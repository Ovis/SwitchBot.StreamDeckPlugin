(() => {
  const locale = (navigator.language || "en").toLowerCase();
  const ja = locale === "ja" || locale.startsWith("ja-");
  window.SwitchBotI18n = {
    locale: ja ? "ja" : "en",
    t(en, jp) { return ja ? jp : en; }
  };
  document.documentElement.lang = ja ? "ja" : "en";
})();
