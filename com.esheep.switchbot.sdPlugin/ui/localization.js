(() => {
  let locale = "en";

  function applyLocale(value) {
    const normalized = String(value || "en").toLowerCase();
    locale = normalized.startsWith("ja") ? "ja" : "en";
    document.documentElement.lang = locale;

    if (window.SDPIComponents?.i18n) {
      window.SDPIComponents.i18n.language = locale;
    }

    document.dispatchEvent(new CustomEvent("switchbot-locale-changed"));
  }

  window.SwitchBotI18n = {
    get locale() { return locale; },
    t(en, ja) { return locale === "ja" ? ja : en; },
    configureSdpi() {
      if (!window.SDPIComponents?.i18n) return;
      window.SDPIComponents.i18n.locales = {
        en: {
          token: "Token",
          secret: "Secret",
          copyJson: "Copy JSON",
          deviceCatalog: "Device catalog",
          device: "Device",
          showOnKey: "Show on key",
          prettyPrint: "Pretty print",
          method: "Method",
          path: "Path",
          requestBody: "Request Body",
          copyResponse: "Copy response"
        },
        ja: {
          token: "トークン",
          secret: "シークレット",
          copyJson: "JSONをコピー",
          deviceCatalog: "デバイス一覧",
          device: "デバイス",
          showOnKey: "キーに表示",
          prettyPrint: "整形",
          method: "メソッド",
          path: "パス",
          requestBody: "リクエスト本文",
          copyResponse: "レスポンスをコピー"
        }
      };
      window.SDPIComponents.i18n.language = locale;
    }
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
