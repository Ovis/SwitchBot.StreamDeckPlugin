import streamDeck from "@elgato/streamdeck";
import type { SwitchBotCredentials } from "../api/switchbot-auth.js";
import type { CredentialProvider } from "../execution/request-executor.js";
import { getCredentials, normalizeGlobalSettings } from "./global-settings.js";

export class StreamDeckCredentialProvider implements CredentialProvider {
  async getCredentials(): Promise<SwitchBotCredentials | undefined> {
    const settings = await streamDeck.settings.getGlobalSettings();
    return getCredentials(normalizeGlobalSettings(settings));
  }
}
