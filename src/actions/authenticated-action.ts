import streamDeck, { SingletonAction } from "@elgato/streamdeck";
import type { RequestExecutor } from "../execution/request-executor.js";
import type { GlobalSettingsStore } from "../settings/global-settings-store.js";
import { propertyInspectorMessage } from "../settings/property-inspector-messages.js";\nimport { parsePropertyInspectorToPluginMessage } from "../protocol/property-inspector-protocol.js";
import type {
  PropertyInspectorCredentials,
  TestConnectionResultMessage
} from "../protocol/property-inspector-protocol.js";

export abstract class AuthenticatedAction extends SingletonAction<any> {
  protected constructor(
    private readonly authExecutor: RequestExecutor,
    private readonly globalSettings: GlobalSettingsStore
  ) {
    super();
  }

  override async onSendToPlugin(value: unknown): Promise<void> {
    const ev = propertyInspectorMessage(value);
    const message = parsePropertyInspectorToPluginMessage(ev.payload);

    if (message?.event === "saveCredentials") {
      await this.saveCredentials(message.credentials);
      return;
    }

    if (message?.event !== "testConnection") return;

    await this.saveCredentials(message.credentials);

    const result = await this.authExecutor.execute({ method: "GET", path: "/v1.1/devices" });
    if (!result.success) {
      streamDeck.logger.error("Test Connection failed", {
        category: result.error?.category,
        httpStatus: result.response?.httpStatus,
        switchBotStatus: result.response?.switchBot?.statusCode
      });
    }

    const response: TestConnectionResultMessage = {
      event: "testConnectionResult",
      success: result.success,
      ...(!result.success && result.error ? { errorCategory: result.error.category } : {})
    };
    await streamDeck.ui.sendToPropertyInspector({ ...response });
  }

  private async saveCredentials(credentials: PropertyInspectorCredentials): Promise<void> {
    await this.globalSettings.update(current => ({
      ...current,
      version: 1,
      credentials
    }));
  }
}
