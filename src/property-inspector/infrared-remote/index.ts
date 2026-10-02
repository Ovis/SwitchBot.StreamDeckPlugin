import "../shared/localization.js";
import "../shared/authentication.js";
import { attachExecutionDiagnostics } from "../shared/execution-diagnostics.js";
import { catalogRefreshStatusMessage } from "../shared/catalog-refresh-status.js";
import { checked, queryRequired, valueOf } from "../shared/dom.js";
import { createPropertyInspectorSettingsStore } from "../shared/property-inspector-settings-store.js";
import { normalizeInfraredRemotePropertyInspectorSettings } from "../shared/managed-settings-normalizers.js";
import {
  InfraredRemotePropertyInspectorItem,
  parsePluginToPropertyInspectorMessage
} from "../../protocol/property-inspector-protocol.js";
import type { InfraredRemoteSettingsV1 } from "../../settings/infrared-remote-settings.js";

type InfraredRemote = InfraredRemotePropertyInspectorItem;

interface GeneratedBody {
  error?: string;
  command?: string;
  parameter?: string;
  commandType?: string;
}

function escapeHtml(value: string): string {
  const replacements: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  };
  return value.replace(/[&<>"']/g, character => replacements[character] ?? character);
}

document.addEventListener("DOMContentLoaded", () => {
  const { streamDeckClient } = SDPIComponents;
  attachExecutionDiagnostics(streamDeckClient);
  const remote = queryRequired<SdpiValueElement>("#remote");
  const operation = queryRequired<SdpiValueElement>("#operation");
  const customButton = queryRequired<SdpiValueElement>("#custom-button");
  const channel = queryRequired<SdpiValueElement>("#channel");
  const acTemperature = queryRequired<SdpiValueElement>("#ac-temperature");
  const acMode = queryRequired<SdpiValueElement>("#ac-mode");
  const acFan = queryRequired<SdpiValueElement>("#ac-fan");
  const acPower = queryRequired<SdpiValueElement>("#ac-power");
  const customItem = queryRequired<HTMLElement>("#custom-item");
  const channelItem = queryRequired<HTMLElement>("#channel-item");
  const acFields = queryRequired<HTMLElement>("#ac-fields");
  const validationStatus = queryRequired<HTMLElement>("#validation-status");
  const catalogStatus = queryRequired<HTMLElement>("#catalog-status");
  const overrideActive = queryRequired<HTMLElement>("#override-active");
  const commandOverride = queryRequired<SdpiValueElement>("#command-override");
  const parameterOverride = queryRequired<SdpiValueElement>("#parameter-override");
  const typeOverride = queryRequired<SdpiValueElement>("#type-override");
  const commandValue = queryRequired<SdpiValueElement>("#command-value");
  const parameterValue = queryRequired<SdpiValueElement>("#parameter-value");
  const typeMode = queryRequired<SdpiValueElement>("#type-mode");
  const typeValue = queryRequired<SdpiValueElement>("#type-value");
  const customTypeItem = queryRequired<HTMLElement>("#custom-type-item");
  const requestPreview = queryRequired<HTMLElement>("#request-preview");
  const showOperationOnKey = queryRequired<SdpiValueElement>("#show-operation-on-key");
  const copyResponse = queryRequired<SdpiValueElement>("#copy-response");
  const prettyPrint = queryRequired<SdpiValueElement>("#pretty-print");

  let remotes = new Map<string, InfraredRemote>();
  let suppressBodyChange = true;
  let typeModeInitialized = false;
  let savedOperation = "";

  function setControlDisabled(element: SdpiValueElement, disabled: boolean): void {
    // sdpi-components は disabled プロパティを参照して内部 input を描画するため、
    // 属性とプロパティを同時に同期し、再描画後も状態が戻らないようにする。
    element.disabled = disabled;
    element.toggleAttribute("disabled", disabled);
  }

  const selectedRemote = () => remotes.get(valueOf(remote));
  const selectedCommand = () => selectedRemote()?.commands?.find(item => item.value === valueOf(operation));

  const settingsStore = createPropertyInspectorSettingsStore(streamDeckClient, normalizeInfraredRemotePropertyInspectorSettings);
  const initialization = settingsStore.initialize();

  function emptyOverrides(settings: InfraredRemoteSettingsV1): void {
    settings.overrides = {
      command: { enabled: false, value: "" },
      parameter: { enabled: false, value: "" },
      commandType: { enabled: false, value: "" }
    };
  }

  function clearOverridesInUi(): void {
    const previousSuppress = suppressBodyChange;
    suppressBodyChange = true;
    try {
      commandOverride.value = false;
      parameterOverride.value = false;
      typeOverride.value = false;
      commandValue.value = "";
      parameterValue.value = "";
      typeValue.value = "";
      typeModeInitialized = false;
    } finally {
      suppressBodyChange = previousSuppress;
    }
    updateUi();
  }

  function setOperationOptions(remoteInfo: InfraredRemote | undefined, selectedOperation = ""): void {
    const items = remoteInfo?.commands ?? [];
    operation.innerHTML = '<option value=""></option>' + items.map(item =>
      `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`
    ).join("");

    // datasource 復元中に一時的な空値が valuechange として通知されるため、
    // 保存済み値が現在の候補に存在するときだけ明示的に復元する。
    operation.value = items.some(item => item.value === selectedOperation) ? selectedOperation : "";
  }

  function applySettingsToUi(settings: InfraredRemoteSettingsV1, includeCatalogSelections: boolean): void {
    suppressBodyChange = true;
    try {
      if (includeCatalogSelections) {
        remote.value = remotes.has(settings.deviceId) ? settings.deviceId : "";
        savedOperation = settings.operation;
        setOperationOptions(remotes.get(settings.deviceId), settings.operation);
      }
      customButton.value = settings.customButtonName;
      channel.value = settings.channel;
      acTemperature.value = settings.airConditioner.temperature;
      acMode.value = settings.airConditioner.mode;
      acFan.value = settings.airConditioner.fanSpeed;
      acPower.value = settings.airConditioner.powerState;
      commandOverride.value = settings.overrides.command.enabled;
      parameterOverride.value = settings.overrides.parameter.enabled;
      typeOverride.value = settings.overrides.commandType.enabled;
      commandValue.value = settings.overrides.command.value;
      parameterValue.value = settings.overrides.parameter.value;
      typeValue.value = settings.overrides.commandType.value;
      showOperationOnKey.value = settings.output.showOperationOnKey;
      copyResponse.value = settings.output.copyResponseToClipboard;
      prettyPrint.value = settings.output.prettyPrint;
      typeModeInitialized = false;
    } finally {
      suppressBodyChange = false;
    }
    updateUi();
  }

  function generatedBody(): GeneratedBody {
    const info = selectedRemote();
    if (!info) {
      return { error: window.SwitchBotI18n?.t("Select an infrared remote.", "赤外線リモコンを選択してください。") ?? "Select an infrared remote." };
    }

    const selectedOperation = valueOf(operation);
    const command = selectedCommand();

    if (info.remoteType === "Others" || selectedOperation === "custom") {
      const name = valueOf(customButton).trim();
      if (!name) {
        return { error: window.SwitchBotI18n?.t("Enter a custom button name.", "カスタムボタン名を入力してください。") ?? "Enter a custom button name." };
      }
      return { command: name, parameter: "default", commandType: "customize" };
    }

    if (!selectedOperation || !command) {
      return { error: window.SwitchBotI18n?.t("No operation is selected.", "操作が未選択です。") ?? "No operation is selected." };
    }

    if (command.parameterKind === "channel") {
      const channelValue = valueOf(channel).trim();
      if (!channelValue) {
        return { error: window.SwitchBotI18n?.t("Enter a channel.", "チャンネルを入力してください。") ?? "Enter a channel." };
      }
      return { command: selectedOperation, parameter: channelValue, commandType: "command" };
    }

    if (command.parameterKind === "air-conditioner") {
      const temperature = valueOf(acTemperature).trim();
      if (!temperature || !Number.isFinite(Number(temperature))) {
        return { error: window.SwitchBotI18n?.t("Enter a valid temperature.", "有効な温度を入力してください。") ?? "Enter a valid temperature." };
      }
      return {
        command: selectedOperation,
        parameter: [
          temperature,
          valueOf(acMode, "2"),
          valueOf(acFan, "1"),
          valueOf(acPower, "on")
        ].join(","),
        commandType: "command"
      };
    }

    return { command: selectedOperation, parameter: "default", commandType: "command" };
  }

  function finalBody(): GeneratedBody {
    const generated = generatedBody();
    const command = checked(commandOverride) ? valueOf(commandValue) : generated.command;
    const parameter = checked(parameterOverride) ? valueOf(parameterValue) : generated.parameter;
    const commandType = checked(typeOverride) ? valueOf(typeValue) : generated.commandType;

    if (!command) {
      return {
        error: generated.error
          ?? window.SwitchBotI18n?.t("Command is required.", "Command は必須です。")
          ?? "Command is required."
      };
    }
    if (!commandType) {
      return {
        error: generated.error
          ?? window.SwitchBotI18n?.t("Command type is required.", "Command type は必須です。")
          ?? "Command type is required."
      };
    }
    return { command, parameter: parameter ?? "", commandType };
  }

  function applyInfraredLocale(): void {
    const ja = window.SwitchBotI18n?.locale === "ja";
    queryRequired<HTMLElement>("#advanced-heading").textContent =
      window.SwitchBotI18n?.t("Advanced Override", "上書き") ?? "Advanced Override";
    queryRequired<HTMLElement>("#output-heading").textContent =
      window.SwitchBotI18n?.t("Output", "出力") ?? "Output";
    queryRequired<HTMLElement>("#override-active").textContent =
      window.SwitchBotI18n?.t("Advanced Override active", "上書きが有効です") ?? "Advanced Override active";
    queryRequired<HTMLOptionElement>("#custom-type-option").textContent =
      window.SwitchBotI18n?.t("Custom", "カスタム") ?? "Custom";

    const modeLabels = ja ? ["自動", "冷房", "除湿", "送風", "暖房"] : ["Auto", "Cool", "Dry", "Fan", "Heat"];
    const fanLabels = ja ? ["自動", "弱", "中", "強"] : ["Auto", "Low", "Medium", "High"];

    queryRequired<SdpiValueElement>("#ac-mode").querySelectorAll("option").forEach((option, index) => {
      option.textContent = modeLabels[index] ?? option.textContent;
    });
    queryRequired<SdpiValueElement>("#ac-fan").querySelectorAll("option").forEach((option, index) => {
      option.textContent = fanLabels[index] ?? option.textContent;
    });
    window.SwitchBotI18n?.refreshSdpiLocalization();
  }

  function updateUi(): void {
    applyInfraredLocale();
    const info = selectedRemote();
    const command = selectedCommand();

    customItem.hidden = !(info?.remoteType === "Others" || valueOf(operation) === "custom");
    channelItem.hidden = command?.parameterKind !== "channel";
    acFields.hidden = command?.parameterKind !== "air-conditioner";

    setControlDisabled(commandValue, !checked(commandOverride));
    setControlDisabled(parameterValue, !checked(parameterOverride));
    setControlDisabled(typeMode, !checked(typeOverride));

    overrideActive.hidden = !(checked(commandOverride) || checked(parameterOverride) || checked(typeOverride));

    const generated = generatedBody();
    const previousSuppress = suppressBodyChange;
    suppressBodyChange = true;
    try {
      if (checked(typeOverride) && !typeModeInitialized) {
        const savedType = valueOf(typeValue);
        typeMode.value = ["command", "customize"].includes(savedType) ? savedType : "custom";
        typeModeInitialized = true;
      }
      if (!checked(typeOverride)) typeModeInitialized = false;
      if (!checked(commandOverride)) commandValue.value = generated.command ?? "";
      if (!checked(parameterOverride)) parameterValue.value = generated.parameter ?? "";
      if (!checked(typeOverride)) {
        typeValue.value = generated.commandType ?? "";
        typeMode.value = ["command", "customize"].includes(generated.commandType ?? "") ? generated.commandType ?? "" : "custom";
      }
    } finally {
      suppressBodyChange = previousSuppress;
    }
    customTypeItem.hidden = !checked(typeOverride) || valueOf(typeMode) !== "custom";

    const body = finalBody();
    validationStatus.textContent = body.error ?? "";
    requestPreview.textContent = body.error
      ? (window.SwitchBotI18n?.t("Request Body unavailable: ", "Request Bodyを生成できません: ") ?? "Request Body unavailable: ") + body.error
      : JSON.stringify({ command: body.command, parameter: body.parameter, commandType: body.commandType }, null, 2);
  }

  function enableOverride(kind: "command" | "parameter" | "type", enabled: boolean): void {
    const generated = generatedBody();
    const generatedValue = kind === "command"
      ? generated.command ?? ""
      : kind === "parameter"
        ? generated.parameter ?? ""
        : generated.commandType ?? "";
    const field = kind === "command" ? commandValue : kind === "parameter" ? parameterValue : typeValue;
    const value = enabled ? generatedValue : "";

    suppressBodyChange = true;
    try {
      field.value = value;
      if (kind === "type") {
        typeModeInitialized = false;
        typeMode.value = ["command", "customize"].includes(generatedValue) ? generatedValue : "custom";
      }
    } finally {
      suppressBodyChange = false;
    }

    void settingsStore.update(settings => {
      const key = kind === "type" ? "commandType" : kind;
      settings.overrides[key] = { enabled, value };
    });
    updateUi();
  }

  remote.addEventListener("valuechange", () => {
    void (async () => {
      if (suppressBodyChange) return;

      const next = selectedRemote();
      if (!next) {
        // remote の datasource はカタログ到着前に値だけ復元されることがある。
        // ここで空の remoteType/operation を保存すると永続設定を破壊するため待機する。
        return;
      }

      await initialization;
      const currentSettings = settingsStore.current;
      const sameType = currentSettings.remoteType === next.remoteType;
      suppressBodyChange = true;
      try {
        const preservedOperation = sameType ? (savedOperation || currentSettings.operation) : "";
        savedOperation = preservedOperation;
        setOperationOptions(next, preservedOperation);
        const persisted = await settingsStore.update(current => {
          current.deviceId = valueOf(remote);
          current.remoteType = next.remoteType;
          current.operation = preservedOperation;
          emptyOverrides(current);
        });
        applySettingsToUi(persisted, false);
      } finally {
        suppressBodyChange = false;
      }
      updateUi();
    })();
  });

  operation.addEventListener("valuechange", () => {
    void (async () => {
      if (suppressBodyChange) return;
      const selectedOperation = valueOf(operation);
      savedOperation = selectedOperation;

      clearOverridesInUi();
      const persisted = await settingsStore.update(settings => {
        settings.operation = selectedOperation;
        emptyOverrides(settings);
      });
      applySettingsToUi(persisted, false);
    })();
  });

  const bodyFields: Array<[
    SdpiValueElement,
    (settings: InfraredRemoteSettingsV1, value: string) => void
  ]> = [
    [customButton, (settings, value) => { settings.customButtonName = value; }],
    [channel, (settings, value) => { settings.channel = value; }],
    [acTemperature, (settings, value) => { settings.airConditioner.temperature = value; }],
    [acMode, (settings, value) => {
      settings.airConditioner.mode = value as InfraredRemoteSettingsV1["airConditioner"]["mode"];
    }],
    [acFan, (settings, value) => {
      settings.airConditioner.fanSpeed = value as InfraredRemoteSettingsV1["airConditioner"]["fanSpeed"];
    }],
    [acPower, (settings, value) => {
      settings.airConditioner.powerState = value as InfraredRemoteSettingsV1["airConditioner"]["powerState"];
    }]
  ];
  for (const [element, updateSetting] of bodyFields) {
    element.addEventListener("valuechange", () => {
      if (suppressBodyChange) return;
      void (async () => {
        clearOverridesInUi();
        const persisted = await settingsStore.update(settings => {
          updateSetting(settings, valueOf(element));
          emptyOverrides(settings);
        });
        applySettingsToUi(persisted, false);
      })();
    });
    element.addEventListener("input", updateUi);
  }

  commandOverride.addEventListener("valuechange", () => {
    if (!suppressBodyChange) enableOverride("command", checked(commandOverride));
  });
  parameterOverride.addEventListener("valuechange", () => {
    if (!suppressBodyChange) enableOverride("parameter", checked(parameterOverride));
  });
  typeOverride.addEventListener("valuechange", () => {
    if (!suppressBodyChange) enableOverride("type", checked(typeOverride));
  });

  typeMode.addEventListener("valuechange", () => {
    if (suppressBodyChange || !checked(typeOverride)) return;
    const mode = valueOf(typeMode);
    if (mode !== "custom") {
      suppressBodyChange = true;
      typeValue.value = mode;
      suppressBodyChange = false;
      void settingsStore.update(settings => {
        settings.overrides.commandType.value = mode;
      });
    }
    updateUi();
  });

  const overrideFields: Array<[SdpiValueElement, "command" | "parameter" | "commandType"]> = [
    [commandValue, "command"],
    [parameterValue, "parameter"],
    [typeValue, "commandType"]
  ];
  for (const [field, key] of overrideFields) {
    field.addEventListener("input", updateUi);
    field.addEventListener("valuechange", () => {
      if (suppressBodyChange) return;
      void settingsStore.update(settings => {
        settings.overrides[key].value = valueOf(field);
      });
      updateUi();
    });
  }

  showOperationOnKey.addEventListener("valuechange", () => {
    if (suppressBodyChange) return;
    void settingsStore.update(settings => {
      settings.output.showOperationOnKey = checked(showOperationOnKey);
    });
  });
  copyResponse.addEventListener("valuechange", () => {
    if (suppressBodyChange) return;
    void settingsStore.update(settings => {
      settings.output.copyResponseToClipboard = checked(copyResponse);
    });
  });
  prettyPrint.addEventListener("valuechange", () => {
    if (suppressBodyChange) return;
    void settingsStore.update(settings => {
      settings.output.prettyPrint = checked(prettyPrint);
    });
  });

  streamDeckClient.sendToPropertyInspector.subscribe(event => {
    const message = parsePluginToPropertyInspectorMessage(event.payload);
    const payload = message?.event === "getInfraredRemotes" ? message : undefined;
    if (!payload) return;

    void (async () => {
      await initialization;
      remotes = new Map(payload.remotes.map(item => [item.value, item]));
      // datasource の選択肢は SDPI Components が応答から描画する。
      // light DOM の option を更新すると監視処理が再取得を繰り返すため、
      // ここではコマンド情報と保存済みの選択値だけを反映する。
      const settings = await settingsStore.reload();
      applySettingsToUi(settings, true);

      catalogStatus.textContent = catalogRefreshStatusMessage(
        payload.refreshFailed,
        payload.refreshFailure,
        (english, japanese) => window.SwitchBotI18n?.t(english, japanese) ?? english
      );
    })();
  });

  void initialization.then(settings => applySettingsToUi(settings, false));
  document.addEventListener("switchbot-locale-changed", () => {
    applyInfraredLocale();
    updateUi();
  });
});
