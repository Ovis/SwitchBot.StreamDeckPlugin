import streamDeck from "@elgato/streamdeck";
import { normalizeGlobalSettings, type GlobalSettingsV1 } from "./global-settings.js";

export class GlobalSettingsStore {
  private queue: Promise<void> = Promise.resolve();

  async get(): Promise<GlobalSettingsV1> {
    await this.queue;
    return normalizeGlobalSettings(await streamDeck.settings.getGlobalSettings());
  }

  async update(mutator: (current: GlobalSettingsV1) => GlobalSettingsV1): Promise<GlobalSettingsV1> {
    let updated: GlobalSettingsV1 | undefined;
    const operation = this.queue.then(async () => {
      const current = normalizeGlobalSettings(await streamDeck.settings.getGlobalSettings());
      updated = normalizeGlobalSettings(mutator(current));
      await streamDeck.settings.setGlobalSettings(updated);
    });
    this.queue = operation.catch(() => undefined);
    await operation;
    return updated!;
  }
}
