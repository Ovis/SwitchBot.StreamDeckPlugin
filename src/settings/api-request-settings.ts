import { z } from "zod";
import { API_ENDPOINT_IDS } from "../api/api-endpoints.js";

export const DEFAULT_API_REQUEST_BODY = `{
  "command": "",
  "parameter": "default",
  "commandType": "command"
}`;

const OutputSchema = z.object({
  copyResponseToClipboard: z.boolean().catch(false).default(false),
  prettyPrint: z.boolean().catch(true).default(true)
});

const ApiRequestSettingsSchema = z.object({
  version: z.literal(1).default(1),
  endpoint: z.enum(API_ENDPOINT_IDS).catch("custom").default("custom"),
  deviceId: z.string().catch("").default(""),
  sceneId: z.string().catch("").default(""),
  method: z.enum(["GET", "POST", "PUT", "DELETE"]).catch("POST").default("POST"),
  path: z.string().catch("").default(""),
  body: z.string().catch(DEFAULT_API_REQUEST_BODY).default(DEFAULT_API_REQUEST_BODY),
  output: OutputSchema
});

export type ApiRequestSettingsV1 = z.infer<typeof ApiRequestSettingsSchema>;

export function normalizeApiRequestSettings(value: unknown): ApiRequestSettingsV1 {
  if (isFutureVersion(value)) return defaults();
  const source = isRecord(value) ? value : {};
  return ApiRequestSettingsSchema.parse({
    ...source,
    output: OutputSchema.parse(isRecord(source.output) ? source.output : {})
  });
}

function defaults(): ApiRequestSettingsV1 {
  return ApiRequestSettingsSchema.parse({ output: OutputSchema.parse({}) });
}

function isFutureVersion(value: unknown): boolean {
  return isRecord(value) && value.version !== undefined && value.version !== 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
