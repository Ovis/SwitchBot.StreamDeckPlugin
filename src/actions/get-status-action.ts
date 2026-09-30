import streamDeck, { action, type DidReceiveSettingsEvent, type KeyDownEvent, type WillAppearEvent, type WillDisappearEvent } from "@elgato/streamdeck";
import type { RequestExecutor } from "../execution/request-executor.js";
import type { ExecutionResult } from "../execution/execution-result.js";
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
type GetStatusKeyAction = KeyDownEvent<GetStatusSettingsV1>["action"];

@action({ UUID: "com.esheep.switchbot.get-status" })
export class GetStatusAction extends AuthenticatedAction {
  private readonly locale: DisplayLocale;
  private readonly restoreTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly refreshTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly inFlightRequests = new Map<string, { deviceId: string; request: Promise<ExecutionResult> }>();
  private readonly generations = new Map<string, number>();

  constructor(
    private readonly executor: RequestExecutor,
    private readonly output: OutputProcessor,
    private readonly catalogStore: DeviceCatalogStore,
    private readonly catalogRefresh: CatalogRefreshService,
    private readonly statusGlobalSettings: GlobalSettingsStore,
    executionDiagnostics: ExecutionDiagnosticsStore,
    locale?: string
  ) {
    super(executor, statusGlobalSettings, executionDiagnostics);
    this.locale = displayLocale(locale);
  }

  override async onWillAppear(ev: WillAppearEvent<GetStatusSettingsV1>): Promise<void> {
    if (!ev.action.isKey()) return;
    const settings = normalizeGetStatusSettings(ev.payload.settings);
    const generation = this.nextGeneration(ev.action.id);
    await ev.action.setTitle(settings.buttonName);
    await ev.action.setImage();

    if (this.shouldAutoRefresh(settings)) {
      await this.performAutomaticRefresh(ev.action, settings, generation);
    }
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<GetStatusSettingsV1>): Promise<void> {
    this.clearRestoreTimer(ev.action.id);
    this.clearRefreshTimer(ev.action.id);
    if (!ev.action.isKey()) return;

    const generation = this.nextGeneration(ev.action.id);
    const settings = normalizeGetStatusSettings(ev.payload.settings);
    // 設定変更前のデバイスから取得した値を現在値として見せないため、いったん通常表示へ戻す。
    await ev.action.setTitle(settings.buttonName);
    await ev.action.setImage();

    if (this.shouldAutoRefresh(settings)) {
      await this.performAutomaticRefresh(ev.action, settings, generation);
    }
  }

  override onWillDisappear(ev: WillDisappearEvent<GetStatusSettingsV1>): void {
    super.onWillDisappear(ev);
    this.clearRestoreTimer(ev.action.id);
    this.clearRefreshTimer(ev.action.id);
    this.nextGeneration(ev.action.id);
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

    // 手動取得を新しい周期の起点とし、直後に定期取得が重ならないようタイマーを張り直す。
    this.clearRefreshTimer(ev.action.id);
    const generation = this.currentGeneration(ev.action.id);
    if (this.shouldAutoRefresh(settings)) {
      this.scheduleAutomaticRefresh(ev.action, settings, generation);
    }

    const result = await this.getStatus(ev.action.id, deviceId);
    this.recordExecutionDiagnostics(ev.action.id, result);
    this.logFailure(result);

    if (result.success) {
      await this.rememberObservedFields(deviceId, result.response.body);
    }

    // 設定変更や画面遷移の途中で完了した古いリクエストは、現在のキー表示を上書きしない。
    if (generation !== this.currentGeneration(ev.action.id)) return;

    if (result.success && settings.output.showStatusOnKey) {
      const title = formatStatusTemplate(result.response.body, settings.output.statusTemplate, this.locale);
      if (title) {
        this.clearRestoreTimer(ev.action.id);
        if (settings.output.refreshIntervalMinutes > 0) {
          // 定期更新時はStatusを通常表示として扱うため、結果表示用の一時アイコンへ切り替えない。
          await ev.action.setImage();
          await ev.action.setTitle(title);
        } else {
          // 手動のみの場合は従来どおり15秒間だけ結果表示に切り替える。
          await ev.action.setImage(STATUS_RESULT_KEY_IMAGE);
          await ev.action.setTitle(title);
          this.restoreTimers.set(ev.action.id, setTimeout(() => {
            this.restoreTimers.delete(ev.action.id);
            void this.restoreNormalAppearance(ev.action);
          }, 15_000));
        }
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

  private async performAutomaticRefresh(
    actionInstance: GetStatusKeyAction,
    settings: GetStatusSettingsV1,
    generation: number
  ): Promise<void> {
    const deviceId = settings.deviceId.trim();
    if (!deviceId || generation !== this.currentGeneration(actionInstance.id)) return;

    const result = await this.getStatus(actionInstance.id, deviceId);
    if (generation !== this.currentGeneration(actionInstance.id)) return;

    this.recordExecutionDiagnostics(actionInstance.id, result);
    this.logFailure(result);

    if (result.success) {
      await this.rememberObservedFields(deviceId, result.response.body);
      const title = formatStatusTemplate(result.response.body, settings.output.statusTemplate, this.locale);
      if (title) {
        // 自動更新ではアイコンや成功フィードバックを変更せず、最後の正常なStatusだけを更新する。
        await actionInstance.setTitle(title);
      }
    }

    // 失敗時も最後の正常表示を維持したまま、完了時点から次の周期を開始する。
    if (generation === this.currentGeneration(actionInstance.id)) {
      this.scheduleAutomaticRefresh(actionInstance, settings, generation);
    }
  }

  private scheduleAutomaticRefresh(
    actionInstance: GetStatusKeyAction,
    settings: GetStatusSettingsV1,
    generation: number
  ): void {
    this.clearRefreshTimer(actionInstance.id);
    if (!this.shouldAutoRefresh(settings) || generation !== this.currentGeneration(actionInstance.id)) return;

    this.refreshTimers.set(actionInstance.id, setTimeout(() => {
      this.refreshTimers.delete(actionInstance.id);
      void this.performAutomaticRefresh(actionInstance, settings, generation);
    }, settings.output.refreshIntervalMinutes * 60_000));
  }

  private getStatus(actionId: string, deviceId: string): Promise<ExecutionResult> {
    const existing = this.inFlightRequests.get(actionId);
    // 同一ActionでもPIでDeviceを変更した直後は旧Deviceのリクエストが残り得る。
    // 共有対象を同じDeviceへの取得に限定し、旧レスポンスを新DeviceのStatusとして扱わないようにする。
    if (existing?.deviceId === deviceId) return existing.request;

    const request = this.executor.execute({
      method: "GET",
      path: `/v1.1/devices/${encodeURIComponent(deviceId)}/status`
    });
    this.inFlightRequests.set(actionId, { deviceId, request });
    void request.finally(() => {
      if (this.inFlightRequests.get(actionId)?.request === request) this.inFlightRequests.delete(actionId);
    });
    return request;
  }

  private async rememberObservedFields(deviceId: string, responseBody: unknown): Promise<void> {
    const fields = observedStatusFields(responseBody);
    // 候補は表示設定とは独立して最新の正常レスポンスから更新する。
    // Global Settingsへ保存することで、同じdeviceIdを使う別のGet Statusキーからも共有できる。
    await this.statusGlobalSettings.update(current => ({
      ...current,
      version: 1,
      observedStatusFields: { ...(current.observedStatusFields ?? {}), [deviceId]: fields }
    }));
    await streamDeck.ui.sendToPropertyInspector({ event: "observedStatusFields", deviceId, fields });
  }

  private shouldAutoRefresh(settings: GetStatusSettingsV1): boolean {
    return settings.output.showStatusOnKey
      && settings.output.refreshIntervalMinutes > 0
      && settings.deviceId.trim().length > 0;
  }

  private logFailure(result: ExecutionResult): void {
    if (result.success) return;
    streamDeck.logger.error("Get Status failed", {
      category: result.error.category,
      method: result.request.method,
      path: result.request.path,
      httpStatus: result.response?.httpStatus,
      switchBotStatus: result.response?.switchBot?.statusCode
    });
  }

  private async restoreNormalAppearance(actionInstance: GetStatusKeyAction): Promise<void> {
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

  private currentGeneration(actionId: string): number {
    return this.generations.get(actionId) ?? 0;
  }

  private nextGeneration(actionId: string): number {
    const next = this.currentGeneration(actionId) + 1;
    this.generations.set(actionId, next);
    return next;
  }

  private clearRestoreTimer(actionId: string): void {
    const timer = this.restoreTimers.get(actionId);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.restoreTimers.delete(actionId);
    }
  }

  private clearRefreshTimer(actionId: string): void {
    const timer = this.refreshTimers.get(actionId);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.refreshTimers.delete(actionId);
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
