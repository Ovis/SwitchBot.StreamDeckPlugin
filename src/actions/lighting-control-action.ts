import { action } from "@elgato/streamdeck";
import type { RequestExecutor } from "../execution/request-executor.js";
import type { ExecutionDiagnosticsStore } from "../execution/execution-diagnostics-store.js";
import type { OutputProcessor } from "../output/output-processor.js";
import type { DeviceCatalogStore } from "../settings/device-catalog-store.js";
import type { CatalogRefreshService } from "../services/catalog-refresh-service.js";
import type { GlobalSettingsStore } from "../settings/global-settings-store.js";
import { PhysicalControlAction } from "./physical-control-action.js";

/**
 * SwitchBot照明系の日常的な照明操作をPhysical Control共通基盤へ接続するAction。
 *
 * 対応deviceTypeとControl Commandの差異はPhysical Device Catalog側で管理し、
 * Action classにはLightingカテゴリ固有の分岐を持たせない。
 */
@action({ UUID: "com.esheep.switchbot.lighting" })
export class LightingAction extends PhysicalControlAction {
  constructor(
    executor: RequestExecutor,
    output: OutputProcessor,
    catalogStore: DeviceCatalogStore,
    catalogRefresh: CatalogRefreshService,
    globalSettings: GlobalSettingsStore,
    executionDiagnostics: ExecutionDiagnosticsStore,
    locale?: string
  ) {
    super("lighting", executor, output, catalogStore, catalogRefresh, globalSettings, executionDiagnostics, locale);
  }
}
