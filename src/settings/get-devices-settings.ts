import { z } from "zod";

const GetDevicesSettingsSchema = z.object({
  version: z.literal(1).default(1),
  output: z.object({
    copyResponseToClipboard: z.boolean().catch(false).default(false)
  }).catch({ copyResponseToClipboard: false }).default({ copyResponseToClipboard: false })
});

export type GetDevicesSettingsV1 = z.infer<typeof GetDevicesSettingsSchema>;

export function normalizeGetDevicesSettings(value: unknown): GetDevicesSettingsV1 {
  if (isFutureVersion(value)) return GetDevicesSettingsSchema.parse({});
  return GetDevicesSettingsSchema.parse(isRecord(value) ? value : {});
}

function isFutureVersion(value: unknown): boolean {
  return isRecord(value) && value.version !== undefined && value.version !== 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
