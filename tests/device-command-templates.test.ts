import { describe, expect, it } from "vitest";
import { getDeviceCommandTemplate } from "../src/api/device-command-templates.js";

describe("device command templates", () => {
  it.each([
    ["Bot", "press", "default"],
    ["Plug Mini (JP)", "turnOn", "default"],
    ["Lock", "lock", "default"],
    ["Curtain 3", "setPosition", "0,ff,50"],
    ["Blind Tilt", "setPosition", "up;50"],
    ["Weather Station", "customQuote", "Hello"]
  ])("provides an editable sample for %s", (deviceType, command, parameter) => {
    const template = getDeviceCommandTemplate(deviceType);
    expect(template).toBeDefined();
    expect(JSON.parse(template!.body)).toMatchObject({ command, parameter, commandType: "command" });
  });

  it("uses the documented object parameter shape for Floor Cleaning Robot S10", () => {
    const body = JSON.parse(getDeviceCommandTemplate("Floor Cleaning Robot S10")!.body);
    expect(body).toEqual({
      command: "startClean",
      parameter: { action: "sweep_mop", param: { fanLevel: 1, waterLevel: 1, times: 1 } },
      commandType: "command"
    });
  });

  it("does not guess a command for an unknown device type", () => {
    expect(getDeviceCommandTemplate("Future Device")).toBeUndefined();
  });
});
