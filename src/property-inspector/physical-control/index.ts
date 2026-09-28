import "../shared/localization.js";
import "../shared/authentication.js";
import { queryRequired, valueOf } from "../shared/dom.js";
import { attachExecutionDiagnostics } from "../shared/execution-diagnostics.js";
import { parsePluginToPropertyInspectorMessage, type PhysicalControlDeviceItem, type PhysicalControlOperationItem } from "../../protocol/property-inspector-protocol.js";

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
  attachExecutionDiagnostics(streamDeckClient);
  const device = queryRequired<SdpiValueElement>("#device");
  const operation = queryRequired<SdpiValueElement>("#operation");
  let devices = new Map<string, PhysicalControlDeviceItem>();
  let operations = new Map<string, PhysicalControlOperationItem>();
  let suppress = false;
  let requestedDeviceId = "";
  let initialSelectionRetryDeviceId = "";

  async function patchSettings(mutator: (settings: Record<string, unknown>) => void): Promise<void> {
    const settings = settingsRecord(await streamDeckClient.getSettings());
    mutator(settings);
    await streamDeckClient.setSettings(settings);
  }

  function sendCatalog(isRefresh = false, deviceId = valueOf(device)): void {
    // Plugin側が保存settingsの反映タイミングだけに依存すると、PI上の選択とOperation一覧がずれる可能性がある。
    // 現在選択中のdeviceIdも送り、catalogの実データを基準にOperationを解決させる。
    requestedDeviceId = deviceId;
    streamDeckClient.send("sendToPlugin", {
      event: "getPhysicalControlCatalog",
      isRefresh,
      deviceId
    });
  }

  device.addEventListener("valuechange", () => {
    void (async () => {
      if (suppress) return;
      const selected = devices.get(valueOf(device));
      await patchSettings(settings => {
        settings.version = 1;
        settings.deviceId = selected?.value ?? "";
        settings.deviceType = selected?.deviceType ?? "";
        settings.operationId = "";
        settings.operationParameters = {};
      });
      operation.value = "";
      sendCatalog();
    })();
  });

  queryRequired<HTMLElement>("#refresh-catalog").addEventListener("click", () => sendCatalog(true));

  function updateRequestPreview(): void {
    queryRequired<HTMLElement>("#request-preview").textContent = operations.get(valueOf(operation))?.requestBody ?? "";
  }

  operation.addEventListener("valuechange", () => {
    if (suppress) return;
    void patchSettings(settings => {
      settings.version = 1;
      settings.operationId = valueOf(operation);
      settings.operationParameters = {};
    });
    updateRequestPreview();
  });

  streamDeckClient.sendToPropertyInspector.subscribe(event => {
    const message = parsePluginToPropertyInspectorMessage(event.payload);
    if (message?.event !== "physicalControlCatalog") return;
    void (async () => {
      devices = new Map(message.devices.map(item => [item.value, item]));
      operations = new Map(message.operations.map(item => [item.value, item]));
      const settings = settingsRecord(await streamDeckClient.getSettings());
      const selectedDevice = typeof settings.deviceId === "string" ? settings.deviceId : "";
      const selectedOperation = typeof settings.operationId === "string" ? settings.operationId : "";
      suppress = true;
      try {
        const devicePlaceholder = window.SwitchBotI18n?.t("Select a device", "デバイスを選択") ?? "Select a device";
        const operationPlaceholder = window.SwitchBotI18n?.t("Select an operation", "操作を選択") ?? "Select an operation";
        // sdpi-selectは動的optionを差し替えた際、空optionを先頭候補として扱わず
        // 実際には未選択でも最初のDeviceが選択済みに見えることがある。
        // value=""のplaceholderを明示し、表示状態と永続settingsを一致させる。
        device.innerHTML = `<option value="">${escapeHtml(devicePlaceholder)}</option>` + message.devices.map(item =>
          `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`
        ).join("");
        operation.innerHTML = `<option value="">${escapeHtml(operationPlaceholder)}</option>` + message.operations.map(item =>
          `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`
        ).join("");
        device.value = message.devices.some(item => item.value === selectedDevice) ? selectedDevice : "";
        operation.value = message.operations.some(item => item.value === selectedOperation) ? selectedOperation : "";
      } finally {
        suppress = false;
      }
      updateRequestPreview();

      // PIを開いた直後は、SDKのsettings復元より先に最初のcatalog要求がPluginへ届くことがある。
      // その場合、応答時点では保存済みDeviceを復元できてもOperationだけが空になるため、
      // 実在する保存済みDeviceを一度だけ明示して再要求し、手動Refreshを不要にする。
      if (selectedDevice !== ""
        && message.devices.some(item => item.value === selectedDevice)
        && requestedDeviceId !== selectedDevice
        && initialSelectionRetryDeviceId !== selectedDevice) {
        initialSelectionRetryDeviceId = selectedDevice;
        sendCatalog(false, selectedDevice);
      }

      const statusMessages = [
        message.configurationInvalid
          ? window.SwitchBotI18n?.t(
            "The saved device is no longer available for this action. Select the device again.",
            "保存済みのデバイスはこの操作では利用できません。デバイスを選択し直してください。"
          ) ?? ""
          : "",
        message.refreshFailed
          ? window.SwitchBotI18n?.t("Refresh failed. Showing the saved catalog.", "更新に失敗しました。保存済みの一覧を表示しています。") ?? ""
          : ""
      ].filter(Boolean);
      queryRequired<HTMLElement>("#catalog-status").textContent = statusMessages.join("\n");
    })();
  });

  queryRequired<HTMLElement>("#refresh-catalog").textContent = window.SwitchBotI18n?.t("Refresh", "更新") ?? "Refresh";
  queryRequired<HTMLElement>("#advanced-note").textContent =
    window.SwitchBotI18n?.t("Use API Request for advanced operations and configuration changes.", "高度な操作や設定変更には「APIリクエスト」を使用してください") ?? "";
  sendCatalog();
});
