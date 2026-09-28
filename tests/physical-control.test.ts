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
