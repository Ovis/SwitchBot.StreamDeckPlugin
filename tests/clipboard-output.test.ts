import { describe, expect, it } from "vitest";
import { ClipboardOutput } from "../src/output/clipboard-output.js";
import type { ClipboardService } from "../src/services/clipboard-service.js";
import type { ExecutionResult } from "../src/execution/execution-result.js";

function result(body: unknown, rawBody: string): ExecutionResult {
  return {
    success: true,
    request: { method: "GET", path: "/v1.1/devices" },
    response: { httpStatus: 200, headers: {}, body, rawBody },
    executedAt: "2026-09-26T00:00:00.000Z"
  };
}

describe("ClipboardOutput", () => {
  it("pretty prints parsed JSON", async () => {
    let copied = "";
    const service: ClipboardService = { writeText: async value => { copied = value; } };
    await new ClipboardOutput(service).write(result({ a: 1 }, '{"a":1}'), true);
    expect(copied).toBe('{\n  "a": 1\n}');
  });

  it("uses raw body when pretty print is disabled", async () => {
    let copied = "";
    const service: ClipboardService = { writeText: async value => { copied = value; } };
    await new ClipboardOutput(service).write(result({ a: 1 }, '{"a":1}'), false);
    expect(copied).toBe('{"a":1}');
  });

  it("preserves raw non-JSON response", async () => {
    let copied = "";
    const service: ClipboardService = { writeText: async value => { copied = value; } };
    await new ClipboardOutput(service).write(result("plain text", "plain text"), true);
    expect(copied).toBe("plain text");
  });
});
