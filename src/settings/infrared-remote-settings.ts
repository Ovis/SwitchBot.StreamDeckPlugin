import { z } from "zod";
import { nestedRecord, normalizeVersionedSettings } from "./settings-lifecycle.js";

const OverrideSchema = z.object({
  enabled: z.boolean().catch(false).default(false),
  value: z.string().catch("").default("")
});

const OutputSchema = z.object({
  copyResponseToClipboard: z.boolean().catch(false).default(false),
  prettyPrint: z.boolean().catch(true).default(true),
  showOperationOnKey: z.boolean().catch(false).default(false)
});

const InfraredRemoteSettingsSchema = z.object({
  version: z.literal(1).default(1),
  deviceId: z.string().catch("").default(""),
  remoteType: z.string().catch("").default(""),
  operation: z.string().catch("").default(""),
  customButtonName: z.string().catch("").default(""),
  channel: z.string().catch("").default(""),
  airConditioner: z.object({
    temperature: z.string().catch("26").default("26"),
    mode: z.enum(["1", "2", "3", "4", "5"]).catch("2").default("2"),
    fanSpeed: z.enum(["1", "2", "3", "4"]).catch("1").default("1"),
    powerState: z.enum(["on", "off"]).catch("on").default("on")
  }),
  overrides: z.object({
    command: OverrideSchema,
    parameter: OverrideSchema,
    commandType: OverrideSchema
  }),
  output: OutputSchema
});

export type InfraredRemoteSettingsV1 = z.infer<typeof InfraredRemoteSettingsSchema>;

export function normalizeInfraredRemoteSettings(value: unknown): InfraredRemoteSettingsV1 {
  return normalizeVersionedSettings(value, {
    currentVersion: 1,
    schema: InfraredRemoteSettingsSchema,
    defaults,
    normalize: source => {
      const overrides = nestedRecord(source, "overrides");
      return {
        ...source,
        airConditioner: nestedRecord(source, "airConditioner"),
        overrides: {
          command: OverrideSchema.parse(nestedRecord(overrides, "command")),
          parameter: OverrideSchema.parse(nestedRecord(overrides, "parameter")),
          commandType: OverrideSchema.parse(nestedRecord(overrides, "commandType"))
        },
        output: OutputSchema.parse(nestedRecord(source, "output"))
      };
    }
  });
}

export function clearInfraredOverrides(settings: InfraredRemoteSettingsV1): InfraredRemoteSettingsV1 {
  return {
    ...settings,
    overrides: {
      command: { enabled: false, value: "" },
      parameter: { enabled: false, value: "" },
      commandType: { enabled: false, value: "" }
    }
  };
}

function defaults(): InfraredRemoteSettingsV1 {
  return InfraredRemoteSettingsSchema.parse({
    airConditioner: {},
    overrides: { command: {}, parameter: {}, commandType: {} },
    output: {}
  });
}
