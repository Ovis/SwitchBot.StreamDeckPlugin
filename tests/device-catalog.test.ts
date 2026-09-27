import { describe, expect, it } from "vitest";
import { deviceCatalogFromResponse, mergeDeviceCatalog } from "../src/settings/device-catalog.js";
import { normalizeGlobalSettings } from "../src/settings/global-settings.js";

describe("device catalog", () => {
  it("extracts physical and infrared devices from a SwitchBot response", () => {
    const catalog = deviceCatalogFromResponse({
      statusCode: 100,
      body: {
        deviceList: [{ deviceId: "A", deviceName: "温湿度計", deviceType: "MeterPlus", extra: true }],
        infraredRemoteList: [{ deviceId: "B", deviceName: "エアコン", remoteType: "Air Conditioner", hubDeviceId: "HUB" }]
      },
      message: "success"
    }, "2026-09-26T12:00:00.000Z");

    expect(catalog).toEqual({
      fetchedAt: "2026-09-26T12:00:00.000Z",
      devices: [{ deviceId: "A", deviceName: "温湿度計", deviceType: "MeterPlus", lastSeenAt: "2026-09-26T12:00:00.000Z", deleted: false }],
      infraredRemotes: [{ deviceId: "B", deviceName: "エアコン", remoteType: "Air Conditioner", hubDeviceId: "HUB", lastSeenAt: "2026-09-26T12:00:00.000Z", deleted: false }]
    });
  });


  it("soft-deletes entries missing from the latest refresh and restores them when seen again", () => {
    const first = deviceCatalogFromResponse({
      body: {
        deviceList: [
          { deviceId: "A", deviceName: "現役", deviceType: "MeterPlus" },
          { deviceId: "B", deviceName: "旧デバイス", deviceType: "Bot" }
        ],
        infraredRemoteList: []
      }
    }, "2026-09-26T12:00:00.000Z")!;

    const second = deviceCatalogFromResponse({
      body: {
        deviceList: [{ deviceId: "A", deviceName: "現役", deviceType: "MeterPlus" }],
        infraredRemoteList: []
      }
    }, "2026-09-27T12:00:00.000Z")!;

    const afterMissing = mergeDeviceCatalog(first, second);
    expect(afterMissing.devices.find(device => device.deviceId === "B")).toEqual({
      deviceId: "B",
      deviceName: "旧デバイス",
      deviceType: "Bot",
      lastSeenAt: "2026-09-26T12:00:00.000Z",
      deleted: true
    });

    const third = deviceCatalogFromResponse({
      body: {
        deviceList: [
          { deviceId: "A", deviceName: "現役", deviceType: "MeterPlus" },
          { deviceId: "B", deviceName: "復活", deviceType: "Bot" }
        ],
        infraredRemoteList: []
      }
    }, "2026-09-28T12:00:00.000Z")!;

    expect(mergeDeviceCatalog(afterMissing, third).devices.find(device => device.deviceId === "B")).toEqual({
      deviceId: "B",
      deviceName: "復活",
      deviceType: "Bot",
      lastSeenAt: "2026-09-28T12:00:00.000Z",
      deleted: false
    });
  });

  it("rejects an incomplete device-list response", () => {
    expect(deviceCatalogFromResponse({ statusCode: 100, body: {} }, "now")).toBeUndefined();
  });

  it("does not let a malformed catalog invalidate credentials", () => {
    expect(normalizeGlobalSettings({
      version: 1,
      credentials: { token: "token", secret: "secret" },
      deviceCatalog: { fetchedAt: 42 }
    })).toEqual({
      version: 1,
      credentials: { token: "token", secret: "secret" }
    });
  });
});
