import "../shared/localization.js";
import "../shared/authentication.js";
import { attachExecutionDiagnostics } from "../shared/execution-diagnostics.js";
import { createSettingsPatchQueue, queryRequired, valueOf } from "../shared/dom.js";
import { parsePluginToPropertyInspectorMessage } from "../../protocol/property-inspector-protocol.js";

interface GetStatusGlobalSettings {
  observedStatusFields?: Record<string, string[]>;
}

document.addEventListener("DOMContentLoaded", () => {
  const { streamDeckClient } = SDPIComponents;
  const patchSettings = createSettingsPatchQueue(streamDeckClient);
  const textarea = queryRequired<HTMLTextAreaElement>("#status-template");
  const deviceSelect = queryRequired<SdpiValueElement>("#device-select");
  let observedFields: Record<string, string[]> = {};

  attachExecutionDiagnostics(streamDeckClient);

  function t(en: string, ja: string): string {
    return window.SwitchBotI18n?.t(en, ja) ?? en;
  }

  function localizeUi(): void {
    queryRequired<HTMLElement>("#output-heading").textContent = t("Output", "出力");
    queryRequired<HTMLElement>("#status-template-item").setAttribute("label", t("Display template", "表示テンプレート"));
    queryRequired<HTMLElement>("#template-help").textContent = t(
      "Wrap a Status API field name in {}, for example {temperature}. Leave blank to use automatic display.",
      "Status APIのフィールド名を{}で囲みます（例: {temperature}）。空欄なら自動表示します。"
    );
    renderFields();
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
    await saveTemplate(next);

    textarea.focus();
    const caret = start + insertion.length;
    textarea.setSelectionRange(caret, caret);
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

  async function loadTemplate(): Promise<void> {
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
  textarea.addEventListener("change", () => void saveTemplate(textarea.value));
  localizeUi();
  document.addEventListener("switchbot-locale-changed", localizeUi);
  void loadTemplate();
  void loadObservedFields();
});
