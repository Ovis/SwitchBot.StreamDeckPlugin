import streamDeck, { action, type KeyDownEvent } from "@elgato/streamdeck";
import type { RequestExecutor } from "../execution/request-executor.js";
import type { ExecutionDiagnosticsStore } from "../execution/execution-diagnostics-store.js";
import type { OutputProcessor } from "../output/output-processor.js";
import type { DeviceCatalogStore } from "../settings/device-catalog-store.js";
import type { CatalogRefreshService } from "../services/catalog-refresh-service.js";
import type { GlobalSettingsStore } from "../settings/global-settings-store.js";
import { loadPropertyInspectorCatalog } from "../services/property-inspector-catalog-lifecycle.js";
import { normalizeBotControlSettings, type BotControlSettingsV1 } from "../settings/bot-control-settings.js";
import { propertyInspectorMessage } from "../settings/property-inspector-messages.js";
import { parsePropertyInspectorToPluginMessage, type PhysicalControlCatalogMessage } from "../protocol/property-inspector-protocol.js";
import { physicalDeviceDefinition, supportsPhysicalAction } from "../physical-control/physical-control-catalog.js";
import { buildPhysicalCommand } from "../physical-control/physical-command-builder.js";
import { displayLocale, localizeDeviceLabel, type DisplayLocale } from "../output/status-title-formatter.js";
import { AuthenticatedAction } from "./authenticated-action.js";

@action({ UUID: "com.esheep.switchbot.bot-control" })
export class BotControlAction extends AuthenticatedAction {
  private readonly locale: DisplayLocale;

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
        value: operation.id
      })),
      refreshFailed: result.refreshFailed
    };
    await streamDeck.ui.sendToPropertyInspector({ ...message });
  }

  override async onKeyDown(ev: KeyDownEvent<BotControlSettingsV1>): Promise<void> {
    const settings = normalizeBotControlSettings(await ev.action.getSettings());
    const catalog = await this.catalogStore.get();
    const selected = catalog?.devices.find(device => device.deviceId === settings.deviceId);
    if (!selected || selected.deviceType !== settings.deviceType || !supportsPhysicalAction(selected.deviceType, "bot")) {
      streamDeck.logger.error("Bot Control failed", { category: "configuration", reason: "device-type-mismatch" });
      await ev.action.showAlert();
      return;
    }
    const built = buildPhysicalCommand({ action: "bot", ...settings });
    if (!built.request) {
      streamDeck.logger.error("Bot Control failed", { category: "configuration", reason: built.error ?? "invalid-request" });
      await ev.action.showAlert();
      return;
    }
    const result = await this.executor.execute(built.request);
    this.recordExecutionDiagnostics(ev.action.id, result);
    await this.output.process(result, { copyResponseToClipboard: false, prettyPrint: true }, ev.action);
  }
}
