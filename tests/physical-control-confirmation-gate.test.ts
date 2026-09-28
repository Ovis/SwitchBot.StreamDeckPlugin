import { describe, expect, it } from "vitest";
import { PhysicalControlConfirmationGate } from "../src/physical-control/physical-control-confirmation-gate.js";

describe("PhysicalControlConfirmationGate", () => {
  it("同じ危険操作を期限内に再押下した場合だけ確認済みにする", () => {
    const gate = new PhysicalControlConfirmationGate(3_000);
    expect(gate.confirm("action-1", "lock-1:unlock", 1_000)).toBe("required");
    expect(gate.confirm("action-1", "lock-1:unlock", 3_999)).toBe("confirmed");
  });

  it("期限切れ・別操作・別Actionでは確認状態を流用しない", () => {
    const gate = new PhysicalControlConfirmationGate(3_000);
    expect(gate.confirm("action-1", "lock-1:unlock", 1_000)).toBe("required");
    expect(gate.confirm("action-1", "lock-1:deadbolt", 2_000)).toBe("required");
    expect(gate.confirm("action-2", "lock-1:deadbolt", 2_001)).toBe("required");
    expect(gate.confirm("action-1", "lock-1:deadbolt", 5_001)).toBe("required");
  });

  it("clear後は再度確認を要求する", () => {
    const gate = new PhysicalControlConfirmationGate(3_000);
    expect(gate.confirm("action-1", "lock-1:unlock", 1_000)).toBe("required");
    gate.clear("action-1");
    expect(gate.confirm("action-1", "lock-1:unlock", 2_000)).toBe("required");
  });
});
