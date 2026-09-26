import { describe, expect, it } from "vitest";
import type { SwitchBotClient } from "../src/api/switchbot-client.js";
import { RequestExecutor, type CredentialProvider } from "../src/execution/request-executor.js";
import type { ExecutionRequest } from "../src/execution/execution-request.js";

const request: ExecutionRequest = { method: "GET", path: "/v1.1/devices" };
const credentials: CredentialProvider = {
  getCredentials: async () => ({ token: "token", secret: "secret" })
};

function clientReturning(httpStatus: number, body: unknown): SwitchBotClient {
  return {
    request: async () => ({
      httpStatus,
      headers: { "content-type": "application/json" },
      rawBody: JSON.stringify(body),
      body
    })
  } as SwitchBotClient;
}

describe("RequestExecutor", () => {
  it("returns success for HTTP success and SwitchBot status 100", async () => {
    const executor = new RequestExecutor(
      clientReturning(200, { statusCode: 100, body: {}, message: "success" }),
      credentials,
      () => new Date("2026-09-26T00:00:00.000Z")
    );
    const result = await executor.execute(request);
    expect(result.success).toBe(true);
    expect(result.response?.switchBot?.statusCode).toBe(100);
    expect(result.executedAt).toBe("2026-09-26T00:00:00.000Z");
  });

  it("classifies missing credentials as configuration", async () => {
    const executor = new RequestExecutor(clientReturning(200, {}), { getCredentials: async () => undefined });
    expect((await executor.execute(request)).error?.category).toBe("configuration");
  });

  it("classifies HTTP 401 as authentication", async () => {
    const executor = new RequestExecutor(clientReturning(401, { statusCode: 190 }), credentials);
    expect((await executor.execute(request)).error?.category).toBe("authentication");
  });

  it("classifies other HTTP failures", async () => {
    const executor = new RequestExecutor(clientReturning(500, { statusCode: 190 }), credentials);
    expect((await executor.execute(request)).error?.category).toBe("http");
  });

  it("preserves and classifies unknown SwitchBot error codes", async () => {
    const executor = new RequestExecutor(clientReturning(200, { statusCode: 98765, message: "future error" }), credentials);
    const result = await executor.execute(request);
    expect(result.error?.category).toBe("switchbot");
    expect(result.response?.switchBot?.statusCode).toBe(98765);
  });

  it("classifies malformed successful responses", async () => {
    const executor = new RequestExecutor(clientReturning(200, { hello: "world" }), credentials);
    expect((await executor.execute(request)).error?.category).toBe("response");
  });

  it("classifies transport exceptions as network", async () => {
    const client = { request: async () => { throw new Error("socket failed"); } } as unknown as SwitchBotClient;
    const executor = new RequestExecutor(client, credentials);
    const result = await executor.execute(request);
    expect(result.error?.category).toBe("network");
    expect(result.error?.message).toBe("socket failed");
  });

  it("rejects invalid requests before loading credentials", async () => {
    let requested = false;
    const executor = new RequestExecutor(clientReturning(200, {}), {
      getCredentials: async () => { requested = true; return { token: "t", secret: "s" }; }
    });
    const result = await executor.execute({ method: "GET", path: "https://evil.example/" });
    expect(result.error?.category).toBe("configuration");
    expect(requested).toBe(false);
  });
});
