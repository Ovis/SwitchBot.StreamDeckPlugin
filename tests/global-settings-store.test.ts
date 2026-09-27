import { beforeEach, describe, expect, it, vi } from "vitest";

let persisted: Record<string, unknown>;
const getGlobalSettings = vi.fn(async () => ({ ...persisted }));
const setGlobalSettings = vi.fn(async (value: Record<string, unknown>) => {
  await Promise.resolve();
  persisted = { ...value };
});

vi.mock("@elgato/streamdeck", () => ({
  default: { settings: { getGlobalSettings, setGlobalSettings } }
}));

import { GlobalSettingsStore } from "../src/settings/global-settings-store.js";

describe("GlobalSettingsStore", () => {
  beforeEach(() => {
    persisted = { version: 1, credentials: { token: "t", secret: "s" } };
    getGlobalSettings.mockClear();
    setGlobalSettings.mockClear();
  });

  it("serializes concurrent read-modify-write updates", async () => {
    const store = new GlobalSettingsStore();
    await Promise.all([
      store.update(current => ({ ...current, deviceCatalog: { fetchedAt: "d", devices: [], infraredRemotes: [] } })),
      store.update(current => ({ ...current, sceneCatalog: { fetchedAt: "s", scenes: [] } }))
    ]);
    const result = await store.get();
    expect(result.credentials).toEqual({ token: "t", secret: "s" });
    expect(result.deviceCatalog?.fetchedAt).toBe("d");
    expect(result.sceneCatalog?.fetchedAt).toBe("s");
  });
});
