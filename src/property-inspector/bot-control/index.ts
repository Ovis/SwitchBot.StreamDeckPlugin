import "../shared/localization.js";
import "../shared/authentication.js";
import { queryRequired } from "../shared/dom.js";
import { parsePluginToPropertyInspectorMessage } from "../../protocol/property-inspector-protocol.js";

document.addEventListener("DOMContentLoaded", () => {
  const { streamDeckClient } = SDPIComponents;
  const device = queryRequired<HTMLSelectElement>("#device");
  const operation = queryRequired<HTMLSelectElement>("#operation");

  function sendCatalog(isRefresh = false): void {
    streamDeckClient.send("sendToPlugin", { event: "getPhysicalControlCatalog", isRefresh });
  }

  function options(select: HTMLSelectElement, items: readonly { label: string; value: string }[]): void {
    const selected = select.value;
    select.replaceChildren(...items.map(item => {
      const option = document.createElement("option");
      option.value = item.value; option.textContent = item.label; return option;
    }));
    select.value = selected;
  }

  streamDeckClient.sendToPropertyInspector.subscribe(event => {
    const message = parsePluginToPropertyInspectorMessage(event.payload);
    if (message?.event !== "physicalControlCatalog") return;
    options(device, message.devices);
    options(operation, message.operations);
    queryRequired<HTMLElement>("#catalog-status").textContent = message.refreshFailed
      ? window.SwitchBotI18n?.t("Refresh failed. Showing the saved catalog.", "更新に失敗しました。保存済みの一覧を表示しています。") ?? ""
      : "";
  });

  device.addEventListener("change", () => {
    const selected = device.selectedOptions[0];
    streamDeckClient.setSettings({ deviceId: device.value, deviceType: selected?.dataset.deviceType ?? "", operationId: "" });
    sendCatalog();
  });
  device.addEventListener("click", event => {
    if ((event.target as HTMLElement).closest("[data-refresh]")) sendCatalog(true);
  });
  queryRequired<HTMLElement>("#advanced-note").textContent =
    window.SwitchBotI18n?.t("Use API Request for advanced operations and configuration changes.", "高度な操作や設定変更には「APIリクエスト」を使用してください") ?? "";
  sendCatalog();
});
