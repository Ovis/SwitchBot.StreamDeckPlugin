import type { CatalogRefreshFailure } from "../../protocol/property-inspector-protocol.js";

type Translate = (english: string, japanese: string) => string;

export function catalogRefreshStatusMessage(
  refreshFailed: boolean | undefined,
  refreshFailure: CatalogRefreshFailure | undefined,
  translate: Translate
): string {
  if (!refreshFailed) return "";
  if (refreshFailure === "rate-limit") {
    return translate("The API usage limit has been reached.", "API利用上限に達しています。");
  }
  return translate("Refresh failed. Showing the saved catalog.", "更新に失敗しました。保存済みの一覧を表示しています。");
}
