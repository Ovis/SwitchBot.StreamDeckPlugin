import { z } from "zod";

export const DEFAULT_API_REQUEST_BODY = `{
  "command": "",
  "parameter": "default",
  "commandType": "command"
}`;

const ApiRequestSettingsSchema = z.object({
  version: z.literal(1).default(1),
  method: z.enum(["GET", "POST", "PUT", "DELETE"]).default("POST"),
  path: z.string().default(""),
  body: z.string().default(DEFAULT_API_REQUEST_BODY),
  output: z.object({
    copyResponseToClipboard: z.boolean().default(false),
    prettyPrint: z.boolean().default(true)
  }).default({ copyResponseToClipboard: false, prettyPrint: true })
});

export type ApiRequestSettingsV1 = z.infer<typeof ApiRequestSettingsSchema>;

export function normalizeApiRequestSettings(value: unknown): ApiRequestSettingsV1 {
  const parsed = ApiRequestSettingsSchema.safeParse(value);
  return parsed.success ? parsed.data : ApiRequestSettingsSchema.parse({});
}
