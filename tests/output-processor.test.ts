import { describe, expect, it } from "vitest";
import { ClipboardOutput } from "../src/output/clipboard-output.js";
import { OutputProcessor } from "../src/output/output-processor.js";
import type { FeedbackAction } from "../src/output/streamdeck-feedback.js";
import type { ClipboardService } from "../src/services/clipboard-service.js";
import type { ExecutionResult } from "../src/execution/execution-result.js";

const success: ExecutionResult = {
  success: true,
  request: { method: "GET", path: "/v1.1/devices" },
  response: { httpStatus: 200, headers: {}, body: { statusCode: 100 }, rawBody: '{"statusCode":100}' },
  executedAt: "2026-09-26T00:00:00.000Z"
};

function feedback() {
  const calls = { ok: 0, alert: 0 };
  const action: FeedbackAction = {
    showOk: async () => { calls.ok++; },
    showAlert: async () => { calls.alert++; }
  };
  return { calls, action };
}

describe("OutputProcessor", () => {
  it("copies before showing success", async () => {
    let copied = "";
    const clipboard: ClipboardService = { writeText: async value => { copied = value; } };
    const { calls, action } = feedback();
    const processed = await new OutputProcessor(new ClipboardOutput(clipboard))
      .process(success, { copyResponseToClipboard: true, prettyPrint: true }, action);
    expect(processed).toBe(true);
    expect(copied).toContain('"statusCode": 100');
    expect(calls).toEqual({ ok: 1, alert: 0 });
  });

  it("shows alert when clipboard writing fails", async () => {
    const clipboard: ClipboardService = { writeText: async () => { throw new Error("clipboard"); } };
    const { calls, action } = feedback();
    const processed = await new OutputProcessor(new ClipboardOutput(clipboard))
      .process(success, { copyResponseToClipboard: true, prettyPrint: true }, action);
    expect(processed).toBe(false);
    expect(calls).toEqual({ ok: 0, alert: 1 });
  });

  it("does not copy and shows alert for failed execution", async () => {
    let copied = false;
    const clipboard: ClipboardService = { writeText: async () => { copied = true; } };
    const { calls, action } = feedback();
    const failed: ExecutionResult = {
      success: false,
      request: success.request,
      error: { category: "network", message: "failed" },
      executedAt: success.executedAt
    };
    await new OutputProcessor(new ClipboardOutput(clipboard))
      .process(failed, { copyResponseToClipboard: true, prettyPrint: true }, action);
    expect(copied).toBe(false);
    expect(calls).toEqual({ ok: 0, alert: 1 });
  });
});
