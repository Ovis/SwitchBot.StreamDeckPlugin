import { describe, expect, it } from "vitest";
import { findApiEndpoint, resolveApiEndpoint } from "../src/api/api-endpoints.js";

describe("API endpoint presets", () => {
  it("defines the common SwitchBot device and scene endpoints", () => {
    expect(findApiEndpoint("get-device-status")).toMatchObject({ method: "GET", path: "/v1.1/devices/{deviceId}/status" });
    expect(findApiEndpoint("execute-scene")).toMatchObject({ method: "POST", path: "/v1.1/scenes/{sceneId}/execute" });
  });

  it("expands selected device and scene IDs safely", () => {
    expect(resolveApiEndpoint("get-device-status", "POST", "", "A/B", "")).toEqual({ method: "GET", path: "/v1.1/devices/A%2FB/status" });
    expect(resolveApiEndpoint("execute-scene", "GET", "", "", "Scene 1")).toEqual({ method: "POST", path: "/v1.1/scenes/Scene%201/execute" });
  });

  it("requires catalog selections for parameterized presets", () => {
    expect(resolveApiEndpoint("get-device-status", "POST", "", "", "")).toBeUndefined();
    expect(resolveApiEndpoint("execute-scene", "POST", "", "", "")).toBeUndefined();
  });

  it("keeps custom method and path", () => {
    expect(resolveApiEndpoint("custom", "DELETE", "/v1.1/custom", "", "")).toEqual({ method: "DELETE", path: "/v1.1/custom" });
  });
});
