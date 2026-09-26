import streamDeck, { action, type KeyDownEvent } from "@elgato/streamdeck";
import type { RequestExecutor } from "../execution/request-executor.js";
import { AuthenticatedAction } from "./authenticated-action.js";
import type { OutputProcessor } from "../output/output-processor.js";
import { deviceCatalogFromResponse, mergeDeviceCatalog } from "../settings/device-catalog.js";
import type { DeviceCatalogStore } from "../settings/device-catalog-store.js";
import { normalizeGetDevicesSettings, type GetDevicesSettingsV1 } from "../settings/get-devices-settings.js";

@action({ UUID: "com.ovis.switchbot.get-devices" })
export class GetDevicesAction extends AuthenticatedAction {
  constructor(
    private readonly executor: RequestExecutor,
    private readonly output: OutputProcessor,
    private readonly catalogStore: DeviceCatalogStore
  ) {
    super(executor);
  }

  override async onKeyDown(ev: KeyDownEvent<GetDevicesSettingsV1>): Promise<void> {
    const settings = normalizeGetDevicesSettings(await ev.action.getSettings());
    const result = await this.executor.execute({
      method: "GET",
      path: "/v1.1/devices"
    });

    if (!result.success) {
      streamDeck.logger.error("Get Devices failed", {
        category: result.error?.category,
        method: result.request.method,
        path: result.request.path,
        httpStatus: result.response?.httpStatus,
        switchBotStatus: result.response?.switchBot?.statusCode
      });
      await this.output.process(result, { copyResponseToClipboard: false, prettyPrint: true }, ev.action);
      return;
    }

    const catalog = deviceCatalogFromResponse(result.response?.body, result.executedAt);
    if (!catalog) {
      streamDeck.logger.error("Get Devices failed", { category: "response", reason: "invalid-device-catalog" });
      await ev.action.showAlert();
      return;
    }

    try {
      const previousCatalog = await this.catalogStore.get();
      await this.catalogStore.set(mergeDeviceCatalog(previousCatalog, catalog));
    } catch {
      streamDeck.logger.error("Get Devices failed", { category: "internal", reason: "catalog-save-failed" });
      await ev.action.showAlert();
      return;
    }

    await this.output.process(
      result,
      { copyResponseToClipboard: settings.output.copyResponseToClipboard, prettyPrint: true },
      ev.action
    );
  }
}
