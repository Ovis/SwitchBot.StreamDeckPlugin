import { describe, expect, it } from "vitest";
import { getDeviceCommandTemplate } from "../src/api/device-command-templates.js";

describe("device command templates", () => {
  it.each([
    ["Bot", "turnOn", "default"],
    ["Plug Mini (JP)", "turnOn", "default"],
    ["Lock", "lock", "default"],
    ["Curtain3", "turnOn", "default"],
    ["Blind Tilt", "fullyOpen", "default"],
    ["Robot Vacuum Cleaner S10", "pause", "default"],
    ["WeatherStation", "customQuote", "Hello"]
  ])("provides an editable sample for %s", (deviceType, command, parameter) => {
    const template = getDeviceCommandTemplate(deviceType);
    expect(template).toBeDefined();
    expect(JSON.parse(template!.body)).toMatchObject({ command, parameter, commandType: "command" });
  });

  it("入力値を必要とするOperationしかない機種へ恣意的なサンプル値を補わない", () => {
    expect(getDeviceCommandTemplate("Roller Shade")).toBeUndefined();
  });

  it("provides the documented asynchronous passcode command shape for Keypad Touch", () => {
    const body = JSON.parse(getDeviceCommandTemplate("Keypad Touch")!.body);
    expect(body).toEqual({
      command: "createKey",
      parameter: { name: "example", type: "permanent", password: "123456", startTime: 0, endTime: 0 },
      commandType: "command"
    });
  });

  it.each(["MeterPro(CO2)", "MeterPlus", "WoIOSensor", "Hub Mini", "Hub 2", "Contact Sensor", "Remote"])(
    "does not invent a control command for read-only/non-command device %s",
    deviceType => expect(getDeviceCommandTemplate(deviceType)).toBeUndefined()
  );

  it("does not guess a command for an unknown device type", () => {
    expect(getDeviceCommandTemplate("Future Device")).toBeUndefined();
  });

  it.each([
    "Smart Lock Pro",
    "Smart Lock Ultra"
  ])("matches the deviceType returned by the device list for %s", deviceType => {
    expect(getDeviceCommandTemplate(deviceType)).toBeDefined();
  });
});
