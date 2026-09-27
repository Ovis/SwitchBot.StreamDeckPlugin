import { CUSTOM_OPERATION_ID, infraredCommandsForRemoteType } from "./infrared-remote-commands.js";
import type { InfraredRemoteSettingsV1 } from "../settings/infrared-remote-settings.js";
import type { ExecutionRequest } from "../execution/execution-request.js";

export interface InfraredRequestBuildResult {
  request?: ExecutionRequest;
  body?: { command: string; parameter: string; commandType: string };
  displayText?: string;
  error?: string;
}

export function buildInfraredRequest(settings: InfraredRemoteSettingsV1): InfraredRequestBuildResult {
  const deviceId = settings.deviceId.trim();
  if (!deviceId) return { error: "Select an infrared remote." };

  const generated = buildGeneratedBody(settings);
  const command = settings.overrides.command.enabled ? settings.overrides.command.value : generated.command;
  const parameter = settings.overrides.parameter.enabled ? settings.overrides.parameter.value : generated.parameter;
  const commandType = settings.overrides.commandType.enabled ? settings.overrides.commandType.value : generated.commandType;

  if (!command) return { error: generated.error ?? "Command is required." };
  if (!commandType) return { error: "Command type is required." };

  const body = { command, parameter, commandType };
  return {
    body,
    request: {
      method: "POST",
      path: `/v1.1/devices/${encodeURIComponent(deviceId)}/commands`,
      body: JSON.stringify(body)
    },
    displayText: hasOverride(settings) ? command : generated.displayText ?? command
  };
}

function buildGeneratedBody(settings: InfraredRemoteSettingsV1): {
  command: string;
  parameter: string;
  commandType: string;
  displayText?: string;
  error?: string;
} {
  if (settings.operation === CUSTOM_OPERATION_ID || settings.remoteType === "Others") {
    const custom = settings.customButtonName.trim();
    return custom
      ? { command: custom, parameter: "default", commandType: "customize", displayText: custom }
      : { command: "", parameter: "default", commandType: "customize", error: "Enter a custom button name." };
  }

  if (!settings.operation) {
    return { command: "", parameter: "default", commandType: "command", error: "Select an operation." };
  }

  const definition = infraredCommandsForRemoteType(settings.remoteType).find(item => item.id === settings.operation);
  if (!definition) {
    return { command: "", parameter: "default", commandType: "command", error: "The selected operation is not available for this remote type." };
  }

  if (definition.parameterKind === "channel") {
    const channel = settings.channel.trim();
    return channel
      ? { command: definition.command, parameter: channel, commandType: "command", displayText: `CH ${channel}` }
      : { command: definition.command, parameter: "", commandType: "command", error: "Enter a channel." };
  }

  if (definition.parameterKind === "air-conditioner") {
    const temperature = settings.airConditioner.temperature.trim();
    const numericTemperature = Number(temperature);
    if (!temperature || !Number.isFinite(numericTemperature)) {
      return { command: definition.command, parameter: "", commandType: "command", error: "Enter a valid temperature." };
    }
    const parameter = [
      temperature,
      settings.airConditioner.mode,
      settings.airConditioner.fanSpeed,
      settings.airConditioner.powerState
    ].join(",");
    return {
      command: definition.command,
      parameter,
      commandType: "command",
      displayText: `${airConditionerModeLabel(settings.airConditioner.mode)} ${temperature}℃ ${settings.airConditioner.powerState.toUpperCase()}`
    };
  }

  return {
    command: definition.command,
    parameter: "default",
    commandType: "command",
    displayText: displayLabel(definition.command)
  };
}

function hasOverride(settings: InfraredRemoteSettingsV1): boolean {
  return settings.overrides.command.enabled || settings.overrides.parameter.enabled || settings.overrides.commandType.enabled;
}

function airConditionerModeLabel(mode: string): string {
  return ({ "1": "AUTO", "2": "冷房", "3": "除湿", "4": "送風", "5": "暖房" } as Record<string, string>)[mode] ?? mode;
}

function displayLabel(command: string): string {
  return ({
    turnOn: "電源 ON", turnOff: "電源 OFF", volumeAdd: "音量 +", volumeSub: "音量 -",
    channelAdd: "CH +", channelSub: "CH -", setMute: "ミュート", FastForward: "早送り",
    Rewind: "巻き戻し", Next: "次へ", Previous: "前へ", Pause: "一時停止", Play: "再生",
    Stop: "停止", swing: "首振り", timer: "タイマー", lowSpeed: "風量 弱",
    middleSpeed: "風量 中", highSpeed: "風量 強", brightnessUp: "明るさ +", brightnessDown: "明るさ -"
  } as Record<string, string>)[command] ?? command;
}

export function truncateInfraredDisplayText(value: string): string {
  return Array.from(value).length <= 16 ? value : Array.from(value).slice(0, 15).join("") + "…";
}
