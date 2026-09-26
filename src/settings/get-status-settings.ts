import { z } from "zod";

const GetStatusSettingsSchema = z.object({
  version: z.literal(1).default(1),
  deviceId: z.string().catch("").default(""),
  output: z.object({
    prettyPrint: z.boolean().catch(true).default(true)
  }).catch({ prettyPrint: true }).default({ prettyPrint: true })
});

export type GetStatusSettingsV1 = z.infer<typeof GetStatusSettingsSchema>;

export function normalizeGetStatusSettings(value: unknown): GetStatusSettingsV1 {
  if (isFutureVersion(value)) return GetStatusSettingsSchema.parse({});
  return GetStatusSettingsSchema.parse(isRecord(value) ? value : {});
}

function isFutureVersion(value: unknown): boolean {
  return isRecord(value) && value.version !== undefined && value.version !== 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
