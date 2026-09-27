export interface PropertyInspectorMessage {
  context?: string;
  payload?: {
    type?: unknown;
    event?: unknown;
    isRefresh?: unknown;
    credentials?: unknown;
  };
}

export function propertyInspectorMessage(value: unknown): PropertyInspectorMessage {
  return typeof value === "object" && value !== null ? value as PropertyInspectorMessage : {};
}

export function credentialsFromPayload(value: unknown): { token: string; secret: string } | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.token !== "string" || typeof record.secret !== "string") return undefined;
  return { token: record.token, secret: record.secret };
}
