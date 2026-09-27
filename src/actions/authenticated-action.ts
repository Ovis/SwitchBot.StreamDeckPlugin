import streamDeck, { SingletonAction } from "@elgato/streamdeck";
import type { RequestExecutor } from "../execution/request-executor.js";
import type { GlobalSettingsStore } from "../settings/global-settings-store.js";
import { credentialsFromPayload, propertyInspectorMessage } from "../settings/property-inspector-messages.js";
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
    const type = typeof ev.payload?.type === "string" ? ev.payload.type : undefined;

    if (type === "saveCredentials") {
      const credentials = credentialsFromPayload(ev.payload?.credentials);
      if (!credentials) return;
      await this.saveCredentials(credentials);
      return;
    }

    if (type !== "testConnection") return;

    const credentials = credentialsFromPayload(ev.payload?.credentials);
    if (credentials) await this.saveCredentials(credentials);

    const result = await this.authExecutor.execute({ method: "GET", path: "/v1.1/devices" });
    if (!result.success) {
      streamDeck.logger.error("Test Connection failed", {
        category: result.error?.category,
        httpStatus: result.response?.httpStatus,
        switchBotStatus: result.response?.switchBot?.statusCode
      });
    }

    const message: TestConnectionResultMessage = {
      type: "testConnectionResult",
      success: result.success,
      ...(!result.success && result.error ? { errorCategory: result.error.category } : {})
    };
    await streamDeck.ui.sendToPropertyInspector(message);
  }

  private async saveCredentials(credentials: PropertyInspectorCredentials): Promise<void> {
    await this.globalSettings.update(current => ({
      ...current,
      version: 1,
      credentials
    }));
  }
}
