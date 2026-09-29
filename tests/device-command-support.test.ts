import { describe, expect, it } from "vitest";
import { documentedControlCommandDeviceTypes, supportsControlCommands } from "../src/api/device-command-support.js";
import { physicalDeviceDefinitions } from "../src/physical-control/physical-control-catalog.js";

describe("Control Commands device support", () => {
  it("Physical Control対象deviceTypeをすべてAPI Requestでも選択可能にする", () => {
    for (const definition of physicalDeviceDefinitions()) {
      expect(supportsControlCommands(definition.deviceType), definition.deviceType).toBe(true);
    }
  });

  it.each([
    "Keypad", "Keypad Touch", "Keypad Vision", "Keypad Vision Pro",
    "AI Art Frame", "WeatherStation", "Kata Friends"
  ])("Physical Control外でも公式Command対応の%sをAPI Requestで選択可能にする", deviceType => {
    expect(supportsControlCommands(deviceType)).toBe(true);
  });

  it.each([
    "Meter", "MeterPlus", "MeterPro", "MeterPro(CO2)", "WoIOSensor",
    "Motion Sensor", "Contact Sensor", "Presence Sensor", "Water Leak Detector",
    "Hub Mini", "Hub 2", "Hub 3", "Remote", "AI MindClip", "Home Climate Panel",
    "Indoor Cam", "Pan/Tilt Cam"
  ])("公式Control Commands非対応deviceType %sを除外する", deviceType => {
    expect(supportsControlCommands(deviceType)).toBe(false);
  });

  it.each([
    "Standing Circulator Fan",
    "Evaporative Humidifier",
    "Evaporative Humidifier (Auto-refill)",
    "Mini Robot Vacuum K10+",
    "Mini Robot Vacuum K10+ Pro",
    "K10+ Pro Combo",
    "K20+ Pro",
    "Robot Vacuum K11+"
  ])("製品名%sをGET /devicesのdeviceTypeとして推測しない", deviceType => {
    expect(supportsControlCommands(deviceType)).toBe(false);
  });

  it("公開一覧に重複deviceTypeを含めない", () => {
    expect(new Set(documentedControlCommandDeviceTypes).size).toBe(documentedControlCommandDeviceTypes.length);
  });

  it("未知の将来deviceTypeはfail closedする", () => {
    expect(supportsControlCommands("Future Device")).toBe(false);
  });
});
