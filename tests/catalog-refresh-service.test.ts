import { describe, expect, it, vi } from "vitest";

vi.mock("@elgato/streamdeck", () => ({
  default: { logger: { error: vi.fn() } }
}));

import { CatalogRefreshService } from "../src/services/catalog-refresh-service.js";
import type { RequestExecutor } from "../src/execution/request-executor.js";
import type { DeviceCatalogStore } from "../src/settings/device-catalog-store.js";
import type { SceneCatalogStore } from "../src/settings/scene-catalog-store.js";

describe("CatalogRefreshService", () => {
  it("returns the saved device catalog and reports refresh failure", async () => {
    const saved = { fetchedAt: "old", devices: [], infraredRemotes: [] };
    const executor = { execute: vi.fn(async () => ({
      success: false, request: { method: "GET", path: "/v1.1/devices" }, executedAt: "now",
      error: { category: "network", message: "failed" }
    })) } as unknown as RequestExecutor;
    const devices = { get: vi.fn(async () => saved), set: vi.fn() } as unknown as DeviceCatalogStore;
    const scenes = { get: vi.fn(), set: vi.fn() } as unknown as SceneCatalogStore;

    const result = await new CatalogRefreshService(executor, devices, scenes).refreshDevices();
    expect(result).toEqual({ catalog: saved, refreshed: false });
  });

  it("shares concurrent device refreshes so an older response cannot overwrite a newer catalog", async () => {
    let resolveExecute!: (value: unknown) => void;
    const pending = new Promise(resolve => { resolveExecute = resolve; });
    const executor = { execute: vi.fn(() => pending) } as unknown as RequestExecutor;
    const devices = {
      get: vi.fn(async () => undefined),
      set: vi.fn(async () => undefined)
    } as unknown as DeviceCatalogStore;
    const scenes = { get: vi.fn(), set: vi.fn() } as unknown as SceneCatalogStore;
    const service = new CatalogRefreshService(executor, devices, scenes);

    const first = service.refreshDevices();
    const second = service.refreshDevices();

    expect(executor.execute).toHaveBeenCalledOnce();
    expect(second).toBe(first);

    resolveExecute({
      success: true,
      request: { method: "GET", path: "/v1.1/devices" },
      executedAt: "2026-09-29T00:00:00.000Z",
      response: {
        httpStatus: 200, headers: {}, rawBody: "",
        body: { statusCode: 100, body: { deviceList: [], infraredRemoteList: [] } }
      }
    });

    await expect(first).resolves.toMatchObject({ refreshed: true });
    await expect(second).resolves.toMatchObject({ refreshed: true });
    expect(devices.set).toHaveBeenCalledOnce();
  });

  it("releases a failed single-flight refresh so the next request can retry", async () => {
    const executor = { execute: vi.fn(async () => ({
      success: false, request: { method: "GET", path: "/v1.1/devices" }, executedAt: "now",
      error: { category: "network", message: "failed" }
    })) } as unknown as RequestExecutor;
    const devices = {
      get: vi.fn()
        .mockRejectedValueOnce(new Error("settings unavailable"))
        .mockResolvedValueOnce({ fetchedAt: "retry", devices: [], infraredRemotes: [] }),
      set: vi.fn()
    } as unknown as DeviceCatalogStore;
    const scenes = { get: vi.fn(), set: vi.fn() } as unknown as SceneCatalogStore;
    const service = new CatalogRefreshService(executor, devices, scenes);

    await expect(service.refreshDevices()).rejects.toThrow("settings unavailable");
    await expect(service.refreshDevices()).resolves.toMatchObject({ refreshed: false });
    expect(executor.execute).toHaveBeenCalledTimes(2);
  });

  it("persists and reports a successful scene refresh", async () => {
    const executor = { execute: vi.fn(async () => ({
      success: true, request: { method: "GET", path: "/v1.1/scenes" }, executedAt: "2026-09-27T00:00:00.000Z",
      response: { httpStatus: 200, headers: {}, rawBody: "", body: { statusCode: 100, body: [{ sceneId: "1", sceneName: "Home" }] } }
    })) } as unknown as RequestExecutor;
    const devices = { get: vi.fn(), set: vi.fn() } as unknown as DeviceCatalogStore;
    const scenes = { get: vi.fn(async () => undefined), set: vi.fn(async () => undefined) } as unknown as SceneCatalogStore;

    const result = await new CatalogRefreshService(executor, devices, scenes).refreshScenes();
    expect(result.refreshed).toBe(true);
    expect(result.catalog?.scenes[0]).toMatchObject({ sceneId: "1", deleted: false });
    expect(scenes.set).toHaveBeenCalledOnce();
  });
});
