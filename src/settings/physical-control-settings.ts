import { z } from "zod";
import { normalizeVersionedSettings } from "./settings-lifecycle.js";

const PhysicalControlSettingsSchema = z.object({
  version: z.literal(1).default(1),
  deviceId: z.string().catch("").default(""),
  deviceType: z.string().catch("").default(""),
  operationId: z.string().catch("").default(""),
  operationParameters: z.record(z.string(), z.unknown()).catch({}).default({})
});

export type PhysicalControlSettingsV1 = z.infer<typeof PhysicalControlSettingsSchema>;

/** Physical Controlの永続設定を現在versionへ正規化する。 */
export function normalizePhysicalControlSettings(value: unknown): PhysicalControlSettingsV1 {
  return normalizeVersionedSettings(value, {
    currentVersion: 1,
    schema: PhysicalControlSettingsSchema,
    defaults: () => PhysicalControlSettingsSchema.parse({})
  });
}
