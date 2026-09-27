import type { HttpMethod } from "../execution/execution-request.js";

export const API_ENDPOINT_IDS = [
  "get-devices", "get-device-status", "send-device-command", "get-scenes", "execute-scene",
  "configure-webhook", "query-webhook", "update-webhook", "delete-webhook", "custom"
] as const;

export type ApiEndpointId = typeof API_ENDPOINT_IDS[number];
export type ApiEndpointParameter = "device" | "scene";
export type ApiEndpointBodyMode = "none" | "json";

export interface ApiEndpointDefinition {
  id: Exclude<ApiEndpointId, "custom">;
  method: "GET" | "POST";
  path: string;
  parameter?: ApiEndpointParameter;
  bodyMode: ApiEndpointBodyMode;
  defaultBody?: string;
  labels: { en: string; ja: string };
}

const COMMAND_BODY = `{
  "command": "",
  "parameter": "default",
  "commandType": "command"
}`;

export const API_ENDPOINTS: readonly ApiEndpointDefinition[] = [
  { id: "get-devices", method: "GET", path: "/v1.1/devices", bodyMode: "none", labels: { en: "Devices — Get device list", ja: "デバイス — デバイス一覧を取得" } },
  { id: "get-device-status", method: "GET", path: "/v1.1/devices/{deviceId}/status", parameter: "device", bodyMode: "none", labels: { en: "Devices — Get device status", ja: "デバイス — デバイス状態を取得" } },
  { id: "send-device-command", method: "POST", path: "/v1.1/devices/{deviceId}/commands", parameter: "device", bodyMode: "json", defaultBody: COMMAND_BODY, labels: { en: "Devices — Send control command", ja: "デバイス — 制御コマンドを送信" } },
  { id: "get-scenes", method: "GET", path: "/v1.1/scenes", bodyMode: "none", labels: { en: "Scenes — Get scene list", ja: "シーン — シーン一覧を取得" } },
  { id: "execute-scene", method: "POST", path: "/v1.1/scenes/{sceneId}/execute", parameter: "scene", bodyMode: "none", labels: { en: "Scenes — Execute scene", ja: "シーン — シーンを実行" } },
  { id: "configure-webhook", method: "POST", path: "/v1.1/webhook/setupWebhook", bodyMode: "json", defaultBody: `{
  "action": "setupWebhook",
  "url": "",
  "deviceList": "ALL"
}`, labels: { en: "Webhook — Configure", ja: "Webhook — 設定" } },
  { id: "query-webhook", method: "POST", path: "/v1.1/webhook/queryWebhook", bodyMode: "json", defaultBody: `{
  "action": "queryUrl"
}`, labels: { en: "Webhook — Query configuration", ja: "Webhook — 設定を取得" } },
  { id: "update-webhook", method: "POST", path: "/v1.1/webhook/updateWebhook", bodyMode: "json", defaultBody: `{
  "action": "updateWebhook",
  "config": {
    "url": "",
    "enable": true
  }
}`, labels: { en: "Webhook — Update configuration", ja: "Webhook — 設定を更新" } },
  { id: "delete-webhook", method: "POST", path: "/v1.1/webhook/deleteWebhook", bodyMode: "json", defaultBody: `{
  "action": "deleteWebhook",
  "url": ""
}`, labels: { en: "Webhook — Delete", ja: "Webhook — 削除" } }
];

export interface ResolvedApiEndpoint {
  method: HttpMethod;
  path: string;
  bodyMode: ApiEndpointBodyMode;
  defaultBody?: string;
}

export function findApiEndpoint(id: ApiEndpointId): ApiEndpointDefinition | undefined {
  return API_ENDPOINTS.find(endpoint => endpoint.id === id);
}

export function apiEndpointPropertyInspectorData(locale: "en" | "ja") {
  return {
    items: [
      ...API_ENDPOINTS.map(endpoint => ({ label: endpoint.labels[locale], value: endpoint.id })),
      { label: locale === "ja" ? "カスタム" : "Custom", value: "custom" }
    ],
    definitions: API_ENDPOINTS.map(({ labels: _labels, ...endpoint }) => endpoint)
  };
}

export function resolveApiEndpoint(
  endpointId: ApiEndpointId,
  customMethod: HttpMethod,
  customPath: string,
  deviceId: string,
  sceneId: string
): ResolvedApiEndpoint | undefined {
  if (endpointId === "custom") {
    return {
      method: customMethod,
      path: customPath.trim(),
      bodyMode: customMethod === "POST" || customMethod === "PUT" ? "json" : "none"
    };
  }
  const endpoint = findApiEndpoint(endpointId);
  if (!endpoint) return undefined;
  if (endpoint.parameter === "device" && !deviceId.trim()) return undefined;
  if (endpoint.parameter === "scene" && !sceneId.trim()) return undefined;
  return {
    method: endpoint.method,
    path: endpoint.path
      .replace("{deviceId}", encodeURIComponent(deviceId.trim()))
      .replace("{sceneId}", encodeURIComponent(sceneId.trim())),
    bodyMode: endpoint.bodyMode,
    ...(endpoint.defaultBody ? { defaultBody: endpoint.defaultBody } : {})
  };
}

export function resolveApiRequestBody(endpoint: ResolvedApiEndpoint, configuredBody: string, genericDefaultBody: string): string | undefined {
  if (endpoint.bodyMode === "none") return undefined;
  const body = configuredBody.trim();
  if (endpoint.defaultBody && (!body || body === genericDefaultBody.trim())) return endpoint.defaultBody;
  return configuredBody;
}
