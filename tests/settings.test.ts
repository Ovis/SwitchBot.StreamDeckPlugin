import { describe, expect, it } from "vitest";
import { DEFAULT_API_REQUEST_BODY, normalizeApiRequestSettings } from "../src/settings/api-request-settings.js";
import { getCredentials, normalizeGlobalSettings } from "../src/settings/global-settings.js";
import { normalizeGetStatusSettings } from "../src/settings/get-status-settings.js";

describe("settings normalization", () => {
  it("applies API Request defaults", () => {
    expect(normalizeApiRequestSettings({})).toEqual({
      version: 1,
      method: "POST",
      path: "",
      body: DEFAULT_API_REQUEST_BODY,
      output: { copyResponseToClipboard: false, prettyPrint: true }
    });
  });

  it("applies Get Status defaults", () => {
    expect(normalizeGetStatusSettings({})).toEqual({
      version: 1,
      deviceId: "",
      output: { prettyPrint: true }
    });
  });

  it("does not expose incomplete credentials", () => {
    expect(getCredentials(normalizeGlobalSettings({ version: 1, credentials: { token: "x" } }))).toBeUndefined();
  });

  it("trims complete credentials", () => {
    expect(getCredentials(normalizeGlobalSettings({
      version: 1,
      credentials: { token: " token ", secret: " secret " }
    }))).toEqual({ token: "token", secret: "secret" });
  });

  it("recovers malformed v1 fields without discarding valid fields", () => {
    expect(normalizeApiRequestSettings({
      version: 1,
      method: 123,
      path: "/v1.1/devices",
      body: "{}",
      output: { copyResponseToClipboard: true, prettyPrint: "invalid" }
    })).toEqual({
      version: 1,
      method: "POST",
      path: "/v1.1/devices",
      body: "{}",
      output: { copyResponseToClipboard: true, prettyPrint: true }
    });
  });

  it("does not interpret unknown future versions as v1", () => {
    expect(normalizeApiRequestSettings({
      version: 99,
      method: "GET",
      path: "/future"
    })).toEqual({
      version: 1,
      method: "POST",
      path: "",
      body: DEFAULT_API_REQUEST_BODY,
      output: { copyResponseToClipboard: false, prettyPrint: true }
    });
  });

  it("recovers a malformed Get Status output without losing device ID", () => {
    expect(normalizeGetStatusSettings({
      version: 1,
      deviceId: "device",
      output: { prettyPrint: "invalid" }
    })).toEqual({
      version: 1,
      deviceId: "device",
      output: { prettyPrint: true }
    });
  });
});
