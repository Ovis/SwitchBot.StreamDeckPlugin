const PRIORITY_FIELDS: ReadonlyArray<[string, string, string?]> = [
  ["temperature", "Temp", "°C"],
  ["humidity", "Humidity", "%"],
  ["CO2", "CO2", "ppm"],
  ["co2", "CO2", "ppm"],
  ["battery", "Battery", "%"],
  ["lockState", "Lock"],
  ["power", "Power"],
  ["brightness", "Brightness", "%"]
];

export function formatStatusForKey(responseBody: unknown): string | undefined {
  const status = statusBody(responseBody);
  if (!status) return undefined;

  const lines: string[] = [];
  const used = new Set<string>();

  for (const [key, label, suffix = ""] of PRIORITY_FIELDS) {
    const value = status[key];
    if (isPrimitive(value)) {
      lines.push(`${label}: ${String(value)}${suffix}`);
      used.add(key);
      if (lines.length === 3) return lines.join("\n");
    }
  }

  for (const [key, value] of Object.entries(status)) {
    if (used.has(key) || key === "deviceId" || key === "deviceType" || !isPrimitive(value)) continue;
    const text = `${key}: ${String(value)}`;
    if (text.length <= 24) lines.push(text);
    if (lines.length === 3) break;
  }

  return lines.length > 0 ? lines.join("\n") : undefined;
}

function statusBody(value: unknown): Record<string, unknown> | undefined {
  if (!isRecord(value) || !isRecord(value.body)) return undefined;
  return value.body;
}

function isPrimitive(value: unknown): value is string | number | boolean {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
