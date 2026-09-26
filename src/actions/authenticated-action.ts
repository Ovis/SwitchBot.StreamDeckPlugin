import streamDeck, { SingletonAction, type SendToPluginEvent } from "@elgato/streamdeck";
import type { RequestExecutor } from "../execution/request-executor.js";

type AuthMessage = { type?: unknown };

export abstract class AuthenticatedAction<TSettings extends Record<string, unknown> = Record<string, never>>
  extends SingletonAction<TSettings> {
  protected constructor(private readonly authExecutor: RequestExecutor) {
    super();
  }

  override async onSendToPlugin(ev: SendToPluginEvent<AuthMessage, TSettings>): Promise<void> {
    if (ev.payload?.type !== "testConnection") return;

    const result = await this.authExecutor.execute({
      method: "GET",
      path: "/v1.1/devices"
    });

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
      message: result.success
        ? "Connection successful."
        : connectionFailureMessage(result.error?.category)
    });
  }
}

function connectionFailureMessage(category: string | undefined): string {
  switch (category) {
    case "configuration": return "Token and Secret are required.";
    case "authentication": return "Authentication failed. Check Token and Secret.";
    case "network": return "Network request failed.";
    case "http": return "SwitchBot returned an HTTP error.";
    case "switchbot": return "SwitchBot rejected the request.";
    case "response": return "SwitchBot returned an unexpected response.";
    default: return "Connection test failed.";
  }
}
