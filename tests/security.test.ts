import { describe, expect, it, vi } from "vitest";
import { SwitchBotAuth } from "../src/api/switchbot-auth.js";
import { SwitchBotClient, type FetchLike } from "../src/api/switchbot-client.js";
import { RequestExecutor } from "../src/execution/request-executor.js";

describe("security boundaries", () => {
  it("does not allow extension headers to override authentication headers", async () => {
    const fetchImpl = vi.fn(async () => new Response(
      JSON.stringify({ statusCode: 100 }), { status: 200 }
    )) as unknown as FetchLike;
    const client = new SwitchBotClient(
      new SwitchBotAuth({ now: () => 1234, nonce: () => "safe-nonce" }),
      fetchImpl
    );

    await client.request({
      method: "GET",
      path: "/v1.1/devices",
      headers: {
        Authorization: "attacker-token",
        sign: "attacker-sign",
        t: "0",
        nonce: "attacker-nonce",
        Host: "evil.example",
        "Content-Length": "999",
        "X-Custom": "allowed"
      }
    }, { token: "real-token", secret: "real-secret" });

    const [, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const headers = init.headers as Headers;
    expect(headers.get("Authorization")).toBe("real-token");
    expect(headers.get("sign")).not.toBe("attacker-sign");
    expect(headers.get("t")).toBe("1234");
    expect(headers.get("nonce")).toBe("safe-nonce");
    expect(headers.get("Host")).toBeNull();
    expect(headers.get("Content-Length")).toBeNull();
    expect(headers.get("X-Custom")).toBe("allowed");
  });

  it("does not expose transport exception messages", async () => {
    const secret = "DO_NOT_LEAK_SECRET";
    const client = {
      request: async () => { throw new Error(`request failed with ${secret}`); }
    } as unknown as SwitchBotClient;
    const executor = new RequestExecutor(client, {
      getCredentials: async () => ({ token: "token", secret })
    });

    const result = await executor.execute({ method: "GET", path: "/v1.1/devices" });
    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected execution to fail.");
    expect(result.error.category).toBe("network");
    expect(result.error.message).toBe("SwitchBot network request failed.");
    expect(JSON.stringify(result)).not.toContain(secret);
  });
});
