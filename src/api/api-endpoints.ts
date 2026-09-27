export const API_ENDPOINT_IDS = [
  "get-devices",
  "get-device-status",
  "send-device-command",
  "get-scenes",
  "execute-scene",
  "configure-webhook",
  "query-webhook",
  "update-webhook",
  "delete-webhook",
  "custom"
] as const;

export type ApiEndpointId = typeof API_ENDPOINT_IDS[number];

export interface ApiEndpointDefinition {
  id: Exclude<ApiEndpointId, "custom">;
  method: "GET" | "POST";
  path: string;
  requiresDevice?: boolean;
  requiresScene?: boolean;
}

export const API_ENDPOINTS: readonly ApiEndpointDefinition[] = [
  { id: "get-devices", method: "GET", path: "/v1.1/devices" },
  { id: "get-device-status", method: "GET", path: "/v1.1/devices/{deviceId}/status", requiresDevice: true },
  { id: "send-device-command", method: "POST", path: "/v1.1/devices/{deviceId}/commands", requiresDevice: true },
  { id: "get-scenes", method: "GET", path: "/v1.1/scenes" },
  { id: "execute-scene", method: "POST", path: "/v1.1/scenes/{sceneId}/execute", requiresScene: true },
  { id: "configure-webhook", method: "POST", path: "/v1.1/webhook/setupWebhook" },
  { id: "query-webhook", method: "POST", path: "/v1.1/webhook/queryWebhook" },
  { id: "update-webhook", method: "POST", path: "/v1.1/webhook/updateWebhook" },
  { id: "delete-webhook", method: "POST", path: "/v1.1/webhook/deleteWebhook" }
];

export function findApiEndpoint(id: ApiEndpointId): ApiEndpointDefinition | undefined {
  return API_ENDPOINTS.find(endpoint => endpoint.id === id);
}

export function resolveApiEndpoint(
  endpointId: ApiEndpointId,
  customMethod: "GET" | "POST" | "PUT" | "DELETE",
  customPath: string,
  deviceId: string,
  sceneId: string
): { method: "GET" | "POST" | "PUT" | "DELETE"; path: string } | undefined {
  if (endpointId === "custom") return { method: customMethod, path: customPath.trim() };
  const endpoint = findApiEndpoint(endpointId);
  if (!endpoint) return undefined;
  if (endpoint.requiresDevice && !deviceId.trim()) return undefined;
  if (endpoint.requiresScene && !sceneId.trim()) return undefined;
  return {
    method: endpoint.method,
    path: endpoint.path
      .replace("{deviceId}", encodeURIComponent(deviceId.trim()))
      .replace("{sceneId}", encodeURIComponent(sceneId.trim()))
  };
}
