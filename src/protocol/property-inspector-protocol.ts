/**
 * Property Inspector とプラグイン間の通信契約を定義する。
 *
 * datasource が要求する event 名は維持しつつ、すべてのメッセージを event で判別できる
 * discriminated union に統一する。外部境界の値は別途 parser で検証してから利用する。
 */
type ProtocolJsonPrimitive = string | number | boolean | null | undefined;
type ProtocolJsonValue = ProtocolJsonPrimitive | ProtocolJsonObject | ProtocolJsonValue[];

interface ProtocolJsonObject {
  [key: string]: ProtocolJsonValue;
}

export interface PropertyInspectorSelectItem extends ProtocolJsonObject {
  label: string;
  value: string;
}

export interface PropertyInspectorCredentials extends ProtocolJsonObject {
  token: string;
  secret: string;
}

export interface SaveCredentialsRequest extends ProtocolJsonObject {
  event: "saveCredentials";
  credentials: PropertyInspectorCredentials;
}

export interface TestConnectionRequest extends ProtocolJsonObject {
  event: "testConnection";
  credentials: PropertyInspectorCredentials;
}

export interface ApiEndpointsRequest extends ProtocolJsonObject {
  event: "getApiEndpoints";
}

export interface DevicesRequest extends ProtocolJsonObject {
  event: "getDevices";
  isRefresh?: boolean;
}

export interface ScenesRequest extends ProtocolJsonObject {
  event: "getScenes";
  isRefresh?: boolean;
}

export interface PhysicalControlCatalogRequest extends ProtocolJsonObject {
  event: "getPhysicalControlCatalog";
  isRefresh?: boolean;
}

export interface InfraredRemotesRequest extends ProtocolJsonObject {
  event: "getInfraredRemotes";
  isRefresh?: boolean;
}

export type PropertyInspectorToPluginMessage =
  | SaveCredentialsRequest
  | TestConnectionRequest
  | ApiEndpointsRequest
  | DevicesRequest
  | ScenesRequest
  | InfraredRemotesRequest
  | PhysicalControlCatalogRequest
  | ExecutionDiagnosticsRequest;

export interface PropertyInspectorMessageEnvelope {
  context?: string;
  payload?: unknown;
}

export type PropertyInspectorErrorCategory =
  | "configuration"
  | "authentication"
  | "network"
  | "http"
  | "switchbot"
  | "response"
  | "internal";

export interface ExecutionDiagnosticsRequest extends ProtocolJsonObject {
  event: "getExecutionDiagnostics";
}

export interface ExecutionDiagnosticsUnavailableMessage extends ProtocolJsonObject {
  event: "executionDiagnostics";
  available: false;
}

export interface ExecutionDiagnosticsAvailableMessage extends ProtocolJsonObject {
  event: "executionDiagnostics";
  available: true;
  executedAt: string;
  method: string;
  path: string;
  success: boolean;
  errorCategory?: PropertyInspectorErrorCategory;
  errorMessage?: string;
  httpStatus?: number;
  switchBotStatusCode?: number;
  switchBotMessage?: string;
  responseBody?: string;
}

export type ExecutionDiagnosticsMessage =
  | ExecutionDiagnosticsUnavailableMessage
  | ExecutionDiagnosticsAvailableMessage;

export interface TestConnectionResultMessage extends ProtocolJsonObject {
  event: "testConnectionResult";
  success: boolean;
  errorCategory?: PropertyInspectorErrorCategory;
}

export interface ApiEndpointPropertyInspectorDefinition extends ProtocolJsonObject {
  id: string;
  method: string;
  path: string;
  parameter?: "device" | "scene";
  bodyMode: "none" | "json";
  defaultBody?: string;
}

export interface ApiEndpointsResultMessage extends ProtocolJsonObject {
  event: "getApiEndpoints";
  items: PropertyInspectorSelectItem[];
  definitions: ApiEndpointPropertyInspectorDefinition[];
}

export interface DevicesResultMessage extends ProtocolJsonObject {
  event: "getDevices";
  items: PropertyInspectorSelectItem[];
  commandTemplates?: Record<string, string>;
  refreshFailed?: boolean;
}

export interface ScenesResultMessage extends ProtocolJsonObject {
  event: "getScenes";
  items: PropertyInspectorSelectItem[];
  refreshFailed?: boolean;
}

export type InfraredParameterKind = "default" | "channel" | "air-conditioner" | "custom";

export interface InfraredCommandPropertyInspectorItem extends PropertyInspectorSelectItem {
  parameterKind: InfraredParameterKind;
}

export interface InfraredRemotePropertyInspectorItem extends PropertyInspectorSelectItem {
  remoteType: string;
  hubDeviceId: string;
  commands: InfraredCommandPropertyInspectorItem[];
}

export interface PhysicalControlDeviceItem extends PropertyInspectorSelectItem {
  deviceType: string;
}

export interface PhysicalControlOperationItem extends PropertyInspectorSelectItem {
  requestBody: string;
}

export interface PhysicalControlCatalogMessage extends ProtocolJsonObject {
  event: "physicalControlCatalog";
  devices: PhysicalControlDeviceItem[];
  operations: PhysicalControlOperationItem[];
  refreshFailed?: boolean;
}

export interface InfraredRemotesResultMessage extends ProtocolJsonObject {
  event: "getInfraredRemotes";
  items: PropertyInspectorSelectItem[];
  remotes: InfraredRemotePropertyInspectorItem[];
  refreshFailed?: boolean;
}

export type PluginToPropertyInspectorMessage =
  | TestConnectionResultMessage
  | ApiEndpointsResultMessage
  | DevicesResultMessage
  | ScenesResultMessage
  | InfraredRemotesResultMessage
  | PhysicalControlCatalogMessage
  | ExecutionDiagnosticsMessage;


/**
 * Property Inspector からPluginへ届く payload を共有Protocolとして検証する。
 *
 * 未知eventや不正な必須値は受理せず、Actionが未検証の外部入力を扱わないようにする。
 */
export function parsePropertyInspectorToPluginMessage(value: unknown): PropertyInspectorToPluginMessage | undefined {
  if (!protocolRecord(value) || typeof value.event !== "string") return undefined;

  if (value.event === "saveCredentials" || value.event === "testConnection") {
    const credentials = protocolCredentials(value.credentials);
    return credentials ? { event: value.event, credentials } : undefined;
  }
  if (value.event === "getApiEndpoints") return { event: "getApiEndpoints" };
  if (value.event === "getExecutionDiagnostics") return { event: "getExecutionDiagnostics" };
  if (value.event === "getDevices" || value.event === "getScenes" || value.event === "getInfraredRemotes" || value.event === "getPhysicalControlCatalog") {
    return {
      event: value.event,
      ...(typeof value.isRefresh === "boolean" ? { isRefresh: value.isRefresh } : {})
    };
  }
  return undefined;
}

function protocolCredentials(value: unknown): PropertyInspectorCredentials | undefined {
  if (!protocolRecord(value) || typeof value.token !== "string" || typeof value.secret !== "string") return undefined;
  return { token: value.token, secret: value.secret };
}

/**
 * Plugin から Property Inspector へ届く payload を共有Protocolとして検証する。
 *
 * Stream Deck SDK は外部境界なので型宣言だけを信用せず、未知eventや不正な必須値は受理しない。
 */
export function parsePluginToPropertyInspectorMessage(value: unknown): PluginToPropertyInspectorMessage | undefined {
  if (!protocolRecord(value) || typeof value.event !== "string") return undefined;

  if (value.event === "executionDiagnostics") {
    if (typeof value.available !== "boolean") return undefined;
    if (!value.available) return { event: "executionDiagnostics", available: false };
    if (typeof value.executedAt !== "string" || typeof value.method !== "string" || typeof value.path !== "string"
      || typeof value.success !== "boolean") return undefined;
    const errorCategory = protocolErrorCategory(value.errorCategory);
    return {
      event: "executionDiagnostics",
      available: true,
      executedAt: value.executedAt,
      method: value.method,
      path: value.path,
      success: value.success,
      ...(errorCategory ? { errorCategory } : {}),
      ...(typeof value.errorMessage === "string" ? { errorMessage: value.errorMessage } : {}),
      ...(typeof value.httpStatus === "number" ? { httpStatus: value.httpStatus } : {}),
      ...(typeof value.switchBotStatusCode === "number" ? { switchBotStatusCode: value.switchBotStatusCode } : {}),
      ...(typeof value.switchBotMessage === "string" ? { switchBotMessage: value.switchBotMessage } : {}),
      ...(typeof value.responseBody === "string" ? { responseBody: value.responseBody } : {})
    };
  }

  if (value.event === "testConnectionResult") {
    if (typeof value.success !== "boolean") return undefined;
    const errorCategory = protocolErrorCategory(value.errorCategory);
    return { event: "testConnectionResult", success: value.success, ...(errorCategory ? { errorCategory } : {}) };
  }

  if (value.event === "getDevices" || value.event === "getScenes") {
    if (!Array.isArray(value.items)) return undefined;
    const items = value.items.map(protocolSelectItem).filter(protocolDefined);
    const refreshFailed = typeof value.refreshFailed === "boolean" ? value.refreshFailed : undefined;
    if (value.event === "getScenes") {
      return { event: "getScenes", items, ...(refreshFailed !== undefined ? { refreshFailed } : {}) };
    }
    const commandTemplates = protocolRecord(value.commandTemplates)
      ? Object.fromEntries(Object.entries(value.commandTemplates).filter((entry): entry is [string, string] => typeof entry[1] === "string"))
      : undefined;
    return { event: "getDevices", items, ...(commandTemplates ? { commandTemplates } : {}), ...(refreshFailed !== undefined ? { refreshFailed } : {}) };
  }

  if (value.event === "getApiEndpoints") {
    if (!Array.isArray(value.items) || !Array.isArray(value.definitions)) return undefined;
    const definitions = value.definitions.map(protocolEndpoint).filter(protocolDefined);
    return { event: "getApiEndpoints", items: value.items.map(protocolSelectItem).filter(protocolDefined), definitions };
  }

  if (value.event === "physicalControlCatalog") {
    if (!Array.isArray(value.devices) || !Array.isArray(value.operations)) return undefined;
    const devices = value.devices.map(protocolPhysicalControlDevice).filter(protocolDefined);
    const operations = value.operations.map(protocolPhysicalControlOperation).filter(protocolDefined);
    return { event: "physicalControlCatalog", devices, operations, ...(typeof value.refreshFailed === "boolean" ? { refreshFailed: value.refreshFailed } : {}) };
  }

  if (value.event === "getInfraredRemotes") {
    if (!Array.isArray(value.items) || !Array.isArray(value.remotes)) return undefined;
    const remotes = value.remotes.map(protocolInfraredRemote).filter(protocolDefined);
    return {
      event: "getInfraredRemotes",
      items: value.items.map(protocolSelectItem).filter(protocolDefined),
      remotes,
      ...(typeof value.refreshFailed === "boolean" ? { refreshFailed: value.refreshFailed } : {})
    };
  }

  return undefined;
}

function protocolSelectItem(value: unknown): PropertyInspectorSelectItem | undefined {
  if (!protocolRecord(value) || typeof value.label !== "string" || typeof value.value !== "string") return undefined;
  return { label: value.label, value: value.value };
}

function protocolEndpoint(value: unknown): ApiEndpointPropertyInspectorDefinition | undefined {
  if (!protocolRecord(value) || typeof value.id !== "string" || typeof value.method !== "string" || typeof value.path !== "string") return undefined;
  if (value.parameter !== undefined && value.parameter !== "device" && value.parameter !== "scene") return undefined;
  if (value.bodyMode !== "none" && value.bodyMode !== "json") return undefined;
  if (value.defaultBody !== undefined && typeof value.defaultBody !== "string") return undefined;
  return {
    id: value.id, method: value.method, path: value.path, bodyMode: value.bodyMode,
    ...(value.parameter ? { parameter: value.parameter } : {}),
    ...(typeof value.defaultBody === "string" ? { defaultBody: value.defaultBody } : {})
  };
}

function protocolPhysicalControlOperation(value: unknown): PhysicalControlOperationItem | undefined {
  const item = protocolSelectItem(value);
  if (!item || !protocolRecord(value) || typeof value.requestBody !== "string") return undefined;
  return { ...item, requestBody: value.requestBody };
}

function protocolPhysicalControlDevice(value: unknown): PhysicalControlDeviceItem | undefined {
  const item = protocolSelectItem(value);
  if (!item || !protocolRecord(value) || typeof value.deviceType !== "string") return undefined;
  return { ...item, deviceType: value.deviceType };
}

function protocolInfraredRemote(value: unknown): InfraredRemotePropertyInspectorItem | undefined {
  if (!protocolRecord(value) || typeof value.label !== "string" || typeof value.value !== "string"
    || typeof value.remoteType !== "string" || typeof value.hubDeviceId !== "string" || !Array.isArray(value.commands)) return undefined;
  return {
    label: value.label, value: value.value, remoteType: value.remoteType, hubDeviceId: value.hubDeviceId,
    commands: value.commands.map(protocolInfraredCommand).filter(protocolDefined)
  };
}

function protocolInfraredCommand(value: unknown): InfraredCommandPropertyInspectorItem | undefined {
  if (!protocolRecord(value) || typeof value.label !== "string" || typeof value.value !== "string") return undefined;
  if (value.parameterKind !== "default" && value.parameterKind !== "channel"
    && value.parameterKind !== "air-conditioner" && value.parameterKind !== "custom") return undefined;
  return { label: value.label, value: value.value, parameterKind: value.parameterKind };
}

function protocolErrorCategory(value: unknown): PropertyInspectorErrorCategory | undefined {
  if (value === "configuration" || value === "authentication" || value === "network" || value === "http"
    || value === "switchbot" || value === "response" || value === "internal") return value;
  return undefined;
}

function protocolDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function protocolRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
