import "../shared/localization.js";
import "../shared/authentication.js";
import { attachExecutionDiagnostics } from "../shared/execution-diagnostics.js";
import { checked, createSettingsPatchQueue, queryRequired, valueOf } from "../shared/dom.js";
import { parsePluginToPropertyInspectorMessage } from "../../protocol/property-inspector-protocol.js";

interface GetStatusGlobalSettings {
  observedStatusFields?: Record<string, string[]>;
}

document.addEventListener("DOMContentLoaded", () => {
  const { streamDeckClient } = SDPIComponents;
  const patchSettings = createSettingsPatchQueue(streamDeckClient);
  const textarea = queryRequired<HTMLTextAreaElement>("#status-template");
  const deviceSelect = queryRequired<SdpiValueElement>("#device-select");
  const showStatusOnKey = queryRequired<SdpiValueElement>("#show-status-on-key");
  const refreshInterval = queryRequired<SdpiValueElement>("#refresh-interval");
  let observedFields: Record<string, string[]> = {};

  attachExecutionDiagnostics(streamDeckClient);

  function t(en: string, ja: string): string {
    return window.SwitchBotI18n?.t(en, ja) ?? en;
  }

  function renderRefreshIntervalOptions(): void {
    const current = valueOf(refreshInterval, "0");
    const options = [
      ["0", t("Manual only", "手動のみ")],
      ["1", t("1 minute", "1分")],
      ["2", t("2 minutes", "2分")],
      ["5", t("5 minutes", "5分")],
      ["10", t("10 minutes", "10分")],
      ["30", t("30 minutes", "30分")],
      ["60", t("60 minutes", "60分")]
    ];
    // sdpi-selectを維持してStream Deck標準テーマを使用する。
    // locale確定後にoption自体を再構築し、Shadow DOM側の表示にも翻訳済みラベルを反映させる。
    refreshInterval.innerHTML = options.map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
    refreshInterval.value = current;
  }

  function localizeUi(): void {
    queryRequired<HTMLElement>("#output-heading").textContent = t("Output", "出力");
    queryRequired<HTMLElement>("#status-template-label").textContent = t("Display template", "表示テンプレート");
    queryRequired<HTMLElement>("#refresh-interval-item").setAttribute("label", t("Refresh interval", "更新間隔"));
    renderRefreshIntervalOptions();
    updateRefreshIntervalAvailability();
    queryRequired<HTMLElement>("#template-help").textContent = t(
      "Wrap the item you want to display in {}, for example {temperature}. If left blank, major items are automatically selected from the retrieved information. After retrieving the status once, available items are shown and can be clicked to insert them.",
      "表示したい項目を {} で囲んで指定できます（例: {temperature}）。空欄の場合は、取得した情報から主要な項目を自動的に選んで表示します。一度ステータスを取得すると、利用可能な項目が表示され、クリックして入力できます。"
    );
    renderFields();
  }

  function updateRefreshIntervalAvailability(): void {
    // sdpi-checkboxはnative checkboxではないためvalueを基準に判定する。
    // checked()が初期復元前の値を返す場合はloadOutputSettings()で永続settingsから再確定する。
    if (checked(showStatusOnKey)) refreshInterval.removeAttribute("disabled");
    else refreshInterval.setAttribute("disabled", "");
  }

  function selectedDeviceId(): string {
    return valueOf(deviceSelect);
  }

  function renderFields(): void {
    const fields = observedFields[selectedDeviceId()] ?? [];
    const heading = queryRequired<HTMLElement>("#status-fields-heading");
    const host = queryRequired<HTMLElement>("#status-field-list");
    heading.textContent = fields.length > 0 ? t("Available fields:", "利用可能な項目:") : "";
    host.replaceChildren();

    for (const field of fields) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "status-field-button";
      button.textContent = `{${field}}`;
      button.addEventListener("click", () => void insertField(field));
      host.appendChild(button);
    }
  }

  async function insertField(field: string): Promise<void> {
    const current = textarea.value;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const insertion = `{${field}}`;
    const next = current.slice(0, start) + insertion + current.slice(end);

    textarea.value = next;
    textarea.focus();
    const caret = start + insertion.length;
    textarea.setSelectionRange(caret, caret);

    // 設定保存を待つと、その間のPI更新で選択位置が失われる可能性がある。
    // 表示とcaretを先に確定し、保存だけを既存の直列化キューへ委譲する。
    await saveTemplate(next);
  }

  async function saveTemplate(value: string): Promise<void> {
    await patchSettings(settings => {
      const output = typeof settings.output === "object" && settings.output !== null && !Array.isArray(settings.output)
        ? { ...(settings.output as Record<string, unknown>) }
        : {};
      output.statusTemplate = value;
      settings.output = output;
    });
  }

  async function loadOutputSettings(): Promise<void> {
    const value = await streamDeckClient.getSettings();
    const record = typeof value === "object" && value !== null && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
    const source = typeof record.settings === "object" && record.settings !== null && !Array.isArray(record.settings)
      ? record.settings as Record<string, unknown>
      : record;
    const output = typeof source.output === "object" && source.output !== null && !Array.isArray(source.output)
      ? source.output as Record<string, unknown>
      : {};

    textarea.value = typeof output.statusTemplate === "string" ? output.statusTemplate : "";
    const interval = output.refreshIntervalMinutes;
    refreshInterval.value = typeof interval === "number" || typeof interval === "string" ? String(interval) : "0";

    const show = typeof output.showStatusOnKey === "boolean" ? output.showStatusOnKey : true;
    if (show) refreshInterval.removeAttribute("disabled");
    else refreshInterval.setAttribute("disabled", "");
  }

  async function loadObservedFields(): Promise<void> {
    const value = await streamDeckClient.getGlobalSettings();
    if (typeof value !== "object" || value === null || Array.isArray(value)) return;
    const fields = (value as GetStatusGlobalSettings).observedStatusFields;
    if (fields && typeof fields === "object") observedFields = fields;
    renderFields();
  }

  streamDeckClient.sendToPropertyInspector.subscribe(event => {
    const message = parsePluginToPropertyInspectorMessage(event.payload);
    if (!message) return;

    if (message.event === "observedStatusFields") {
      observedFields = { ...observedFields, [message.deviceId]: [...message.fields] };
      renderFields();
      return;
    }

    if (message.event === "getDevices") {
      queryRequired<HTMLElement>("#catalog-status").textContent = message.refreshFailed
        ? t("Refresh failed. Showing the saved catalog.", "更新に失敗しました。保存済みの一覧を表示しています。")
        : "";
    }
  });

  deviceSelect.addEventListener("change", renderFields);
  showStatusOnKey.addEventListener("valuechange", updateRefreshIntervalAvailability);
  textarea.addEventListener("change", () => void saveTemplate(textarea.value));
  localizeUi();
  document.addEventListener("switchbot-locale-changed", localizeUi);
  void loadOutputSettings();
  void loadObservedFields();
});
