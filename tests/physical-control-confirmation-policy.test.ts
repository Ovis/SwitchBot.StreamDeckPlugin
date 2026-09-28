import { describe, expect, it } from "vitest";
import { shouldSkipPhysicalControlConfirmation } from "../src/actions/physical-control-action.js";

describe("Physical Control confirmation skip policy", () => {
  it("設定が有効な場合はunlockだけ確認を省略する", () => {
    expect(shouldSkipPhysicalControlConfirmation(true, "unlock")).toBe(true);
  });

  it.each([
    "deadbolt",
    "night-latch-unlock",
    "open",
    "close",
    "lock",
    "motion-detection-on"
  ])("設定が有効でも%sでは確認を省略しない", operationId => {
    expect(shouldSkipPhysicalControlConfirmation(true, operationId)).toBe(false);
  });

  it("設定が無効な場合はunlockでも確認を省略しない", () => {
    expect(shouldSkipPhysicalControlConfirmation(false, "unlock")).toBe(false);
  });
});
