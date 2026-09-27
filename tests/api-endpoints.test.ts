import { describe, expect, it } from "vitest";
import { DEFAULT_API_REQUEST_BODY } from "../src/settings/api-request-settings.js";
import { apiEndpointPropertyInspectorData, findApiEndpoint, resolveApiEndpoint, resolveApiRequestBody } from "../src/api/api-endpoints.js";

describe("API endpoint presets", () => {
  it("defines common endpoints from one metadata source", () => {
    expect(findApiEndpoint("get-device-status")).toMatchObject({ method: "GET", path: "/v1.1/devices/{deviceId}/status", bodyMode: "none" });
    expect(findApiEndpoint("execute-scene")).toMatchObject({ method: "POST", path: "/v1.1/scenes/{sceneId}/execute", bodyMode: "none" });
    expect(apiEndpointPropertyInspectorData("ja").items).toContainEqual({ label: "カスタム", value: "custom" });
  });

  it("expands selected device and scene IDs safely", () => {
    expect(resolveApiEndpoint("get-device-status", "POST", "", "A/B", "")).toMatchObject({ method: "GET", path: "/v1.1/devices/A%2FB/status" });
    expect(resolveApiEndpoint("execute-scene", "GET", "", "", "Scene 1")).toMatchObject({ method: "POST", path: "/v1.1/scenes/Scene%201/execute" });
  });

  it("requires catalog selections for parameterized presets", () => {
    expect(resolveApiEndpoint("get-device-status", "POST", "", "", "")).toBeUndefined();
    expect(resolveApiEndpoint("execute-scene", "POST", "", "", "")).toBeUndefined();
  });

  it("keeps custom method and path", () => {
    expect(resolveApiEndpoint("custom", "DELETE", "/v1.1/custom", "", "")).toEqual({ method: "DELETE", path: "/v1.1/custom", bodyMode: "none" });
  });

  it("omits bodies for bodyless presets and supplies endpoint-specific templates", () => {
    const scene = resolveApiEndpoint("execute-scene", "POST", "", "", "scene")!;
    expect(resolveApiRequestBody(scene, DEFAULT_API_REQUEST_BODY, DEFAULT_API_REQUEST_BODY)).toBeUndefined();

    const query = resolveApiEndpoint("query-webhook", "POST", "", "", "")!;
    expect(resolveApiRequestBody(query, DEFAULT_API_REQUEST_BODY, DEFAULT_API_REQUEST_BODY)).toContain('"action": "queryUrl"');

    const command = resolveApiEndpoint("send-device-command", "POST", "", "device", "")!;
    expect(resolveApiRequestBody(command, DEFAULT_API_REQUEST_BODY, DEFAULT_API_REQUEST_BODY)).toContain('"commandType": "command"');
  });
});
