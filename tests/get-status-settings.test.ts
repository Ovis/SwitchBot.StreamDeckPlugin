import { describe, expect, it } from "vitest";
import { normalizeGetStatusSettings } from "../src/settings/get-status-settings.js";

describe("Get Status settings", () => {
  it("keeps a configured device ID and output option", () => {
    expect(normalizeGetStatusSettings({
      version: 1,
      deviceId: "ABC/123",
      output: { prettyPrint: false }
    })).toEqual({
      version: 1,
      deviceId: "ABC/123",
      output: { prettyPrint: false }
    });
  });

  it("falls back to safe defaults for malformed persisted settings", () => {
    expect(normalizeGetStatusSettings({ version: 2, deviceId: 123 })).toEqual({
      version: 1,
      deviceId: "",
      output: { prettyPrint: true }
    });
  });
});
