import streamDeck, { type Action, type DidReceiveSettingsEvent, type KeyDownEvent, type WillAppearEvent, type WillDisappearEvent   } from "@elgato/streamdeck";
import type { RequestExecutor } from "../execution/request-executor.js";
import type { ExecutionDiagnosticsStore } from "../execution/execution-diagnostics-store.js";
import type { ExecutionRequest } from "../execution/execution-request.js";
import type { ExecutionErrorCategory } from "../execution/execution-result.js";
import type { OutputProcessor } from "../output/output-processor.js";
import type { DeviceCatalogStore } from "../settings/device-catalog-store.js";
import type { DeviceCatalog } from "../settings/device-catalog.js";
import type { CatalogRefreshService } from "../services/catalog-refresh-service.js";
import type { GlobalSettingsStore } from "../settings/global-settings-store.js";
import { ActionInstanceFifo } from "../execution/action-instance-fifo.js";
import { loadPropertyInspectorCatalog } from "../services/property-inspector-catalog-lifecycle.js";
import { normalizePhysicalControlSettings, type PhysicalControlSettingsV1 } from "../settings/physical-control-settings.js";
import { parsePropertyInspectorToPluginMessage, type PhysicalControlCatalogMessage, type PhysicalControlOperationParameterItem } from "../protocol/property-inspector-protocol.js";
import { physicalDeviceDefinition, supportsPhysicalAction, type PhysicalControlActionId } from "../physical-control/physical-control-catalog.js";
import { buildPhysicalCommand, physicalCommandBody } from "../physical-control/physical-command-builder.js";
import { PhysicalControlConfirmationGate } from "../physical-control/physical-control-confirmation-gate.js";
import { displayLocale, localizeDeviceLabel, type DisplayLocale } from "../output/status-title-formatter.js";
import { AuthenticatedAction, type PropertyInspectorEvent } from "./authenticated-action.js";

interface QueuedPhysicalCommand {
  request: ExecutionRequest;
  displayText: string;
  action: KeyDownEvent<PhysicalControlSettingsV1>["action"];
}

const MAX_QUEUED_COMMANDS = 5;
const SUCCESS_TITLE_MS = 3_000;
const FAILURE_TITLE_MS = 5_000;

/**
 * 危険操作の確認を省略できるかを判定する。
 *
 * ユーザー設定で省略可能なのは通常のunlockだけに限定し、deadboltやnight latch、
 * Garage Doorなど他の確認必須操作へ設定が波及しないよう明示的に判定する。
 */
export function shouldSkipPhysicalControlConfirmation(
  skipUnlockConfirmation: boolean,
  operationId: string
): boolean {
  return skipUnlockConfirmation && operationId === "unlock";
}

/**
 * SwitchBot物理デバイスの日常操作に共通する実行・Catalog・feedback処理を提供する。
 *
 * 製品カテゴリ固有のActionはこのクラスへPhysicalControlActionIdを渡すだけに留め、
 * Control Commandの差異はPhysical Device Catalog側で宣言的に管理する。
 */
export class PhysicalControlAction extends AuthenticatedAction {
  private readonly locale: DisplayLocale;
  private readonly commandQueue: ActionInstanceFifo<QueuedPhysicalCommand>;
  private readonly restoreTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly confirmationGate = new PhysicalControlConfirmationGate();

  constructor(
    private readonly physicalActionId: PhysicalControlActionId,
    private readonly executor: RequestExecutor,
    private readonly output: OutputProcessor,
    private readonly catalogStore: DeviceCatalogStore,
    private readonly catalogRefresh: CatalogRefreshService,
    globalSettings: GlobalSettingsStore,
    executionDiagnostics: ExecutionDiagnosticsStore,
    locale?: string
  ) {
    super(executor, globalSettings, executionDiagnostics);
    this.locale = displayLocale(locale);
    this.commandQueue = new ActionInstanceFifo(
      MAX_QUEUED_COMMANDS,
      (actionId, item, isDisposed) => this.executeQueuedCommand(actionId, item, isDisposed),
      (actionId, error) => {
        streamDeck.logger.error("Physical Control queue item failed unexpectedly", {
          actionId,
          errorName: error instanceof Error ? error.name : "UnknownError"
        });
      }
    );
  }

  override async onWillAppear(ev: WillAppearEvent<PhysicalControlSettingsV1>): Promise<void> {
    await this.updateNormalTitle(ev.action, normalizePhysicalControlSettings(ev.payload.settings));
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<PhysicalControlSettingsV1>): Promise<void> {
    this.confirmationGate.clear(ev.action.id);
    this.clearTemporaryTitle(ev.action.id);
    await this.updateNormalTitle(ev.action, normalizePhysicalControlSettings(ev.payload.settings));
  }

  override async onSendToPlugin(ev: PropertyInspectorEvent): Promise<void> {
    const request = parsePropertyInspectorToPluginMessage(ev.payload);
    if (request?.event !== "getPhysicalControlCatalog") {
      await super.onSendToPlugin(ev);
      return;
    }

    const actionInstance = ev.action;
    let settings = normalizePhysicalControlSettings(actionInstance ? await actionInstance.getSettings() : {});
    const result = await loadPropertyInspectorCatalog({
      isRefresh: request.isRefresh === true,
      loadCached: () => this.catalogStore.get(),
      refresh: () => this.catalogRefresh.refreshDevices()
    });
    // PIが現在選択しているDeviceを優先する。setSettings直後のSDK反映タイミングに依存せず、
    // catalog上の実データからdeviceTypeとOperationを決定するためである。
    const selectedDeviceId = request.deviceId?.trim() || settings.deviceId;
    const selectedCatalogDevice = result.catalog?.devices.find(device => device.deviceId === selectedDeviceId);

    // PR開発途中などdeviceType導入前に保存された設定は、deviceIdだけが残っている場合がある。
    // /devicesで同じIDの対応デバイスを確認できた場合に限ってtypeを補完し、
    // 未知typeや既存typeの不一致を推測で上書きすることはしない。
    if (selectedCatalogDevice && !selectedCatalogDevice.deleted
      && supportsPhysicalAction(selectedCatalogDevice.deviceType, this.physicalActionId)
      && (settings.deviceId !== selectedDeviceId || settings.deviceType === "")) {
      const deviceChanged = settings.deviceId !== selectedDeviceId;
      const requestedOperationId = request.operationId?.trim() || settings.operationId;
      const requestedOperationSupported = physicalDeviceDefinition(selectedCatalogDevice.deviceType)
        ?.operations.some(operation => operation.id === requestedOperationId) === true;
      settings = {
        ...settings,
        deviceId: selectedDeviceId,
        deviceType: selectedCatalogDevice.deviceType,
        // Device変更ではparameterを必ず破棄する一方、同じOperation IDが新Deviceでも有効なら維持する。
        // 先頭Operationへの自動fallbackは行わず、非対応なら未選択へ戻してfail closedする。
        ...(deviceChanged ? {
          operationId: requestedOperationSupported ? requestedOperationId : "",
          operationParameters: {}
        } : {})
      };
      if (actionInstance) await actionInstance.setSettings(settings);
    }

    const effectiveDeviceType = selectedCatalogDevice?.deviceType ?? settings.deviceType;
    const effectiveDefinition = physicalDeviceDefinition(effectiveDeviceType);
    if (selectedCatalogDevice && !selectedCatalogDevice.deleted
      && supportsPhysicalAction(effectiveDeviceType, this.physicalActionId)
      && settings.operationId !== ""
      && !effectiveDefinition?.operations.some(operation => operation.id === settings.operationId)) {
      // PIがDevice選択を先に保存した場合でも、catalogを基準に旧Operationの有効性を再検証する。
      // 非対応Operationを先頭候補へ置換せず空へ戻すことで、別commandの意図しない実行を防ぐ。
      settings = { ...settings, operationId: "", operationParameters: {} };
      if (actionInstance) await actionInstance.setSettings(settings);
    }
    const configurationInvalid = selectedDeviceId !== "" && (
      !selectedCatalogDevice
      || selectedCatalogDevice.deleted
      || !supportsPhysicalAction(effectiveDeviceType, this.physicalActionId)
      || (settings.deviceType !== "" && settings.deviceId === selectedDeviceId && settings.deviceType !== effectiveDeviceType)
    );
    const devices = (result.catalog?.devices ?? [])
      .filter(device => supportsPhysicalAction(device.deviceType, this.physicalActionId))
      .filter(device => !device.deleted || device.deviceId === settings.deviceId)
      .map(device => ({
        label: localizeDeviceLabel(device.deviceName, device.deviceType, device.deviceId, device.deleted, this.locale),
        value: device.deviceId,
        deviceType: device.deviceType
      }));
    const operations = configurationInvalid || selectedDeviceId === ""
      ? []
      : (physicalDeviceDefinition(effectiveDeviceType)?.operations ?? []);

    const message: PhysicalControlCatalogMessage = {
      event: "physicalControlCatalog",
      devices,
      selectedDeviceId,
      operations: operations.map(operation => {
        const localizeInput = (input: NonNullable<typeof operation.input>): PhysicalControlOperationParameterItem => {
          const label = this.locale === "ja" ? input.label.ja : input.label.en;
          if (input.kind === "number") {
            return {
              kind: "number", key: input.key, label,
              min: input.min, max: input.max, step: input.step,
              ...(input.unit ? { unit: input.unit } : {})
            };
          }
          if (input.kind === "rgb") return { kind: "rgb", key: input.key, label };
          return {
            kind: "select", key: input.key, label,
            options: input.options.map(option => ({
              label: this.locale === "ja" ? option.label.ja : option.label.en,
              value: option.value
            }))
          };
        };
        return {
        label: this.locale === "ja" ? operation.label.ja : operation.label.en,
        value: operation.id,
        ...(operation.input ? { input: localizeInput(operation.input) } : {}),
        ...(operation.inputs ? { inputs: operation.inputs.map(localizeInput) } : {}),
        requestBody: (() => {
          const operationParameters = request.operationId === operation.id ? request.operationParameters : undefined;
          const built = buildPhysicalCommand({
            action: this.physicalActionId,
            deviceId: selectedDeviceId,
            deviceType: effectiveDeviceType,
            operationId: operation.id,
            ...(operationParameters ? { operationParameters } : {})
          });
          return built.command ? physicalCommandBody(built.command, true) : "";
        })()
      };
      }),
      refreshFailed: result.refreshFailed,
      ...(result.refreshFailure ? { refreshFailure: result.refreshFailure } : {}),
      configurationInvalid
    };
    await this.sendToPropertyInspectorIfCurrent(ev.action.id, message);
  }

  override async onKeyDown(ev: KeyDownEvent<PhysicalControlSettingsV1>): Promise<void> {
    const settings = normalizePhysicalControlSettings(await ev.action.getSettings());
    const catalog = await this.catalogStore.get();
    const selected = catalog?.devices.find(device => device.deviceId === settings.deviceId);
    if (!this.isAvailableSelectedDevice(selected, settings)) {
      streamDeck.logger.error("Physical Control failed", { category: "configuration", reason: "device-unavailable-or-type-mismatch" });
      await ev.action.showAlert();
      await this.showTemporaryTitle(ev.action.id, ev.action, this.failureTitle("configuration"), FAILURE_TITLE_MS);
      return;
    }

    const built = buildPhysicalCommand({ action: this.physicalActionId, ...settings });
    if (!built.request) {
      streamDeck.logger.error("Physical Control failed", { category: "configuration", reason: built.error ?? "invalid-request" });
      await ev.action.showAlert();
      await this.showTemporaryTitle(ev.action.id, ev.action, this.failureTitle("configuration"), FAILURE_TITLE_MS);
      return;
    }

    const operation = physicalDeviceDefinition(settings.deviceType)?.operations.find(candidate => candidate.id === settings.operationId);
    const skipConfirmation = shouldSkipPhysicalControlConfirmation(
      settings.skipUnlockConfirmation === true,
      settings.operationId
    );
    if (operation?.confirmationRequired && !skipConfirmation) {
      const confirmationKey = `${settings.deviceId}:${settings.deviceType}:${settings.operationId}`;
      if (this.confirmationGate.confirm(ev.action.id, confirmationKey) === "required") {
        await this.showTemporaryTitle(
          ev.action.id,
          ev.action,
          this.locale === "ja" ? "再押下で\n実行" : "Press again\nto confirm",
          3_000
        );
        return;
      }
      this.clearTemporaryTitle(ev.action.id);
    }

    const displayText = operation
      ? (this.locale === "ja" ? operation.label.ja : operation.label.en)
      : built.displayText ?? settings.operationId;
    if (this.commandQueue.enqueue(ev.action.id, { request: built.request, displayText, action: ev.action }) === "full") {
      streamDeck.logger.warn("Physical Control command queue is full", { actionId: ev.action.id, limit: MAX_QUEUED_COMMANDS });
      await ev.action.showAlert();
    }
  }

  override onWillDisappear(ev: WillDisappearEvent<PhysicalControlSettingsV1>): void {
    super.onWillDisappear(ev);
    this.confirmationGate.clear(ev.action.id);
    this.commandQueue.dispose(ev.action.id);
    this.clearTemporaryTitle(ev.action.id);
  }

  private async executeQueuedCommand(
    actionId: string,
    item: QueuedPhysicalCommand,
    isDisposed: () => boolean
  ): Promise<void> {
    const result = await this.executor.execute(item.request);
    this.recordExecutionDiagnostics(actionId, result);
    if (!result.success) {
      streamDeck.logger.error("Physical Control command failed", {
        category: result.error.category,
        method: result.request.method,
        path: result.request.path,
        httpStatus: result.response?.httpStatus,
        switchBotStatus: result.response?.switchBot?.statusCode
      });
    }
    if (isDisposed()) return;

    const succeeded = await this.output.process(
      result,
      { copyResponseToClipboard: false, prettyPrint: true },
      item.action
    );
    if (!succeeded) {
      if (!result.success) {
        await this.showTemporaryTitle(actionId, item.action, this.failureTitle(result.error.category), FAILURE_TITLE_MS);
      }
      return;
    }

    await this.showTemporaryTitle(actionId, item.action, item.displayText, SUCCESS_TITLE_MS);
  }

  private isAvailableSelectedDevice(
    device: DeviceCatalog["devices"][number] | undefined,
    settings: PhysicalControlSettingsV1
  ): device is DeviceCatalog["devices"][number] {
    return device !== undefined
      && !device.deleted
      && device.deviceType === settings.deviceType
      && supportsPhysicalAction(device.deviceType, this.physicalActionId);
  }

  private async showTemporaryTitle(
    actionId: string,
    actionInstance: KeyDownEvent<PhysicalControlSettingsV1>["action"],
    title: string,
    durationMs: number
  ): Promise<void> {
    this.clearTemporaryTitle(actionId);
    await actionInstance.setTitle(title);
    this.restoreTimers.set(actionId, setTimeout(() => {
      this.restoreTimers.delete(actionId);
      void this.updateNormalTitleFromCurrentSettings(actionInstance).catch(error => {
        // タイマーcallbackはSDKイベントのawait対象外なので、Action破棄などによる失敗を未処理Promiseにしない。
        streamDeck.logger.warn("Failed to restore Physical Control title", {
          errorName: error instanceof Error ? error.name : "UnknownError"
        });
      });
    }, durationMs));
  }

  private failureTitle(category: ExecutionErrorCategory): string {
    const labels: Record<ExecutionErrorCategory, { en: string; ja: string }> = {
      configuration: { en: "Configuration error", ja: "設定エラー" },
      authentication: { en: "Authentication error", ja: "認証エラー" },
      network: { en: "Network error", ja: "通信エラー" },
      http: { en: "HTTP error", ja: "HTTPエラー" },
      switchbot: { en: "SwitchBot error", ja: "SwitchBotエラー" },
      response: { en: "Response error", ja: "応答エラー" },
      internal: { en: "Internal error", ja: "内部エラー" }
    };
    return this.locale === "ja" ? labels[category].ja : labels[category].en;
  }

  private clearTemporaryTitle(actionId: string): void {
    const timer = this.restoreTimers.get(actionId);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.restoreTimers.delete(actionId);
    }
  }

  private async updateNormalTitleFromCurrentSettings(actionInstance: Action<PhysicalControlSettingsV1>): Promise<void> {
    await this.updateNormalTitle(actionInstance, normalizePhysicalControlSettings(await actionInstance.getSettings()));
  }

  private async updateNormalTitle(
    actionInstance: Action<PhysicalControlSettingsV1>,
    settings: PhysicalControlSettingsV1
  ): Promise<void> {
    if (!actionInstance.isKey()) return;
    const catalog = await this.catalogStore.get();
    const device = catalog?.devices.find(candidate => candidate.deviceId === settings.deviceId);
    const operation = physicalDeviceDefinition(settings.deviceType)?.operations.find(candidate => candidate.id === settings.operationId);
    if (!this.isAvailableSelectedDevice(device, settings) || !operation) {
      await actionInstance.setTitle();
      return;
    }

    // Stream Deckではユーザー定義タイトルがsetTitleより優先されるため、
    // 通常時はプラグイン側の既定表示だけをDevice名 + Operation名へ更新する。
    const operationLabel = this.locale === "ja" ? operation.label.ja : operation.label.en;
    await actionInstance.setTitle(`${device.deviceName.trim() || device.deviceType}\n${operationLabel}`);
  }
}
