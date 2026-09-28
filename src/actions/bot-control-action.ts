import streamDeck, { action, type DidReceiveSettingsEvent, type KeyDownEvent, type WillAppearEvent, type WillDisappearEvent } from "@elgato/streamdeck";
import type { RequestExecutor } from "../execution/request-executor.js";
import type { ExecutionDiagnosticsStore } from "../execution/execution-diagnostics-store.js";
import type { ExecutionRequest } from "../execution/execution-request.js";
import type { OutputProcessor } from "../output/output-processor.js";
import type { DeviceCatalogStore } from "../settings/device-catalog-store.js";
import type { CatalogRefreshService } from "../services/catalog-refresh-service.js";
import type { GlobalSettingsStore } from "../settings/global-settings-store.js";
import { ActionInstanceFifo } from "../execution/action-instance-fifo.js";
import { loadPropertyInspectorCatalog } from "../services/property-inspector-catalog-lifecycle.js";
import { normalizeBotControlSettings, type BotControlSettingsV1 } from "../settings/bot-control-settings.js";
import { propertyInspectorMessage } from "../settings/property-inspector-messages.js";
import { parsePropertyInspectorToPluginMessage, type PhysicalControlCatalogMessage } from "../protocol/property-inspector-protocol.js";
import { physicalDeviceDefinition, supportsPhysicalAction } from "../physical-control/physical-control-catalog.js";
import { buildPhysicalCommand } from "../physical-control/physical-command-builder.js";
import { displayLocale, localizeDeviceLabel, type DisplayLocale } from "../output/status-title-formatter.js";
import { AuthenticatedAction } from "./authenticated-action.js";

interface QueuedBotCommand {
  request: ExecutionRequest;
  displayText: string;
  action: KeyDownEvent<BotControlSettingsV1>["action"];
}

const MAX_QUEUED_COMMANDS = 5;
const TEMPORARY_TITLE_MS = 3_000;

@action({ UUID: "com.esheep.switchbot.bot-control" })
export class BotControlAction extends AuthenticatedAction {
  private readonly locale: DisplayLocale;
  private readonly commandQueue: ActionInstanceFifo<QueuedBotCommand>;
  private readonly restoreTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
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
        streamDeck.logger.error("Bot Control queue item failed unexpectedly", {
          actionId,
          errorName: error instanceof Error ? error.name : "UnknownError"
        });
      }
    );
  }

  override async onWillAppear(ev: WillAppearEvent<BotControlSettingsV1>): Promise<void> {
    await this.updateNormalTitle(ev.action, normalizeBotControlSettings(ev.payload.settings));
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<BotControlSettingsV1>): Promise<void> {
    this.clearTemporaryTitle(ev.action.id);
    await this.updateNormalTitle(ev.action, normalizeBotControlSettings(ev.payload.settings));
  }

  override async onSendToPlugin(value: unknown): Promise<void> {
    const ev = propertyInspectorMessage(value);
    const request = parsePropertyInspectorToPluginMessage(ev.payload);
    if (request?.event !== "getPhysicalControlCatalog") {
      await super.onSendToPlugin(value);
      return;
    }

    const actionInstance = typeof ev.context === "string" ? streamDeck.actions.getActionById(ev.context) : undefined;
    const settings = normalizeBotControlSettings(actionInstance ? await actionInstance.getSettings() : {});
    const result = await loadPropertyInspectorCatalog({
      isRefresh: request.isRefresh === true,
      loadCached: () => this.catalogStore.get(),
      refresh: () => this.catalogRefresh.refreshDevices()
    });
    const devices = (result.catalog?.devices ?? [])
      .filter(device => supportsPhysicalAction(device.deviceType, "bot"))
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
        requestBody: JSON.stringify({
          command: operation.command,
          parameter: operation.parameter,
          commandType: operation.commandType
        }, null, 2)
      })),
      refreshFailed: result.refreshFailed
    };
    await streamDeck.ui.sendToPropertyInspector({ ...message });
  }

  override async onKeyDown(ev: KeyDownEvent<BotControlSettingsV1>): Promise<void> {
    const settings = normalizeBotControlSettings(await ev.action.getSettings());
    const catalog = await this.catalogStore.get();
    const selected = catalog?.devices.find(device => device.deviceId === settings.deviceId);
    if (!selected || selected.deleted || selected.deviceType !== settings.deviceType || !supportsPhysicalAction(selected.deviceType, "bot")) {
      streamDeck.logger.error("Bot Control failed", { category: "configuration", reason: "device-unavailable-or-type-mismatch" });
      await ev.action.showAlert();
      return;
    }

    const built = buildPhysicalCommand({ action: "bot", ...settings });
    if (!built.request) {
      streamDeck.logger.error("Bot Control failed", { category: "configuration", reason: built.error ?? "invalid-request" });
      await ev.action.showAlert();
      return;
    }

    const operation = physicalDeviceDefinition(settings.deviceType)?.operations.find(candidate => candidate.id === settings.operationId);
    const displayText = operation
      ? (this.locale === "ja" ? operation.label.ja : operation.label.en)
      : built.displayText ?? settings.operationId;
    if (this.commandQueue.enqueue(ev.action.id, { request: built.request, displayText, action: ev.action }) === "full") {
      streamDeck.logger.warn("Bot Control command queue is full", { actionId: ev.action.id, limit: MAX_QUEUED_COMMANDS });
      await ev.action.showAlert();
    }
  }

  override onWillDisappear(ev: WillDisappearEvent<BotControlSettingsV1>): void {
    this.commandQueue.dispose(ev.action.id);
    this.clearTemporaryTitle(ev.action.id);
  }

  private async executeQueuedCommand(
    actionId: string,
    item: QueuedBotCommand,
    isDisposed: () => boolean
  ): Promise<void> {
    const result = await this.executor.execute(item.request);
    this.recordExecutionDiagnostics(actionId, result);
    if (!result.success) {
      streamDeck.logger.error("Bot Control command failed", {
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
    if (!succeeded) return;

    this.clearTemporaryTitle(actionId);
    await item.action.setTitle(item.displayText);
    this.restoreTimers.set(actionId, setTimeout(() => {
      this.restoreTimers.delete(actionId);
      void this.updateNormalTitleFromCurrentSettings(item.action);
    }, TEMPORARY_TITLE_MS));
  }

  private clearTemporaryTitle(actionId: string): void {
    const timer = this.restoreTimers.get(actionId);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.restoreTimers.delete(actionId);
    }
  }

  private async updateNormalTitleFromCurrentSettings(actionInstance: QueuedBotCommand["action"]): Promise<void> {
    await this.updateNormalTitle(actionInstance, normalizeBotControlSettings(await actionInstance.getSettings()));
  }

  private async updateNormalTitle(
    actionInstance: QueuedBotCommand["action"],
    settings: BotControlSettingsV1
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
