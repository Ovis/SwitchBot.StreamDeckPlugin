(() => {
  let locale = "en";

  function applyLocale(value) {
    const normalized = (value || "en").toLowerCase();
    const next = normalized === "ja" || normalized.startsWith("ja-") ? "ja" : "en";
    if (next === locale && document.documentElement.lang === next) return;
    locale = next;
    document.documentElement.lang = locale;
    document.dispatchEvent(new CustomEvent("switchbot-locale-changed"));
  }

  window.SwitchBotI18n = {
    get locale() { return locale; },
    t(en, ja) { return locale === "ja" ? ja : en; },
    async initialize() {
      try {
        const connection = await SDPIComponents.streamDeckClient.getConnectionInfo();
        applyLocale(connection?.info?.application?.language);
      } catch {
        applyLocale("en");
      }
    }
  };

  document.documentElement.lang = locale;
  document.addEventListener("DOMContentLoaded", () => {
    void window.SwitchBotI18n.initialize();
  });
})();
