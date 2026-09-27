import type {
  PropertyInspectorCredentials,
  PropertyInspectorMessageEnvelope
} from "../protocol/property-inspector-protocol.js";

export type PropertyInspectorMessage = PropertyInspectorMessageEnvelope;

export function propertyInspectorMessage(value: unknown): PropertyInspectorMessage {
  return typeof value === "object" && value !== null ? value as PropertyInspectorMessage : {};
}

export function credentialsFromPayload(value: unknown): PropertyInspectorCredentials | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.token !== "string" || typeof record.secret !== "string") return undefined;
  return { token: record.token, secret: record.secret };
}
