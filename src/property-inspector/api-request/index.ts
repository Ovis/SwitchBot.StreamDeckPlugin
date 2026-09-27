import "../shared/localization.js";
import "../shared/authentication.js";
import { queryRequired, valueOf } from "../shared/dom.js";

interface EndpointDefinition {
  id: string;
  method: string;
  path: string;
  parameter?: "device" | "scene";
  bodyMode?: "none" | string;
  defaultBody?: string;
}

interface ApiEndpointsPayload {
  event: "getApiEndpoints";
  definitions: EndpointDefinition[];
}

interface CatalogPayload {
  event: "getDevices" | "getScenes";
  commandTemplates?: Record<string, string>;
  refreshFailed?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function endpointPayload(value: unknown): ApiEndpointsPayload | undefined {
  if (!isRecord(value) || value.event !== "getApiEndpoints" || !Array.isArray(value.definitions)) return undefined;
  const definitions = value.definitions.filter((item): item is EndpointDefinition =>
    isRecord(item) && typeof item.id === "string" && typeof item.method === "string" && typeof item.path === "string"
  );
  return { event: "getApiEndpoints", definitions };
}

function catalogPayload(value: unknown): CatalogPayload | undefined {
  if (!isRecord(value) || (value.event !== "getDevices" && value.event !== "getScenes")) return undefined;
  const commandTemplates = isRecord(value.commandTemplates)
    ? Object.fromEntries(Object.entries(value.commandTemplates).filter((entry): entry is [string, string] => typeof entry[1] === "string"))
    : undefined;
  return {
    event: value.event,
    ...(commandTemplates ? { commandTemplates } : {}),
    ...(typeof value.refreshFailed === "boolean" ? { refreshFailed: value.refreshFailed } : {})
  };
}

document.addEventListener("DOMContentLoaded", () => {
  const { streamDeckClient } = SDPIComponents;
  const endpoint = queryRequired<SdpiValueElement>("#endpoint");
  const method = queryRequired<SdpiValueElement>("#method");
  const methodItem = queryRequired<HTMLElement>("#method-item");
  const pathItem = queryRequired<HTMLElement>("#path-item");
  const path = queryRequired<SdpiValueElement>("#path");
  const deviceItem = queryRequired<HTMLElement>("#device-item");
  const device = queryRequired<SdpiValueElement>("#device");
  const sceneItem = queryRequired<HTMLElement>("#scene-item");
  const preview = queryRequired<HTMLElement>("#preset-preview");
  const bodyItem = queryRequired<HTMLElement>("#body-item");
  const body = queryRequired<SdpiValueElement>("#request-body");
  const status = queryRequired<HTMLElement>("#json-status");
  const catalogStatus = queryRequired<HTMLElement>("#catalog-status");
  const sampleBodyItem = queryRequired<HTMLElement>("#sample-body-item");
  const sampleBodyButton = queryRequired<HTMLElement>("#sample-body-button");

  let definitions = new Map<string, EndpointDefinition>();
  let commandTemplates = new Map<string, string>();
  let lastAutoTemplate = "";

  const selectedEndpoint = () => valueOf(endpoint, "custom");
  const definition = () => definitions.get(selectedEndpoint());
  const effectiveMethod = () => definition()?.method || valueOf(method, "POST");

  function validateJson(): void {
    if (bodyItem.hidden) return;
    const value = valueOf(body);
    if (!value.trim()) {
      status.textContent = window.SwitchBotI18n?.t("Empty body", "本文が空です") ?? "Empty body";
      status.className = "";
      return;
    }
    try {
      JSON.parse(value);
      status.textContent = window.SwitchBotI18n?.t("Valid JSON", "有効なJSON") ?? "Valid JSON";
      status.className = "valid";
    } catch {
      status.textContent = window.SwitchBotI18n?.t("Invalid JSON", "無効なJSON") ?? "Invalid JSON";
      status.className = "invalid";
    }
  }

  function updateUi(): void {
    const preset = definition();
    const custom = selectedEndpoint() === "custom";
    methodItem.hidden = !custom;
    pathItem.hidden = !custom;
    preview.hidden = custom;
    if (custom) path.setAttribute("required", "");
    else path.removeAttribute("required");

    deviceItem.hidden = preset?.parameter !== "device";
    sceneItem.hidden = preset?.parameter !== "scene";
    if (preset) preview.textContent = `${preset.method} ${preset.path}`;

    bodyItem.hidden = preset ? preset.bodyMode === "none" : effectiveMethod() !== "POST" && effectiveMethod() !== "PUT";
    const hasSample = selectedEndpoint() === "send-device-command" && commandTemplates.has(valueOf(device));
    sampleBodyItem.hidden = bodyItem.hidden || !hasSample;
    if (bodyItem.hidden) status.textContent = "";
    else validateJson();
  }

  function applyPresetBody(): void {
    const preset = definition();
    if (!preset?.defaultBody) return;
    const current = valueOf(body).trim();
    const generic = `{
  "command": "",
  "parameter": "default",
  "commandType": "command"
}`;
    if (!current || current === generic.trim()) body.value = preset.defaultBody;
  }

  function applyDeviceCommandTemplate(): void {
    if (selectedEndpoint() !== "send-device-command") return;
    const template = commandTemplates.get(valueOf(device));
    if (!template) return;
    const current = valueOf(body).trim();
    const generic = `{
  "command": "",
  "parameter": "default",
  "commandType": "command"
}`;
    if (!current || current === generic.trim() || current === lastAutoTemplate.trim()) {
      body.value = template;
      lastAutoTemplate = template;
      validateJson();
    }
  }

  function setDeviceCommandSample(): void {
    const template = commandTemplates.get(valueOf(device));
    if (!template || selectedEndpoint() !== "send-device-command") return;
    body.value = template;
    lastAutoTemplate = template;
    validateJson();
  }

  function onEndpointChanged(): void {
    catalogStatus.textContent = "";
    applyPresetBody();
    updateUi();
  }

  endpoint.addEventListener("valuechange", onEndpointChanged);
  method.addEventListener("valuechange", updateUi);
  device.addEventListener("valuechange", () => {
    applyDeviceCommandTemplate();
    updateUi();
  });
  sampleBodyButton.addEventListener("click", setDeviceCommandSample);
  document.addEventListener("input", event => {
    if (event.target instanceof Element && event.target.getAttribute("setting") === "body") validateJson();
  });

  streamDeckClient.sendToPropertyInspector.subscribe(event => {
    const endpoints = endpointPayload(event.payload);
    if (endpoints) {
      definitions = new Map(endpoints.definitions.map(item => [item.id, item]));
      applyPresetBody();
      applyDeviceCommandTemplate();
      updateUi();
      return;
    }

    const catalog = catalogPayload(event.payload);
    if (!catalog) return;
    if (catalog.event === "getDevices" && catalog.commandTemplates) {
      commandTemplates = new Map(Object.entries(catalog.commandTemplates));
      applyDeviceCommandTemplate();
    }
    if (catalog.refreshFailed) {
      catalogStatus.textContent = window.SwitchBotI18n?.t(
        "Refresh failed. Showing the saved catalog.",
        "更新に失敗しました。保存済みの一覧を表示しています。"
      ) ?? "Refresh failed. Showing the saved catalog.";
    }
  });

  updateUi();
  void endpoint.updateComplete?.then(updateUi);
  void method.updateComplete?.then(updateUi);

  document.addEventListener("switchbot-locale-changed", () => {
    sampleBodyButton.textContent = window.SwitchBotI18n?.t("Set sample JSON", "サンプルJSONを設定") ?? "Set sample JSON";
    updateUi();
  });
});
