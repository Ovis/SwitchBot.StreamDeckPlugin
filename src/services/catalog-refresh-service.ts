import streamDeck from "@elgato/streamdeck";
import type { ExecutionResult } from "../execution/execution-result.js";
import type { RequestExecutor } from "../execution/request-executor.js";
import { deviceCatalogFromResponse, mergeDeviceCatalog, type DeviceCatalog } from "../settings/device-catalog.js";
import type { DeviceCatalogStore } from "../settings/device-catalog-store.js";
import { mergeSceneCatalog, sceneCatalogFromResponse, type SceneCatalog } from "../settings/scene-catalog.js";
import type { SceneCatalogStore } from "../settings/scene-catalog-store.js";

export interface CatalogRefreshResult<T> {
  catalog: T | undefined;
  refreshed: boolean;
}

export class CatalogRefreshService {
  constructor(
    private readonly executor: RequestExecutor,
    private readonly deviceCatalogStore: DeviceCatalogStore,
    private readonly sceneCatalogStore: SceneCatalogStore
  ) {}

  async refreshDevices(): Promise<CatalogRefreshResult<DeviceCatalog>> {
    const result = await this.executor.execute({ method: "GET", path: "/v1.1/devices" });
    if (!result.success) {
      this.logFailure("Device catalog refresh", result);
      return { catalog: await this.deviceCatalogStore.get(), refreshed: false };
    }
    const latest = deviceCatalogFromResponse(result.response.body, result.executedAt);
    if (!latest) {
      streamDeck.logger.error("Device catalog refresh failed", { category: "response", reason: "invalid-device-catalog" });
      return { catalog: await this.deviceCatalogStore.get(), refreshed: false };
    }
    try {
      const merged = mergeDeviceCatalog(await this.deviceCatalogStore.get(), latest);
      await this.deviceCatalogStore.set(merged);
      return { catalog: merged, refreshed: true };
    } catch {
      streamDeck.logger.error("Device catalog refresh failed", { category: "internal", reason: "catalog-save-failed" });
      return { catalog: await this.deviceCatalogStore.get(), refreshed: false };
    }
  }

  async refreshScenes(): Promise<CatalogRefreshResult<SceneCatalog>> {
    const result = await this.executor.execute({ method: "GET", path: "/v1.1/scenes" });
    if (!result.success) {
      this.logFailure("Scene catalog refresh", result);
      return { catalog: await this.sceneCatalogStore.get(), refreshed: false };
    }
    const latest = sceneCatalogFromResponse(result.response.body, result.executedAt);
    if (!latest) {
      streamDeck.logger.error("Scene catalog refresh failed", { category: "response", reason: "invalid-scene-catalog" });
      return { catalog: await this.sceneCatalogStore.get(), refreshed: false };
    }
    try {
      const merged = mergeSceneCatalog(await this.sceneCatalogStore.get(), latest);
      await this.sceneCatalogStore.set(merged);
      return { catalog: merged, refreshed: true };
    } catch {
      streamDeck.logger.error("Scene catalog refresh failed", { category: "internal", reason: "catalog-save-failed" });
      return { catalog: await this.sceneCatalogStore.get(), refreshed: false };
    }
  }

  private logFailure(operation: string, result: Extract<ExecutionResult, { success: false }>): void {
    streamDeck.logger.error(`${operation} failed`, {
      category: result.error.category,
      method: result.request.method,
      path: result.request.path,
      httpStatus: result.response?.httpStatus,
      switchBotStatus: result.response?.switchBot?.statusCode
    });
  }
}
