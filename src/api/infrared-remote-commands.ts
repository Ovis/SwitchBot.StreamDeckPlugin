export interface InfraredCommandDefinition {
  id: string;
  command: string;
  parameterKind: "default" | "channel" | "air-conditioner" | "custom";
  labels: { en: string; ja: string };
}

const baseCommands: readonly InfraredCommandDefinition[] = [
  { id: "turnOn", command: "turnOn", parameterKind: "default", labels: { en: "Power On", ja: "電源 ON" } },
  { id: "turnOff", command: "turnOff", parameterKind: "default", labels: { en: "Power Off", ja: "電源 OFF" } }
];

const command = (id: string, en: string, ja: string, parameterKind: InfraredCommandDefinition["parameterKind"] = "default"): InfraredCommandDefinition =>
  ({ id, command: id, parameterKind, labels: { en, ja } });

const extraCommands: Readonly<Record<string, readonly InfraredCommandDefinition[]>> = {
  "Air Conditioner": [
    { id: "setAll", command: "setAll", parameterKind: "air-conditioner", labels: { en: "Set configuration", ja: "設定変更" } }
  ],
  "TV": [
    command("SetChannel", "Set channel", "チャンネル指定", "channel"),
    command("volumeAdd", "Volume +", "音量 +"),
    command("volumeSub", "Volume -", "音量 -"),
    command("channelAdd", "Channel +", "チャンネル +"),
    command("channelSub", "Channel -", "チャンネル -")
  ],
  "IPTV/Streamer": [
    command("SetChannel", "Set channel", "チャンネル指定", "channel"),
    command("volumeAdd", "Volume +", "音量 +"),
    command("volumeSub", "Volume -", "音量 -"),
    command("channelAdd", "Channel +", "チャンネル +"),
    command("channelSub", "Channel -", "チャンネル -")
  ],
  "Streamer": [
    command("SetChannel", "Set channel", "チャンネル指定", "channel"),
    command("volumeAdd", "Volume +", "音量 +"),
    command("volumeSub", "Volume -", "音量 -"),
    command("channelAdd", "Channel +", "チャンネル +"),
    command("channelSub", "Channel -", "チャンネル -")
  ],
  "Set Top Box": [
    command("SetChannel", "Set channel", "チャンネル指定", "channel"),
    command("volumeAdd", "Volume +", "音量 +"),
    command("volumeSub", "Volume -", "音量 -"),
    command("channelAdd", "Channel +", "チャンネル +"),
    command("channelSub", "Channel -", "チャンネル -")
  ],
  "DVD": [
    command("setMute", "Mute", "ミュート"),
    command("FastForward", "Fast forward", "早送り"),
    command("Rewind", "Rewind", "巻き戻し"),
    command("Next", "Next", "次へ"),
    command("Previous", "Previous", "前へ"),
    command("Pause", "Pause", "一時停止"),
    command("Play", "Play", "再生"),
    command("Stop", "Stop", "停止")
  ],
  "DVD Player": [
    command("setMute", "Mute", "ミュート"),
    command("FastForward", "Fast forward", "早送り"),
    command("Rewind", "Rewind", "巻き戻し"),
    command("Next", "Next", "次へ"),
    command("Previous", "Previous", "前へ"),
    command("Pause", "Pause", "一時停止"),
    command("Play", "Play", "再生"),
    command("Stop", "Stop", "停止")
  ],
  "Speaker": [
    command("setMute", "Mute", "ミュート"),
    command("FastForward", "Fast forward", "早送り"),
    command("Rewind", "Rewind", "巻き戻し"),
    command("Next", "Next", "次へ"),
    command("Previous", "Previous", "前へ"),
    command("Pause", "Pause", "一時停止"),
    command("Play", "Play", "再生"),
    command("Stop", "Stop", "停止"),
    command("volumeAdd", "Volume +", "音量 +"),
    command("volumeSub", "Volume -", "音量 -")
  ],
  "Fan": [
    command("swing", "Swing", "首振り"),
    command("timer", "Timer", "タイマー"),
    command("lowSpeed", "Low speed", "風量 弱"),
    command("middleSpeed", "Medium speed", "風量 中"),
    command("highSpeed", "High speed", "風量 強")
  ],
  "Light": [
    command("brightnessUp", "Brightness +", "明るさ +"),
    command("brightnessDown", "Brightness -", "明るさ -")
  ]
};

export const CUSTOM_OPERATION_ID = "custom";

export function infraredCommandsForRemoteType(remoteType: string): readonly InfraredCommandDefinition[] {
  const canonicalType = canonicalInfraredRemoteType(remoteType);
  if (canonicalType === "Others" || !canonicalType) return [];
  return [...baseCommands, ...(extraCommands[canonicalType] ?? [])];
}

export function isKnownInfraredRemoteType(remoteType: string): boolean {
  return canonicalInfraredRemoteType(remoteType) !== undefined;
}

/**
 * SwitchBot API が返す DIY 系の remoteType を、同じ標準コマンド体系を持つ家電種別へ正規化する
 *
 * DIY Fan や DIY Light などはアプリで手動学習したリモコンだが、
 * OpenAPI 上では対応する Fan / Light の標準コマンドも利用できる。
 * 未知の DIY 種別まで推測して有効化しないよう、既知の家電種別に一致する場合だけ正規化する。
 */
function canonicalInfraredRemoteType(remoteType: string): string | undefined {
  if (KNOWN_REMOTE_TYPES.has(remoteType)) return remoteType;

  if (remoteType.startsWith("DIY ")) {
    const baseType = remoteType.slice(4);
    if (KNOWN_REMOTE_TYPES.has(baseType) && baseType !== "Others") return baseType;
  }

  return undefined;
}

const KNOWN_REMOTE_TYPES = new Set([
  "Air Conditioner", "TV", "Light", "IPTV/Streamer", "Streamer", "Set Top Box", "DVD", "DVD Player",
  "Fan", "Projector", "Camera", "Air Purifier", "Speaker", "Water Heater", "Vacuum Cleaner",
  "Robot Vacuum Cleaner", "Others"
]);

export function infraredCommandPropertyInspectorData(remoteType: string, locale: "en" | "ja") {
  const commands = infraredCommandsForRemoteType(remoteType).map(item => ({
    label: item.labels[locale],
    value: item.id,
    parameterKind: item.parameterKind
  }));
  return [
    ...commands,
    { label: locale === "ja" ? "カスタムボタン" : "Custom Button", value: CUSTOM_OPERATION_ID, parameterKind: "custom" as const }
  ];
}
