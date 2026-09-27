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
      scene: "Scene",
      endpoint: "Endpoint",
      loadingScenes: "Loading saved scenes...",
      selectScene: "Select a scene",
      buttonName: "Button name",
      showOnKey: "Show result on button",
      prettyPrint: "Pretty print",
      method: "Method",
      path: "Path",
      requestBody: "Request Body",\n      sampleJson: "Sample",
      copyResponse: "Copy response",
      loadingDevices: "Loading saved devices...",
      selectDevice: "Select a device"
    },
    ja: {
      token: "トークン",
      secret: "シークレット",
      copyJson: "JSONをコピー",
      deviceCatalog: "デバイス一覧",
      device: "デバイス",
      scene: "シーン",
      endpoint: "エンドポイント",
      loadingScenes: "保存済みシーンを読み込み中...",
      selectScene: "シーンを選択",
      buttonName: "ボタン名",
      showOnKey: "取得結果をボタンに表示",
      prettyPrint: "整形",
      method: "メソッド",
      path: "パス",
      requestBody: "リクエスト本文",\n      sampleJson: "サンプル",
      copyResponse: "レスポンスをコピー",
      loadingDevices: "保存済みデバイスを読み込み中...",
      selectDevice: "デバイスを選択"
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
    try {
      const language = JSON.parse(info)?.application?.language;
      applyLocale(language);
    } catch {
      applyLocale("en");
    }
    originalConnect?.(port, uuid, event, info, actionInfo);
  };
})();
