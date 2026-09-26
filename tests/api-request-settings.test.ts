import { describe, expect, it } from "vitest";
import { DEFAULT_API_REQUEST_BODY, normalizeApiRequestSettings } from "../src/settings/api-request-settings.js";

describe("API Request settings", () => {
  it("uses v1 defaults", () => {
    expect(normalizeApiRequestSettings({})).toEqual({
      version: 1,
      method: "POST",
      path: "",
      body: DEFAULT_API_REQUEST_BODY,
      output: { copyResponseToClipboard: false, prettyPrint: true }
    });
  });

  it("keeps configured values", () => {
    expect(normalizeApiRequestSettings({
      version: 1,
      method: "PUT",
      path: "/v1.1/devices/id/commands",
      body: '{"command":"x"}',
      output: { copyResponseToClipboard: true, prettyPrint: false }
    })).toEqual({
      version: 1,
      method: "PUT",
      path: "/v1.1/devices/id/commands",
      body: '{"command":"x"}',
      output: { copyResponseToClipboard: true, prettyPrint: false }
    });
  });
});
