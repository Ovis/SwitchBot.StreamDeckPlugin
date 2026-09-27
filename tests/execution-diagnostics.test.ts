import { describe, expect, it } from "vitest";
import { ExecutionDiagnosticsStore } from "../src/execution/execution-diagnostics-store.js";
import { executionDiagnosticsView, formatResponseBody } from "../src/execution/execution-diagnostics.js";
import type { ExecutionResult } from "../src/execution/execution-result.js";

const success: ExecutionResult = {
  success: true,
  request: { method: "POST", path: "/v1.1/devices/device/commands" },
  executedAt: "2026-09-28T00:00:00.000Z",
  response: {
    httpStatus: 200,
    headers: { authorization: "must-not-be-exposed" },
    body: { statusCode: 100, body: { ok: true } },
    rawBody: '{"statusCode":100,"body":{"ok":true}}',
    switchBot: { statusCode: 100, message: "success" }
  }
};

describe("execution diagnostics", () => {
  it("Action instanceごとに最新結果だけを保持し削除できる", () => {
    const store = new ExecutionDiagnosticsStore();
    store.set("a", success);
    expect(store.get("a")).toBe(success);
    expect(store.get("b")).toBeUndefined();
    store.delete("a");
    expect(store.get("a")).toBeUndefined();
  });

  it("PI表示モデルへ認証ヘッダーを含めず変換する", () => {
    const view = executionDiagnosticsView(success);
    expect(view).toEqual({
      executedAt: "2026-09-28T00:00:00.000Z",
      method: "POST",
      path: "/v1.1/devices/device/commands",
      success: true,
      httpStatus: 200,
      switchBotStatusCode: 100,
      switchBotMessage: "success",
      responseBody: '{\n  "statusCode": 100,\n  "body": {\n    "ok": true\n  }\n}'
    });
    expect(JSON.stringify(view)).not.toContain("authorization");
  });

  it("HTTP応答前の失敗も診断表示できる", () => {
    const failure: ExecutionResult = {
      success: false,
      request: { method: "GET", path: "/v1.1/devices" },
      executedAt: "2026-09-28T00:00:00.000Z",
      error: { category: "network", message: "SwitchBot network request failed." }
    };
    expect(executionDiagnosticsView(failure)).toMatchObject({
      success: false,
      errorCategory: "network",
      errorMessage: "SwitchBot network request failed."
    });
  });

  it("非JSONレスポンスはrawBodyを保持する", () => {
    expect(formatResponseBody(undefined, "plain text")).toBe("plain text");
  });
});
