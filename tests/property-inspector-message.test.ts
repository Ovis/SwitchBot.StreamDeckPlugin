import { describe, expect, it } from "vitest";
import { propertyInspectorMessage } from "../src/settings/property-inspector-messages.js";

describe("propertyInspectorMessage", () => {
  it("reads the action instance ID from the SDK SendToPluginEvent shape", () => {
    expect(propertyInspectorMessage({
      action: { id: "action-123" },
      payload: { event: "getDevices" }
    })).toEqual({
      context: "action-123",
      payload: { event: "getDevices" }
    });
  });

  it("does not depend on the raw WebSocket context field", () => {
    expect(propertyInspectorMessage({
      context: "raw-context",
      action: { id: "sdk-action" },
      payload: { event: "testConnection" }
    })).toEqual({
      context: "sdk-action",
      payload: { event: "testConnection" }
    });
  });

  it("keeps payload while failing closed when the SDK action is unavailable", () => {
    expect(propertyInspectorMessage({
      payload: { event: "getPhysicalControlCatalog" }
    })).toEqual({
      payload: { event: "getPhysicalControlCatalog" }
    });
  });
});
