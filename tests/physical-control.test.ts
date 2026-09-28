import { describe, expect, it } from "vitest";
import { buildPhysicalCommand, physicalCommandBody, physicalCommandRequest } from "../src/physical-control/physical-command-builder.js";
import { physicalDeviceDefinition, supportsPhysicalAction } from "../src/physical-control/physical-control-catalog.js";

describe("Bot physical control", () => {
  it("Botだけをbot actionの対象として明示する", () => {
    expect(supportsPhysicalAction("Bot", "bot")).toBe(true);
    expect(supportsPhysicalAction("MeterPlus", "bot")).toBe(false);
    expect(physicalDeviceDefinition("Unknown Future Device")).toBeUndefined();
  });

  it.each([
    ["turn-on", "turnOn"],
    ["turn-off", "turnOff"],
    ["press", "press"]
  ])("%sを公式Control Commandへ変換する", (operationId, command) => {
    const built = buildPhysicalCommand({ action: "bot", deviceId: "AA BB", deviceType: "Bot", operationId });
    expect(built.request).toEqual({
      method: "POST",
      path: "/v1.1/devices/AA%20BB/commands",
      body: JSON.stringify({ command, parameter: "default", commandType: "command" })
    });
  });

  it("PIプレビューと実送信で同じPhysicalCommand変換を使用できる", () => {
    const built = buildPhysicalCommand({ action: "bot", deviceId: "bot-1", deviceType: "Bot", operationId: "press" });
    expect(built.command).toBeDefined();
    expect(physicalCommandBody(built.command!, true)).toBe(JSON.stringify({
      command: "press",
      parameter: "default",
      commandType: "command"
    }, null, 2));
    expect(physicalCommandRequest(built.command!)).toEqual(built.request);
  });

  it("未知deviceTypeと未知operationはfail closedする", () => {
    expect(buildPhysicalCommand({ action: "bot", deviceId: "id", deviceType: "Unknown", operationId: "press" }).request).toBeUndefined();
    expect(buildPhysicalCommand({ action: "bot", deviceId: "id", deviceType: "Bot", operationId: "future" }).request).toBeUndefined();
  });
});


describe("Power physical control", () => {
  it.each([
    ["Plug", ["turn-on", "turn-off"]],
    ["Plug Mini (US)", ["turn-on", "turn-off", "toggle"]],
    ["Plug Mini (JP)", ["turn-on", "turn-off", "toggle"]],
    ["Plug Mini (EU)", ["turn-on", "turn-off", "toggle"]]
  ] as const)("%sの公式Control Commandsだけを公開する", (deviceType, operationIds) => {
    const definition = physicalDeviceDefinition(deviceType);
    expect(definition?.action).toBe("power");
    expect(definition?.operations.map(operation => operation.id)).toEqual(operationIds);
    expect(supportsPhysicalAction(deviceType, "power")).toBe(true);
  });

  it.each([
    ["Plug", "turn-on", "turnOn"],
    ["Plug", "turn-off", "turnOff"],
    ["Plug Mini (US)", "toggle", "toggle"],
    ["Plug Mini (JP)", "toggle", "toggle"],
    ["Plug Mini (EU)", "toggle", "toggle"]
  ])("%sの%sを正しいControl Commandへ変換する", (deviceType, operationId, command) => {
    const built = buildPhysicalCommand({ action: "power", deviceId: "POWER-001", deviceType, operationId });
    expect(built.request).toEqual({
      method: "POST",
      path: "/v1.1/devices/POWER-001/commands",
      body: JSON.stringify({ command, parameter: "default", commandType: "command" })
    });
  });

  it("通常Plugではtoggleをfail closedする", () => {
    const built = buildPhysicalCommand({
      action: "power",
      deviceId: "PLUG-001",
      deviceType: "Plug",
      operationId: "toggle"
    });
    expect(built.request).toBeUndefined();
    expect(built.error).toBe("unsupported-operation");
  });

  it("Relay Switchはパラメータ付き仕様を実装するまでPower対象にしない", () => {
    expect(supportsPhysicalAction("Relay Switch 1", "power")).toBe(false);
    expect(supportsPhysicalAction("Relay Switch 1PM", "power")).toBe(false);
    expect(supportsPhysicalAction("Relay Switch 2PM", "power")).toBe(false);
  });
});


describe("Lighting physical control", () => {
  it.each([
    ["Color Bulb", ["turn-on", "turn-off", "toggle", "set-brightness", "set-color", "set-color-temperature"]],
    ["Strip Light", ["turn-on", "turn-off", "toggle", "set-brightness", "set-color"]],
    ["Floor Lamp", ["turn-on", "turn-off", "toggle", "set-brightness", "set-color", "set-color-temperature"]],
    ["Strip Light 3", ["turn-on", "turn-off", "toggle", "set-brightness", "set-color", "set-color-temperature"]],
    ["RGBICWW Strip Light", ["turn-on", "turn-off", "toggle", "set-brightness", "set-color", "set-color-temperature"]],
    ["RGBICWW Floor Lamp", ["turn-on", "turn-off", "toggle", "set-brightness", "set-color", "set-color-temperature"]],
    ["RGBIC Neon Wire Rope Light", ["turn-on", "turn-off", "toggle", "set-brightness", "set-color"]],
    ["RGBIC Neon Rope Light", ["turn-on", "turn-off", "toggle", "set-brightness", "set-color"]],
    ["Permanent Outdoor Lights", ["turn-on", "turn-off", "toggle", "set-brightness", "set-color", "set-color-temperature"]],
    ["Ceiling Light", ["turn-on", "turn-off", "toggle", "set-brightness", "set-color-temperature"]],
    ["Ceiling Light Pro", ["turn-on", "turn-off", "toggle", "set-brightness", "set-color-temperature"]],
    ["RGBICWW Ceiling Light", ["turn-on", "turn-off", "toggle", "turn-on-main-light", "turn-off-main-light", "turn-on-color-light", "turn-off-color-light", "set-main-light-brightness", "set-main-light-color-temperature", "set-color-light-brightness", "set-color-light-rgb"]],
    ["Candle Warmer Lamp", ["turn-on", "turn-off", "toggle", "set-brightness"]]
  ] as const)("%sでは公式Control Commandsだけを公開する", (deviceType, operationIds) => {
    const definition = physicalDeviceDefinition(deviceType);
    expect(definition?.action).toBe("lighting");
    expect(definition?.operations.map(operation => operation.id)).toEqual(operationIds);
  });

  it("明るさのdeviceType別範囲を検証する", () => {
    expect(buildPhysicalCommand({
      action: "lighting", deviceId: "L1", deviceType: "Color Bulb", operationId: "set-brightness",
      operationParameters: { value: 0 }
    }).error).toBe("invalid-parameter");
    expect(buildPhysicalCommand({
      action: "lighting", deviceId: "L1", deviceType: "Color Bulb", operationId: "set-brightness",
      operationParameters: { value: 1 }
    }).command?.parameter).toBe("1");
    expect(buildPhysicalCommand({
      action: "lighting", deviceId: "L2", deviceType: "Floor Lamp", operationId: "set-brightness",
      operationParameters: { value: 0 }
    }).command?.parameter).toBe("0");
  });

  it("RGBを0-255の3成分として正規化する", () => {
    const built = buildPhysicalCommand({
      action: "lighting", deviceId: "L1", deviceType: "Color Bulb", operationId: "set-color",
      operationParameters: { value: "255:000:7" }
    });
    expect(built.command?.parameter).toBe("255:0:7");
    expect(buildPhysicalCommand({
      action: "lighting", deviceId: "L1", deviceType: "Color Bulb", operationId: "set-color",
      operationParameters: { value: "256:0:0" }
    }).error).toBe("invalid-parameter");
  });

  it("色温度を2700-6500Kに制限する", () => {
    expect(buildPhysicalCommand({
      action: "lighting", deviceId: "L1", deviceType: "Color Bulb", operationId: "set-color-temperature",
      operationParameters: { value: 2700 }
    }).command?.parameter).toBe("2700");
    expect(buildPhysicalCommand({
      action: "lighting", deviceId: "L1", deviceType: "Color Bulb", operationId: "set-color-temperature",
      operationParameters: { value: 6501 }
    }).error).toBe("invalid-parameter");
  });

  it("RGBICWW Ceiling LightのMain/Color Light固有commandを構築する", () => {
    expect(buildPhysicalCommand({
      action: "lighting", deviceId: "L3", deviceType: "RGBICWW Ceiling Light",
      operationId: "set-main-light-brightness", operationParameters: { value: 50 }
    }).command).toMatchObject({ command: "setMainLightBrightness", parameter: "50" });
    expect(buildPhysicalCommand({
      action: "lighting", deviceId: "L3", deviceType: "RGBICWW Ceiling Light",
      operationId: "set-color-light-rgb", operationParameters: { value: "1:2:3" }
    }).command).toMatchObject({ command: "setColorLightRGB", parameter: "1:2:3" });
  });

  it("parameter必須Operationは未入力をfail closedする", () => {
    expect(buildPhysicalCommand({
      action: "lighting", deviceId: "L1", deviceType: "Color Bulb", operationId: "set-brightness"
    }).error).toBe("invalid-parameter");
  });
});


describe("Climate physical control", () => {
  it.each([
    ["Humidifier", ["turn-on", "turn-off", "mode-auto", "mode-34", "mode-67", "mode-100", "target-humidity"]],
    ["Humidifier2", ["turn-on", "turn-off", "level-4", "level-3", "level-2", "level-1", "target-humidity", "sleep", "auto", "drying", "child-lock-on", "child-lock-off"]],
    ["Evaporative Humidifier", ["turn-on", "turn-off", "level-4", "level-3", "level-2", "level-1", "target-humidity", "sleep", "auto", "drying", "child-lock-on", "child-lock-off"]],
    ["Evaporative Humidifier (Auto-refill)", ["turn-on", "turn-off", "level-4", "level-3", "level-2", "level-1", "target-humidity", "sleep", "auto", "drying", "child-lock-on", "child-lock-off"]],
    ["Air Purifier VOC", ["turn-on", "turn-off", "normal", "auto", "sleep", "pet", "child-lock-on", "child-lock-off"]],
    ["Air Purifier PM2.5", ["turn-on", "turn-off", "normal", "auto", "sleep", "pet", "child-lock-on", "child-lock-off"]],
    ["Air Purifier Table VOC", ["turn-on", "turn-off", "normal", "auto", "sleep", "pet", "child-lock-on", "child-lock-off"]],
    ["Air Purifier Table PM2.5", ["turn-on", "turn-off", "normal", "auto", "sleep", "pet", "child-lock-on", "child-lock-off"]],
    ["Smart Radiator Thermostat", ["turn-on", "turn-off", "schedule", "manual", "off-mode", "eco", "comfort", "quick-heat", "manual-temperature"]]
  ] as const)("%sでは公式Control Commandsだけを公開する", (deviceType, operationIds) => {
    const definition = physicalDeviceDefinition(deviceType);
    expect(definition?.action).toBe("climate");
    expect(definition?.operations.map(operation => operation.id)).toEqual(operationIds);
    expect(supportsPhysicalAction(deviceType, "climate")).toBe(true);
  });

  it("read-onlyのHome Climate PanelはControl対象にしない", () => {
    expect(supportsPhysicalAction("Home Climate Panel", "climate")).toBe(false);
  });

  it.each([
    ["Humidifier", "mode-auto", undefined, "setMode", "auto"],
    ["Humidifier", "mode-34", undefined, "setMode", "101"],
    ["Humidifier", "target-humidity", 55, "setMode", "55"],
    ["Humidifier2", "auto", undefined, "setMode", '{"mode":7,"targetHumidify":0}'],
    ["Humidifier2", "target-humidity", 55, "setMode", '{"mode":5,"targetHumidify":55}'],
    ["Humidifier2", "child-lock-on", undefined, "setChildLock", "true"],
    ["Air Purifier VOC", "normal", 2, "setMode", '{"mode":1,"fanGear":2}'],
    ["Air Purifier VOC", "sleep", undefined, "setMode", '{"mode":3}'],
    ["Air Purifier VOC", "child-lock-off", undefined, "setChildLock", "0"],
    ["Smart Radiator Thermostat", "eco", undefined, "setMode", "3"],
    ["Smart Radiator Thermostat", "manual-temperature", 22, "setManualModeTemperature", "22"]
  ])("%sの%sを公式wire parameterへ変換する", (deviceType, operationId, value, command, parameter) => {
    const built = buildPhysicalCommand({
      action: "climate", deviceId: "CLIMATE-001", deviceType, operationId,
      ...(value === undefined ? {} : { operationParameters: { value } })
    });
    expect(built.command).toMatchObject({ command, parameter, commandType: "command" });
  });

  it("Climateの入力範囲をfail closedする", () => {
    expect(buildPhysicalCommand({
      action: "climate", deviceId: "C1", deviceType: "Humidifier", operationId: "target-humidity",
      operationParameters: { value: 101 }
    }).error).toBe("invalid-parameter");
    expect(buildPhysicalCommand({
      action: "climate", deviceId: "C2", deviceType: "Air Purifier VOC", operationId: "normal",
      operationParameters: { value: 4 }
    }).error).toBe("invalid-parameter");
    expect(buildPhysicalCommand({
      action: "climate", deviceId: "C3", deviceType: "Smart Radiator Thermostat", operationId: "manual-temperature",
      operationParameters: { value: 3 }
    }).error).toBe("invalid-parameter");
  });
});
