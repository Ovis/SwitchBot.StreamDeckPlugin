import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  persisted: { value: {} as Record<string, unknown> },
  getGlobalSettings: vi.fn(),
  setGlobalSettings: vi.fn()
}));

vi.mock("@elgato/streamdeck", () => ({
  default: { settings: { getGlobalSettings: mocks.getGlobalSettings, setGlobalSettings: mocks.setGlobalSettings } }
}));

import { GlobalSettingsStore } from "../src/settings/global-settings-store.js";

describe("GlobalSettingsStore", () => {
  beforeEach(() => {
    mocks.persisted.value = { version: 1, credentials: { token: "t", secret: "s" } };
    mocks.getGlobalSettings.mockReset().mockImplementation(async () => ({ ...mocks.persisted.value }));
    mocks.setGlobalSettings.mockReset().mockImplementation(async (value: Record<string, unknown>) => {
      await Promise.resolve();
      mocks.persisted.value = { ...value };
    });
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
