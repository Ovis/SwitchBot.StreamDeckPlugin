import type {
  PropertyInspectorCredentials,
  PropertyInspectorMessageEnvelope,
  PropertyInspectorToPluginMessage
} from "../protocol/property-inspector-protocol.js";

/**
 * Stream Deck SDK から渡される envelope を安全に読み取る。
 */
export function propertyInspectorMessage(value: unknown): PropertyInspectorMessageEnvelope {
  if (!isRecord(value)) return {};
  return {
    ...(typeof value.context === "string" ? { context: value.context } : {}),
    ...("payload" in value ? { payload: value.payload } : {})
  };
}

/**
 * Property Inspector から届いた payload を共有Protocolへ変換する。
 *
 * 未知のeventや不正な必須値は受理せず、将来のProtocol追加時にも既存Actionが
 * 誤って別メッセージとして処理しないよう fail closed とする。
 */
export function propertyInspectorRequest(value: unknown): PropertyInspectorToPluginMessage | undefined {
  if (!isRecord(value) || typeof value.event !== "string") return undefined;

  switch (value.event) {
    case "saveCredentials":
    case "testConnection": {
      const credentials = credentialsFromPayload(value.credentials);
      if (!credentials) return undefined;
      return { event: value.event, credentials };
    }
    case "getApiEndpoints":
      return { event: "getApiEndpoints" };
    case "getDevices":
    case "getScenes":
    case "getInfraredRemotes":
      return {
        event: value.event,
        ...(typeof value.isRefresh === "boolean" ? { isRefresh: value.isRefresh } : {})
      };
    default:
      return undefined;
  }
}

export function credentialsFromPayload(value: unknown): PropertyInspectorCredentials | undefined {
  if (!isRecord(value)) return undefined;
  if (typeof value.token !== "string" || typeof value.secret !== "string") return undefined;
  return { token: value.token, secret: value.secret };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
