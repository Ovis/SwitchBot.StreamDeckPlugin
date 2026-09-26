import { z } from "zod";

const DeviceSchema = z.object({
  deviceId: z.string(),
  deviceName: z.string().catch(""),
  deviceType: z.string().catch(""),
  lastSeenAt: z.string().optional(),
  deleted: z.boolean().catch(false).default(false)
});

const InfraredRemoteSchema = z.object({
  deviceId: z.string(),
  deviceName: z.string().catch(""),
  remoteType: z.string().catch(""),
  lastSeenAt: z.string().optional(),
  deleted: z.boolean().catch(false).default(false)
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
    devices: devices.data.map(device => ({ ...device, lastSeenAt: fetchedAt, deleted: false })),
    infraredRemotes: infraredRemotes.data.map(device => ({ ...device, lastSeenAt: fetchedAt, deleted: false }))
  };
}

export function mergeDeviceCatalog(previous: DeviceCatalog | undefined, latest: DeviceCatalog): DeviceCatalog {
  return {
    fetchedAt: latest.fetchedAt,
    devices: mergeEntries(previous?.devices ?? [], latest.devices),
    infraredRemotes: mergeEntries(previous?.infraredRemotes ?? [], latest.infraredRemotes)
  };
}

function mergeEntries<T extends { deviceId: string; lastSeenAt?: string; deleted: boolean }>(
  previous: readonly T[],
  latest: readonly T[]
): T[] {
  const latestById = new Map(latest.map(entry => [entry.deviceId, entry]));
  const merged: T[] = latest.map(entry => ({ ...entry, deleted: false } as T));

  for (const old of previous) {
    if (!latestById.has(old.deviceId)) {
      merged.push({ ...old, deleted: true } as T);
    }
  }

  return merged;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
