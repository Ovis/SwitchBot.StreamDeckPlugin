import { describe, expect, it } from "vitest";
import { normalizePhysicalControlSettings } from "../src/settings/physical-control-settings.js";

describe("Physical Control settings", () => {
  it("空設定をv1既定値へ正規化する", () => {
    expect(normalizePhysicalControlSettings({})).toEqual({
      version: 1,
      deviceId: "",
      deviceType: "",
      operationId: "",
      skipUnlockConfirmation: false,
      operationParameters: {}
    });
  });

  it("保存済み選択を維持する", () => {
    expect(normalizePhysicalControlSettings({
      version: 1,
      deviceId: "bot-1",
      deviceType: "Bot",
      operationId: "press",
      skipUnlockConfirmation: false,
      operationParameters: {}
    })).toEqual({
      version: 1,
      deviceId: "bot-1",
      deviceType: "Bot",
      operationId: "press",
      skipUnlockConfirmation: false,
      operationParameters: {}
    });
  });

  it("解錠確認の省略設定を保存する", () => {
    expect(normalizePhysicalControlSettings({
      version: 1,
      deviceId: "lock-pro-1",
      deviceType: "Smart Lock Pro",
      operationId: "unlock",
      skipUnlockConfirmation: true,
      operationParameters: {}
    }).skipUnlockConfirmation).toBe(true);
  });

  it("未知の将来versionはfail closedする", () => {
    expect(normalizePhysicalControlSettings({
      version: 2,
      deviceId: "bot-1",
      deviceType: "Bot",
      operationId: "press",
      skipUnlockConfirmation: false,
      operationParameters: {}
    })).toEqual({
      version: 1,
      deviceId: "",
      deviceType: "",
      operationId: "",
      skipUnlockConfirmation: false,
      operationParameters: {}
    });
  });
});
