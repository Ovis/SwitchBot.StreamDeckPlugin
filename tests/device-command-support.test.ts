import { describe, expect, it } from "vitest";
import { supportsControlCommands } from "../src/api/device-command-support.js";

describe("Control Commands device support", () => {
  it.each([
    "Bot", "Curtain", "Curtain3", "Blind Tilt",
    "Keypad", "Keypad Touch", "Lock", "Smart Lock Pro", "Smart Lock Pro Wifi", "Smart Lock Ultra",
    "Color Bulb", "Strip Light", "Ceiling Light",
    "Robot Vacuum Cleaner S10", "Robot Vacuum Cleaner S1",
    "Battery Circulator Fan", "Humidifier",
    "Plug", "Plug Mini (JP)", "Relay Switch 1",
    "WeatherStation", "AI Art Frame", "Kata Friends"
  ])("includes documented command-capable deviceType %s", deviceType => {
    expect(supportsControlCommands(deviceType)).toBe(true);
  });

  it.each([
    "Meter", "MeterPlus", "MeterPro", "MeterPro(CO2)", "WoIOSensor",
    "Motion Sensor", "Contact Sensor", "Presence Sensor", "Water Leak Detector",
    "Hub Mini", "Hub 2", "Hub 3", "Remote", "AI MindClip", "Home Climate Panel",
    "Indoor Cam", "Pan/Tilt Cam"
  ])("excludes documented non-command deviceType %s", deviceType => {
    expect(supportsControlCommands(deviceType)).toBe(false);
  });

  it("fails closed for an unknown future device type", () => {
    expect(supportsControlCommands("Future Device")).toBe(false);
  });
});
