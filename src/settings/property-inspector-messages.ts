import type { PropertyInspectorMessageEnvelope } from "../protocol/property-inspector-protocol.js";

/**
 * Stream Deck SDK から渡される envelope を安全に読み取る。
 *
 * @elgato/streamdeck の SendToPluginEvent は raw WebSocket の context を公開せず、
 * 送信元Actionを action として公開するため、Action instance IDは action.id から取り出す。
 * SDK固有の形はここで吸収し、payloadのProtocol検証はprotocol層に委ねる。
 */
export function propertyInspectorMessage(value: unknown): PropertyInspectorMessageEnvelope {
  if (!isRecord(value)) return {};
  const action = isRecord(value.action) ? value.action : undefined;
  return {
    ...(typeof action?.id === "string" ? { context: action.id } : {}),
    ...("payload" in value ? { payload: value.payload } : {})
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
