export type PhysicalControlActionId = "bot";

export interface PhysicalOperationDefinition {
  id: string;
  label: { en: string; ja: string };
  command: string;
  parameter: string;
  commandType: "command";
}

export interface PhysicalDeviceDefinition {
  deviceType: string;
  action: PhysicalControlActionId;
  operations: readonly PhysicalOperationDefinition[];
}

const BOT_OPERATIONS: readonly PhysicalOperationDefinition[] = [
  { id: "turn-on", label: { en: "Turn On", ja: "ON" }, command: "turnOn", parameter: "default", commandType: "command" },
  { id: "turn-off", label: { en: "Turn Off", ja: "OFF" }, command: "turnOff", parameter: "default", commandType: "command" },
  { id: "press", label: { en: "Press", ja: "押す" }, command: "press", parameter: "default", commandType: "command" }
];

const DEFINITIONS: readonly PhysicalDeviceDefinition[] = [
  { deviceType: "Bot", action: "bot", operations: BOT_OPERATIONS }
];

/** APIから返るdeviceTypeをNormal Controlの明示的な定義へ解決する。未知typeは推測しない。 */
export function physicalDeviceDefinition(deviceType: string): PhysicalDeviceDefinition | undefined {
  return DEFINITIONS.find(definition => definition.deviceType === deviceType);
}

/** 指定Actionで選択可能なdeviceTypeかを判定する。 */
export function supportsPhysicalAction(deviceType: string, action: PhysicalControlActionId): boolean {
  return physicalDeviceDefinition(deviceType)?.action === action;
}
