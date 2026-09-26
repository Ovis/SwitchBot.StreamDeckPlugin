(() => {
  const i18n = SDPIComponents.i18n;
  const originalConnect = window.connectElgatoStreamDeckSocket;
  let locale = "en";

  i18n.locales = {
    en: {
      token: "Token",
      secret: "Secret",
      copyJson: "Copy JSON",
      deviceCatalog: "Device catalog",
      device: "Device",
      showOnKey: "Show result on button",
      prettyPrint: "Pretty print",
      method: "Method",
      path: "Path",
      requestBody: "Request Body",
      copyResponse: "Copy response",
      loadingDevices: "Loading saved devices...",
      selectDevice: "Run Get Devices first"
    },
    ja: {
      token: "トークン",
      secret: "シークレット",
      copyJson: "JSONをコピー",
      deviceCatalog: "デバイス一覧",
      device: "デバイス",
      showOnKey: "取得結果をボタンに表示",
      prettyPrint: "整形",
      method: "メソッド",
      path: "パス",
      requestBody: "リクエスト本文",
      copyResponse: "レスポンスをコピー",
      loadingDevices: "保存済みデバイスを読み込み中...",
      selectDevice: "先にデバイス取得を実行してください"
    }
  };

  function refreshAttribute(selector, attribute) {
    document.querySelectorAll(selector).forEach(element => {
      const value = element.getAttribute(attribute);
      if (!value) return;
      element.removeAttribute(attribute);
      element.setAttribute(attribute, value);
    });
  }

  function refreshSdpiLocalization() {
    refreshAttribute("sdpi-item[label]", "label");
    refreshAttribute("sdpi-select[loading]", "loading");
    refreshAttribute("sdpi-select[placeholder]", "placeholder");
    refreshAttribute("sdpi-textfield[placeholder]", "placeholder");
  }

  function applyLocale(value) {
    const normalized = String(value || "en").toLowerCase();
    locale = normalized === "ja" || normalized.startsWith("ja-") ? "ja" : "en";
    document.documentElement.lang = locale;
    i18n.language = locale;
    refreshSdpiLocalization();
    document.dispatchEvent(new CustomEvent("switchbot-locale-changed"));
  }

  window.SwitchBotI18n = {
    get locale() { return locale; },
    t(en, ja) { return locale === "ja" ? ja : en; },
    refreshSdpiLocalization
  };

  window.connectElgatoStreamDeckSocket = (port, uuid, event, info, actionInfo) => {
    console.info("[SwitchBot PI] registration callback received");
    try {
      const language = JSON.parse(info)?.application?.language;
      console.info("[SwitchBot PI] Stream Deck language", language ?? "(missing)");
      applyLocale(language);
    } catch (error) {
      console.error("[SwitchBot PI] registration info parse failed", error?.name ?? "Error");
      applyLocale("en");
    }

    originalConnect?.(port, uuid, event, info, actionInfo);
  };
})();
