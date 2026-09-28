import { z } from "zod";
import { normalizeVersionedSettings } from "./settings-lifecycle.js";

const BotControlSettingsSchema = z.object({
  version: z.literal(1).default(1),
  deviceId: z.string().catch("").default(""),
  deviceType: z.string().catch("").default(""),
  operationId: z.string().catch("").default("")
});

export type BotControlSettingsV1 = z.infer<typeof BotControlSettingsSchema>;

/** Bot Controlの永続設定を現在versionへ正規化する。 */
export function normalizeBotControlSettings(value: unknown): BotControlSettingsV1 {
  return normalizeVersionedSettings(value, {
    currentVersion: 1,
    schema: BotControlSettingsSchema,
    defaults: () => BotControlSettingsSchema.parse({})
  });
}
