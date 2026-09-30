import { z } from "zod";
import { nestedRecord, normalizeVersionedSettings } from "./settings-lifecycle.js";

const OutputSchema = z.object({
  showStatusOnKey: z.boolean().catch(true).default(true),
  copyResponseToClipboard: z.boolean().catch(false).default(false),
  prettyPrint: z.boolean().catch(true).default(true),
  statusTemplate: z.string().catch("").default(""),
  refreshIntervalMinutes: z.preprocess(\n    value => typeof value === "string" && value.trim() !== "" ? Number(value) : value,\n    z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(5), z.literal(10), z.literal(30), z.literal(60)]).catch(0).default(0)\n  )
});

const GetStatusSettingsSchema = z.object({
  version: z.literal(1).default(1),
  deviceId: z.string().catch("").default(""),
  buttonName: z.string().catch("").default(""),
  output: OutputSchema
});

export type GetStatusSettingsV1 = z.infer<typeof GetStatusSettingsSchema>;

export function normalizeGetStatusSettings(value: unknown): GetStatusSettingsV1 {
  return normalizeVersionedSettings(value, {
    currentVersion: 1,
    schema: GetStatusSettingsSchema,
    defaults,
    normalize: source => ({
      ...source,
      output: OutputSchema.parse(nestedRecord(source, "output"))
    })
  });
}

function defaults(): GetStatusSettingsV1 {
  return GetStatusSettingsSchema.parse({ output: OutputSchema.parse({}) });
}
