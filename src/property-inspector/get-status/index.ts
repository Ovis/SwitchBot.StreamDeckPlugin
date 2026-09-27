import "../shared/localization.js";
import "../shared/authentication.js";
import { queryRequired } from "../shared/dom.js";
import type { DevicesResultMessage } from "../../protocol/property-inspector-protocol.js";

function deviceCatalogPayload(value: unknown): DevicesResultMessage | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  if (record.event !== "getDevices") return undefined;
  return {
    event: "getDevices",
    items: [],
    ...(typeof record.refreshFailed === "boolean" ? { refreshFailed: record.refreshFailed } : {})
  };
}

document.addEventListener("DOMContentLoaded", () => {
  const { streamDeckClient } = SDPIComponents;

  function localizeUi(): void {
    queryRequired<HTMLElement>("#output-heading").textContent =
      window.SwitchBotI18n?.t("Output", "出力") ?? "Output";
  }

  streamDeckClient.sendToPropertyInspector.subscribe(event => {
    const payload = deviceCatalogPayload(event.payload);
    if (!payload) return;
    queryRequired<HTMLElement>("#catalog-status").textContent = payload.refreshFailed
      ? window.SwitchBotI18n?.t(
          "Refresh failed. Showing the saved catalog.",
          "更新に失敗しました。保存済みの一覧を表示しています。"
        ) ?? "Refresh failed. Showing the saved catalog."
      : "";
  });

  localizeUi();
  document.addEventListener("switchbot-locale-changed", localizeUi);
});
