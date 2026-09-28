import type { ExecutionRequest } from "../execution/execution-request.js";
import { physicalDeviceDefinition, type PhysicalControlActionId } from "./physical-control-catalog.js";

export interface PhysicalCommandSettings {
  action: PhysicalControlActionId;
  deviceId: string;
  deviceType: string;
  operationId: string;
}

export interface BuiltPhysicalCommand {
  request?: ExecutionRequest;
  displayText?: string;
  error?: "missing-device" | "device-type-mismatch" | "unsupported-operation";
}

/**
 * 保存済みdeviceTypeとcatalog定義を照合してControl Commandを構築する。
 *
 * deviceTypeやoperationが未知の場合は推測せずfail closedし、別製品へ誤送信しない。
 */
export function buildPhysicalCommand(settings: PhysicalCommandSettings): BuiltPhysicalCommand {
  const deviceId = settings.deviceId.trim();
  if (!deviceId) return { error: "missing-device" };
  const definition = physicalDeviceDefinition(settings.deviceType);
  if (!definition || definition.action !== settings.action) return { error: "device-type-mismatch" };
  const operation = definition.operations.find(candidate => candidate.id === settings.operationId);
  if (!operation) return { error: "unsupported-operation" };
  return {
    request: {
      method: "POST",
      path: `/v1.1/devices/${encodeURIComponent(deviceId)}/commands`,
      body: JSON.stringify({
        command: operation.command,
        parameter: operation.parameter,
        commandType: operation.commandType
      })
    },
    displayText: operation.label.en
  };
}
