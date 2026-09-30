import streamDeck, { action, type DidReceiveSettingsEvent, type KeyDownEvent, type WillAppearEvent, type WillDisappearEvent } from "@elgato/streamdeck";
import type { RequestExecutor } from "../execution/request-executor.js";
import type { ExecutionDiagnosticsStore } from "../execution/execution-diagnostics-store.js";
import { AuthenticatedAction } from "./authenticated-action.js";
import type { OutputProcessor } from "../output/output-processor.js";
import type { DeviceCatalogStore } from "../settings/device-catalog-store.js";
import type { CatalogRefreshService } from "../services/catalog-refresh-service.js";
import { loadPropertyInspectorCatalog } from "../services/property-inspector-catalog-lifecycle.js";
import type { GlobalSettingsStore } from "../settings/global-settings-store.js";
import { propertyInspectorMessage } from "../settings/property-inspector-messages.js";
import { parsePropertyInspectorToPluginMessage } from "../protocol/property-inspector-protocol.js";
import { normalizeGetStatusSettings, type GetStatusSettingsV1 } from "../settings/get-status-settings.js";
import { displayLocale, formatStatusTemplate, localizeDeviceLabel, observedStatusFields, type DisplayLocale } from "../output/status-title-formatter.js";
import type { DevicesResultMessage } from "../protocol/property-inspector-protocol.js";

const STATUS_RESULT_KEY_IMAGE = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144"><rect width="144" height="144" fill="#000000"/></svg>`)}`;

@action({ UUID: "com.esheep.switchbot.get-status" })
export class GetStatusAction extends AuthenticatedAction {
  private readonly locale: DisplayLocale;
  private readonly restoreTimers = new Map<string, ReturnType<typeof setTimeout>>();
  constructor(
    private readonly executor: RequestExecutor,
    private readonly output: OutputProcessor,
    private readonly catalogStore: DeviceCatalogStore,
    private readonly catalogRefresh: CatalogRefreshService,
    private readonly globalSettings: GlobalSettingsStore,
    executionDiagnostics: ExecutionDiagnosticsStore,
    locale?: string
  ) {
    super(executor, globalSettings, executionDiagnostics);
    this.locale = displayLocale(locale);
  }

  override async onWillAppear(ev: WillAppearEvent<GetStatusSettingsV1>): Promise<void> {
    if (!ev.action.isKey()) return;
    const settings = normalizeGetStatusSettings(ev.payload.settings);
    await ev.action.setTitle(settings.buttonName);
    await ev.action.setImage();
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<GetStatusSettingsV1>): Promise<void> {
    this.clearRestoreTimer(ev.action.id);
    if (!ev.action.isKey()) return;
    const settings = normalizeGetStatusSettings(ev.payload.settings);
    await ev.action.setTitle(settings.buttonName);
    // 設定変更で一時表示タイマーを破棄した場合も、結果表示用の透明画像が残らないよう既定画像へ戻す。
    await ev.action.setImage();
  }

  override onWillDisappear(ev: WillDisappearEvent<GetStatusSettingsV1>): void {
    super.onWillDisappear(ev);
    this.clearRestoreTimer(ev.action.id);
  }

  override async onSendToPlugin(value: unknown): Promise<void> {
    const ev = propertyInspectorMessage(value);
    const request = parsePropertyInspectorToPluginMessage(ev.payload);
    if (request?.event === "getDevices") {
      const refresh = request.isRefresh === true;
      const result = await loadPropertyInspectorCatalog({
        isRefresh: refresh,
        loadCached: () => this.catalogStore.get(),
        refresh: () => this.catalogRefresh.refreshDevices()
      });
      const actionInstance = typeof ev.context === "string" ? streamDeck.actions.getActionById(ev.context) : undefined;
      const settings = actionInstance
        ? normalizeGetStatusSettings(await actionInstance.getSettings())
        : normalizeGetStatusSettings({});
      const message: DevicesResultMessage = {
        event: "getDevices",
        items: selectableDevices(result.catalog?.devices ?? [], settings.deviceId).map(device => ({
          label: localizeDeviceLabel(device.deviceName, device.deviceType, device.deviceId, device.deleted, this.locale),
          value: device.deviceId
        })),
        refreshFailed: result.refreshFailed
      };
      await streamDeck.ui.sendToPropertyInspector({ ...message });
      return;
    }

    await super.onSendToPlugin(value);
  }

  override async onKeyDown(ev: KeyDownEvent<GetStatusSettingsV1>): Promise<void> {
    const settings = normalizeGetStatusSettings(await ev.action.getSettings());
    const deviceId = settings.deviceId.trim();

    if (!deviceId) {
      streamDeck.logger.error("Get Status failed", { category: "configuration", reason: "missing-device-id" });
      await ev.action.showAlert();
      return;
    }

    const result = await this.executor.execute({
      method: "GET",
      path: `/v1.1/devices/${encodeURIComponent(deviceId)}/status`
    });
    this.recordExecutionDiagnostics(ev.action.id, result);

    if (!result.success) {
      streamDeck.logger.error("Get Status failed", {
        category: result.error.category,
        method: result.request.method,
        path: result.request.path,
        httpStatus: result.response?.httpStatus,
        switchBotStatus: result.response?.switchBot?.statusCode
      });
    }

    if (result.success) {
      const fields = observedStatusFields(result.response.body);
      // 候補は表示設定とは独立して最新の正常レスポンスから更新する。
      // Global Settingsへ保存することで、同じdeviceIdを使う別のGet Statusキーからも共有できる。
      await this.globalSettings.update(current => ({
        ...current,
        version: 1,
        observedStatusFields: { ...(current.observedStatusFields ?? {}), [deviceId]: fields }
      }));
      await streamDeck.ui.sendToPropertyInspector({ event: "observedStatusFields", deviceId, fields });
    }

    if (result.success && settings.output.showStatusOnKey) {
      const title = formatStatusTemplate(result.response.body, settings.output.statusTemplate, this.locale);
      if (title) {
        this.clearRestoreTimer(ev.action.id);
        // Stream Deckでは透明なruntime画像の背後にmanifestのState画像が見えるため、
        // ステータス文字列の表示中は黒一色の画像でアイコンを覆い、文字の可読性を確保する。
        // 引数なしのsetImageでmanifestの画像へ戻せるので、元画像のパスをAction側で重複管理しない。
        await ev.action.setImage(STATUS_RESULT_KEY_IMAGE);
        await ev.action.setTitle(title);
        this.restoreTimers.set(ev.action.id, setTimeout(() => {
          this.restoreTimers.delete(ev.action.id);
          void this.restoreNormalAppearance(ev.action);
        }, 15_000));
      }
    } else if (result.success) {
      this.clearRestoreTimer(ev.action.id);
      await ev.action.setTitle(settings.buttonName);
      await ev.action.setImage();
    }

    await this.output.process(
      result,
      {
        copyResponseToClipboard: settings.output.copyResponseToClipboard,
        prettyPrint: settings.output.prettyPrint,
        showSuccessFeedback: false
      },
      ev.action
    );
  }
  private async restoreNormalAppearance(actionInstance: KeyDownEvent<GetStatusSettingsV1>["action"]): Promise<void> {
    try {
      // 一時表示中にPIでbuttonNameが変更される場合があるため、押下時のsnapshotではなく現在設定から復元する。
      const current = normalizeGetStatusSettings(await actionInstance.getSettings());
      await actionInstance.setTitle(current.buttonName);
      await actionInstance.setImage();
    } catch (error) {
      streamDeck.logger.warn("Failed to restore Get Status button appearance", {
        errorName: error instanceof Error ? error.name : "UnknownError"
      });
    }
  }

  private clearRestoreTimer(actionId: string): void {
    const timer = this.restoreTimers.get(actionId);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.restoreTimers.delete(actionId);
    }
  }
}

export interface SelectableDevice {
  deviceId: string;
  deviceName: string;
  deviceType: string;
  deleted: boolean;
}

export function selectableDevices<T extends SelectableDevice>(devices: readonly T[], selectedDeviceId: string): T[] {
  const selected = selectedDeviceId.trim();
  return devices.filter(device => !device.deleted || device.deviceId === selected);
}
