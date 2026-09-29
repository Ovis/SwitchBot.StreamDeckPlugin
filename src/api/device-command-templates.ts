import { buildPhysicalCommand, physicalCommandBody } from "../physical-control/physical-command-builder.js";
import { physicalDeviceDefinition } from "../physical-control/physical-control-catalog.js";

export interface DeviceCommandTemplate {
  deviceType: string;
  body: string;
}

const DEFAULT_PARAMETER = "default";

function command(command: string, parameter: string | number | Record<string, unknown> = DEFAULT_PARAMETER): string {
  return JSON.stringify({ command, parameter, commandType: "command" }, null, 2);
}

/**
 * Physical Controlでは意図的に扱わない機種のAPI Request用サンプル。
 *
 * Physical Control対象機種はCatalogから生成し、deviceType・command・parameterをここへ重複定義しない。
 */
const API_REQUEST_ONLY_TEMPLATES: Readonly<Record<string, string>> = {
  "Keypad Touch": command("createKey", {
    name: "example",
    type: "permanent",
    password: "123456",
    startTime: 0,
    endTime: 0
  }),
  "WeatherStation": command("customQuote", "Hello")
};

/**
 * Physical Control Catalogから、追加入力なしで成立するOperationをAPI Requestの編集用サンプルへ変換する。
 *
 * 数値や選択値を必要とするOperationへ恣意的な初期値を補わず、Catalogだけで完全に構築できる
 * 最初のOperationを採用する。該当Operationがない機種はサンプルなしとして扱う。
 */
function physicalControlTemplate(deviceType: string): string | undefined {
  const definition = physicalDeviceDefinition(deviceType);
  if (!definition) return undefined;

  for (const operation of definition.operations) {
    const built = buildPhysicalCommand({
      action: definition.action,
      deviceId: "template",
      deviceType,
      operationId: operation.id
    });
    if (built.command) return physicalCommandBody(built.command, true);
  }
  return undefined;
}

/** GET /devicesが返すdeviceTypeに対応する編集用Control Commandサンプルを取得する。 */
export function getDeviceCommandTemplate(deviceType: string): DeviceCommandTemplate | undefined {
  const body = physicalControlTemplate(deviceType) ?? API_REQUEST_ONLY_TEMPLATES[deviceType];
  return body ? { deviceType, body } : undefined;
}
