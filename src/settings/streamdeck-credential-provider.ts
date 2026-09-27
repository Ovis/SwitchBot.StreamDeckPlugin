import type { SwitchBotCredentials } from "../api/switchbot-auth.js";
import type { CredentialProvider } from "../execution/request-executor.js";
import { getCredentials } from "./global-settings.js";
import type { GlobalSettingsStore } from "./global-settings-store.js";

export class StreamDeckCredentialProvider implements CredentialProvider {
  constructor(private readonly globalSettings: GlobalSettingsStore) {}

  async getCredentials(): Promise<SwitchBotCredentials | undefined> {
    return getCredentials(await this.globalSettings.get());
  }
}
