import { describe, expect, it } from "vitest";
import { validateApiPath, validateExecutionRequest } from "../src/utils/validation.js";

describe("validateApiPath", () => {
  it("accepts a SwitchBot API relative path", () => {
    expect(validateApiPath("/v1.1/devices")).toBeUndefined();
  });
  it.each(["https://example.com/x", "//example.com/x", "v1.1/devices"])("rejects unsafe path %s", path => {
    expect(validateApiPath(path)).toBeDefined();
  });
});

describe("validateExecutionRequest", () => {
  it("rejects invalid JSON for POST", () => {
    expect(validateExecutionRequest({ method:"POST", path:"/v1.1/devices/x/commands", body:"{" })).toBe("Request body must be valid JSON.");
  });
  it("rejects bodies for GET", () => {
    expect(validateExecutionRequest({ method:"GET", path:"/v1.1/devices", body:"{}" })).toBe("GET requests must not include a body.");
  });
});
