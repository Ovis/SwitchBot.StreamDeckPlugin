import streamDeck, { SingletonAction } from "@elgato/streamdeck";
import type { RequestExecutor } from "../execution/request-executor.js";

export abstract class AuthenticatedAction extends SingletonAction<any> {
  protected constructor(private readonly authExecutor: RequestExecutor) {
    super();
  }

  override async onSendToPlugin(ev: any): Promise<void> {
    streamDeck.logger.info("Property Inspector message received", {
      type: typeof ev.payload?.type === "string" ? ev.payload.type : "(missing)"
    });
    if (ev.payload?.type !== "testConnection") return;

    streamDeck.logger.info("Test Connection request started");

    const result = await this.authExecutor.execute({
      method: "GET",
      path: "/v1.1/devices"
    });

    streamDeck.logger.info("Test Connection request completed", { success: result.success });

    if (!result.success) {
      streamDeck.logger.error("Test Connection failed", {
        category: result.error?.category,
        httpStatus: result.response?.httpStatus,
        switchBotStatus: result.response?.switchBot?.statusCode
      });
    }

    await streamDeck.ui.sendToPropertyInspector({
      type: "testConnectionResult",
      success: result.success,
      errorCategory: result.success ? undefined : result.error?.category
    });
  }
}

