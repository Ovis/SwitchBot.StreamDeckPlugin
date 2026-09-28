export type PhysicalControlActionId = "bot" | "power" | "lighting" | "climate" | "security" | "curtains-blinds";

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
  /** 検証済み数値を公式APIのparameter文字列へ埋め込むための宣言的な形式。 */
  parameterFormat?: { prefix: string; suffix: string };
  /** 誤操作で物理的なアクセス状態を変え得る操作は、キー上で再押下確認を必須にする。 */
  confirmationRequired?: boolean;
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


const fixed = (id: string, en: string, ja: string, command: string, parameter: string): PhysicalOperationDefinition =>
  ({ id, label: { en, ja }, command, parameter, commandType: "command" });
const numeric = (
  id: string, en: string, ja: string, command: string, min: number, max: number, step: number,
  inputEn: string, inputJa: string, unit?: string, parameterFormat?: PhysicalOperationDefinition["parameterFormat"]
): PhysicalOperationDefinition => ({
  id, label: { en, ja }, command, parameter: "", commandType: "command",
  input: { kind: "number", key: "value", label: { en: inputEn, ja: inputJa }, min, max, step, ...(unit ? { unit } : {}) },
  ...(parameterFormat ? { parameterFormat } : {})
});

const HUMIDIFIER: readonly PhysicalOperationDefinition[] = [
  ...ON_OFF,
  fixed("mode-auto", "Auto", "自動", "setMode", "auto"),
  fixed("mode-34", "Atomization 34%", "噴霧量 34%", "setMode", "101"),
  fixed("mode-67", "Atomization 67%", "噴霧量 67%", "setMode", "102"),
  fixed("mode-100", "Atomization 100%", "噴霧量 100%", "setMode", "103"),
  numeric("target-humidity", "Set Target Humidity", "目標湿度を設定", "setMode", 0, 100, 1, "Humidity", "湿度", "%")
];
const HUMIDIFIER2: readonly PhysicalOperationDefinition[] = [
  ...ON_OFF,
  fixed("level-4", "Level 4", "レベル4", "setMode", '{"mode":1,"targetHumidify":0}'),
  fixed("level-3", "Level 3", "レベル3", "setMode", '{"mode":2,"targetHumidify":0}'),
  fixed("level-2", "Level 2", "レベル2", "setMode", '{"mode":3,"targetHumidify":0}'),
  fixed("level-1", "Level 1", "レベル1", "setMode", '{"mode":4,"targetHumidify":0}'),
  numeric("target-humidity", "Humidity Mode", "湿度指定", "setMode", 0, 100, 1, "Humidity", "湿度", "%", { prefix: '{"mode":5,"targetHumidify":', suffix: "}" }),
  fixed("sleep", "Sleep", "睡眠", "setMode", '{"mode":6,"targetHumidify":0}'),
  fixed("auto", "Auto", "自動", "setMode", '{"mode":7,"targetHumidify":0}'),
  fixed("drying", "Drying", "乾燥", "setMode", '{"mode":8,"targetHumidify":0}'),
  fixed("child-lock-on", "Child Lock On", "チャイルドロック ON", "setChildLock", "true"),
  fixed("child-lock-off", "Child Lock Off", "チャイルドロック OFF", "setChildLock", "false")
];
const AIR_PURIFIER: readonly PhysicalOperationDefinition[] = [
  ...ON_OFF,
  numeric("normal", "Normal", "通常", "setMode", 1, 3, 1, "Fan Gear", "風量", undefined, { prefix: '{"mode":1,"fanGear":', suffix: "}" }),
  fixed("auto", "Auto", "自動", "setMode", '{"mode":2}'),
  fixed("sleep", "Sleep", "睡眠", "setMode", '{"mode":3}'),
  fixed("pet", "Pet", "ペット", "setMode", '{"mode":4}'),
  fixed("child-lock-on", "Child Lock On", "チャイルドロック ON", "setChildLock", "1"),
  fixed("child-lock-off", "Child Lock Off", "チャイルドロック OFF", "setChildLock", "0")
];
const CIRCULATOR_FAN: readonly PhysicalOperationDefinition[] = [
  ...ON_OFF_TOGGLE,
  fixed("night-light-off", "Night Light Off", "ナイトライト OFF", "setNightLightMode", "off"),
  fixed("night-light-bright", "Night Light Bright", "ナイトライト 明", "setNightLightMode", "1"),
  fixed("night-light-dim", "Night Light Dim", "ナイトライト 暗", "setNightLightMode", "2"),
  fixed("wind-direct", "Direct Wind", "直風", "setWindMode", "direct"),
  fixed("wind-natural", "Natural Wind", "自然風", "setWindMode", "natural"),
  fixed("wind-sleep", "Sleep Wind", "睡眠風", "setWindMode", "sleep"),
  fixed("wind-baby", "Ultra Quiet Wind", "超静音風", "setWindMode", "baby"),
  numeric("wind-speed", "Set Wind Speed", "風速を設定", "setWindSpeed", 1, 100, 1, "Wind Speed", "風速", "%"),
  numeric("close-delay", "Set Auto-off Timer", "自動OFFタイマーを設定", "closeDelay", 1, 36000, 1, "Seconds", "秒", "s")
];
const CIRCULATOR_FAN_2_PRO: readonly PhysicalOperationDefinition[] = [
  ...ON_OFF,
  fixed("night-light-off", "Night Light Off", "ナイトライト OFF", "setNightLightMode", "off"),
  fixed("night-light-bright", "Night Light Bright", "ナイトライト 明", "setNightLightMode", "0"),
  fixed("night-light-soft", "Night Light Soft", "ナイトライト 柔", "setNightLightMode", "1"),
  fixed("wind-direct", "Direct Wind", "直風", "setWindMode", "direct"),
  fixed("wind-natural", "Natural Wind", "自然風", "setWindMode", "natural"),
  fixed("wind-sleep", "Sleep Wind", "睡眠風", "setWindMode", "sleep"),
  fixed("wind-hurricane", "Hurricane Wind", "強風", "setWindMode", "hurricane"),
  numeric("wind-speed", "Set Wind Speed", "風速を設定", "setWindSpeed", 1, 100, 1, "Wind Speed", "風速", "%")
];

const RADIATOR_THERMOSTAT: readonly PhysicalOperationDefinition[] = [
  ...ON_OFF,
  fixed("schedule", "Schedule Mode", "スケジュール", "setMode", "0"),
  fixed("manual", "Manual Mode", "手動", "setMode", "1"),
  fixed("off-mode", "Off Mode", "OFFモード", "setMode", "2"),
  fixed("eco", "Eco Mode", "エコ", "setMode", "3"),
  fixed("comfort", "Comfort Mode", "快適", "setMode", "4"),
  fixed("quick-heat", "Quick Heat", "急速加熱", "setMode", "5"),
  numeric("manual-temperature", "Set Manual Temperature", "手動温度を設定", "setManualModeTemperature", 4, 35, 1, "Temperature", "温度", "°C")
];

const securityOperation = (
  id: string, en: string, ja: string, command: string, confirmationRequired = false
): PhysicalOperationDefinition => ({
  id, label: { en, ja }, command, parameter: "default", commandType: "command",
  ...(confirmationRequired ? { confirmationRequired: true } : {})
});

const SMART_LOCK: readonly PhysicalOperationDefinition[] = [
  securityOperation("lock", "Lock", "施錠", "lock"),
  securityOperation("unlock", "Unlock", "解錠", "unlock", true)
];
const SMART_LOCK_WITH_DEADBOLT: readonly PhysicalOperationDefinition[] = [
  ...SMART_LOCK,
  securityOperation("deadbolt", "Disengage Deadbolt / Latch", "デッドボルト / ラッチを解除", "deadbolt", true)
];
const SMART_LOCK_LITE: readonly PhysicalOperationDefinition[] = [
  securityOperation("lock", "Lock", "施錠", "lock"),
  securityOperation("unlock", "Unlock", "解錠", "unlock", true)
];
const SMART_LOCK_PRO_WIFI: readonly PhysicalOperationDefinition[] = [
  securityOperation("lock", "Lock", "施錠", "lock"),
  securityOperation("unlock", "Unlock", "解錠", "unlock", true),
  securityOperation("night-latch-unlock", "Unlock Night Latch", "ナイトラッチを解錠", "nightLatchUnlock", true),
  securityOperation("deadbolt", "Disengage Deadbolt / Latch", "デッドボルト / ラッチを解除", "deadbolt", true)
];
const LOCK_VISION: readonly PhysicalOperationDefinition[] = [
  // passcode管理は資格情報と非同期結果を扱うため、日常操作用Physical Controlから意図的に除外する。
  securityOperation("lock", "Lock", "施錠", "lock"),
  securityOperation("unlock", "Unlock", "解錠", "unlock", true)
];
const GARAGE_DOOR: readonly PhysicalOperationDefinition[] = [
  securityOperation("open", "Open", "開く", "turnOn", true),
  securityOperation("close", "Close", "閉じる", "turnOff", true)
];
const VIDEO_DOORBELL: readonly PhysicalOperationDefinition[] = [
  securityOperation("motion-detection-on", "Enable Motion Detection", "動体検知 ON", "enableMotionDetection"),
  securityOperation("motion-detection-off", "Disable Motion Detection", "動体検知 OFF", "disableMotionDetection")
];

const CURTAIN: readonly PhysicalOperationDefinition[] = [
  fixed("open", "Open", "開く", "turnOn", "default"),
  fixed("close", "Close", "閉じる", "turnOff", "default"),
  fixed("pause", "Pause", "一時停止", "pause", "default"),
  numeric("set-position", "Set Position", "位置を設定", "setPosition", 0, 100, 1, "Closed Position", "閉じ具合", "%", {
    prefix: "0,ff,", suffix: ""
  })
];
const BLIND_TILT: readonly PhysicalOperationDefinition[] = [
  fixed("fully-open", "Fully Open", "全開", "fullyOpen", "default"),
  fixed("close-up", "Close Up", "上向きに閉じる", "closeUp", "default"),
  fixed("close-down", "Close Down", "下向きに閉じる", "closeDown", "default"),
  // Blind Tiltは方向もwire parameterの一部なので、方向ごとにOperationを分けて単一数値入力の契約を維持する。
  numeric("set-position-up", "Set Position (Up)", "位置を設定（上向き）", "setPosition", 0, 100, 2, "Open Position", "開き具合", "%", {
    prefix: "up;", suffix: ""
  }),
  numeric("set-position-down", "Set Position (Down)", "位置を設定（下向き）", "setPosition", 0, 100, 2, "Open Position", "開き具合", "%", {
    prefix: "down;", suffix: ""
  })
];
const ROLLER_SHADE: readonly PhysicalOperationDefinition[] = [
  numeric("set-position", "Set Position", "位置を設定", "setPosition", 0, 100, 1, "Closed Position", "閉じ具合", "%")
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
  { deviceType: "Candle Warmer Lamp", action: "lighting", operations: CANDLE_WARMER },
  { deviceType: "Humidifier", action: "climate", operations: HUMIDIFIER },
  { deviceType: "Humidifier2", action: "climate", operations: HUMIDIFIER2 },
  { deviceType: "Evaporative Humidifier", action: "climate", operations: HUMIDIFIER2 },
  { deviceType: "Evaporative Humidifier (Auto-refill)", action: "climate", operations: HUMIDIFIER2 },
  { deviceType: "Air Purifier VOC", action: "climate", operations: AIR_PURIFIER },
  { deviceType: "Air Purifier PM2.5", action: "climate", operations: AIR_PURIFIER },
  { deviceType: "Air Purifier Table VOC", action: "climate", operations: AIR_PURIFIER },
  { deviceType: "Air Purifier Table PM2.5", action: "climate", operations: AIR_PURIFIER },
  { deviceType: "Smart Radiator Thermostat", action: "climate", operations: RADIATOR_THERMOSTAT },
  { deviceType: "Battery Circulator Fan", action: "climate", operations: CIRCULATOR_FAN },
  { deviceType: "Circulator Fan", action: "climate", operations: CIRCULATOR_FAN },
  { deviceType: "Standing Circulator Fan", action: "climate", operations: CIRCULATOR_FAN },
  { deviceType: "Battery Circulator Fan 2 Pro", action: "climate", operations: CIRCULATOR_FAN_2_PRO },
  { deviceType: "Smart Lock", action: "security", operations: SMART_LOCK },
  { deviceType: "Lock", action: "security", operations: SMART_LOCK },
  { deviceType: "Smart Lock Pro", action: "security", operations: SMART_LOCK_WITH_DEADBOLT },
  { deviceType: "Lock Pro", action: "security", operations: SMART_LOCK_WITH_DEADBOLT },
  { deviceType: "Smart Lock Lite", action: "security", operations: SMART_LOCK_LITE },
  { deviceType: "Lock Lite", action: "security", operations: SMART_LOCK_LITE },
  { deviceType: "Smart Lock Ultra", action: "security", operations: SMART_LOCK_WITH_DEADBOLT },
  { deviceType: "Lock Ultra", action: "security", operations: SMART_LOCK_WITH_DEADBOLT },
  { deviceType: "Smart Lock Pro Wifi", action: "security", operations: SMART_LOCK_PRO_WIFI },
  { deviceType: "Lock Pro Matter Enabled", action: "security", operations: SMART_LOCK_PRO_WIFI },
  { deviceType: "Lock Vision", action: "security", operations: LOCK_VISION },
  { deviceType: "Lock Vision Pro", action: "security", operations: LOCK_VISION },
  { deviceType: "Garage Door Opener", action: "security", operations: GARAGE_DOOR },
  { deviceType: "Video Doorbell", action: "security", operations: VIDEO_DOORBELL },
  { deviceType: "Curtain", action: "curtains-blinds", operations: CURTAIN },
  { deviceType: "Curtain 3", action: "curtains-blinds", operations: CURTAIN },
  { deviceType: "Blind Tilt", action: "curtains-blinds", operations: BLIND_TILT },
  { deviceType: "Roller Shade", action: "curtains-blinds", operations: ROLLER_SHADE }
];

/** APIから返るdeviceTypeをNormal Controlの明示的な定義へ解決する。未知typeは推測しない。 */
export function physicalDeviceDefinition(deviceType: string): PhysicalDeviceDefinition | undefined {
  return DEFINITIONS.find(definition => definition.deviceType === deviceType);
}

/** 指定Actionで選択可能なdeviceTypeかを判定する。 */
export function supportsPhysicalAction(deviceType: string, action: PhysicalControlActionId): boolean {
  return physicalDeviceDefinition(deviceType)?.action === action;
}
