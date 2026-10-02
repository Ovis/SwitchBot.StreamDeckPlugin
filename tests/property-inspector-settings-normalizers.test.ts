import { describe, expect, it } from "vitest";
import {
  normalizeGetStatusPropertyInspectorSettings,
  normalizeInfraredRemotePropertyInspectorSettings,
  normalizePhysicalControlPropertyInspectorSettings
} from "../src/property-inspector/shared/managed-settings-normalizers.js";
import { normalizeGetStatusSettings } from "../src/settings/get-status-settings.js";
import { normalizeInfraredRemoteSettings } from "../src/settings/infrared-remote-settings.js";
import { normalizePhysicalControlSettings } from "../src/settings/physical-control-settings.js";

const commonInvalidValues: unknown[] = [
  undefined,
  null,
  [],
  "settings",
  { version: 0, deviceId: "ignored" },
  { version: 2, deviceId: "future" },
  { version: "1", deviceId: "invalid-version" }
];

describe("Managed PI settings normalizers", () => {
  it.each([
    ...commonInvalidValues,
    {},
    {
      version: 1,
      deviceId: "device",
      deviceType: "Bot",
      operationId: "press",
      skipUnlockConfirmation: true,
      operationParameters: { duration: 3, enabled: false, optional: null, color: "1:2:3" },
      ignored: "value"
    },
    { deviceId: 123, skipUnlockConfirmation: "true", operationParameters: { invalid: undefined } },
    { operationParameters: { invalid: Number.NaN } }
  ])("Physical ControlはPlugin側normalizerと一致する: %j", value => {
    expect(normalizePhysicalControlPropertyInspectorSettings(value)).toEqual(normalizePhysicalControlSettings(value));
  });

  it.each([
    ...commonInvalidValues,
    {},
    {
      version: 1,
      deviceId: "remote",
      remoteType: "Air Conditioner",
      operation: "setAll",
      customButtonName: "custom",
      channel: "5",
      airConditioner: { temperature: "24", mode: "3", fanSpeed: "4", powerState: "off" },
      overrides: {
        command: { enabled: true, value: "turnOn" },
        parameter: { enabled: false, value: "default" },
        commandType: { enabled: true, value: "command" }
      },
      output: { copyResponseToClipboard: true, prettyPrint: false, showOperationOnKey: true },
      ignored: "value"
    },
    {
      airConditioner: { temperature: 24, mode: "future", fanSpeed: null, powerState: false },
      overrides: { command: [], parameter: { enabled: "true", value: 3 } },
      output: { copyResponseToClipboard: "true", prettyPrint: null }
    }
  ])("Infrared RemoteはPlugin側normalizerと一致する: %j", value => {
    expect(normalizeInfraredRemotePropertyInspectorSettings(value)).toEqual(normalizeInfraredRemoteSettings(value));
  });

  it.each([
    ...commonInvalidValues,
    {},
    {
      version: 1,
      deviceId: "device",
      buttonName: "Meter",
      output: {
        showStatusOnKey: false,
        copyResponseToClipboard: true,
        prettyPrint: false,
        statusTemplate: "{temperature}",
        refreshIntervalMinutes: "30"
      },
      ignored: "value"
    },
    { output: { refreshIntervalMinutes: "1.0" } },
    { output: { refreshIntervalMinutes: " ", showStatusOnKey: "true", statusTemplate: 123 } },
    { output: { refreshIntervalMinutes: 3 } }
  ])("Get StatusはPlugin側normalizerと一致する: %j", value => {
    expect(normalizeGetStatusPropertyInspectorSettings(value)).toEqual(normalizeGetStatusSettings(value));
  });
});
