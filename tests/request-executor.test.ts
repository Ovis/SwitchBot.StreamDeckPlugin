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
  } as unknown as SwitchBotClient;
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
    const result = await executor.execute(request);
    expectFailureCategory(result, "configuration");
  });

  it("classifies HTTP 401 as authentication", async () => {
    const executor = new RequestExecutor(clientReturning(401, { statusCode: 190 }), credentials);
    const result = await executor.execute(request);
    expectFailureCategory(result, "authentication");
  });

  it("classifies other HTTP failures", async () => {
    const executor = new RequestExecutor(clientReturning(500, { statusCode: 190 }), credentials);
    const result = await executor.execute(request);
    expectFailureCategory(result, "http");
  });

  it("preserves and classifies unknown SwitchBot error codes", async () => {
    const executor = new RequestExecutor(clientReturning(200, { statusCode: 98765, message: "future error" }), credentials);
    const result = await executor.execute(request);
    const failure = expectFailureCategory(result, "switchbot");
    expect(failure.response?.switchBot?.statusCode).toBe(98765);
  });

  it("classifies malformed successful responses", async () => {
    const executor = new RequestExecutor(clientReturning(200, { hello: "world" }), credentials);
    const result = await executor.execute(request);
    expectFailureCategory(result, "response");
  });

  it("classifies transport exceptions as network", async () => {
    const client = { request: async () => { throw new Error("socket failed"); } } as unknown as SwitchBotClient;
    const executor = new RequestExecutor(client, credentials);
    const result = await executor.execute(request);
    const failure = expectFailureCategory(result, "network");
    expect(failure.error.message).toBe("SwitchBot network request failed.");
  });

  it("rejects invalid requests before loading credentials", async () => {
    let requested = false;
    const executor = new RequestExecutor(clientReturning(200, {}), {
      getCredentials: async () => { requested = true; return { token: "t", secret: "s" }; }
    });
    const result = await executor.execute({ method: "GET", path: "https://evil.example/" });
    const failure = expectFailureCategory(result, "configuration");
    expect(requested).toBe(false);
  });
});


function expectFailureCategory(
  result: Awaited<ReturnType<RequestExecutor["execute"]>>,
  category: import("../src/execution/execution-result.js").ExecutionErrorCategory
): Extract<Awaited<ReturnType<RequestExecutor["execute"]>>, { success: false }> {
  expect(result.success).toBe(false);
  if (result.success) throw new Error("Expected execution to fail.");
  expect(result.error.category).toBe(category);
  return result;
}
