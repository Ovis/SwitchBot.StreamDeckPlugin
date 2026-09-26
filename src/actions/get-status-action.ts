import streamDeck, { action, type KeyDownEvent } from "@elgato/streamdeck";
import type { RequestExecutor } from "../execution/request-executor.js";
import { AuthenticatedAction } from "./authenticated-action.js";
import type { OutputProcessor } from "../output/output-processor.js";
import type { DeviceCatalogStore } from "../settings/device-catalog-store.js";
import { normalizeGetStatusSettings, type GetStatusSettingsV1 } from "../settings/get-status-settings.js";

@action({ UUID: "com.ovis.switchbot.get-status" })
export class GetStatusAction extends AuthenticatedAction {
  constructor(
    private readonly executor: RequestExecutor,
    private readonly output: OutputProcessor,
    private readonly catalogStore: DeviceCatalogStore
  ) {
    super(executor);
  }

  override async onSendToPlugin(ev: any): Promise<void> {
    if (ev.payload?.event === "getDevices") {
      const catalog = await this.catalogStore.get();
      await streamDeck.ui.sendToPropertyInspector({
        event: "getDevices",
        items: (catalog?.devices ?? []).map(device => ({
          label: deviceLabel(device.deviceName, device.deviceType, device.deviceId),
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

    await this.output.process(
      result,
      { copyResponseToClipboard: true, prettyPrint: settings.output.prettyPrint },
      ev.action
    );
  }
}

function deviceLabel(name: string, type: string, id: string): string {
  const displayName = name.trim() || "Unnamed device";
  const displayType = type.trim() || "Unknown type";
  return `${displayName} — ${displayType} (${id})`;
}
