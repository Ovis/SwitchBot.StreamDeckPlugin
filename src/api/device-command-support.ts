// Physical device types whose official SwitchBot API documentation marks Command support as available.
// Keep this allow-list aligned with the "Device Specifications and Supported Features List" in
// https://github.com/OpenWonderLabs/SwitchBotAPI/blob/main/README.md.
// Values are deviceType strings returned by GET /v1.1/devices; aliases cover documented naming variants.
const CONTROL_COMMAND_DEVICE_TYPES = new Set([
  // Locks & security
  "Keypad", "Keypad Touch", "Keypad Vision", "Keypad Vision Pro",
  "Lock", "Lock Lite", "Smart Lock Pro", "Smart Lock Pro Wifi", "Smart Lock Ultra",
  "Lock Vision", "Lock Vision Pro", "Video Doorbell",

  // Curtains & blinds
  "Blind Tilt", "Curtain", "Curtain3", "Roller Shade",

  // Lighting
  "Candle Warmer Lamp", "Ceiling Light", "Ceiling Light Pro", "Color Bulb", "Floor Lamp",
  "RGBIC Neon Rope Light", "RGBIC Neon Wire Rope Light", "RGBICWW Floor Lamp",
  "RGBICWW Strip Light", "Strip Light", "Strip Light 3", "Permanent Outdoor Lights",
  "RGBICWW Ceiling Light",

  // Robot vacuums
  "Robot Vacuum Cleaner S10", "Robot Vacuum Cleaner S20", "K10+ Pro Combo", "K20+ Pro",
  "Mini Robot Vacuum K10+", "Mini Robot Vacuum K10+ Pro",
  "Robot Vacuum Cleaner S1", "Robot Vacuum Cleaner S1 Plus", "Robot Vacuum K11+",

  // Climate control
  "Air Purifier PM2.5", "Air Purifier Table PM2.5", "Air Purifier Table VOC", "Air Purifier VOC",
  "Battery Circulator Fan", "Circulator Fan", "Evaporative Humidifier",
  "Evaporative Humidifier (Auto-refill)", "Humidifier", "Smart Radiator Thermostat",
  "Standing Circulator Fan", "Battery Circulator Fan 2 Pro",

  // Plugs & switches
  "Garage Door Opener", "Plug", "Plug Mini (EU)", "Plug Mini (JP)", "Plug Mini (US)",
  "Relay Switch 1", "Relay Switch 1PM", "Relay Switch 2PM",

  // Others
  "Bot", "AI Art Frame", "WeatherStation", "Kata Friends"
] as const);

export function supportsControlCommands(deviceType: string): boolean {
  return CONTROL_COMMAND_DEVICE_TYPES.has(deviceType as never);
}

export const documentedControlCommandDeviceTypes = Object.freeze([...CONTROL_COMMAND_DEVICE_TYPES]);
