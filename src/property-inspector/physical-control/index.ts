import "../shared/localization.js";
import "../shared/authentication.js";
import { checked, queryRequired, valueOf } from "../shared/dom.js";
import { attachExecutionDiagnostics } from "../shared/execution-diagnostics.js";
import { catalogRefreshStatusMessage } from "../shared/catalog-refresh-status.js";
import { createPropertyInspectorSettingsStore } from "../shared/property-inspector-settings-store.js";
import { normalizePhysicalControlPropertyInspectorSettings } from "../shared/managed-settings-normalizers.js";
import { parsePluginToPropertyInspectorMessage, type PhysicalControlDeviceItem, type PhysicalControlOperationItem } from "../../protocol/property-inspector-protocol.js";
import { shouldResyncInitialSelection } from "./initial-selection-resync.js";

function escapeHtml(value: string): string {
  const replacements: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return value.replace(/[&<>"']/g, character => replacements[character] ?? character);
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
  let suppress = true;
  let initialSelectionRetryDeviceId = "";
  let parameterPreviewResyncKey = "";
  let renderedParameterOperationId = "";

  const settingsStore = createPropertyInspectorSettingsStore(streamDeckClient, normalizePhysicalControlPropertyInspectorSettings);
  const initialization = settingsStore.initialize();

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
      const previousOperationId = valueOf(operation);
      await settingsStore.update(settings => {
        settings.version = 1;
        settings.deviceId = selected?.value ?? "";
        settings.deviceType = selected?.deviceType ?? "";
        // 新Deviceでも同じOperation IDが有効かはPlugin側のcatalogで確定する。
        // ここでは候補を維持してparametersだけを消去し、未検証のfallbackは行わない。
        settings.operationId = previousOperationId;
        settings.operationParameters = {};
      });
      sendCatalog(false, selected?.value ?? "", previousOperationId, {});
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

  function operationInputs(item: PhysicalControlOperationItem | undefined) {
    if (item?.inputs) return item.inputs;
    return item?.input ? [item.input] : [];
  }

  function renderOperationParameters(saved: Record<string, unknown> = {}): void {
    const host = queryRequired<HTMLElement>("#operation-parameters");
    const selected = operations.get(valueOf(operation));
    const inputs = operationInputs(selected);
    host.innerHTML = "";
    renderedParameterOperationId = selected?.value ?? "";
    queryRequired<HTMLElement>("#parameter-status").textContent = "";
    if (inputs.length === 0) return;

    host.innerHTML = inputs.map((input, index) => {
      const fieldId = `operation-parameter-${index}`;
      const statusId = `parameter-status-${index}`;
      if (input.kind === "select") {
        const placeholder = window.SwitchBotI18n?.t("Select a value", "値を選択") ?? "Select a value";
        const options = (input.options ?? []).map(option =>
          `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`
        ).join("");
        return `<sdpi-item label="${escapeHtml(input.label)}"><sdpi-select id="${fieldId}" placeholder="${escapeHtml(placeholder)}"><option value="">${escapeHtml(placeholder)}</option>${options}</sdpi-select></sdpi-item><div id="${statusId}"></div>`;
      }
      const placeholder = input.kind === "rgb" ? "255:0:0" : `${input.min}–${input.max}${input.unit ?? ""}`;
      return `<sdpi-item label="${escapeHtml(input.label)}"><sdpi-textfield id="${fieldId}" placeholder="${escapeHtml(placeholder)}"></sdpi-textfield></sdpi-item><div id="${statusId}"></div>`;
    }).join("");

    const isInvalid = (input: (typeof inputs)[number], raw: string): boolean => raw !== "" && (
      input.kind === "rgb"
        ? !isValidRgb(raw)
        : input.kind === "number"
          ? !isValidNumberParameter(raw, input.min, input.max, input.step)
          : !(input.options ?? []).some(option => option.value === raw)
    );
    const validationMessage = window.SwitchBotI18n?.t(
      "Enter or select a valid value.",
      "有効な値を入力または選択してください"
    ) ?? "";

    const fields = inputs.map((input, index) => {
      const field = queryRequired<SdpiValueElement>(`#operation-parameter-${index}`);
      const initial = saved[input.key];
      const raw = typeof initial === "string" || typeof initial === "number" ? String(initial) : "";
      const invalid = isInvalid(input, raw);
      // selectの保存値がcatalogから外れていても先頭候補へ補正せず、未選択表示のまま元settingsを保持する。
      field.value = input.kind === "select" && invalid ? "" : raw;
      queryRequired<HTMLElement>(`#parameter-status-${index}`).textContent = invalid ? validationMessage : "";
      return field;
    });

    const synchronize = (): void => {
      const parameters: Record<string, string> = {};
      inputs.forEach((input, index) => {
        const field = fields[index];
        if (!field) return;
        const raw = valueOf(field).trim();
        const savedRaw = saved[input.key];
        const savedValue = typeof savedRaw === "string" || typeof savedRaw === "number" ? String(savedRaw) : "";
        const preserveInvalidSelect = input.kind === "select" && raw === "" && isInvalid(input, savedValue);
        // catalogから外れた保存済みselect値は画面上では未選択に見せるが、
        // 他フィールドの編集を契機に暗黙削除しない。ユーザーが有効な候補を選んだ時だけ置き換える。
        if (raw !== "") parameters[input.key] = raw;
        else if (preserveInvalidSelect) parameters[input.key] = savedValue;
        queryRequired<HTMLElement>(`#parameter-status-${index}`).textContent = preserveInvalidSelect || isInvalid(input, raw)
          ? validationMessage
          : "";
      });
      void (async () => {
        await settingsStore.update(settings => { settings.operationParameters = parameters; });
        // 入力欄自体は再生成せずpreviewだけを更新する。catalog応答で同じparameter UIを
        // 作り直すと、入力中にフォーカスやキャレット位置が失われるためである。
        sendCatalog(false, valueOf(device), valueOf(operation), parameters);
      })();
    };
    fields.forEach(field => field.addEventListener("valuechange", synchronize));
  }

  operation.addEventListener("valuechange", () => {
    if (suppress) return;
    void (async () => {
      await settingsStore.update(settings => {
        settings.version = 1;
        settings.operationId = valueOf(operation);
        settings.operationParameters = {};
      });
      renderOperationParameters();
      sendCatalog(false, valueOf(device), valueOf(operation), {});
    })();
  });

  skipUnlockConfirmation.addEventListener("valuechange", () => {
    if (suppress) return;
    void settingsStore.update(settings => {
      settings.skipUnlockConfirmation = checked(skipUnlockConfirmation);
    });
  });

  streamDeckClient.sendToPropertyInspector.subscribe(event => {
    const message = parsePluginToPropertyInspectorMessage(event.payload);
    if (message?.event !== "physicalControlCatalog") return;
    void (async () => {
      await initialization;
      devices = new Map(message.devices.map(item => [item.value, item]));
      operations = new Map(message.operations.map(item => [item.value, item]));
      const settings = await settingsStore.reload();
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
        skipUnlockConfirmation.value = settings.skipUnlockConfirmation;
        syncOperationOptions();
      } finally {
        suppress = false;
      }
      const currentOperationId = valueOf(operation);
      const currentInputs = operationInputs(operations.get(currentOperationId));
      const renderedFields = document.querySelectorAll("[id^='operation-parameter-']");
      // parameter変更に対するpreview応答では既存入力欄を維持する。
      // Operationが変わった場合は入力種別が同じでも制約が異なり得るため必ず作り直す。
      if (renderedParameterOperationId !== currentOperationId || renderedFields.length !== currentInputs.length) {
        renderOperationParameters(savedParameters);
      }
      updateRequestPreview();

      // 保存済みparameterは最初のcatalog要求時にはPI側でまだ取得できていない。
      // parameter付きOperationを復元した場合だけ一度再要求し、実送信と同じbuilderでpreviewを再生成する。
      const selectedOperationItem = operations.get(selectedOperation);
      const parameterPreviewKey = operationInputs(selectedOperationItem).length > 0 && Object.keys(savedParameters).length > 0
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
        catalogRefreshStatusMessage(
          message.refreshFailed,
          message.refreshFailure,
          (english, japanese) => window.SwitchBotI18n?.t(english, japanese) ?? english
        )
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
  void initialization.then(settings => {
    suppress = true;
    skipUnlockConfirmation.value = settings.skipUnlockConfirmation;
    suppress = false;
    sendCatalog(false, settings.deviceId, settings.operationId, settings.operationParameters);
  });
});
