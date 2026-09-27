import streamDeck, { action, type KeyDownEvent } from "@elgato/streamdeck";
import type { RequestExecutor } from "../execution/request-executor.js";
import { AuthenticatedAction } from "./authenticated-action.js";
import type { OutputProcessor } from "../output/output-processor.js";
import { mergeSceneCatalog, sceneCatalogFromResponse } from "../settings/scene-catalog.js";
import type { SceneCatalogStore } from "../settings/scene-catalog-store.js";
import { normalizeGetScenesSettings, type GetScenesSettingsV1 } from "../settings/get-scenes-settings.js";

@action({ UUID: "com.esheep.switchbot.get-scenes" })
export class GetScenesAction extends AuthenticatedAction {
  constructor(
    private readonly executor: RequestExecutor,
    private readonly output: OutputProcessor,
    private readonly catalogStore: SceneCatalogStore
  ) {
    super(executor);
  }

  override async onKeyDown(ev: KeyDownEvent<GetScenesSettingsV1>): Promise<void> {
    const settings = normalizeGetScenesSettings(await ev.action.getSettings());
    const result = await this.executor.execute({ method: "GET", path: "/v1.1/scenes" });

    if (!result.success) {
      streamDeck.logger.error("Get Scenes failed", {
        category: result.error?.category,
        method: result.request.method,
        path: result.request.path,
        httpStatus: result.response?.httpStatus,
        switchBotStatus: result.response?.switchBot?.statusCode
      });
      await this.output.process(result, { copyResponseToClipboard: false, prettyPrint: true }, ev.action);
      return;
    }

    const catalog = sceneCatalogFromResponse(result.response?.body, result.executedAt);
    if (!catalog) {
      streamDeck.logger.error("Get Scenes failed", { category: "response", reason: "invalid-scene-catalog" });
      await ev.action.showAlert();
      return;
    }

    try {
      const previousCatalog = await this.catalogStore.get();
      await this.catalogStore.set(mergeSceneCatalog(previousCatalog, catalog));
    } catch {
      streamDeck.logger.error("Get Scenes failed", { category: "internal", reason: "catalog-save-failed" });
      await ev.action.showAlert();
      return;
    }

    await this.output.process(
      result,
      { copyResponseToClipboard: settings.output.copyResponseToClipboard, prettyPrint: true },
      ev.action
    );
  }
}
