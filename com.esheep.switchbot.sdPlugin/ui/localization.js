(() => {
  let locale = "en";

  function applyLocale(value) {
    const normalized = String(value || "en").toLowerCase();
    const next = normalized.startsWith("ja") ? "ja" : "en";
    locale = next;
    document.documentElement.lang = locale;
    document.dispatchEvent(new CustomEvent("switchbot-locale-changed"));
  }

  window.SwitchBotI18n = {
    get locale() { return locale; },
    t(en, ja) { return locale === "ja" ? ja : en; }
  };

  window.connectElgatoStreamDeckSocket = (_port, _uuid, _event, info) => {
    console.info("[SwitchBot PI] registration callback received");
    try {
      const language = JSON.parse(info)?.application?.language;
      console.info("[SwitchBot PI] Stream Deck language", language ?? "(missing)");
      applyLocale(language);
    } catch (error) {
      console.error("[SwitchBot PI] registration info parse failed", error?.name ?? "Error");
      applyLocale("en");
    }
  };

  document.documentElement.lang = locale;
})();
