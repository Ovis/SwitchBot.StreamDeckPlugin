(() => {
  const { streamDeckClient } = SDPIComponents;

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
    status.className = "";
    await save();
    streamDeckClient.sendToPlugin({ type: "testConnection" });
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("switchbot-token")?.addEventListener("change", save);
    document.getElementById("switchbot-secret")?.addEventListener("change", save);
    document.getElementById("switchbot-test-connection")?.addEventListener("click", testConnection);

    streamDeckClient.on("sendToPropertyInspector", ev => {
      const payload = ev?.payload;
      if (payload?.type !== "testConnectionResult") return;
      const status = document.getElementById("switchbot-auth-status");
      status.textContent = payload.message ?? (payload.success ? "Connection successful." : "Connection failed.");
      status.className = payload.success ? "auth-success" : "auth-error";
    });

    void load();
  });
})();
