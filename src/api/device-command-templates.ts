export interface DeviceCommandTemplate {
  deviceType: string;
  body: string;
}

const DEFAULT_PARAMETER = "default";

function command(command: string, parameter: string | number | Record<string, unknown> = DEFAULT_PARAMETER): string {
  return JSON.stringify({ command, parameter, commandType: "command" }, null, 2);
}

const TEMPLATES: Readonly<Record<string, string>> = {
  "Bot": command("press"),
  "Plug": command("turnOn"),
  "Plug Mini (US)": command("turnOn"),
  "Plug Mini (JP)": command("turnOn"),
  "Plug Mini (EU)": command("turnOn"),
  "Curtain": command("setPosition", "0,ff,50"),
  "Curtain3": command("setPosition", "0,ff,50"),
  "Blind Tilt": command("setPosition", "up;50"),
  "Humidifier": command("turnOn"),
  "Color Bulb": command("turnOn"),
  "Strip Light": command("turnOn"),
  "Ceiling Light": command("turnOn"),
  "Ceiling Light Pro": command("turnOn"),
  "Lock": command("lock"),
  "Smart Lock Pro": command("lock"),
  "Lock Lite": command("lock"),
  "Smart Lock Ultra": command("lock"),
  "Keypad Touch": command("createKey", {
    name: "example",
    type: "permanent",
    password: "123456",
    startTime: 0,
    endTime: 0
  }),
  "Battery Circulator Fan": command("turnOn"),
  "Robot Vacuum Cleaner S1": command("start"),
  "Robot Vacuum Cleaner S1 Plus": command("start"),
  "Robot Vacuum Cleaner S10": command("startClean", {
    action: "sweep_mop",
    param: { fanLevel: 1, waterLevel: 1, times: 1 }
  }),
  "WeatherStation": command("customQuote", "Hello")
};

export function getDeviceCommandTemplate(deviceType: string): DeviceCommandTemplate | undefined {
  const body = TEMPLATES[deviceType];
  return body ? { deviceType, body } : undefined;
}
