import streamDeck, { type Action, type DidReceiveSettingsEvent, type KeyDownEvent, type WillAppearEvent, type WillDisappearEvent } from "@elgato/streamdeck";
import type { RequestExecutor } from "../execution/request-executor.js";
import type { ExecutionDiagnosticsStore } from "../execution/execution-diagnostics-store.js";
import type { ExecutionRequest } from "../execution/execution-request.js";
import type { ExecutionErrorCategory } from "../execution/execution-result.js";
import type { OutputProcessor } from "../output/output-processor.js";
import type { DeviceCatalogStore } from "../settings/device-catalog-store.js";
import type { CatalogRefreshService } from "../services/catalog-refresh-service.js";
import type { GlobalSettingsStore } from "../settings/global-settings-store.js";
import { ActionInstanceFifo } from "../execution/action-instance-fifo.js";
import { loadPropertyInspectorCatalog } from "../services/property-inspector-catalog-lifecycle.js";
import { normalizePhysicalControlSettings, type PhysicalControlSettingsV1 } from "../settings/physical-control-settings.js";
import { propertyInspectorMessage } from "../settings/property-inspector-messages.js";
import { parsePropertyInspectorToPluginMessage, type PhysicalControlCatalogMessage } from "../protocol/property-inspector-protocol.js";
import { physicalDeviceDefinition, supportsPhysicalAction, type PhysicalControlActionId } from "../physical-control/physical-control-catalog.js";
import { buildPhysicalCommand, physicalCommandBody } from "../physical-control/physical-command-builder.js";
import { displayLocale, localizeDeviceLabel, type DisplayLocale } from "../output/status-title-formatter.js";
import { AuthenticatedAction } from "./authenticated-action.js";

interface QueuedPhysicalCommand {
  request: ExecutionRequest;
  displayText: string;
  action: KeyDownEvent<PhysicalControlSettingsV1>["action"];
}

const MAX_QUEUED_COMMANDS = 5;
const SUCCESS_TITLE_MS = 3_000;
const FAILURE_TITLE_MS = 5_000;

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
    this.clearTemporaryTitle(ev.action.id);
    await this.updateNormalTitle(ev.action, normalizePhysicalControlSettings(ev.payload.settings));
  }

  override async onSendToPlugin(value: unknown): Promise<void> {
    const ev = propertyInspectorMessage(value);
    const request = parsePropertyInspectorToPluginMessage(ev.payload);
    if (request?.event !== "getPhysicalControlCatalog") {
      await super.onSendToPlugin(value);
      return;
    }

    const actionInstance = typeof ev.context === "string" ? streamDeck.actions.getActionById(ev.context) : undefined;
    const settings = normalizePhysicalControlSettings(actionInstance ? await actionInstance.getSettings() : {});
    const result = await loadPropertyInspectorCatalog({
      isRefresh: request.isRefresh === true,
      loadCached: () => this.catalogStore.get(),
      refresh: () => this.catalogRefresh.refreshDevices()
    });
    const devices = (result.catalog?.devices ?? [])
      .filter(device => supportsPhysicalAction(device.deviceType, this.physicalActionId))
      .filter(device => !device.deleted || device.deviceId === settings.deviceId)
      .map(device => ({
        label: localizeDeviceLabel(device.deviceName, device.deviceType, device.deviceId, device.deleted, this.locale),
        value: device.deviceId,
        deviceType: device.deviceType
      }));
    const operations = physicalDeviceDefinition(settings.deviceType)?.operations ?? [];
    const message: PhysicalControlCatalogMessage = {
      event: "physicalControlCatalog",
      devices,
      operations: operations.map(operation => ({
        label: this.locale === "ja" ? operation.label.ja : operation.label.en,
        value: operation.id,
        requestBody: (() => {
          const built = buildPhysicalCommand({
            action: this.physicalActionId,
            deviceId: settings.deviceId,
            deviceType: settings.deviceType,
            operationId: operation.id
          });
          return built.command ? physicalCommandBody(built.command, true) : "";
        })()
      })),
      refreshFailed: result.refreshFailed
    };
    await streamDeck.ui.sendToPropertyInspector({ ...message });
  }

  override async onKeyDown(ev: KeyDownEvent<PhysicalControlSettingsV1>): Promise<void> {
    const settings = normalizePhysicalControlSettings(await ev.action.getSettings());
    const catalog = await this.catalogStore.get();
    const selected = catalog?.devices.find(device => device.deviceId === settings.deviceId);
    if (!selected || selected.deleted || selected.deviceType !== settings.deviceType || !supportsPhysicalAction(selected.deviceType, this.physicalActionId)) {
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
    const displayText = operation
      ? (this.locale === "ja" ? operation.label.ja : operation.label.en)
      : built.displayText ?? settings.operationId;
    if (this.commandQueue.enqueue(ev.action.id, { request: built.request, displayText, action: ev.action }) === "full") {
      streamDeck.logger.warn("Physical Control command queue is full", { actionId: ev.action.id, limit: MAX_QUEUED_COMMANDS });
      await ev.action.showAlert();
    }
  }

  override onWillDisappear(ev: WillDisappearEvent<PhysicalControlSettingsV1>): void {
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
      void this.updateNormalTitleFromCurrentSettings(actionInstance);
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
    if (!device || !operation) {
      await actionInstance.setTitle();
      return;
    }

    // Stream Deckではユーザー定義タイトルがsetTitleより優先されるため、
    // 通常時はプラグイン側の既定表示だけをDevice名 + Operation名へ更新する。
    const operationLabel = this.locale === "ja" ? operation.label.ja : operation.label.en;
    await actionInstance.setTitle(`${device.deviceName.trim() || device.deviceType}\n${operationLabel}`);
  }
}
