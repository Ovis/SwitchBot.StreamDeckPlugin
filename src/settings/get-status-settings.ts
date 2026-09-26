import type { JsonObject } from "@elgato/streamdeck";
import { z } from "zod";

export interface GetStatusSettingsV1 extends JsonObject {
  version: 1;
  deviceId: string;
  output: { prettyPrint: boolean };
}

const OutputSchema = z.object({
  prettyPrint: z.boolean().catch(true)
}).catch({ prettyPrint: true });

export function normalizeGetStatusSettings(value: unknown): GetStatusSettingsV1 {
  const record = isRecord(value) && (value.version === undefined || value.version === 1) ? value : {};
  return {
    version: 1,
    deviceId: z.string().catch("").parse(record.deviceId),
    output: OutputSchema.parse(record.output)
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
