import { describe, expect, it } from "vitest";
import { formatStatusForKey, formatStatusTemplate, observedStatusFields } from "../src/output/status-title-formatter.js";
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

describe("Get Status display template", () => {
  const response = {
    body: {
      deviceId: "A",
      deviceType: "MeterPro(CO2)",
      temperature: 25.4,
      humidity: 53,
      CO2: 820,
      power: "on",
      enabled: true,
      nullable: null,
      nested: { value: 1 },
      values: [1, 2]
    }
  };

  it("expands primitive placeholders without limiting lines or length", () => {
    expect(formatStatusTemplate(
      response,
      "温度:{temperature}℃\n湿度:{humidity}%\nCO2:{CO2}ppm\nEnabled:{enabled}"
    )).toBe("温度:25.4℃\n湿度:53%\nCO2:820ppm\nEnabled:true");
  });

  it("expands the same placeholder more than once and preserves surrounding whitespace", () => {
    expect(formatStatusTemplate(response, "  {CO2}/{CO2}\n")).toBe("  820/820\n");
  });

  it("localizes template values using the existing localization rules", () => {
    expect(formatStatusTemplate(response, "電源:{power}", "ja")).toBe("電源:オン");
  });

  it("keeps unknown, object, and array placeholders while null becomes empty", () => {
    expect(formatStatusTemplate(
      response,
      "{missing}|{nested}|{values}|{nullable}"
    )).toBe("{missing}|{nested}|{values}|");
  });

  it("keeps field-name case sensitivity", () => {
    expect(formatStatusTemplate(response, "{CO2}/{co2}")).toBe("820/{co2}");
  });

  it.each([undefined, "", "   ", "\n\t"])("falls back to automatic formatting for an unset template", template => {
    expect(formatStatusTemplate(response, template ?? "")).toBe(formatStatusForKey(response));
  });
});

describe("Get Status observed fields", () => {
  it("extracts only direct primitive fields while preserving API case and order", () => {
    expect(observedStatusFields({
      body: {
        deviceId: "A",
        temperature: 25.4,
        humidity: 53,
        CO2: 820,
        nullable: null,
        nested: {},
        values: [],
        enabled: false,
        deviceType: "MeterPro(CO2)"
      }
    })).toEqual(["temperature", "humidity", "CO2", "enabled"]);
  });
});

describe("Get Status output settings", () => {
  it("shows status on the key and does not copy JSON by default", () => {
    expect(normalizeGetStatusSettings({}).output).toEqual({
      showStatusOnKey: true,
      copyResponseToClipboard: false,
      prettyPrint: true,
      statusTemplate: "",
      refreshIntervalMinutes: 0
    });
  });
});
