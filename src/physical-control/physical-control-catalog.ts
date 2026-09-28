export type PhysicalControlActionId = "bot" | "power" | "lighting";

export type PhysicalOperationParameter =
  | { kind: "number"; key: string; label: { en: string; ja: string }; min: number; max: number; step: number; unit?: string }
  | { kind: "rgb"; key: string; label: { en: string; ja: string } };

export interface PhysicalOperationDefinition {
  id: string;
  label: { en: string; ja: string };
  command: string;
  parameter: string;
  commandType: "command";
  input?: PhysicalOperationParameter;
}

export interface PhysicalDeviceDefinition {
  deviceType: string;
  action: PhysicalControlActionId;
  operations: readonly PhysicalOperationDefinition[];
}

const ON_OFF: readonly PhysicalOperationDefinition[] = [
  { id: "turn-on", label: { en: "Turn On", ja: "ON" }, command: "turnOn", parameter: "default", commandType: "command" },
  { id: "turn-off", label: { en: "Turn Off", ja: "OFF" }, command: "turnOff", parameter: "default", commandType: "command" }
];
const ON_OFF_TOGGLE: readonly PhysicalOperationDefinition[] = [
  ...ON_OFF,
  { id: "toggle", label: { en: "Toggle", ja: "切り替え" }, command: "toggle", parameter: "default", commandType: "command" }
];
const BOT_OPERATIONS: readonly PhysicalOperationDefinition[] = [
  ...ON_OFF,
  { id: "press", label: { en: "Press", ja: "押す" }, command: "press", parameter: "default", commandType: "command" }
];

const brightness = (min: number, command = "setBrightness", id = "set-brightness", en = "Set Brightness", ja = "明るさを設定"): PhysicalOperationDefinition => ({
  id, label: { en, ja }, command, parameter: "", commandType: "command",
  input: { kind: "number", key: "value", label: { en: "Brightness", ja: "明るさ" }, min, max: 100, step: 1, unit: "%" }
});
const colorTemperature = (command = "setColorTemperature", id = "set-color-temperature", en = "Set Color Temperature", ja = "色温度を設定"): PhysicalOperationDefinition => ({
  id, label: { en, ja }, command, parameter: "", commandType: "command",
  input: { kind: "number", key: "value", label: { en: "Color Temperature", ja: "色温度" }, min: 2700, max: 6500, step: 1, unit: "K" }
});
const color = (command = "setColor", id = "set-color", en = "Set Color", ja = "色を設定"): PhysicalOperationDefinition => ({
  id, label: { en, ja }, command, parameter: "", commandType: "command",
  input: { kind: "rgb", key: "value", label: { en: "Color", ja: "色" } }
});

const LIGHT_RGB_1_100 = [...ON_OFF_TOGGLE, brightness(1), color(), colorTemperature()] as const;
const LIGHT_RGB_0_100 = [...ON_OFF_TOGGLE, brightness(0), color(), colorTemperature()] as const;
const LIGHT_RGB_ONLY_0_100 = [...ON_OFF_TOGGLE, brightness(0), color()] as const;
const CEILING_LIGHT = [...ON_OFF_TOGGLE, brightness(1), colorTemperature()] as const;
const CANDLE_WARMER = [...ON_OFF_TOGGLE, brightness(0)] as const;
const RGBICWW_CEILING: readonly PhysicalOperationDefinition[] = [
  ...ON_OFF_TOGGLE,
  { id: "turn-on-main-light", label: { en: "Main Light On", ja: "メインライト ON" }, command: "turnOnMainLight", parameter: "default", commandType: "command" },
  { id: "turn-off-main-light", label: { en: "Main Light Off", ja: "メインライト OFF" }, command: "turnOffMainLight", parameter: "default", commandType: "command" },
  { id: "turn-on-color-light", label: { en: "Color Light On", ja: "カラーライト ON" }, command: "turnOnColorLight", parameter: "default", commandType: "command" },
  { id: "turn-off-color-light", label: { en: "Color Light Off", ja: "カラーライト OFF" }, command: "turnOffColorLight", parameter: "default", commandType: "command" },
  brightness(1, "setMainLightBrightness", "set-main-light-brightness", "Set Main Light Brightness", "メインライトの明るさを設定"),
  colorTemperature("setMainLightColorTemp", "set-main-light-color-temperature", "Set Main Light Color Temperature", "メインライトの色温度を設定"),
  brightness(1, "setColorLightBrightness", "set-color-light-brightness", "Set Color Light Brightness", "カラーライトの明るさを設定"),
  color("setColorLightRGB", "set-color-light-rgb", "Set Color Light RGB", "カラーライトの色を設定")
];

const DEFINITIONS: readonly PhysicalDeviceDefinition[] = [
  { deviceType: "Bot", action: "bot", operations: BOT_OPERATIONS },
  // Plugは公式仕様上toggleを持たないため、Plug Mini系とはOperation定義を分ける。
  { deviceType: "Plug", action: "power", operations: ON_OFF },
  { deviceType: "Plug Mini (US)", action: "power", operations: ON_OFF_TOGGLE },
  { deviceType: "Plug Mini (JP)", action: "power", operations: ON_OFF_TOGGLE },
  { deviceType: "Plug Mini (EU)", action: "power", operations: ON_OFF_TOGGLE },
  { deviceType: "Color Bulb", action: "lighting", operations: LIGHT_RGB_1_100 },
  { deviceType: "Strip Light", action: "lighting", operations: [...ON_OFF_TOGGLE, brightness(1), color()] },
  { deviceType: "Floor Lamp", action: "lighting", operations: LIGHT_RGB_0_100 },
  { deviceType: "Strip Light 3", action: "lighting", operations: LIGHT_RGB_0_100 },
  { deviceType: "RGBICWW Strip Light", action: "lighting", operations: LIGHT_RGB_0_100 },
  { deviceType: "RGBICWW Floor Lamp", action: "lighting", operations: LIGHT_RGB_0_100 },
  { deviceType: "RGBIC Neon Wire Rope Light", action: "lighting", operations: LIGHT_RGB_ONLY_0_100 },
  { deviceType: "RGBIC Neon Rope Light", action: "lighting", operations: LIGHT_RGB_ONLY_0_100 },
  { deviceType: "Permanent Outdoor Lights", action: "lighting", operations: LIGHT_RGB_0_100 },
  { deviceType: "Ceiling Light", action: "lighting", operations: CEILING_LIGHT },
  { deviceType: "Ceiling Light Pro", action: "lighting", operations: CEILING_LIGHT },
  { deviceType: "RGBICWW Ceiling Light", action: "lighting", operations: RGBICWW_CEILING },
  { deviceType: "Candle Warmer Lamp", action: "lighting", operations: CANDLE_WARMER }
];

/** APIから返るdeviceTypeをNormal Controlの明示的な定義へ解決する。未知typeは推測しない。 */
export function physicalDeviceDefinition(deviceType: string): PhysicalDeviceDefinition | undefined {
  return DEFINITIONS.find(definition => definition.deviceType === deviceType);
}

/** 指定Actionで選択可能なdeviceTypeかを判定する。 */
export function supportsPhysicalAction(deviceType: string, action: PhysicalControlActionId): boolean {
  return physicalDeviceDefinition(deviceType)?.action === action;
}
