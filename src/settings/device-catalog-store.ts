import streamDeck from "@elgato/streamdeck";
import type { DeviceCatalog } from "./device-catalog.js";
import { normalizeGlobalSettings } from "./global-settings.js";

export class DeviceCatalogStore {
  async get(): Promise<DeviceCatalog | undefined> {
    const settings = normalizeGlobalSettings(await streamDeck.settings.getGlobalSettings());
    return settings.deviceCatalog;
  }

  async set(deviceCatalog: DeviceCatalog): Promise<void> {
    const current = await streamDeck.settings.getGlobalSettings();
    await streamDeck.settings.setGlobalSettings({
      ...current,
      version: 1,
      deviceCatalog
    });
  }
}
