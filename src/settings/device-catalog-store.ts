import type { DeviceCatalog } from "./device-catalog.js";
import type { GlobalSettingsStore } from "./global-settings-store.js";

export class DeviceCatalogStore {
  constructor(private readonly globalSettings: GlobalSettingsStore) {}

  async get(): Promise<DeviceCatalog | undefined> {
    return (await this.globalSettings.get()).deviceCatalog;
  }

  async set(deviceCatalog: DeviceCatalog): Promise<void> {
    await this.globalSettings.update(current => ({ ...current, version: 1, deviceCatalog }));
  }
}
