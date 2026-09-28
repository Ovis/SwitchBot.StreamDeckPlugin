import { action } from "@elgato/streamdeck";
import type { RequestExecutor } from "../execution/request-executor.js";
import type { ExecutionDiagnosticsStore } from "../execution/execution-diagnostics-store.js";
import type { OutputProcessor } from "../output/output-processor.js";
import type { DeviceCatalogStore } from "../settings/device-catalog-store.js";
import type { CatalogRefreshService } from "../services/catalog-refresh-service.js";
import type { GlobalSettingsStore } from "../settings/global-settings-store.js";
import { PhysicalControlAction } from "./physical-control-action.js";

/**
 * SwitchBotのロボット掃除機をPhysical Control共通基盤へ接続するAction。
 *
 * familyごとのcommandやparameter差異はAction側で分岐せず、
 * Physical Device Catalogの宣言的な定義へ集約する。
 */
@action({ UUID: "com.esheep.switchbot.cleaning" })
export class CleaningAction extends PhysicalControlAction {
  constructor(
    executor: RequestExecutor,
    output: OutputProcessor,
    catalogStore: DeviceCatalogStore,
    catalogRefresh: CatalogRefreshService,
    globalSettings: GlobalSettingsStore,
    executionDiagnostics: ExecutionDiagnosticsStore,
    locale?: string
  ) {
    super("cleaning", executor, output, catalogStore, catalogRefresh, globalSettings, executionDiagnostics, locale);
  }
}
