(() => {
  const { streamDeckClient } = SDPIComponents;
  const t = (en, ja) => window.SwitchBotI18n?.t(en, ja) ?? en;

  function render() {
    const host = document.getElementById("switchbot-authentication");
    if (!host) return;
    host.innerHTML = `
      <div id="switchbot-auth-heading" class="section-heading">${t("Authentication", "認証")}</div>
      <sdpi-item id="switchbot-token-item" label="${t("Token", "トークン")}">
        <sdpi-password id="switchbot-token"></sdpi-password>
      </sdpi-item>
      <sdpi-item id="switchbot-secret-item" label="${t("Secret", "シークレット")}">
        <sdpi-password id="switchbot-secret"></sdpi-password>
      </sdpi-item>
      <sdpi-item>
        <sdpi-button id="switchbot-test-connection">${t("Test Connection", "接続テスト")}</sdpi-button>
      </sdpi-item>
      <div id="switchbot-auth-status" class="auth-status" aria-live="polite"></div>`;
  }

  function localizeAuthentication() {
    const heading = document.getElementById("switchbot-auth-heading");
    const tokenItem = document.getElementById("switchbot-token-item");
    const secretItem = document.getElementById("switchbot-secret-item");
    const button = document.getElementById("switchbot-test-connection");
    if (heading) heading.textContent = t("Authentication", "認証");
    if (button) button.textContent = t("Test Connection", "接続テスト");
  }

  async function load() {
    console.info("[SwitchBot PI] global settings load start");
    const settings = await streamDeckClient.getGlobalSettings();
    console.info("[SwitchBot PI] global settings load complete", {
      credentialsPresent: Boolean(settings?.credentials),
      tokenPresent: Boolean(settings?.credentials?.token),
      secretPresent: Boolean(settings?.credentials?.secret)
    });
    const credentials = settings?.credentials ?? {};
    document.getElementById("switchbot-token").value = credentials.token ?? "";
    document.getElementById("switchbot-secret").value = credentials.secret ?? "";
  }

  async function save() {
    console.info("[SwitchBot PI] global settings save start", {
      tokenPresent: Boolean(document.getElementById("switchbot-token")?.value),
      secretPresent: Boolean(document.getElementById("switchbot-secret")?.value)
    });
    const current = await streamDeckClient.getGlobalSettings();
    await streamDeckClient.setGlobalSettings({
      ...current,
      version: 1,
      credentials: {
        token: document.getElementById("switchbot-token").value ?? "",
        secret: document.getElementById("switchbot-secret").value ?? ""
      }
    });
    console.info("[SwitchBot PI] global settings save complete");
  }

  async function testConnection() {
    console.info("[SwitchBot PI] test connection clicked");
    const status = document.getElementById("switchbot-auth-status");
    status.textContent = t("Testing...", "テスト中...");
    status.className = "auth-status";
    await save();
    await streamDeckClient.send("sendToPlugin", { type: "testConnection" });
    console.info("[SwitchBot PI] sendToPlugin complete");
  }

  function connectionFailureText(category) {
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
    console.info("[SwitchBot PI] authentication DOMContentLoaded");
    render();
    localizeAuthentication();
    document.addEventListener("switchbot-locale-changed", localizeAuthentication);
    document.getElementById("switchbot-token")?.addEventListener("change", save);
    document.getElementById("switchbot-secret")?.addEventListener("change", save);
    document.getElementById("switchbot-test-connection")?.addEventListener("click", testConnection);

    streamDeckClient.sendToPropertyInspector.subscribe(ev => {
      const payload = ev?.payload;
      if (payload?.type !== "testConnectionResult") return;
      const status = document.getElementById("switchbot-auth-status");
      status.textContent = payload.success
        ? t("Connection successful.", "接続に成功しました。")
        : connectionFailureText(payload.errorCategory);
      status.className = payload.success ? "auth-status auth-success" : "auth-status auth-error";
    });

    void load().catch(error => console.error("[SwitchBot PI] global settings load failed", error?.name ?? "Error"));
  });
})();
