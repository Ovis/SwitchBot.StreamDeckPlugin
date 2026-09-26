import { describe, expect, it } from "vitest";
import { selectableDevices } from "../src/actions/get-status-action.js";

const devices = [
  { deviceId: "A", deviceName: "Active", deviceType: "MeterPlus", deleted: false },
  { deviceId: "B", deviceName: "Deleted selected", deviceType: "Bot", deleted: true },
  { deviceId: "C", deviceName: "Deleted other", deviceType: "Bot", deleted: true }
];

describe("Get Status device choices", () => {
  it("hides deleted devices when they are not selected", () => {
    expect(selectableDevices(devices, "A").map(device => device.deviceId)).toEqual(["A"]);
  });

  it("keeps the currently selected deleted device visible", () => {
    expect(selectableDevices(devices, "B").map(device => device.deviceId)).toEqual(["A", "B"]);
  });

  it("does not expose deleted devices when there is no selection", () => {
    expect(selectableDevices(devices, "").map(device => device.deviceId)).toEqual(["A"]);
  });
});
