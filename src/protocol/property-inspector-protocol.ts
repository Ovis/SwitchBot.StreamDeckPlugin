/**
 * Property Inspector とプラグイン間で共有する選択肢の wire 形式を表す。
 *
 * PR0-B では既存通信との互換性を維持するため、フィールド名やイベント名は変更しない。
 */
export interface PropertyInspectorSelectItem {
  label: string;
  value: string;
}

/**
 * Property Inspector から認証情報を保存・検証するときに送信する値を表す。
 */
export interface PropertyInspectorCredentials {
  token: string;
  secret: string;
}

/**
 * 認証情報を保存する既存メッセージを表す。
 */
export interface SaveCredentialsMessage {
  type: "saveCredentials";
  credentials: PropertyInspectorCredentials;
}

/**
 * 接続テストを実行する既存メッセージを表す。
 */
export interface TestConnectionMessage {
  type: "testConnection";
  credentials: PropertyInspectorCredentials;
}

/**
 * datasource の一覧取得・明示更新で使用する既存メッセージを表す。
 */
export interface CatalogRequestMessage {
  event: "getDevices" | "getScenes" | "getInfraredRemotes";
  isRefresh?: boolean;
}

/**
 * API Request のエンドポイント定義取得に使用する既存メッセージを表す。
 */
export interface ApiEndpointsRequestMessage {
  event: "getApiEndpoints";
}

export type PropertyInspectorToPluginMessage =
  | SaveCredentialsMessage
  | TestConnectionMessage
  | CatalogRequestMessage
  | ApiEndpointsRequestMessage;

/**
 * Stream Deck SDK が sendToPlugin の payload と併せてプラグインへ渡す envelope を表す。
 *
 * SDK由来の入力自体は信頼せず、既存の実行時チェックを維持する。
 */
export interface PropertyInspectorMessageEnvelope {
  context?: string;
  payload?: {
    type?: unknown;
    event?: unknown;
    isRefresh?: unknown;
    credentials?: unknown;
    [key: string]: unknown;
  };
}

/**
 * 接続テスト結果として返す既存メッセージを表す。
 */
export type PropertyInspectorErrorCategory =
  | "configuration"
  | "authentication"
  | "network"
  | "http"
  | "switchbot"
  | "response"
  | "internal";

export interface TestConnectionResultMessage {
  type: "testConnectionResult";
  success: boolean;
  errorCategory?: PropertyInspectorErrorCategory;
}

/**
 * API Request PI が表示に使用するエンドポイント定義の wire 形式を表す。
 */
export interface ApiEndpointPropertyInspectorDefinition {
  id: string;
  method: string;
  path: string;
  parameter?: "device" | "scene";
  bodyMode: "none" | "json";
  defaultBody?: string;
}

/**
 * API Request PI にエンドポイント候補と定義を返す既存メッセージを表す。
 */
export interface ApiEndpointsResultMessage {
  event: "getApiEndpoints";
  items: PropertyInspectorSelectItem[];
  definitions: ApiEndpointPropertyInspectorDefinition[];
}

/**
 * 物理デバイス一覧を返す既存メッセージを表す。
 *
 * commandTemplates は API Request の制御コマンド用サンプルだけで利用するため任意とする。
 */
export interface DevicesResultMessage {
  event: "getDevices";
  items: PropertyInspectorSelectItem[];
  commandTemplates?: Record<string, string>;
  refreshFailed?: boolean;
}

/**
 * シーン一覧を返す既存メッセージを表す。
 */
export interface ScenesResultMessage {
  event: "getScenes";
  items: PropertyInspectorSelectItem[];
  refreshFailed?: boolean;
}

export type InfraredParameterKind = "default" | "channel" | "air-conditioner" | "custom";

/**
 * 赤外線リモコン PI の操作候補を表す。
 */
export interface InfraredCommandPropertyInspectorItem extends PropertyInspectorSelectItem {
  parameterKind: InfraredParameterKind;
}

/**
 * 赤外線リモコン PI が操作候補を切り替えるために必要なリモコン情報を表す。
 */
export interface InfraredRemotePropertyInspectorItem extends PropertyInspectorSelectItem {
  remoteType: string;
  hubDeviceId: string;
  commands: InfraredCommandPropertyInspectorItem[];
}

/**
 * 赤外線リモコン一覧を返す既存メッセージを表す。
 */
export interface InfraredRemotesResultMessage {
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
