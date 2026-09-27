import type { SceneCatalog } from "./scene-catalog.js";
import type { GlobalSettingsStore } from "./global-settings-store.js";

export class SceneCatalogStore {
  constructor(private readonly globalSettings: GlobalSettingsStore) {}

  async get(): Promise<SceneCatalog | undefined> {
    return (await this.globalSettings.get()).sceneCatalog;
  }

  async set(sceneCatalog: SceneCatalog): Promise<void> {
    await this.globalSettings.update(current => ({ ...current, version: 1, sceneCatalog }));
  }
}
