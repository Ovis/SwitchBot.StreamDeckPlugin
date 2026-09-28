import { describe, expect, it } from "vitest";
import { shouldResyncInitialSelection } from "../src/property-inspector/physical-control/initial-selection-resync.js";

describe("Physical Control initial selection resync", () => {
  it("初回応答が保存済みDeviceを解決していなければ再同期する", () => {
    expect(shouldResyncInitialSelection("bot-1", ["bot-1"], "", "")).toBe(true);
  });

  it("応答が保存済みDevice向けなら再同期しない", () => {
    expect(shouldResyncInitialSelection("bot-1", ["bot-1"], "bot-1", "")).toBe(false);
  });

  it("保存済みDeviceがcatalogに存在しなければ再同期しない", () => {
    expect(shouldResyncInitialSelection("missing", ["bot-1"], "", "")).toBe(false);
  });

  it("同じDeviceへの再同期は一度だけにする", () => {
    expect(shouldResyncInitialSelection("bot-1", ["bot-1"], "", "bot-1")).toBe(false);
  });
});
