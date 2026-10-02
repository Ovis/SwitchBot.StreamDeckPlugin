import type { GetStatusSettingsV1 } from "../../settings/get-status-settings.js";
import type { InfraredRemoteSettingsV1 } from "../../settings/infrared-remote-settings.js";
import type { PhysicalControlSettingsV1 } from "../../settings/physical-control-settings.js";

const GET_STATUS_REFRESH_INTERVALS = new Set([0, 1, 2, 5, 10, 30, 60]);

/** PIバンドルへZod全体を含めず、Plugin側schemaと同じAction settings形状へ正規化する。 */
export function normalizePhysicalControlPropertyInspectorSettings(value: unknown): PhysicalControlSettingsV1 {
  const source = versionOneSource(value);
  if (!source) return physicalControlDefaults();
  return {
    version: 1,
    deviceId: stringValue(source.deviceId),
    deviceType: stringValue(source.deviceType),
    operationId: stringValue(source.operationId),
    skipUnlockConfirmation: booleanValue(source.skipUnlockConfirmation),
    operationParameters: primitiveRecord(source.operationParameters)
  };
}

/** PIバンドルへZod全体を含めず、Plugin側schemaと同じAction settings形状へ正規化する。 */
export function normalizeInfraredRemotePropertyInspectorSettings(value: unknown): InfraredRemoteSettingsV1 {
  const source = versionOneSource(value);
  if (!source) return infraredRemoteDefaults();
  const airConditioner = recordValue(source.airConditioner);
  const overrides = recordValue(source.overrides);
  const command = recordValue(overrides.command);
  const parameter = recordValue(overrides.parameter);
  const commandType = recordValue(overrides.commandType);
  const output = recordValue(source.output);
  return {
    version: 1,
    deviceId: stringValue(source.deviceId),
    remoteType: stringValue(source.remoteType),
    operation: stringValue(source.operation),
    customButtonName: stringValue(source.customButtonName),
    channel: stringValue(source.channel),
    airConditioner: {
      temperature: stringValue(airConditioner.temperature, "26"),
      mode: enumValue(airConditioner.mode, ["1", "2", "3", "4", "5"] as const, "2"),
      fanSpeed: enumValue(airConditioner.fanSpeed, ["1", "2", "3", "4"] as const, "1"),
      powerState: enumValue(airConditioner.powerState, ["on", "off"] as const, "on")
    },
    overrides: {
      command: { enabled: booleanValue(command.enabled), value: stringValue(command.value) },
      parameter: { enabled: booleanValue(parameter.enabled), value: stringValue(parameter.value) },
      commandType: { enabled: booleanValue(commandType.enabled), value: stringValue(commandType.value) }
    },
    output: {
      copyResponseToClipboard: booleanValue(output.copyResponseToClipboard),
      prettyPrint: booleanValue(output.prettyPrint, true),
      showOperationOnKey: booleanValue(output.showOperationOnKey)
    }
  };
}

/** PIバンドルへZod全体を含めず、Plugin側schemaと同じAction settings形状へ正規化する。 */
export function normalizeGetStatusPropertyInspectorSettings(value: unknown): GetStatusSettingsV1 {
  const source = versionOneSource(value);
  if (!source) return getStatusDefaults();
  const output = recordValue(source.output);
  const rawInterval = typeof output.refreshIntervalMinutes === "string" && output.refreshIntervalMinutes.trim() !== ""
    ? Number(output.refreshIntervalMinutes)
    : output.refreshIntervalMinutes;
  return {
    version: 1,
    deviceId: stringValue(source.deviceId),
    buttonName: stringValue(source.buttonName),
    output: {
      showStatusOnKey: booleanValue(output.showStatusOnKey, true),
      copyResponseToClipboard: booleanValue(output.copyResponseToClipboard),
      prettyPrint: booleanValue(output.prettyPrint, true),
      statusTemplate: stringValue(output.statusTemplate),
      refreshIntervalMinutes: typeof rawInterval === "number" && GET_STATUS_REFRESH_INTERVALS.has(rawInterval)
        ? rawInterval as GetStatusSettingsV1["output"]["refreshIntervalMinutes"]
        : 0
    }
  };
}

function physicalControlDefaults(): PhysicalControlSettingsV1 {
  return {
    version: 1,
    deviceId: "",
    deviceType: "",
    operationId: "",
    skipUnlockConfirmation: false,
    operationParameters: {}
  };
}

function infraredRemoteDefaults(): InfraredRemoteSettingsV1 {
  return {
    version: 1,
    deviceId: "",
    remoteType: "",
    operation: "",
    customButtonName: "",
    channel: "",
    airConditioner: { temperature: "26", mode: "2", fanSpeed: "1", powerState: "on" },
    overrides: {
      command: { enabled: false, value: "" },
      parameter: { enabled: false, value: "" },
      commandType: { enabled: false, value: "" }
    },
    output: { copyResponseToClipboard: false, prettyPrint: true, showOperationOnKey: false }
  };
}

function getStatusDefaults(): GetStatusSettingsV1 {
  return {
    version: 1,
    deviceId: "",
    buttonName: "",
    output: {
      showStatusOnKey: true,
      copyResponseToClipboard: false,
      prettyPrint: true,
      statusTemplate: "",
      refreshIntervalMinutes: 0
    }
  };
}

function versionOneSource(value: unknown): Record<string, unknown> | undefined {
  const source = recordValue(value);
  return source.version === undefined || source.version === 1 ? source : undefined;
}

function recordValue(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function primitiveRecord(value: unknown): Record<string, string | number | boolean | null> {
  const source = recordValue(value);
  return Object.values(source).every(item =>
    typeof item === "string" || (typeof item === "number" && Number.isFinite(item))
    || typeof item === "boolean" || item === null)
    ? { ...source } as Record<string, string | number | boolean | null>
    : {};
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function booleanValue(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function enumValue<const T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]): T[number] {
  return typeof value === "string" && allowed.includes(value) ? value as T[number] : fallback;
}
