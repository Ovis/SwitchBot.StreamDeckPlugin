import { describe, expect, it } from "vitest";
import { normalizeGetStatusSettings } from "../src/settings/get-status-settings.js";

describe("Get Status settings", () => {
  it("keeps a configured device ID and output option", () => {
    expect(normalizeGetStatusSettings({
      version: 1,
      deviceId: "ABC/123",
      buttonName: "Living room",
      output: {
        showStatusOnKey: true,
        copyResponseToClipboard: false,
        prettyPrint: false,
        statusTemplate: "Temp:{temperature}"
      }
    })).toEqual({
      version: 1,
      deviceId: "ABC/123",
      buttonName: "Living room",
      output: {
        showStatusOnKey: true,
        copyResponseToClipboard: false,
        prettyPrint: false,
        statusTemplate: "Temp:{temperature}"
      }
    });
  });

  it("preserves individual output values when sibling fields are missing", () => {
    expect(normalizeGetStatusSettings({
      version: 1,
      output: { copyResponseToClipboard: true }
    }).output).toEqual({
      showStatusOnKey: true,
      copyResponseToClipboard: true,
      prettyPrint: true,
      statusTemplate: ""
    });
  });

  it("keeps version 1 persisted settings backward compatible", () => {
    expect(normalizeGetStatusSettings({
      version: 1,
      deviceId: "A",
      output: { showStatusOnKey: false, prettyPrint: false }
    }).output.statusTemplate).toBe("");
  });

  it("falls back to safe defaults for malformed persisted settings", () => {
    expect(normalizeGetStatusSettings({ version: 2, deviceId: 123 })).toEqual({
      version: 1,
      deviceId: "",
      buttonName: "",
      output: {
        showStatusOnKey: true,
        copyResponseToClipboard: false,
        prettyPrint: true,
        statusTemplate: ""
      }
    });
  });
});
