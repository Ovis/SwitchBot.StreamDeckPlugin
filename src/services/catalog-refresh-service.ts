import streamDeck from "@elgato/streamdeck";
import type { RequestExecutor } from "../execution/request-executor.js";
import { deviceCatalogFromResponse, mergeDeviceCatalog, type DeviceCatalog } from "../settings/device-catalog.js";
import type { DeviceCatalogStore } from "../settings/device-catalog-store.js";
import { mergeSceneCatalog, sceneCatalogFromResponse, type SceneCatalog } from "../settings/scene-catalog.js";
import type { SceneCatalogStore } from "../settings/scene-catalog-store.js";

export class CatalogRefreshService {
  constructor(
    private readonly executor: RequestExecutor,
    private readonly deviceCatalogStore: DeviceCatalogStore,
    private readonly sceneCatalogStore: SceneCatalogStore
  ) {}

  async refreshDevices(): Promise<DeviceCatalog | undefined> {
    const result = await this.executor.execute({ method: "GET", path: "/v1.1/devices" });
    if (!result.success) {
      this.logFailure("Device catalog refresh", result);
      return undefined;
    }
    const latest = deviceCatalogFromResponse(result.response?.body, result.executedAt);
    if (!latest) {
      streamDeck.logger.error("Device catalog refresh failed", { category: "response", reason: "invalid-device-catalog" });
      return undefined;
    }
    try {
      const merged = mergeDeviceCatalog(await this.deviceCatalogStore.get(), latest);
      await this.deviceCatalogStore.set(merged);
      return merged;
    } catch {
      streamDeck.logger.error("Device catalog refresh failed", { category: "internal", reason: "catalog-save-failed" });
      return undefined;
    }
  }

  async refreshScenes(): Promise<SceneCatalog | undefined> {
    const result = await this.executor.execute({ method: "GET", path: "/v1.1/scenes" });
    if (!result.success) {
      this.logFailure("Scene catalog refresh", result);
      return undefined;
    }
    const latest = sceneCatalogFromResponse(result.response?.body, result.executedAt);
    if (!latest) {
      streamDeck.logger.error("Scene catalog refresh failed", { category: "response", reason: "invalid-scene-catalog" });
      return undefined;
    }
    try {
      const merged = mergeSceneCatalog(await this.sceneCatalogStore.get(), latest);
      await this.sceneCatalogStore.set(merged);
      return merged;
    } catch {
      streamDeck.logger.error("Scene catalog refresh failed", { category: "internal", reason: "catalog-save-failed" });
      return undefined;
    }
  }

  private logFailure(operation: string, result: any): void {
    streamDeck.logger.error(`${operation} failed`, {
      category: result.error?.category,
      method: result.request.method,
      path: result.request.path,
      httpStatus: result.response?.httpStatus,
      switchBotStatus: result.response?.switchBot?.statusCode
    });
  }
}
