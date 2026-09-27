const i18n = SDPIComponents.i18n;
const originalConnect = window.connectElgatoStreamDeckSocket;
let locale: "en" | "ja" = "en";

i18n.locales = {
  en: {
    token: "Token",
    secret: "Secret",
    copyJson: "Copy JSON",
    deviceCatalog: "Device catalog",
    device: "Device",
    scene: "Scene",
    endpoint: "Endpoint",
    loadingScenes: "Loading saved scenes...",
    selectScene: "Select a scene",
    buttonName: "Button name",
    showOnKey: "Show result on button",
    prettyPrint: "Pretty print",
    method: "Method",
    path: "Path",
    requestBody: "Request Body",
    sampleJson: "Sample",
    copyResponse: "Copy response",
    loadingDevices: "Loading saved devices...",
    selectDevice: "Select a device",
    operation: "Operation",
    selectOperation: "Select operation",
    customButton: "Custom button",
    channel: "Channel",
    temperature: "Temperature (℃)",
    mode: "Mode",
    fanSpeed: "Fan speed",
    power: "Power",
    advancedOverride: "Advanced Override",
    commandOverride: "Command override",
    command: "Command",
    parameterOverride: "Parameter override",
    parameter: "Parameter",
    commandTypeOverride: "Command type override",
    commandType: "Command type",
    customCommandType: "Custom command type",
    output: "Output",
    showOperationOnKey: "Show operation on key"
  },
  ja: {
    token: "トークン",
    secret: "シークレット",
    copyJson: "JSONをコピー",
    deviceCatalog: "デバイス一覧",
    device: "デバイス",
    scene: "シーン",
    endpoint: "エンドポイント",
    loadingScenes: "保存済みシーンを読み込み中...",
    selectScene: "シーンを選択",
    buttonName: "ボタン名",
    showOnKey: "取得結果をボタンに表示",
    prettyPrint: "整形",
    method: "メソッド",
    path: "パス",
    requestBody: "リクエスト本文",
    sampleJson: "サンプル",
    copyResponse: "レスポンスをコピー",
    loadingDevices: "保存済みデバイスを読み込み中...",
    selectDevice: "デバイスを選択",
    operation: "操作",
    selectOperation: "操作を選択",
    customButton: "カスタムボタン",
    channel: "チャンネル",
    temperature: "温度 (℃)",
    mode: "モード",
    fanSpeed: "風量",
    power: "電源",
    advancedOverride: "上書き",
    commandOverride: "コマンドを上書き",
    command: "コマンド",
    parameterOverride: "パラメーターを上書き",
    parameter: "パラメーター",
    commandTypeOverride: "コマンド種別を上書き",
    commandType: "コマンド種別",
    customCommandType: "カスタムコマンド種別",
    output: "出力",
    showOperationOnKey: "操作内容をキーに表示"
  }
};

function refreshAttribute(selector: string, attribute: string): void {
  document.querySelectorAll<HTMLElement>(selector).forEach(element => {
    const value = element.getAttribute(attribute);
    if (!value) return;
    element.removeAttribute(attribute);
    element.setAttribute(attribute, value);
  });
}

function refreshSdpiLocalization(): void {
  refreshAttribute("sdpi-item[label]", "label");
  refreshAttribute("sdpi-select[loading]", "loading");
  refreshAttribute("sdpi-select[placeholder]", "placeholder");
  refreshAttribute("sdpi-textfield[placeholder]", "placeholder");
}

function applyLocale(value: unknown): void {
  const normalized = String(value || "en").toLowerCase();
  locale = normalized === "ja" || normalized.startsWith("ja-") ? "ja" : "en";
  document.documentElement.lang = locale;
  i18n.language = locale;
  refreshSdpiLocalization();
  document.dispatchEvent(new CustomEvent("switchbot-locale-changed"));
}

window.SwitchBotI18n = {
  get locale() {
    return locale;
  },
  t(en: string, ja: string) {
    return locale === "ja" ? ja : en;
  },
  refreshSdpiLocalization
};

window.connectElgatoStreamDeckSocket = (port, uuid, event, info, actionInfo) => {
  try {
    const parsed = JSON.parse(info) as { application?: { language?: unknown } };
    applyLocale(parsed.application?.language);
  } catch {
    applyLocale("en");
  }
  originalConnect?.(port, uuid, event, info, actionInfo);
};

export {};
