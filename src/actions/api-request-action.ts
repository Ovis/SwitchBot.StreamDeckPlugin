import streamDeck, { action, type KeyDownEvent } from "@elgato/streamdeck";
import type { ExecutionRequest } from "../execution/execution-request.js";
import type { RequestExecutor } from "../execution/request-executor.js";
import { apiEndpointPropertyInspectorData, resolveApiEndpoint, resolveApiRequestBody } from "../api/api-endpoints.js";
import { AuthenticatedAction } from "./authenticated-action.js";
import type { OutputProcessor } from "../output/output-processor.js";
import { displayLocale, localizeDeviceLabel, type DisplayLocale } from "../output/status-title-formatter.js";
import type { DeviceCatalogStore } from "../settings/device-catalog-store.js";
import type { SceneCatalogStore } from "../settings/scene-catalog-store.js";
import type { GlobalSettingsStore } from "../settings/global-settings-store.js";
import type { CatalogRefreshService } from "../services/catalog-refresh-service.js";
import { DEFAULT_API_REQUEST_BODY, normalizeApiRequestSettings, type ApiRequestSettingsV1 } from "../settings/api-request-settings.js";
import { propertyInspectorMessage } from "../settings/property-inspector-messages.js";

@action({ UUID: "com.esheep.switchbot.api-request" })
export class ApiRequestAction extends AuthenticatedAction {
  private readonly locale: DisplayLocale;

  constructor(
    private readonly executor: RequestExecutor,
    private readonly output: OutputProcessor,
    private readonly deviceCatalogStore: DeviceCatalogStore,
    private readonly sceneCatalogStore: SceneCatalogStore,
    private readonly catalogRefresh: CatalogRefreshService,
    globalSettings: GlobalSettingsStore,
    locale?: string
  ) {
    super(executor, globalSettings);
    this.locale = displayLocale(locale);
  }

  override async onSendToPlugin(value: unknown): Promise<void> {
    const ev = propertyInspectorMessage(value);
    const event = typeof ev.payload?.event === "string" ? ev.payload.event : undefined;

    if (event === "getApiEndpoints") {
      const data = apiEndpointPropertyInspectorData(this.locale);
      await streamDeck.ui.sendToPropertyInspector({ event, ...data });
      return;
    }

    const actionInstance = typeof ev.context === "string" ? streamDeck.actions.getActionById(ev.context) : undefined;
    const settings = actionInstance
      ? normalizeApiRequestSettings(await actionInstance.getSettings())
      : normalizeApiRequestSettings({});

    if (event === "getDevices") {
      const refresh = ev.payload?.isRefresh === true;
      const result = refresh ? await this.catalogRefresh.refreshDevices() : { catalog: await this.deviceCatalogStore.get(), refreshed: true };
      const items = (result.catalog?.devices ?? [])
        .filter(device => !device.deleted || device.deviceId === settings.deviceId)
        .map(device => ({
          label: localizeDeviceLabel(device.deviceName, device.deviceType, device.deviceId, device.deleted, this.locale),
          value: device.deviceId
        }));
      await streamDeck.ui.sendToPropertyInspector({ event, items, refreshFailed: refresh && !result.refreshed });
      return;
    }

    if (event === "getScenes") {
      const refresh = ev.payload?.isRefresh === true;
      const result = refresh ? await this.catalogRefresh.refreshScenes() : { catalog: await this.sceneCatalogStore.get(), refreshed: true };
      const items = (result.catalog?.scenes ?? [])
        .filter(scene => !scene.deleted || scene.sceneId === settings.sceneId)
        .map(scene => ({
          label: sceneLabel(scene.sceneName, scene.sceneId, scene.deleted, this.locale),
          value: scene.sceneId
        }));
      await streamDeck.ui.sendToPropertyInspector({ event, items, refreshFailed: refresh && !result.refreshed });
      return;
    }

    await super.onSendToPlugin(value);
  }

  override async onKeyDown(ev: KeyDownEvent<ApiRequestSettingsV1>): Promise<void> {
    const settings = normalizeApiRequestSettings(await ev.action.getSettings());
    const endpoint = resolveApiEndpoint(settings.endpoint, settings.method, settings.path, settings.deviceId, settings.sceneId);

    if (!endpoint || !endpoint.path) {
      streamDeck.logger.error("API Request failed", { category: "configuration", reason: "missing-endpoint-parameter" });
      await ev.action.showAlert();
      return;
    }

    const body = resolveApiRequestBody(endpoint, settings.body, DEFAULT_API_REQUEST_BODY);
    const request: ExecutionRequest = {
      method: endpoint.method,
      path: endpoint.path,
      ...(body !== undefined ? { body } : {})
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

    await this.output.process(result, {
      copyResponseToClipboard: settings.output.copyResponseToClipboard,
      prettyPrint: settings.output.prettyPrint
    }, ev.action);
  }
}

function sceneLabel(name: string, id: string, deleted: boolean, locale: DisplayLocale): string {
  const base = name.trim() ? `${name} (${id})` : id;
  if (!deleted) return base;
  return locale === "ja" ? `${base} [削除済み]` : `${base} [Deleted]`;
}
