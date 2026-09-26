import { describe, expect, it, vi } from "vitest";
import { SwitchBotAuth } from "../src/api/switchbot-auth.js";
import { SwitchBotClient, type FetchLike } from "../src/api/switchbot-client.js";

describe("SwitchBotClient", () => {
  it("uses the fixed SwitchBot origin and signed headers", async () => {
    const fetchImpl = vi.fn(async () => new Response(
      JSON.stringify({ statusCode: 100, body: {}, message: "success" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )) as unknown as FetchLike;
    const auth = new SwitchBotAuth({ now: () => 1234, nonce: () => "nonce" });
    const client = new SwitchBotClient(auth, fetchImpl);

    await client.request(
      { method: "GET", path: "/v1.1/devices" },
      { token: "token", secret: "secret" }
    );

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(String(url)).toBe("https://api.switch-bot.com/v1.1/devices");
    const headers = init.headers as Headers;
    expect(headers.get("Authorization")).toBe("token");
    expect(headers.get("t")).toBe("1234");
    expect(headers.get("nonce")).toBe("nonce");
    expect(headers.get("sign")).toBeTruthy();
  });

  it("sends JSON body only for body methods", async () => {
    const fetchImpl = vi.fn(async () => new Response(
      JSON.stringify({ statusCode: 100 }), { status: 200 }
    )) as unknown as FetchLike;
    const client = new SwitchBotClient(
      new SwitchBotAuth({ now: () => 1, nonce: () => "n" }),
      fetchImpl
    );

    await client.request(
      { method: "POST", path: "/v1.1/devices/id/commands", body: "{}" },
      { token: "t", secret: "s" }
    );

    const [, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(init.body).toBe("{}");
    expect((init.headers as Headers).get("Content-Type")).toBe("application/json");
  });

  it("applies the configured request timeout", async () => {
    const fetchImpl = vi.fn(async (_input: any, init?: RequestInit) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      expect(init?.signal?.aborted).toBe(false);
      return new Response(JSON.stringify({ statusCode: 100 }), { status: 200 });
    }) as unknown as FetchLike;
    const client = new SwitchBotClient(
      new SwitchBotAuth({ now: () => 1, nonce: () => "n" }),
      fetchImpl,
      { timeoutMs: 50 }
    );

    await client.request(
      { method: "GET", path: "/v1.1/devices" },
      { token: "t", secret: "s" }
    );
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("rejects an alternate origin before fetch", async () => {
    const fetchImpl = vi.fn() as unknown as FetchLike;
    const client = new SwitchBotClient(undefined, fetchImpl);
    await expect(client.request(
      { method: "GET", path: "//evil.example/x" },
      { token: "t", secret: "s" }
    )).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
