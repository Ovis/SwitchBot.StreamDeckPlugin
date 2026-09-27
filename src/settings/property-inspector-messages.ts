import type { PropertyInspectorMessageEnvelope } from "../protocol/property-inspector-protocol.js";

/**
 * Stream Deck SDK から渡される envelope を安全に読み取る。
 *
 * envelope自体はSDK固有のためここで切り出し、payloadのProtocol検証はprotocol層に委ねる。
 */
export function propertyInspectorMessage(value: unknown): PropertyInspectorMessageEnvelope {
  if (!isRecord(value)) return {};
  return {
    ...(typeof value.context === "string" ? { context: value.context } : {}),
    ...("payload" in value ? { payload: value.payload } : {})
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
