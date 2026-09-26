import streamDeck, { action, type KeyDownEvent, SingletonAction } from "@elgato/streamdeck";
import type { RequestExecutor } from "../execution/request-executor.js";
import type { OutputProcessor } from "../output/output-processor.js";
import { normalizeGetStatusSettings, type GetStatusSettingsV1 } from "../settings/get-status-settings.js";

@action({ UUID: "com.ovis.switchbot.get-status" })
export class GetStatusAction extends SingletonAction<GetStatusSettingsV1> {
  constructor(
    private readonly executor: RequestExecutor,
    private readonly output: OutputProcessor
  ) {
    super();
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
