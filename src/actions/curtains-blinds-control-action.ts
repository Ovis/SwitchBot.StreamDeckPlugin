import { action } from "@elgato/streamdeck";
import type { RequestExecutor } from "../execution/request-executor.js";
import type { ExecutionDiagnosticsStore } from "../execution/execution-diagnostics-store.js";
import type { OutputProcessor } from "../output/output-processor.js";
import type { DeviceCatalogStore } from "../settings/device-catalog-store.js";
import type { CatalogRefreshService } from "../services/catalog-refresh-service.js";
import type { GlobalSettingsStore } from "../settings/global-settings-store.js";
import { PhysicalControlAction } from "./physical-control-action.js";

/**
 * SwitchBotのカーテン・ブラインド系デバイスをPhysical Control共通基盤へ接続するAction。
 *
 * positionの向きやwire parameter形式は製品ごとに異なるため、Action側では分岐せず
 * Physical Device Catalogの宣言的な定義へ集約する。
 */
@action({ UUID: "com.esheep.switchbot.curtains-blinds" })
export class CurtainsBlindsAction extends PhysicalControlAction {
  constructor(
    executor: RequestExecutor,
    output: OutputProcessor,
    catalogStore: DeviceCatalogStore,
    catalogRefresh: CatalogRefreshService,
    globalSettings: GlobalSettingsStore,
    executionDiagnostics: ExecutionDiagnosticsStore,
    locale?: string
  ) {
    super("curtains-blinds", executor, output, catalogStore, catalogRefresh, globalSettings, executionDiagnostics, locale);
  }
}
