import streamDeck, { action, type KeyDownEvent, SingletonAction } from "@elgato/streamdeck";
import type { RequestExecutor } from "../execution/request-executor.js";
import type { OutputProcessor } from "../output/output-processor.js";

@action({ UUID: "com.ovis.switchbot.get-devices" })
export class GetDevicesAction extends SingletonAction {
  constructor(
    private readonly executor: RequestExecutor,
    private readonly output: OutputProcessor
  ) {
    super();
  }

  override async onKeyDown(ev: KeyDownEvent): Promise<void> {
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
    }

    await this.output.process(
      result,
      { copyResponseToClipboard: true, prettyPrint: true },
      ev.action
    );
  }
}
