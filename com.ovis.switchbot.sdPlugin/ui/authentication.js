(() => {
  const { streamDeckClient } = SDPIComponents;

  function render() {
    const host = document.getElementById("switchbot-authentication");
    if (!host) return;
    host.innerHTML = `
      <sdpi-heading>Authentication</sdpi-heading>
      <sdpi-item label="Token">
        <sdpi-password id="switchbot-token"></sdpi-password>
      </sdpi-item>
      <sdpi-item label="Secret">
        <sdpi-password id="switchbot-secret"></sdpi-password>
      </sdpi-item>
      <sdpi-item>
        <sdpi-button id="switchbot-test-connection">Test Connection</sdpi-button>
      </sdpi-item>
      <div id="switchbot-auth-status" class="auth-status" aria-live="polite"></div>`;
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
    status.textContent = "Testing...";
    status.className = "auth-status";
    await save();
    await streamDeckClient.send("sendToPlugin", { type: "testConnection" });
  }

  document.addEventListener("DOMContentLoaded", () => {
    render();
    document.getElementById("switchbot-token")?.addEventListener("change", save);
    document.getElementById("switchbot-secret")?.addEventListener("change", save);
    document.getElementById("switchbot-test-connection")?.addEventListener("click", testConnection);

    streamDeckClient.sendToPropertyInspector.subscribe(ev => {
      const payload = ev?.payload;
      if (payload?.type !== "testConnectionResult") return;
      const status = document.getElementById("switchbot-auth-status");
      status.textContent = payload.message ?? (payload.success ? "Connection successful." : "Connection failed.");
      status.className = payload.success ? "auth-status auth-success" : "auth-status auth-error";
    });

    void load();
  });
})();
