import { queryRequired, valueOf } from "./dom.js";
import type {
  PropertyInspectorCredentials,
  SaveCredentialsRequest,
  TestConnectionRequest,
  TestConnectionResultMessage,
  PropertyInspectorErrorCategory,
  parsePluginToPropertyInspectorMessage
} from "../../protocol/property-inspector-protocol.js";

const { streamDeckClient } = SDPIComponents;

interface GlobalSettingsPayload {
  credentials?: Partial<PropertyInspectorCredentials>;
}

function t(en: string, ja: string): string {
  return window.SwitchBotI18n?.t(en, ja) ?? en;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function globalSettings(value: unknown): GlobalSettingsPayload {
  return isRecord(value) ? value as GlobalSettingsPayload : {};
}

function testConnectionResult(value: unknown): TestConnectionResultMessage | undefined {
  const message = parsePluginToPropertyInspectorMessage(value);
  return message?.event === "testConnectionResult" ? message : undefined;
}

function render(): void {
  const host = queryRequired<HTMLElement>("#switchbot-authentication");
  host.innerHTML = `
    <div id="switchbot-auth-heading" class="section-heading">${t("Authentication", "認証")}</div>
    <sdpi-item id="switchbot-token-item" label="__MSG_token__">
      <sdpi-password id="switchbot-token"></sdpi-password>
    </sdpi-item>
    <sdpi-item id="switchbot-secret-item" label="__MSG_secret__">
      <sdpi-password id="switchbot-secret"></sdpi-password>
    </sdpi-item>
    <sdpi-item>
      <sdpi-button id="switchbot-test-connection">${t("Test Connection", "接続テスト")}</sdpi-button>
    </sdpi-item>
    <div id="switchbot-auth-status" class="auth-status" aria-live="polite"></div>`;
}

function localizeAuthentication(): void {
  queryRequired<HTMLElement>("#switchbot-auth-heading").textContent = t("Authentication", "認証");
  queryRequired<HTMLElement>("#switchbot-test-connection").textContent = t("Test Connection", "接続テスト");
  window.SwitchBotI18n?.refreshSdpiLocalization();
}

async function load(): Promise<void> {
  const settings = globalSettings(await streamDeckClient.getGlobalSettings());
  const credentials = settings.credentials ?? {};
  queryRequired<SdpiValueElement>("#switchbot-token").value = credentials.token ?? "";
  queryRequired<SdpiValueElement>("#switchbot-secret").value = credentials.secret ?? "";
}

function currentCredentials(): PropertyInspectorCredentials {
  return {
    token: valueOf(queryRequired<SdpiValueElement>("#switchbot-token")),
    secret: valueOf(queryRequired<SdpiValueElement>("#switchbot-secret"))
  };
}

async function save(): Promise<void> {
  const message: SaveCredentialsRequest = { event: "saveCredentials", credentials: currentCredentials() };
  await streamDeckClient.send("sendToPlugin", message);
}

async function testConnection(): Promise<void> {
  const status = queryRequired<HTMLElement>("#switchbot-auth-status");
  status.textContent = t("Testing...", "テスト中...");
  status.className = "auth-status";
  const message: TestConnectionRequest = { event: "testConnection", credentials: currentCredentials() };
  await streamDeckClient.send("sendToPlugin", message);
}


function connectionFailureText(category: PropertyInspectorErrorCategory | undefined): string {
  switch (category) {
    case "configuration": return t("Token and Secret are required.", "トークンとシークレットを入力してください。");
    case "authentication": return t("Authentication failed. Check Token and Secret.", "認証に失敗しました。トークンとシークレットを確認してください。");
    case "network": return t("Network request failed.", "ネットワーク通信に失敗しました。");
    case "http": return t("SwitchBot returned an HTTP error.", "SwitchBot APIからHTTPエラーが返されました。");
    case "switchbot": return t("SwitchBot rejected the request.", "SwitchBot APIにリクエストを拒否されました。");
    case "response": return t("SwitchBot returned an unexpected response.", "SwitchBot APIから予期しないレスポンスが返されました。");
    default: return t("Connection test failed.", "接続テストに失敗しました。");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  render();
  localizeAuthentication();
  document.addEventListener("switchbot-locale-changed", localizeAuthentication);

  queryRequired<SdpiValueElement>("#switchbot-token").addEventListener("change", () => void save());
  queryRequired<SdpiValueElement>("#switchbot-secret").addEventListener("change", () => void save());
  queryRequired<HTMLElement>("#switchbot-test-connection").addEventListener("click", () => void testConnection());

  streamDeckClient.sendToPropertyInspector.subscribe(event => {
    const payload = testConnectionResult(event.payload);
    if (!payload) return;

    const status = queryRequired<HTMLElement>("#switchbot-auth-status");
    status.textContent = payload.success
      ? t("Connection successful.", "接続に成功しました。")
      : connectionFailureText(payload.errorCategory);
    status.className = payload.success ? "auth-status auth-success" : "auth-status auth-error";
  });

  void load().catch(() => {
    queryRequired<HTMLElement>("#switchbot-auth-status").textContent =
      t("Failed to load saved credentials.", "保存済み認証情報の読み込みに失敗しました。");
  });
});
