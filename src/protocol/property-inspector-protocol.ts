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
  | InfraredRemotesRequest;

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
  | InfraredRemotesResultMessage;
