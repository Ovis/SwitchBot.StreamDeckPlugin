export type DisplayLocale = "en" | "ja";

const PRIORITY_FIELDS: ReadonlyArray<[string, string, string, string?]> = [
  ["temperature", "Temp", "温度", "°C"],
  ["humidity", "Humidity", "湿度", "%"],
  ["CO2", "CO2", "CO2", "ppm"],
  ["co2", "CO2", "CO2", "ppm"],
  ["battery", "Battery", "電池", "%"],
  ["lockState", "Lock", "ロック"],
  ["power", "Power", "電源"],
  ["brightness", "Brightness", "明るさ", "%"]
];

export function displayLocale(locale: string | undefined): DisplayLocale {
  return locale?.toLowerCase().startsWith("ja") ? "ja" : "en";
}

export function formatStatusForKey(responseBody: unknown, locale: DisplayLocale = "en"): string | undefined {
  const status = statusBody(responseBody);
  if (!status) return undefined;
  const lines: string[] = [];
  const used = new Set<string>();

  for (const [key, en, ja, suffix = ""] of PRIORITY_FIELDS) {
    const value = status[key];
    if (isPrimitive(value)) {
      lines.push(`${locale === "ja" ? ja : en}: ${localizeValue(value, locale)}${suffix}`);
      used.add(key);
      if (lines.length === 3) return lines.join("\n");
    }
  }

  for (const [key, value] of Object.entries(status)) {
    if (used.has(key) || key === "deviceId" || key === "deviceType" || !isPrimitive(value)) continue;
    const text = `${key}: ${localizeValue(value, locale)}`;
    if (text.length <= 24) lines.push(text);
    if (lines.length === 3) break;
  }
  return lines.length > 0 ? lines.join("\n") : undefined;
}

export function localizeDeviceLabel(name: string, type: string, id: string, deleted: boolean, locale: DisplayLocale): string {
  const displayName = name.trim() || (locale === "ja" ? "名称未設定" : "Unnamed device");
  const displayType = type.trim() || (locale === "ja" ? "種類不明" : "Unknown type");
  const prefix = deleted ? (locale === "ja" ? "[削除済み] " : "[Deleted] ") : "";
  return `${prefix}${displayName} — ${displayType} (${id})`;
}

function localizeValue(value: string | number | boolean, locale: DisplayLocale): string {
  if (locale !== "ja" || typeof value !== "string") return String(value);
  const values: Record<string, string> = {
    on: "オン", off: "オフ", locked: "施錠", unlocked: "解錠",
    open: "開", close: "閉", closed: "閉", detected: "検知", notDetected: "未検知"
  };
  return values[value] ?? values[value.toLowerCase()] ?? value;
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
