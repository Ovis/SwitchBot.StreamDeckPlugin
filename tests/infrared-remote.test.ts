import { describe, expect, it } from "vitest";
import { infraredCommandsForRemoteType } from "../src/api/infrared-remote-commands.js";
import { buildInfraredRequest, truncateInfraredDisplayText } from "../src/api/infrared-request-builder.js";
import { normalizeInfraredRemoteSettings } from "../src/settings/infrared-remote-settings.js";

describe("infrared remote commands", () => {
  it("exposes only documented standard commands and keeps unknown types fail-closed", () => {
    expect(infraredCommandsForRemoteType("TV").map(x => x.command)).toEqual([
      "turnOn", "turnOff", "SetChannel", "volumeAdd", "volumeSub", "channelAdd", "channelSub"
    ]);
    expect(infraredCommandsForRemoteType("Others")).toEqual([]);
    expect(infraredCommandsForRemoteType("Future Device")).toEqual([]);
  });

  it("maps documented DIY remote variants to their standard appliance command set", () => {
    expect(infraredCommandsForRemoteType("DIY Fan").map(x => x.command)).toEqual([
      "turnOn", "turnOff", "swing", "timer", "lowSpeed", "middleSpeed", "highSpeed"
    ]);
    expect(infraredCommandsForRemoteType("DIY Light").map(x => x.command)).toEqual([
      "turnOn", "turnOff", "brightnessUp", "brightnessDown"
    ]);
    expect(infraredCommandsForRemoteType("DIY Air Conditioner").map(x => x.command)).toEqual([
      "turnOn", "turnOff", "setAll"
    ]);
    expect(infraredCommandsForRemoteType("DIY Future Device")).toEqual([]);
  });

  it("builds an air-conditioner setAll request", () => {
    const settings = normalizeInfraredRemoteSettings({
      deviceId: "ir/id",
      remoteType: "Air Conditioner",
      operation: "setAll",
      airConditioner: { temperature: "26", mode: "2", fanSpeed: "3", powerState: "on" }
    });
    expect(buildInfraredRequest(settings)).toMatchObject({
      request: {
        method: "POST",
        path: "/v1.1/devices/ir%2Fid/commands",
        body: JSON.stringify({ command: "setAll", parameter: "26,2,3,on", commandType: "command" })
      },
      displayText: "冷房 26℃ ON"
    });
  });

  it("trims a normal custom button name", () => {
    const settings = normalizeInfraredRemoteSettings({
      deviceId: "A",
      remoteType: "Others",
      customButtonName: "  入力切替  "
    });
    expect(buildInfraredRequest(settings).body).toEqual({
      command: "入力切替",
      parameter: "default",
      commandType: "customize"
    });
  });

  it("allows overrides to make an otherwise incomplete normal UI request valid without normalizing values", () => {
    const settings = normalizeInfraredRemoteSettings({
      deviceId: "A",
      remoteType: "Air Conditioner",
      operation: "",
      overrides: {
        command: { enabled: true, value: " raw command " },
        parameter: { enabled: true, value: "" },
        commandType: { enabled: true, value: "future-type" }
      }
    });
    expect(buildInfraredRequest(settings).body).toEqual({
      command: " raw command ",
      parameter: "",
      commandType: "future-type"
    });
  });

  it("reports the missing operation before a missing command type when only command is overridden", () => {
    const settings = normalizeInfraredRemoteSettings({
      deviceId: "A",
      remoteType: "Light",
      operation: "",
      overrides: {
        command: { enabled: true, value: "turnOn" }
      }
    });
    const result = buildInfraredRequest(settings);
    expect(result.error).toBe("No operation is selected.");
    expect(result.request).toBeUndefined();
  });

  it("requires command and commandType after overrides are applied", () => {
    const settings = normalizeInfraredRemoteSettings({
      deviceId: "A",
      remoteType: "Others",
      overrides: {
        command: { enabled: true, value: "" },
        parameter: { enabled: true, value: "" },
        commandType: { enabled: true, value: "customize" }
      }
    });
    expect(buildInfraredRequest(settings).request).toBeUndefined();
  });

  it("truncates only the temporary key display", () => {
    expect(truncateInfraredDisplayText("1234567890123456")).toBe("1234567890123456");
    expect(truncateInfraredDisplayText("12345678901234567")).toBe("123456789012345…");
  });
});
