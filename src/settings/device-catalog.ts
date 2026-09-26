import { z } from "zod";

const DeviceSchema = z.object({
  deviceId: z.string(),
  deviceName: z.string().catch(""),
  deviceType: z.string().catch("")
});

const InfraredRemoteSchema = z.object({
  deviceId: z.string(),
  deviceName: z.string().catch(""),
  remoteType: z.string().catch("")
});

export const DeviceCatalogSchema = z.object({
  fetchedAt: z.string(),
  devices: z.array(DeviceSchema),
  infraredRemotes: z.array(InfraredRemoteSchema)
});

export type DeviceCatalog = z.infer<typeof DeviceCatalogSchema>;

export function deviceCatalogFromResponse(body: unknown, fetchedAt: string): DeviceCatalog | undefined {
  if (!isRecord(body) || !isRecord(body.body)) return undefined;

  const devices = z.array(DeviceSchema).safeParse(body.body.deviceList);
  const infraredRemotes = z.array(InfraredRemoteSchema).safeParse(body.body.infraredRemoteList);
  if (!devices.success || !infraredRemotes.success) return undefined;

  return {
    fetchedAt,
    devices: devices.data,
    infraredRemotes: infraredRemotes.data
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
