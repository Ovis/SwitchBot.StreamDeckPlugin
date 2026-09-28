import { action } from "@elgato/streamdeck";
import type { RequestExecutor } from "../execution/request-executor.js";
import type { ExecutionDiagnosticsStore } from "../execution/execution-diagnostics-store.js";
import type { OutputProcessor } from "../output/output-processor.js";
import type { DeviceCatalogStore } from "../settings/device-catalog-store.js";
import type { CatalogRefreshService } from "../services/catalog-refresh-service.js";
import type { GlobalSettingsStore } from "../settings/global-settings-store.js";
import { PhysicalControlAction } from "./physical-control-action.js";

/**
 * SwitchBot Botの日常操作をPhysical Control共通基盤へ接続するAction。
 *
 * Bot固有のControl Command定義はPhysical Device Catalog側に保持し、
 * Action class自体にはUUIDとAction種別以外の製品固有ロジックを持たせない。
 */
@action({ UUID: "com.esheep.switchbot.bot" })
export class BotAction extends PhysicalControlAction {
  constructor(
    executor: RequestExecutor,
    output: OutputProcessor,
    catalogStore: DeviceCatalogStore,
    catalogRefresh: CatalogRefreshService,
    globalSettings: GlobalSettingsStore,
    executionDiagnostics: ExecutionDiagnosticsStore,
    locale?: string
  ) {
    super("bot", executor, output, catalogStore, catalogRefresh, globalSettings, executionDiagnostics, locale);
  }
}
