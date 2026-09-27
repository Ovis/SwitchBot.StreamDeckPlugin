import { describe, expect, it } from "vitest";
import { formatStatusForKey } from "../src/output/status-title-formatter.js";
import { normalizeGetStatusSettings } from "../src/settings/get-status-settings.js";

describe("Get Status key title", () => {
  it("formats common sensor fields in priority order", () => {
    expect(formatStatusForKey({
      statusCode: 100,
      body: { deviceId: "A", humidity: 54, temperature: 23.8, battery: 87, deviceType: "MeterPlus" }
    })).toBe("Temp: 23.8°C\nHumidity: 54%\nBattery: 87%");
  });

  it("falls back to short primitive status fields", () => {
    expect(formatStatusForKey({
      body: { deviceId: "A", deviceType: "Unknown", mode: "auto", speed: 2 }
    })).toBe("mode: auto\nspeed: 2");
  });

  it("localizes case-sensitive SwitchBot status values in Japanese", () => {
    expect(formatStatusForKey({ body: { motion: "notDetected" } }, "ja")).toBe("motion: 未検知");
  });

  it("returns no title when there is no displayable status body", () => {
    expect(formatStatusForKey({ statusCode: 100, body: {} })).toBeUndefined();
  });
});

describe("Get Status output settings", () => {
  it("shows status on the key and does not copy JSON by default", () => {
    expect(normalizeGetStatusSettings({}).output).toEqual({
      showStatusOnKey: true,
      copyResponseToClipboard: false,
      prettyPrint: true
    });
  });
});
