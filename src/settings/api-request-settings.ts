import { z } from "zod";

export const DEFAULT_API_REQUEST_BODY = `{
  "command": "",
  "parameter": "default",
  "commandType": "command"
}`;

const ApiRequestSettingsSchema = z.object({
  version: z.literal(1).default(1),
  method: z.enum(["GET", "POST", "PUT", "DELETE"]).catch("POST").default("POST"),
  path: z.string().catch("").default(""),
  body: z.string().catch(DEFAULT_API_REQUEST_BODY).default(DEFAULT_API_REQUEST_BODY),
  output: z.object({
    copyResponseToClipboard: z.boolean().catch(false).default(false),
    prettyPrint: z.boolean().catch(true).default(true)
  }).catch({ copyResponseToClipboard: false, prettyPrint: true })
    .default({ copyResponseToClipboard: false, prettyPrint: true })
});

export type ApiRequestSettingsV1 = z.infer<typeof ApiRequestSettingsSchema>;

export function normalizeApiRequestSettings(value: unknown): ApiRequestSettingsV1 {
  if (isFutureVersion(value)) return ApiRequestSettingsSchema.parse({});
  return ApiRequestSettingsSchema.parse(isRecord(value) ? value : {});
}

function isFutureVersion(value: unknown): boolean {
  return isRecord(value) && value.version !== undefined && value.version !== 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
