import type { ExecutionRequest } from "../execution/execution-request.js";
import { physicalDeviceDefinition, type PhysicalControlActionId } from "./physical-control-catalog.js";

export interface PhysicalCommandSettings {
  action: PhysicalControlActionId;
  deviceId: string;
  deviceType: string;
  operationId: string;
}

/**
 * SwitchBot Control Command APIへ送信する論理コマンド。
 *
 * PIのプレビューと実送信で同じ中間表現を共有し、表示内容と実際のrequestが乖離しないようにする。
 */
export interface PhysicalCommand {
  deviceId: string;
  command: string;
  parameter: string;
  commandType: "command";
}

export interface BuiltPhysicalCommand {
  command?: PhysicalCommand;
  request?: ExecutionRequest;
  displayText?: string;
  error?: "missing-device" | "device-type-mismatch" | "unsupported-operation";
}

/** PhysicalCommandをSwitchBot OpenAPIのExecutionRequestへ変換する。 */
export function physicalCommandRequest(command: PhysicalCommand): ExecutionRequest {
  return {
    method: "POST",
    path: `/v1.1/devices/${encodeURIComponent(command.deviceId)}/commands`,
    body: physicalCommandBody(command)
  };
}

/** PhysicalCommandのrequest bodyを生成する。PIのプレビューにも同じ変換を使用する。 */
export function physicalCommandBody(command: PhysicalCommand, pretty = false): string {
  return JSON.stringify({
    command: command.command,
    parameter: command.parameter,
    commandType: command.commandType
  }, null, pretty ? 2 : undefined);
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

  const command: PhysicalCommand = {
    deviceId,
    command: operation.command,
    parameter: operation.parameter,
    commandType: operation.commandType
  };
  return {
    command,
    request: physicalCommandRequest(command),
    displayText: operation.label.en
  };
}
