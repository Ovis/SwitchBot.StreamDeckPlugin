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
    if (tokenItem) tokenItem.label = t("Token", "トークン");
    if (secretItem) secretItem.label = t("Secret", "シークレット");
    if (button) button.textContent = t("Test Connection", "接続テスト");
  }

  async function load() {
    const settings = await streamDeckClient.getGlobalSettings();
    const credentials = settings?.credentials ?? {};
    document.getElementById("switchbot-token").value = credentials.token ?? "";
    document.getElementById("switchbot-secret").value = credentials.secret ?? "";
  }

  async function save() {
    const current = await streamDeckClient.getGlobalSettings();
    await streamDeckClient.setGlobalSettings({
      ...current,
      version: 1,
      credentials: {
        token: document.getElementById("switchbot-token").value ?? "",
        secret: document.getElementById("switchbot-secret").value ?? ""
      }
    });
  }

  async function testConnection() {
    const status = document.getElementById("switchbot-auth-status");
    status.textContent = t("Testing...", "テスト中...");
    status.className = "auth-status";
    await save();
    await streamDeckClient.send("sendToPlugin", { type: "testConnection" });
  }

  document.addEventListener("DOMContentLoaded", () => {
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
      status.textContent = payload.message ?? (payload.success ? t("Connection successful.", "接続に成功しました。") : t("Connection failed.", "接続に失敗しました。"));
      status.className = payload.success ? "auth-status auth-success" : "auth-status auth-error";
    });

    void load();
  });
})();
