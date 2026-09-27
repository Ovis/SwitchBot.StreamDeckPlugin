import streamDeck, { action, type KeyDownEvent } from "@elgato/streamdeck";
import type { ExecutionRequest } from "../execution/execution-request.js";
import type { RequestExecutor } from "../execution/request-executor.js";
import { resolveApiEndpoint } from "../api/api-endpoints.js";
import { AuthenticatedAction } from "./authenticated-action.js";
import type { OutputProcessor } from "../output/output-processor.js";
import { displayLocale, localizeDeviceLabel, type DisplayLocale } from "../output/status-title-formatter.js";
import type { DeviceCatalogStore } from "../settings/device-catalog-store.js";
import type { SceneCatalogStore } from "../settings/scene-catalog-store.js";
import { normalizeApiRequestSettings, type ApiRequestSettingsV1 } from "../settings/api-request-settings.js";

@action({ UUID: "com.esheep.switchbot.api-request" })
export class ApiRequestAction extends AuthenticatedAction {
  private readonly locale: DisplayLocale;

  constructor(
    private readonly executor: RequestExecutor,
    private readonly output: OutputProcessor,
    private readonly deviceCatalogStore: DeviceCatalogStore,
    private readonly sceneCatalogStore: SceneCatalogStore,
    locale?: string
  ) {
    super(executor);
    this.locale = displayLocale(locale);
  }

  override async onSendToPlugin(ev: any): Promise<void> {
    const actionInstance = streamDeck.actions.getActionById(ev.context);
    const settings = actionInstance
      ? normalizeApiRequestSettings(await actionInstance.getSettings())
      : normalizeApiRequestSettings({});

    if (ev.payload?.event === "getDevices") {
      const catalog = await this.deviceCatalogStore.get();
      const items = (catalog?.devices ?? [])
        .filter(device => !device.deleted || device.deviceId === settings.deviceId)
        .map(device => ({
          label: localizeDeviceLabel(device.deviceName, device.deviceType, device.deviceId, device.deleted, this.locale),
          value: device.deviceId
        }));
      await streamDeck.ui.sendToPropertyInspector({ event: "getDevices", items });
      return;
    }

    if (ev.payload?.event === "getScenes") {
      const catalog = await this.sceneCatalogStore.get();
      const items = (catalog?.scenes ?? [])
        .filter(scene => !scene.deleted || scene.sceneId === settings.sceneId)
        .map(scene => ({
          label: sceneLabel(scene.sceneName, scene.sceneId, scene.deleted, this.locale),
          value: scene.sceneId
        }));
      await streamDeck.ui.sendToPropertyInspector({ event: "getScenes", items });
      return;
    }

    await super.onSendToPlugin(ev);
  }

  override async onKeyDown(ev: KeyDownEvent<ApiRequestSettingsV1>): Promise<void> {
    const settings = normalizeApiRequestSettings(await ev.action.getSettings());
    const endpoint = resolveApiEndpoint(settings.endpoint, settings.method, settings.path, settings.deviceId, settings.sceneId);

    if (!endpoint || !endpoint.path) {
      streamDeck.logger.error("API Request failed", { category: "configuration", reason: "missing-endpoint-parameter" });
      await ev.action.showAlert();
      return;
    }

    const request: ExecutionRequest = {
      method: endpoint.method,
      path: endpoint.path,
      ...((endpoint.method === "POST" || endpoint.method === "PUT") ? { body: settings.body } : {})
    };

    const result = await this.executor.execute(request);
    if (!result.success) {
      streamDeck.logger.error("API Request failed", {
        category: result.error?.category,
        method: result.request.method,
        path: result.request.path,
        httpStatus: result.response?.httpStatus,
        switchBotStatus: result.response?.switchBot?.statusCode
      });
    }

    await this.output.process(
      result,
      {
        copyResponseToClipboard: settings.output.copyResponseToClipboard,
        prettyPrint: settings.output.prettyPrint
      },
      ev.action
    );
  }
}

function sceneLabel(name: string, id: string, deleted: boolean, locale: DisplayLocale): string {
  const base = name.trim() ? `${name} (${id})` : id;
  if (!deleted) return base;
  return locale === "ja" ? `${base} [削除済み]` : `${base} [Deleted]`;
}
