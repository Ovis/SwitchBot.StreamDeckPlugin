import "../shared/localization.js";
import "../shared/authentication.js";
import { queryRequired, valueOf } from "../shared/dom.js";
import { parsePluginToPropertyInspectorMessage, type PhysicalControlDeviceItem } from "../../protocol/property-inspector-protocol.js";

function escapeHtml(value: string): string {
  const replacements: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return value.replace(/[&<>"']/g, character => replacements[character] ?? character);
}

function settingsRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  return typeof record.settings === "object" && record.settings !== null && !Array.isArray(record.settings)
    ? record.settings as Record<string, unknown>
    : record;
}

document.addEventListener("DOMContentLoaded", () => {
  const { streamDeckClient } = SDPIComponents;
  const device = queryRequired<SdpiValueElement>("#device");
  const operation = queryRequired<SdpiValueElement>("#operation");
  let devices = new Map<string, PhysicalControlDeviceItem>();
  let suppress = false;

  async function patchSettings(mutator: (settings: Record<string, unknown>) => void): Promise<void> {
    const settings = settingsRecord(await streamDeckClient.getSettings());
    mutator(settings);
    await streamDeckClient.setSettings(settings);
  }

  function sendCatalog(isRefresh = false): void {
    streamDeckClient.send("sendToPlugin", { event: "getPhysicalControlCatalog", isRefresh });
  }

  device.addEventListener("valuechange", () => {
    void (async () => {
      if (suppress) return;
      const selected = devices.get(valueOf(device));
      if (!selected) return;
      await patchSettings(settings => {
        settings.deviceId = selected.value;
        settings.deviceType = selected.deviceType;
        settings.operationId = "";
      });
      operation.value = "";
      sendCatalog();
    })();
  });

  operation.addEventListener("valuechange", () => {
    if (suppress) return;
    void patchSettings(settings => { settings.operationId = valueOf(operation); });
  });

  streamDeckClient.sendToPropertyInspector.subscribe(event => {
    const message = parsePluginToPropertyInspectorMessage(event.payload);
    if (message?.event !== "physicalControlCatalog") return;
    void (async () => {
      devices = new Map(message.devices.map(item => [item.value, item]));
      const settings = settingsRecord(await streamDeckClient.getSettings());
      const selectedDevice = typeof settings.deviceId === "string" ? settings.deviceId : "";
      const selectedOperation = typeof settings.operationId === "string" ? settings.operationId : "";
      suppress = true;
      try {
        device.innerHTML = '<option value=""></option>' + message.devices.map(item =>
          `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`
        ).join("");
        operation.innerHTML = '<option value=""></option>' + message.operations.map(item =>
          `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`
        ).join("");
        device.value = message.devices.some(item => item.value === selectedDevice) ? selectedDevice : "";
        operation.value = message.operations.some(item => item.value === selectedOperation) ? selectedOperation : "";
      } finally {
        suppress = false;
      }
      queryRequired<HTMLElement>("#catalog-status").textContent = message.refreshFailed
        ? window.SwitchBotI18n?.t("Refresh failed. Showing the saved catalog.", "更新に失敗しました。保存済みの一覧を表示しています。") ?? ""
        : "";
    })();
  });

  queryRequired<HTMLElement>("#advanced-note").textContent =
    window.SwitchBotI18n?.t("Use API Request for advanced operations and configuration changes.", "高度な操作や設定変更には「APIリクエスト」を使用してください") ?? "";
  sendCatalog();
});
