import { z } from "zod";
import type { SwitchBotCredentials } from "../api/switchbot-auth.js";
import { DeviceCatalogSchema } from "./device-catalog.js";

const GlobalSettingsSchema = z.object({
  version: z.literal(1).default(1),
  credentials: z.object({
    token: z.string().default(""),
    secret: z.string().default("")
  }).optional(),
  deviceCatalog: DeviceCatalogSchema.optional().catch(undefined)
});

export type GlobalSettingsV1 = z.infer<typeof GlobalSettingsSchema>;

export function normalizeGlobalSettings(value: unknown): GlobalSettingsV1 {
  const parsed = GlobalSettingsSchema.safeParse(value);
  return parsed.success ? parsed.data : { version: 1 };
}

export function getCredentials(settings: GlobalSettingsV1): SwitchBotCredentials | undefined {
  const token = settings.credentials?.token.trim() ?? "";
  const secret = settings.credentials?.secret.trim() ?? "";
  return token && secret ? { token, secret } : undefined;
}
