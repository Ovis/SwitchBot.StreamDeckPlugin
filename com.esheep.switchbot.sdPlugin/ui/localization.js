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
    try {
      applyLocale(JSON.parse(info)?.application?.language);
    } catch {
      applyLocale("en");
    }
  };

  document.documentElement.lang = locale;
})();
