import { describe, expect, it } from "vitest";
import { normalizeBotControlSettings } from "../src/settings/bot-control-settings.js";

describe("Bot Control settings", () => {
  it("空設定をv1既定値へ正規化する", () => {
    expect(normalizeBotControlSettings({})).toEqual({
      version: 1,
      deviceId: "",
      deviceType: "",
      operationId: ""
    });
  });

  it("保存済み選択を維持する", () => {
    expect(normalizeBotControlSettings({
      version: 1,
      deviceId: "bot-1",
      deviceType: "Bot",
      operationId: "press"
    })).toEqual({
      version: 1,
      deviceId: "bot-1",
      deviceType: "Bot",
      operationId: "press"
    });
  });

  it("未知の将来versionはfail closedする", () => {
    expect(normalizeBotControlSettings({
      version: 2,
      deviceId: "bot-1",
      deviceType: "Bot",
      operationId: "press"
    })).toEqual({
      version: 1,
      deviceId: "",
      deviceType: "",
      operationId: ""
    });
  });
});
