import "../shared/localization.js";
import "../shared/authentication.js";
import { attachExecutionDiagnostics } from "../shared/execution-diagnostics.js";
import { catalogRefreshStatusMessage } from "../shared/catalog-refresh-status.js";
import { queryRequired, valueOf } from "../shared/dom.js";
import {
  ApiEndpointPropertyInspectorDefinition,
  ApiEndpointsResultMessage,
  DevicesResultMessage,
  ScenesResultMessage,
  parsePluginToPropertyInspectorMessage
} from "../../protocol/property-inspector-protocol.js";

type EndpointDefinition = ApiEndpointPropertyInspectorDefinition;
type ApiEndpointsPayload = Pick<ApiEndpointsResultMessage, "event" | "definitions">;
type CatalogPayload =
  | Pick<DevicesResultMessage, "event" | "commandTemplates" | "refreshFailed" | "refreshFailure">
  | Pick<ScenesResultMessage, "event" | "refreshFailed" | "refreshFailure">;


document.addEventListener("DOMContentLoaded", () => {
  const { streamDeckClient } = SDPIComponents;
  attachExecutionDiagnostics(streamDeckClient);
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
    const message = parsePluginToPropertyInspectorMessage(event.payload);
    const endpoints = message?.event === "getApiEndpoints" ? message : undefined;
    if (endpoints) {
      definitions = new Map(endpoints.definitions.map(item => [item.id, item]));
      applyPresetBody();
      applyDeviceCommandTemplate();
      updateUi();
      return;
    }

    const catalog = message?.event === "getDevices" || message?.event === "getScenes" ? message : undefined;
    if (!catalog) return;
    if (catalog.event === "getDevices" && catalog.commandTemplates) {
      commandTemplates = new Map(Object.entries(catalog.commandTemplates));
      applyDeviceCommandTemplate();
    }
    catalogStatus.textContent = catalogRefreshStatusMessage(
      catalog.refreshFailed,
      catalog.refreshFailure,
      (english, japanese) => window.SwitchBotI18n?.t(english, japanese) ?? english
    );
  });

  updateUi();
  void endpoint.updateComplete?.then(updateUi);
  void method.updateComplete?.then(updateUi);

  document.addEventListener("switchbot-locale-changed", () => {
    sampleBodyButton.textContent = window.SwitchBotI18n?.t("Set sample JSON", "サンプルJSONを設定") ?? "Set sample JSON";
    updateUi();
  });
});
