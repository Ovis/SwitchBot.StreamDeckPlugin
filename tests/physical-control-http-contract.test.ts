import { describe, expect, it, vi } from "vitest";
import { SwitchBotClient, type FetchLike } from "../src/api/switchbot-client.js";
import type { SwitchBotCredentials } from "../src/api/switchbot-auth.js";
import { RequestExecutor } from "../src/execution/request-executor.js";
import { buildPhysicalCommand } from "../src/physical-control/physical-command-builder.js";

const CREDENTIALS: SwitchBotCredentials = {
  token: "test-token",
  secret: "test-secret"
};

/**
 * 実際のSwitchBotClientまで通し、Physical Controlが最終的に生成するHTTP requestを検証する。
 *
 * 実機を所有していないdeviceTypeでも、catalogからHTTP境界までの変換が公式仕様から
 * 乖離していないことをCIで固定するため、fetchだけをテスト境界として差し替える。
 */
describe("Physical Control HTTP contract", () => {
  it.each([
    ["turn-on", "turnOn"],
    ["turn-off", "turnOff"],
    ["press", "press"]
  ])("Botの%sをControl Command APIの正しいPOSTへ変換する", async (operationId, command) => {
    const fetchMock = vi.fn<FetchLike>(async () => new Response(
      JSON.stringify({ statusCode: 100, message: "success", body: {} }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    ));
    const client = new SwitchBotClient(undefined, fetchMock);
    const executor = new RequestExecutor(client, {
      getCredentials: async () => CREDENTIALS
    }, () => new Date("2026-09-28T00:00:00.000Z"));

    const built = buildPhysicalCommand({
      action: "bot",
      deviceId: "BOT 001",
      deviceType: "Bot",
      operationId
    });
    expect(built.request).toBeDefined();

    const result = await executor.execute(built.request!);

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url.toString()).toBe("https://api.switch-bot.com/v1.1/devices/BOT%20001/commands");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({
      command,
      parameter: "default",
      commandType: "command"
    }));
    expect(new Headers(init?.headers).get("Content-Type")).toBe("application/json");
  });

  it.each([
    ["Plug", "turn-on", "turnOn"],
    ["Plug Mini (US)", "toggle", "toggle"],
    ["Plug Mini (JP)", "turn-off", "turnOff"],
    ["Plug Mini (EU)", "turn-on", "turnOn"]
  ])("%sの%sを正しいHTTP requestとして送信する", async (deviceType, operationId, command) => {
    const fetchMock = vi.fn<FetchLike>(async () => new Response(
      JSON.stringify({ statusCode: 100, message: "success", body: {} }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    ));
    const client = new SwitchBotClient(undefined, fetchMock);
    const executor = new RequestExecutor(client, {
      getCredentials: async () => CREDENTIALS
    });

    const built = buildPhysicalCommand({
      action: "power",
      deviceId: "POWER-001",
      deviceType,
      operationId
    });
    expect(built.request).toBeDefined();

    const result = await executor.execute(built.request!);

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url.toString()).toBe("https://api.switch-bot.com/v1.1/devices/POWER-001/commands");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({
      command,
      parameter: "default",
      commandType: "command"
    }));
  });

  it.each([
    ["Color Bulb", "set-brightness", "50", "setBrightness"],
    ["Color Bulb", "set-color", "255:0:0", "setColor"],
    ["Color Bulb", "set-color-temperature", "4000", "setColorTemperature"],
    ["RGBICWW Ceiling Light", "set-main-light-brightness", "75", "setMainLightBrightness"],
    ["RGBICWW Ceiling Light", "set-color-light-rgb", "1:2:3", "setColorLightRGB"]
  ])("%sの%sをparameter付きHTTP requestとして送信する", async (deviceType, operationId, parameter, command) => {
    const fetchMock = vi.fn<FetchLike>(async () => new Response(
      JSON.stringify({ statusCode: 100, message: "success", body: {} }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    ));
    const executor = new RequestExecutor(new SwitchBotClient(undefined, fetchMock), {
      getCredentials: async () => CREDENTIALS
    });
    const built = buildPhysicalCommand({
      action: "lighting",
      deviceId: "LIGHT-001",
      deviceType,
      operationId,
      operationParameters: { value: parameter }
    });
    expect(built.request).toBeDefined();

    const result = await executor.execute(built.request!);

    expect(result.success).toBe(true);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url.toString()).toBe("https://api.switch-bot.com/v1.1/devices/LIGHT-001/commands");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({ command, parameter, commandType: "command" }));
  });

  it.each([
    ["Humidifier", "target-humidity", 50, "setMode", "50"],
    ["Humidifier2", "target-humidity", 60, "setMode", '{"mode":5,"targetHumidify":60}'],
    ["Air Purifier VOC", "normal", 2, "setMode", '{"mode":1,"fanGear":2}'],
    ["Smart Radiator Thermostat", "manual-temperature", 22, "setManualModeTemperature", "22"],
    ["Battery Circulator Fan", "close-delay", 1800, "closeDelay", "1800"],
    ["Battery Circulator Fan 2 Pro", "wind-speed", 50, "setWindSpeed", "50"]
  ])("%sの%sをparameter付きHTTP requestとして送信する", async (deviceType, operationId, value, command, parameter) => {
    const fetchMock = vi.fn<FetchLike>(async () => new Response(
      JSON.stringify({ statusCode: 100, message: "success", body: {} }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    ));
    const executor = new RequestExecutor(new SwitchBotClient(undefined, fetchMock), {
      getCredentials: async () => CREDENTIALS
    });
    const built = buildPhysicalCommand({
      action: "climate",
      deviceId: "CLIMATE-001",
      deviceType,
      operationId,
      operationParameters: { value }
    });
    expect(built.request).toBeDefined();

    const result = await executor.execute(built.request!);

    expect(result.success).toBe(true);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url.toString()).toBe("https://api.switch-bot.com/v1.1/devices/CLIMATE-001/commands");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({ command, parameter, commandType: "command" }));
  });

  it.each([
    ["Smart Lock Pro", "lock", "lock"],
    ["Smart Lock Pro", "unlock", "unlock"],
    ["Smart Lock Pro", "deadbolt", "deadbolt"],
    ["Smart Lock Pro Wifi", "night-latch-unlock", "nightLatchUnlock"],
    ["Garage Door Opener", "open", "turnOn"],
    ["Video Doorbell", "motion-detection-off", "disableMotionDetection"]
  ])("%sの%sを正しいSecurity HTTP requestとして送信する", async (deviceType, operationId, command) => {
    const fetchMock = vi.fn<FetchLike>(async () => new Response(
      JSON.stringify({ statusCode: 100, message: "success", body: {} }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    ));
    const executor = new RequestExecutor(new SwitchBotClient(undefined, fetchMock), {
      getCredentials: async () => CREDENTIALS
    });
    const built = buildPhysicalCommand({
      action: "security", deviceId: "LOCK-PRO-001", deviceType, operationId
    });
    expect(built.request).toBeDefined();

    const result = await executor.execute(built.request!);

    expect(result.success).toBe(true);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url.toString()).toBe("https://api.switch-bot.com/v1.1/devices/LOCK-PRO-001/commands");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({ command, parameter: "default", commandType: "command" }));
  });

  it.each([
    ["Curtain3", "set-position", 80, "setPosition", "0,ff,80"],
    ["Blind Tilt", "set-position-up", 48, "setPosition", "up;48"],
    ["Roller Shade", "set-position", 75, "setPosition", "75"]
  ])("%sの%sを正しいCurtains & Blinds HTTP requestとして送信する", async (deviceType, operationId, value, command, parameter) => {
    const fetchMock = vi.fn<FetchLike>(async () => new Response(
      JSON.stringify({ statusCode: 100, message: "success", body: {} }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    ));
    const executor = new RequestExecutor(new SwitchBotClient(undefined, fetchMock), {
      getCredentials: async () => CREDENTIALS
    });
    const built = buildPhysicalCommand({
      action: "curtains-blinds", deviceId: "WINDOW-001", deviceType, operationId,
      operationParameters: { value }
    });
    expect(built.request).toBeDefined();

    const result = await executor.execute(built.request!);

    expect(result.success).toBe(true);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url.toString()).toBe("https://api.switch-bot.com/v1.1/devices/WINDOW-001/commands");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({ command, parameter, commandType: "command" }));
  });

  it.each([
    ["Robot Vacuum Cleaner S1", "start-cleaning", {}, "start", "default"],
    ["Robot Vacuum Cleaner S1 Plus", "start-cleaning", {}, "start", "default"],
    ["K10+", "start-cleaning", {}, "start", "default"],
    ["K10+ Pro", "start-cleaning", {}, "start", "default"],
    ["Robot Vacuum Cleaner S10", "start-cleaning", { mode: "sweep_mop", fanLevel: "2", waterLevel: "1", times: 3 }, "startClean", JSON.stringify({ action: "sweep_mop", param: { fanLevel: 2, waterLevel: 1, times: 3 } })],
    ["Robot Vacuum Cleaner S20", "start-cleaning", { mode: "sweep", fanLevel: "1", waterLevel: "2", times: 1 }, "startClean", JSON.stringify({ action: "sweep", param: { fanLevel: 1, waterLevel: 2, times: 1 } })],
    ["Robot Vacuum Cleaner K10+ Pro Combo", "start-cleaning", { mode: "mop", fanLevel: "2", times: 3 }, "startClean", JSON.stringify({ action: "mop", param: { fanLevel: 2, times: 3 } })],
    ["Robot Vacuum Cleaner K20 Plus Pro", "start-cleaning", { mode: "sweep", fanLevel: "3", times: 2 }, "startClean", JSON.stringify({ action: "sweep", param: { fanLevel: 3, times: 2 } })],
    ["Robot Vacuum Cleaner K11+", "start-cleaning", { mode: "mop", fanLevel: "4", times: 1 }, "startClean", JSON.stringify({ action: "mop", param: { fanLevel: 4, times: 1 } })]
  ] as const)("%sをCleaning catalogからHTTP境界まで検証する", async (deviceType, operationId, operationParameters, command, parameter) => {
    const fetchMock = vi.fn<FetchLike>(async () => new Response(
      JSON.stringify({ statusCode: 100, message: "success", body: {} }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    ));
    const executor = new RequestExecutor(new SwitchBotClient(undefined, fetchMock), {
      getCredentials: async () => CREDENTIALS
    });
    const built = buildPhysicalCommand({
      action: "cleaning", deviceId: "CLEANING-001", deviceType, operationId, operationParameters
    });
    expect(built.request).toBeDefined();

    const result = await executor.execute(built.request!);

    expect(result.success).toBe(true);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url.toString()).toBe("https://api.switch-bot.com/v1.1/devices/CLEANING-001/commands");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({ command, parameter, commandType: "command" }));
    expect(new Headers(init?.headers).get("Content-Type")).toBe("application/json");
  });

  it("fail closedしたPhysical ControlはHTTP境界へ到達しない", async () => {
    const fetchMock = vi.fn<FetchLike>();
    const client = new SwitchBotClient(undefined, fetchMock);
    const executor = new RequestExecutor(client, {
      getCredentials: async () => CREDENTIALS
    });

    const built = buildPhysicalCommand({
      action: "bot",
      deviceId: "BOT-001",
      deviceType: "Unknown Future Device",
      operationId: "press"
    });

    expect(built.request).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();

    // requestが存在しない時点で実行経路へ渡さないことがPhysical Control側のfail-closed契約となる。
    expect(executor).toBeDefined();
  });
});
