import streamDeck from "@elgato/streamdeck";
import type { SceneCatalog } from "./scene-catalog.js";
import { normalizeGlobalSettings } from "./global-settings.js";

export class SceneCatalogStore {
  async get(): Promise<SceneCatalog | undefined> {
    const settings = normalizeGlobalSettings(await streamDeck.settings.getGlobalSettings());
    return settings.sceneCatalog;
  }

  async set(sceneCatalog: SceneCatalog): Promise<void> {
    const current = await streamDeck.settings.getGlobalSettings();
    await streamDeck.settings.setGlobalSettings({
      ...current,
      version: 1,
      sceneCatalog
    });
  }
}
