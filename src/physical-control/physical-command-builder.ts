import type { ExecutionRequest } from "../execution/execution-request.js";
import { physicalDeviceDefinition, type PhysicalControlActionId, type PhysicalJsonParameterValue, type PhysicalOperationDefinition, type PhysicalOperationParameter } from "./physical-control-catalog.js";

export interface PhysicalCommandSettings {
  action: PhysicalControlActionId;
  deviceId: string;
  deviceType: string;
  operationId: string;
  operationParameters?: Record<string, string | number | boolean | null>;
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
  error?: "missing-device" | "device-type-mismatch" | "unsupported-operation" | "invalid-parameter";
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
function operationInputs(operation: PhysicalOperationDefinition): readonly PhysicalOperationParameter[] {
  if (operation.inputs) return operation.inputs;
  return operation.input ? [operation.input] : [];
}

function validatedParameterValues(
  inputs: readonly PhysicalOperationParameter[],
  parameters: PhysicalCommandSettings["operationParameters"]
): Map<string, string | number> | undefined {
  const values = new Map<string, string | number>();
  for (const input of inputs) {
    const raw = parameters?.[input.key];
    if (input.kind === "number") {
      const value = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : Number.NaN;
      if (!Number.isFinite(value) || value < input.min || value > input.max
        || Math.abs((value - input.min) / input.step - Math.round((value - input.min) / input.step)) > 1e-9) {
        return undefined;
      }
      values.set(input.key, value);
      continue;
    }
    if (input.kind === "rgb") {
      if (typeof raw !== "string") return undefined;
      const parts = raw.split(":");
      if (parts.length !== 3 || parts.some(part => !/^\\d{1,3}$/.test(part)
        || Number(part) < 0 || Number(part) > 255)) return undefined;
      values.set(input.key, parts.map(part => String(Number(part))).join(":"));
      continue;
    }
    if (typeof raw !== "string") return undefined;
    const option = input.options.find(candidate => candidate.value === raw);
    if (!option) return undefined;
    values.set(input.key, option.wireValue);
  }
  return values;
}

function resolveJsonParameter(
  value: PhysicalJsonParameterValue,
  parameters: ReadonlyMap<string, string | number>
): unknown {
  if (value === null || typeof value !== "object") return value;
  if ("parameter" in value && typeof value.parameter === "string" && Object.keys(value).length === 1) {
    return parameters.get(value.parameter);
  }
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, resolveJsonParameter(child, parameters)]));
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

  const inputs = operationInputs(operation);
  const values = validatedParameterValues(inputs, settings.operationParameters);
  if (inputs.length > 0 && !values) return { error: "invalid-parameter" };

  let parameter = operation.parameter;
  if (operation.parameterJson) {
    // JSON文字列テンプレートの置換では型を保持できないため、検証済みwire値からobjectを組み立てて最後にserializeする。
    parameter = JSON.stringify(resolveJsonParameter(operation.parameterJson, values ?? new Map()));
  } else if (operation.parameterFormat && inputs.length === 1) {
    const value = values?.get(inputs[0].key);
    if (value === undefined) return { error: "invalid-parameter" };
    parameter = `${operation.parameterFormat.prefix}${String(value)}${operation.parameterFormat.suffix}`;
  } else if (inputs.length === 1) {
    const value = values?.get(inputs[0].key);
    if (value === undefined) return { error: "invalid-parameter" };
    parameter = String(value);
  } else if (inputs.length > 1) {
    // 複数入力はwire構造をcatalogが明示した場合だけ送信し、暗黙の結合規則は導入しない。
    return { error: "invalid-parameter" };
  }

  const command: PhysicalCommand = {
    deviceId,
    command: operation.command,
    parameter,
    commandType: operation.commandType
  };
  return {
    command,
    request: physicalCommandRequest(command),
    displayText: operation.label.en
  };
}
