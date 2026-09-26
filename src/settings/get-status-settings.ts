import { z } from "zod";

const GetStatusSettingsSchema = z.object({
  version: z.literal(1).default(1),
  deviceId: z.string().default(""),
  output: z.object({
    prettyPrint: z.boolean().default(true)
  }).default({ prettyPrint: true })
});

export type GetStatusSettingsV1 = z.infer<typeof GetStatusSettingsSchema>;

export function normalizeGetStatusSettings(value: unknown): GetStatusSettingsV1 {
  const parsed = GetStatusSettingsSchema.safeParse(value);
  return parsed.success ? parsed.data : GetStatusSettingsSchema.parse({});
}
