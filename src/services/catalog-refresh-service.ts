import streamDeck from "@elgato/streamdeck";
import type { ExecutionResult } from "../execution/execution-result.js";
import type { RequestExecutor } from "../execution/request-executor.js";
import type { CatalogRefreshFailure } from "../protocol/property-inspector-protocol.js";
import { deviceCatalogFromResponse, mergeDeviceCatalog, type DeviceCatalog } from "../settings/device-catalog.js";
import type { DeviceCatalogStore } from "../settings/device-catalog-store.js";
import { mergeSceneCatalog, sceneCatalogFromResponse, type SceneCatalog } from "../settings/scene-catalog.js";
import type { SceneCatalogStore } from "../settings/scene-catalog-store.js";

export interface CatalogRefreshResult<T> {
  catalog: T | undefined;
  refreshed: boolean;
  refreshFailure?: CatalogRefreshFailure;
}

export class CatalogRefreshService {
  private deviceRefresh: Promise<CatalogRefreshResult<DeviceCatalog>> | undefined;
  private sceneRefresh: Promise<CatalogRefreshResult<SceneCatalog>> | undefined;

  constructor(
    private readonly executor: RequestExecutor,
    private readonly deviceCatalogStore: DeviceCatalogStore,
    private readonly sceneCatalogStore: SceneCatalogStore
  ) {}

  refreshDevices(): Promise<CatalogRefreshResult<DeviceCatalog>> {
    if (this.deviceRefresh) return this.deviceRefresh;

    const operation = this.refreshDevicesCore();
    this.deviceRefresh = this.clearDeviceRefreshWhenSettled(operation);
    return this.deviceRefresh;
  }

  private async clearDeviceRefreshWhenSettled(
    operation: Promise<CatalogRefreshResult<DeviceCatalog>>
  ): Promise<CatalogRefreshResult<DeviceCatalog>> {
    try {
      return await operation;
    } finally {
      // wrapper自身が共有Promiseなので、別refreshへ差し替わっていない場合だけslotを解放する。
      this.deviceRefresh = undefined;
    }
  }

  private async refreshDevicesCore(): Promise<CatalogRefreshResult<DeviceCatalog>> {
    const result = await this.executor.execute({ method: "GET", path: "/v1.1/devices" });
    if (!result.success) {
      this.logFailure("Device catalog refresh", result);
      return {
        catalog: await this.deviceCatalogStore.get(),
        refreshed: false,
        ...this.refreshFailure(result)
      };
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

  refreshScenes(): Promise<CatalogRefreshResult<SceneCatalog>> {
    if (this.sceneRefresh) return this.sceneRefresh;

    const operation = this.refreshScenesCore();
    this.sceneRefresh = this.clearSceneRefreshWhenSettled(operation);
    return this.sceneRefresh;
  }

  private async clearSceneRefreshWhenSettled(
    operation: Promise<CatalogRefreshResult<SceneCatalog>>
  ): Promise<CatalogRefreshResult<SceneCatalog>> {
    try {
      return await operation;
    } finally {
      this.sceneRefresh = undefined;
    }
  }

  private async refreshScenesCore(): Promise<CatalogRefreshResult<SceneCatalog>> {
    const result = await this.executor.execute({ method: "GET", path: "/v1.1/scenes" });
    if (!result.success) {
      this.logFailure("Scene catalog refresh", result);
      return {
        catalog: await this.sceneCatalogStore.get(),
        refreshed: false,
        ...this.refreshFailure(result)
      };
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

  private refreshFailure(result: Extract<ExecutionResult, { success: false }>): { refreshFailure?: CatalogRefreshFailure } {
    return result.response?.httpStatus === 429
      ? { refreshFailure: "rate-limit" }
      : {};
  }
}
