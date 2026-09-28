import { z } from "zod";
import { nestedRecord, normalizeVersionedSettings } from "./settings-lifecycle.js";

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
