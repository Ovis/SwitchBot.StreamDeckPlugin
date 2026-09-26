(() => {
  let locale = "en";

  function applyLocale(value) {
    const normalized = (value || "en").toLowerCase();
    locale = normalized === "ja" || normalized.startsWith("ja-") ? "ja" : "en";
    document.documentElement.lang = locale;
    document.dispatchEvent(new CustomEvent("switchbot-locale-changed"));
  }

  window.SwitchBotI18n = {
    get locale() { return locale; },
    t(en, ja) { return locale === "ja" ? ja : en; }
  };

  const previousConnect = window.connectElgatoStreamDeckSocket;
  window.connectElgatoStreamDeckSocket = (...args) => {
    try {
      const info = JSON.parse(args[4] || "{}");
      applyLocale(info?.application?.language);
    } catch {
      applyLocale("en");
    }
    return previousConnect?.(...args);
  };

  applyLocale(navigator.language);
})();
