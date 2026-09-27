import { z } from "zod";

const OutputSchema = z.object({
  showStatusOnKey: z.boolean().catch(true).default(true),
  copyResponseToClipboard: z.boolean().catch(false).default(false),
  prettyPrint: z.boolean().catch(true).default(true)
});

const GetStatusSettingsSchema = z.object({
  version: z.literal(1).default(1),
  deviceId: z.string().catch("").default(""),
  buttonName: z.string().catch("").default(""),
  output: OutputSchema
});

export type GetStatusSettingsV1 = z.infer<typeof GetStatusSettingsSchema>;

export function normalizeGetStatusSettings(value: unknown): GetStatusSettingsV1 {
  if (isFutureVersion(value)) return defaults();
  const source = isRecord(value) ? value : {};
  return GetStatusSettingsSchema.parse({
    ...source,
    output: OutputSchema.parse(isRecord(source.output) ? source.output : {})
  });
}

function defaults(): GetStatusSettingsV1 {
  return GetStatusSettingsSchema.parse({ output: OutputSchema.parse({}) });
}

function isFutureVersion(value: unknown): boolean {
  return isRecord(value) && value.version !== undefined && value.version !== 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
