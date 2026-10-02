import { describe, expect, it } from "vitest";
import { catalogRefreshStatusMessage } from "../src/property-inspector/shared/catalog-refresh-status.js";

const japanese = (_english: string, japaneseText: string): string => japaneseText;

describe("catalogRefreshStatusMessage", () => {
  it("429相当の失敗ではAPI利用上限を表示する", () => {
    expect(catalogRefreshStatusMessage(true, "rate-limit", japanese)).toBe("API利用上限に達しています。");
  });

  it("その他の失敗では保存済み一覧の案内を維持する", () => {
    expect(catalogRefreshStatusMessage(true, undefined, japanese))
      .toBe("更新に失敗しました。保存済みの一覧を表示しています。");
    expect(catalogRefreshStatusMessage(false, "rate-limit", japanese)).toBe("");
  });
});
