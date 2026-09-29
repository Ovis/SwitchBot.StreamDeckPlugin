import { physicalDeviceDefinitions } from "../physical-control/physical-control-catalog.js";

/**
 * Physical Controlでは扱わないが、公式OpenAPIがControl Commandsを提供するdeviceType。
 *
 * 日常操作として安全かつ自然にモデル化できる機種はPhysical Control Catalogを正とし、
 * API Request専用の特殊機種だけをここで補完する。これにより同じdeviceTypeを二重管理しない。
 */
const API_REQUEST_ONLY_CONTROL_COMMAND_DEVICE_TYPES = [
  "Keypad",
  "Keypad Touch",
  "Keypad Vision",
  "Keypad Vision Pro",
  "AI Art Frame",
  "WeatherStation",
  "Kata Friends"
] as const;

const CONTROL_COMMAND_DEVICE_TYPES = new Set<string>([
  ...physicalDeviceDefinitions().map(definition => definition.deviceType),
  ...API_REQUEST_ONLY_CONTROL_COMMAND_DEVICE_TYPES
]);

/** GET /devicesが返すdeviceTypeについて、公式OpenAPIのControl Commands対象かを判定する。 */
export function supportsControlCommands(deviceType: string): boolean {
  return CONTROL_COMMAND_DEVICE_TYPES.has(deviceType);
}

/**
 * API RequestのDevice候補として認識するControl Commands対応deviceTypeを返す。
 *
 * 呼び出し側が配列を変更して共有状態を壊さないよう、公開値は凍結したコピーとする。
 */
export const documentedControlCommandDeviceTypes = Object.freeze([...CONTROL_COMMAND_DEVICE_TYPES]);
