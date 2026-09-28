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
