import type { JsonObject } from "@elgato/streamdeck";
import { z } from "zod";

export const DEFAULT_API_REQUEST_BODY = `{
  "command": "",
  "parameter": "default",
  "commandType": "command"
}`;

const MethodSchema = z.enum(["GET", "POST", "PUT", "DELETE"]);
const OutputSchema = z.object({
  copyResponseToClipboard: z.boolean().catch(false),
  prettyPrint: z.boolean().catch(true)
}).catch({ copyResponseToClipboard: false, prettyPrint: true });

export interface ApiRequestSettingsV1 extends JsonObject {
  version: 1;
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  body: string;
  output: { copyResponseToClipboard: boolean; prettyPrint: boolean };
}

export function normalizeApiRequestSettings(value: unknown): ApiRequestSettingsV1 {
  const record = isRecord(value) && (value.version === undefined || value.version === 1) ? value : {};
  return {
    version: 1,
    method: MethodSchema.catch("POST").parse(record.method),
    path: z.string().catch("").parse(record.path),
    body: z.string().catch(DEFAULT_API_REQUEST_BODY).parse(record.body),
    output: OutputSchema.parse(record.output)
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
