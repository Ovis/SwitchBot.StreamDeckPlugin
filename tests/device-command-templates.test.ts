import { describe, expect, it } from "vitest";
import { getDeviceCommandTemplate } from "../src/api/device-command-templates.js";

describe("device command templates", () => {
  it.each([
    ["Bot", "press", "default"],
    ["Plug Mini (JP)", "turnOn", "default"],
    ["Lock", "lock", "default"],
    ["Curtain3", "setPosition", "0,ff,50"],
    ["Blind Tilt", "setPosition", "up;50"],
    ["WeatherStation", "customQuote", "Hello"]
  ])("provides an editable sample for %s", (deviceType, command, parameter) => {
    const template = getDeviceCommandTemplate(deviceType);
    expect(template).toBeDefined();
    expect(JSON.parse(template!.body)).toMatchObject({ command, parameter, commandType: "command" });
  });

  it("uses the documented object parameter shape for Floor Cleaning Robot S10", () => {
    const body = JSON.parse(getDeviceCommandTemplate("Robot Vacuum Cleaner S10")!.body);
    expect(body).toEqual({
      command: "startClean",
      parameter: { action: "sweep_mop", param: { fanLevel: 1, waterLevel: 1, times: 1 } },
      commandType: "command"
    });
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
});


  it.each([
    "Smart Lock Pro",
    "Smart Lock Ultra"
  ])("matches the deviceType returned by the device list for %s", deviceType => {
    expect(getDeviceCommandTemplate(deviceType)).toBeDefined();
  });
