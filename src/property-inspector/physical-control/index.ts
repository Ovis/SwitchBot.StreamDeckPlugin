import "../shared/localization.js";
import "../shared/authentication.js";
import { queryRequired, valueOf } from "../shared/dom.js";
import { attachExecutionDiagnostics } from "../shared/execution-diagnostics.js";
import { parsePluginToPropertyInspectorMessage, type PhysicalControlDeviceItem, type PhysicalControlOperationItem } from "../../protocol/property-inspector-protocol.js";
import { shouldResyncInitialSelection } from "./initial-selection-resync.js";

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
  const unlockConfirmationItem = queryRequired<HTMLElement>("#unlock-confirmation-item");
  const skipUnlockConfirmation = queryRequired<SdpiValueElement>("#skip-unlock-confirmation");
  let devices = new Map<string, PhysicalControlDeviceItem>();
  let operations = new Map<string, PhysicalControlOperationItem>();
  let suppress = false;
  let initialSelectionRetryDeviceId = "";
  let parameterPreviewResyncKey = "";
  let renderedParameterOperationId = "";

  async function patchSettings(mutator: (settings: Record<string, unknown>) => void): Promise<void> {
    const settings = settingsRecord(await streamDeckClient.getSettings());
    mutator(settings);
    await streamDeckClient.setSettings(settings);
  }

  function sendCatalog(
    isRefresh = false,
    deviceId = valueOf(device),
    operationId = valueOf(operation),
    operationParameters: Record<string, string | number | boolean | null> = {}
  ): void {
    // Plugin側が保存settingsの反映タイミングだけに依存すると、PI上の選択とOperation一覧がずれる可能性がある。
    // 現在選択中のdeviceIdも送り、catalogの実データを基準にOperationを解決させる。
    streamDeckClient.send("sendToPlugin", {
      event: "getPhysicalControlCatalog",
      isRefresh,
      deviceId,
      operationId,
      operationParameters
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

  function syncOperationOptions(): void {
    // PI初期表示ではsettings復元とcatalog応答の順序が一定ではないため、
    // Operation選択に従属するUIはvaluechangeだけに依存せず、catalog同期のたびに確定状態から再評価する。
    unlockConfirmationItem.hidden = valueOf(operation) !== "unlock";
  }

  function isValidNumberParameter(raw: string, min?: number, max?: number, step?: number): boolean {
    if (min === undefined || max === undefined || step === undefined || raw.trim() === "") return false;
    const value = Number(raw);
    return Number.isFinite(value) && value >= min && value <= max
      && Math.abs((value - min) / step - Math.round((value - min) / step)) <= 1e-9;
  }

  function isValidRgb(raw: string): boolean {
    const parts = raw.split(":");
    return parts.length === 3 && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255);
  }

  function renderOperationParameters(saved: Record<string, unknown> = {}): void {
    const host = queryRequired<HTMLElement>("#operation-parameters");
    const selected = operations.get(valueOf(operation));
    const input = selected?.input;
    host.innerHTML = "";
    renderedParameterOperationId = selected?.value ?? "";
    queryRequired<HTMLElement>("#parameter-status").textContent = "";
    if (!input) return;

    const initial = saved[input.key];
    const placeholder = input.kind === "rgb" ? "255:0:0" : `${input.min}–${input.max}${input.unit ?? ""}`;
    host.innerHTML = `<sdpi-item label="${escapeHtml(input.label)}"><sdpi-textfield id="operation-parameter" placeholder="${escapeHtml(placeholder)}"></sdpi-textfield></sdpi-item>`;
    const field = queryRequired<SdpiValueElement>("#operation-parameter");
    field.value = typeof initial === "string" || typeof initial === "number" ? String(initial) : "";
    field.addEventListener("valuechange", () => {
      const raw = valueOf(field).trim();
      const parameters = raw === "" ? {} : { [input.key]: raw };
      void patchSettings(settings => { settings.operationParameters = parameters; });
      const invalid = raw !== "" && (
        input.kind === "rgb"
          ? !isValidRgb(raw)
          : !isValidNumberParameter(raw, input.min, input.max, input.step)
      );
      queryRequired<HTMLElement>("#parameter-status").textContent = invalid
        ? (window.SwitchBotI18n?.t("Enter a value within the displayed range.", "表示された範囲内の値を入力してください") ?? "")
        : "";
      // 入力欄自体は再生成せずpreviewだけを更新する。catalog応答で同じparameter UIを
      // 作り直すと、入力中にフォーカスやキャレット位置が失われるためである。
      sendCatalog(false, valueOf(device), valueOf(operation), parameters);
    });
  }

  operation.addEventListener("valuechange", () => {
    if (suppress) return;
    void patchSettings(settings => {
      settings.version = 1;
      settings.operationId = valueOf(operation);
      settings.operationParameters = {};
    });
    renderOperationParameters();
    sendCatalog(false, valueOf(device), valueOf(operation), {});
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
      const savedParameters = typeof settings.operationParameters === "object" && settings.operationParameters !== null
        ? settings.operationParameters as Record<string, unknown> : {};
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
        syncOperationOptions();
      } finally {
        suppress = false;
      }
      const parameterField = document.querySelector<SdpiValueElement>("#operation-parameter");
      const currentOperationId = valueOf(operation);
      const currentInput = operations.get(currentOperationId)?.input;
      // parameter変更に対するpreview応答では既存入力欄を維持する。
      // Operationが変わった場合は入力種別が同じでも制約が異なり得るため必ず作り直す。
      if (renderedParameterOperationId !== currentOperationId || (currentInput && !parameterField)) {
        renderOperationParameters(savedParameters);
      }
      updateRequestPreview();

      // 保存済みparameterは最初のcatalog要求時にはPI側でまだ取得できていない。
      // parameter付きOperationを復元した場合だけ一度再要求し、実送信と同じbuilderでpreviewを再生成する。
      const selectedOperationItem = operations.get(selectedOperation);
      const parameterPreviewKey = selectedOperationItem?.input && Object.keys(savedParameters).length > 0
        ? `${selectedDevice}:${selectedOperation}:${JSON.stringify(savedParameters)}` : "";
      if (parameterPreviewKey && parameterPreviewKey !== parameterPreviewResyncKey) {
        parameterPreviewResyncKey = parameterPreviewKey;
        sendCatalog(false, selectedDevice, selectedOperation, savedParameters as Record<string, string | number | boolean | null>);
      }

      // PIを開いた直後は、SDKのsettings復元より先に最初のcatalog要求がPluginへ届くことがある。
      // その場合、応答時点では保存済みDeviceを復元できてもOperationだけが空になるため、
      // 実在する保存済みDeviceを一度だけ明示して再要求し、手動Refreshを不要にする。
      if (shouldResyncInitialSelection(
        selectedDevice,
        message.devices.map(item => item.value),
        message.selectedDeviceId,
        initialSelectionRetryDeviceId
      )) {
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

  function applyLocalizedText(): void {
    const translate = (en: string, ja: string) => window.SwitchBotI18n?.t(en, ja) ?? en;
    queryRequired<HTMLElement>("#refresh-catalog").textContent = translate("Refresh", "更新");
    queryRequired<HTMLElement>("#request-heading").textContent = translate("Request Body", "リクエスト本文");
    queryRequired<HTMLElement>("#advanced-note").textContent =
      translate("Use API Request for advanced operations and configuration changes.", "高度な操作や設定変更には「APIリクエスト」を使用してください");
    unlockConfirmationItem.setAttribute(
      "label",
      translate("Skip double-press confirmation when unlocking", "解錠時の二度押し確認をしない")
    );
    queryRequired<HTMLElement>("#execution-diagnostics-heading").textContent =
      translate("Latest execution result", "最新の実行結果");
  }

  // localeはStream Deckとのsocket接続時に確定するため、DOMContentLoaded時の初期値だけでなく
  // locale確定後にも固定文言を再適用し、日本語環境で英語表示が残らないようにする。
  document.addEventListener("switchbot-locale-changed", applyLocalizedText);
  applyLocalizedText();
  sendCatalog();
});
