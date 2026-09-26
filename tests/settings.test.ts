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

  it("falls back safely for malformed settings", () => {
    expect(normalizeApiRequestSettings({ version: 99, method: 123 })).toMatchObject({
      version: 1,
      method: "POST"
    });
  });
});
