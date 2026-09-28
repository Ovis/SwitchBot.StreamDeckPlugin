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
