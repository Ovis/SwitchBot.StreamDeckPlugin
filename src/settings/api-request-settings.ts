import { z } from "zod";
import { API_ENDPOINT_IDS } from "../api/api-endpoints.js";
import { nestedRecord, normalizeVersionedSettings } from "./settings-lifecycle.js";

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
  return normalizeVersionedSettings(value, {
    currentVersion: 1,
    schema: ApiRequestSettingsSchema,
    defaults,
    normalize: source => ({
      ...source,
      output: OutputSchema.parse(nestedRecord(source, "output"))
    })
  });
}

function defaults(): ApiRequestSettingsV1 {
  return ApiRequestSettingsSchema.parse({ output: OutputSchema.parse({}) });
}
