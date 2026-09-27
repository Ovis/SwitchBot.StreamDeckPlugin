import streamDeck, { action, type DidReceiveSettingsEvent, type KeyDownEvent, type WillAppearEvent, type WillDisappearEvent } from "@elgato/streamdeck";
import type { RequestExecutor } from "../execution/request-executor.js";
import { AuthenticatedAction } from "./authenticated-action.js";
import type { OutputProcessor } from "../output/output-processor.js";
import type { DeviceCatalogStore } from "../settings/device-catalog-store.js";
import type { CatalogRefreshService } from "../services/catalog-refresh-service.js";
import { normalizeGetStatusSettings, type GetStatusSettingsV1 } from "../settings/get-status-settings.js";
import { displayLocale, formatStatusForKey, localizeDeviceLabel, type DisplayLocale } from "../output/status-title-formatter.js";

@action({ UUID: "com.esheep.switchbot.get-status" })
export class GetStatusAction extends AuthenticatedAction {
  private readonly locale: DisplayLocale;
  private readonly restoreTimers = new Map<string, ReturnType<typeof setTimeout>>();
  constructor(
    private readonly executor: RequestExecutor,
    private readonly output: OutputProcessor,
    private readonly catalogStore: DeviceCatalogStore,
    private readonly catalogRefresh: CatalogRefreshService,
    locale?: string
  ) {
    super(executor);
    this.locale = displayLocale(locale);
  }

  override async onWillAppear(ev: WillAppearEvent<GetStatusSettingsV1>): Promise<void> {
    if (!ev.action.isKey()) return;
    const settings = normalizeGetStatusSettings(ev.payload.settings);
    await ev.action.setTitle(settings.buttonName);
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<GetStatusSettingsV1>): Promise<void> {
    this.clearRestoreTimer(ev.action.id);
    if (!ev.action.isKey()) return;
    const settings = normalizeGetStatusSettings(ev.payload.settings);
    await ev.action.setTitle(settings.buttonName);
  }

  override onWillDisappear(ev: WillDisappearEvent<GetStatusSettingsV1>): void {
    this.clearRestoreTimer(ev.action.id);
  }

  override async onSendToPlugin(ev: any): Promise<void> {
    if (ev.payload?.event === "getDevices") {
      const catalog = ev.payload?.isRefresh
        ? await this.catalogRefresh.refreshDevices() ?? await this.catalogStore.get()
        : await this.catalogStore.get();
      const actionInstance = streamDeck.actions.getActionById(ev.context);
      const settings = actionInstance
        ? normalizeGetStatusSettings(await actionInstance.getSettings())
        : normalizeGetStatusSettings({});
      await streamDeck.ui.sendToPropertyInspector({
        event: "getDevices",
        items: selectableDevices(catalog?.devices ?? [], settings.deviceId).map(device => ({
          label: localizeDeviceLabel(device.deviceName, device.deviceType, device.deviceId, device.deleted, this.locale),
          value: device.deviceId
        }))
      });
      return;
    }

    await super.onSendToPlugin(ev);
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

    if (!result.success) {
      streamDeck.logger.error("Get Status failed", {
        category: result.error?.category,
        method: result.request.method,
        path: result.request.path,
        httpStatus: result.response?.httpStatus,
        switchBotStatus: result.response?.switchBot?.statusCode
      });
    }

    if (result.success && settings.output.showStatusOnKey) {
      const title = formatStatusForKey(result.response?.body, this.locale);
      if (title) {
        this.clearRestoreTimer(ev.action.id);
        await ev.action.setTitle(title);
        this.restoreTimers.set(ev.action.id, setTimeout(() => {
          this.restoreTimers.delete(ev.action.id);
          void ev.action.setTitle(settings.buttonName);
        }, 15_000));
      }
    } else if (result.success) {
      this.clearRestoreTimer(ev.action.id);
      await ev.action.setTitle(settings.buttonName);
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
