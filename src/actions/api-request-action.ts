import streamDeck, { action, type KeyDownEvent } from "@elgato/streamdeck";
import type { ExecutionRequest } from "../execution/execution-request.js";
import type { RequestExecutor } from "../execution/request-executor.js";
import { AuthenticatedAction } from "./authenticated-action.js";
import type { OutputProcessor } from "../output/output-processor.js";
import { normalizeApiRequestSettings, type ApiRequestSettingsV1 } from "../settings/api-request-settings.js";

@action({ UUID: "com.ovis.switchbot.api-request" })
export class ApiRequestAction extends AuthenticatedAction<ApiRequestSettingsV1> {
  constructor(
    private readonly executor: RequestExecutor,
    private readonly output: OutputProcessor
  ) {
    super(executor);
  }

  override async onKeyDown(ev: KeyDownEvent<ApiRequestSettingsV1>): Promise<void> {
    const settings = normalizeApiRequestSettings(await ev.action.getSettings());
    const path = settings.path.trim();

    const request: ExecutionRequest = {
      method: settings.method,
      path,
      ...((settings.method === "POST" || settings.method === "PUT")
        ? { body: settings.body }
        : {})
    };

    const result = await this.executor.execute(request);

    if (!result.success) {
      streamDeck.logger.error("API Request failed", {
        category: result.error?.category,
        method: result.request.method,
        path: result.request.path,
        httpStatus: result.response?.httpStatus,
        switchBotStatus: result.response?.switchBot?.statusCode
      });
    }

    await this.output.process(
      result,
      {
        copyResponseToClipboard: settings.output.copyResponseToClipboard,
        prettyPrint: settings.output.prettyPrint
      },
      ev.action
    );
  }
}
