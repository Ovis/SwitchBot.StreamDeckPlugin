import "../shared/localization.js";
import "../shared/authentication.js";
import { queryRequired } from "../shared/dom.js";
import { parsePluginToPropertyInspectorMessage } from "../../protocol/property-inspector-protocol.js";


document.addEventListener("DOMContentLoaded", () => {
  const { streamDeckClient } = SDPIComponents;

  function localizeUi(): void {
    queryRequired<HTMLElement>("#output-heading").textContent =
      window.SwitchBotI18n?.t("Output", "出力") ?? "Output";
  }

  streamDeckClient.sendToPropertyInspector.subscribe(event => {
    const message = parsePluginToPropertyInspectorMessage(event.payload);
    const payload = message?.event === "getDevices" ? message : undefined;
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
