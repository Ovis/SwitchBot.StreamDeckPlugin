import "../shared/localization.js";
import "../shared/authentication.js";
import { checked, queryRequired, valueOf } from "../shared/dom.js";
import type {
  InfraredCommandPropertyInspectorItem,
  InfraredRemotePropertyInspectorItem,
  InfraredRemotesResultMessage
} from "../../protocol/property-inspector-protocol.js";

type InfraredCommand = InfraredCommandPropertyInspectorItem;
type InfraredRemote = InfraredRemotePropertyInspectorItem;
type InfraredPayload = InfraredRemotesResultMessage;

interface GeneratedBody {
  error?: string;
  command?: string;
  parameter?: string;
  commandType?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseCommand(value: unknown): InfraredCommand | undefined {
  if (!isRecord(value) || typeof value.value !== "string" || typeof value.label !== "string") return undefined;
  if (!["default", "channel", "air-conditioner", "custom"].includes(String(value.parameterKind))) return undefined;
  return {
    value: value.value,
    label: value.label,
    parameterKind: value.parameterKind as InfraredCommand["parameterKind"]
  };
}

function parseRemote(value: unknown): InfraredRemote | undefined {
  if (!isRecord(value) || typeof value.value !== "string" || typeof value.remoteType !== "string") return undefined;
  if (typeof value.hubDeviceId !== "string" || !Array.isArray(value.commands)) return undefined;
  const commands = value.commands.map(parseCommand).filter((item): item is InfraredCommand => item !== undefined);
  return {
    value: value.value,
    label: typeof value.label === "string" ? value.label : value.value,
    remoteType: value.remoteType,
    hubDeviceId: value.hubDeviceId,
    commands
  };
}

function parsePayload(value: unknown): InfraredPayload | undefined {
  if (!isRecord(value) || value.event !== "getInfraredRemotes" || !Array.isArray(value.remotes)) return undefined;
  return {
    event: "getInfraredRemotes",
    items: [],
    remotes: value.remotes.map(parseRemote).filter((item): item is InfraredRemote => item !== undefined),
    ...(typeof value.refreshFailed === "boolean" ? { refreshFailed: value.refreshFailed } : {})
  };
}

function settingsRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) return {};
  if (isRecord(value.settings)) return value.settings;
  return value;
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
  const remote = queryRequired<SdpiValueElement>("#remote");
  const operation = queryRequired<SdpiValueElement>("#operation");
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

  let remotes = new Map<string, InfraredRemote>();
  let suppressBodyChange = false;
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

  async function patchSettings(mutator: (settings: Record<string, unknown>) => void): Promise<void> {
    const settings = settingsRecord(await streamDeckClient.getSettings());
    mutator(settings);
    await streamDeckClient.setSettings(settings);
  }

  function emptyOverrides(settings: Record<string, unknown>): void {
    settings.overrides = {
      command: { enabled: false, value: "" },
      parameter: { enabled: false, value: "" },
      commandType: { enabled: false, value: "" }
    };
  }

  function clearOverridesAfterBodyChange(): void {
    if (suppressBodyChange) return;

    // sdpi-components 自身の設定保存と getSettings/setSettings を競合させないため、
    // 各コンポーネントの value だけを変更して通常の保存経路へ任せる。
    commandOverride.value = false;
    parameterOverride.value = false;
    typeOverride.value = false;
    commandValue.value = "";
    parameterValue.value = "";
    typeValue.value = "";
    typeModeInitialized = false;
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

  function generatedBody(): GeneratedBody {
    const info = selectedRemote();
    if (!info) {
      return { error: window.SwitchBotI18n?.t("Select an infrared remote.", "赤外線リモコンを選択してください。") ?? "Select an infrared remote." };
    }

    const selectedOperation = valueOf(operation);
    const command = selectedCommand();

    if (info.remoteType === "Others" || selectedOperation === "custom") {
      const name = valueOf(queryRequired<SdpiValueElement>("#custom-button")).trim();
      if (!name) {
        return { error: window.SwitchBotI18n?.t("Enter a custom button name.", "カスタムボタン名を入力してください。") ?? "Enter a custom button name." };
      }
      return { command: name, parameter: "default", commandType: "customize" };
    }

    if (!selectedOperation || !command) {
      return { error: window.SwitchBotI18n?.t("Select an operation.", "操作を選択してください。") ?? "Select an operation." };
    }

    if (command.parameterKind === "channel") {
      const channel = valueOf(queryRequired<SdpiValueElement>("#channel")).trim();
      if (!channel) {
        return { error: window.SwitchBotI18n?.t("Enter a channel.", "チャンネルを入力してください。") ?? "Enter a channel." };
      }
      return { command: selectedOperation, parameter: channel, commandType: "command" };
    }

    if (command.parameterKind === "air-conditioner") {
      const temperature = valueOf(queryRequired<SdpiValueElement>("#ac-temperature")).trim();
      if (!temperature || !Number.isFinite(Number(temperature))) {
        return { error: window.SwitchBotI18n?.t("Enter a valid temperature.", "有効な温度を入力してください。") ?? "Enter a valid temperature." };
      }
      return {
        command: selectedOperation,
        parameter: [
          temperature,
          valueOf(queryRequired<SdpiValueElement>("#ac-mode"), "2"),
          valueOf(queryRequired<SdpiValueElement>("#ac-fan"), "1"),
          valueOf(queryRequired<SdpiValueElement>("#ac-power"), "on")
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
        error: window.SwitchBotI18n?.t("Command type is required.", "Command type は必須です。")
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

    if (checked(typeOverride) && !typeModeInitialized) {
      const savedType = valueOf(typeValue);
      typeMode.value = ["command", "customize"].includes(savedType) ? savedType : "custom";
      typeModeInitialized = true;
    }
    if (!checked(typeOverride)) typeModeInitialized = false;

    overrideActive.hidden = !(checked(commandOverride) || checked(parameterOverride) || checked(typeOverride));

    const generated = generatedBody();
    if (!checked(commandOverride)) commandValue.value = generated.command ?? "";
    if (!checked(parameterOverride)) parameterValue.value = generated.parameter ?? "";
    if (!checked(typeOverride)) {
      typeValue.value = generated.commandType ?? "";
      typeMode.value = ["command", "customize"].includes(generated.commandType ?? "") ? generated.commandType ?? "" : "custom";
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

    // enabled は checkbox が保存するため、値側も sdpi-textfield の通常保存経路を利用する。
    field.value = enabled ? generatedValue : "";
    if (kind === "type") {
      typeModeInitialized = false;
      typeMode.value = ["command", "customize"].includes(generatedValue) ? generatedValue : "custom";
    }
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

      const settings = settingsRecord(await streamDeckClient.getSettings());
      const sameType = settings.remoteType === next.remoteType;
      suppressBodyChange = true;
      try {
        const storedOperation = typeof settings.operation === "string" ? settings.operation : "";
        const preservedOperation = sameType ? (savedOperation || storedOperation) : "";
        savedOperation = preservedOperation;
        setOperationOptions(next, preservedOperation);
        await patchSettings(current => {
          current.deviceId = valueOf(remote);
          current.remoteType = next.remoteType;
          current.operation = preservedOperation;
          emptyOverrides(current);
        });
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

      // 動的 select の自動保存と競合させず、ユーザー選択だけを明示保存する。
      await patchSettings(settings => {
        settings.operation = selectedOperation;
        emptyOverrides(settings);
      });

      clearOverridesAfterBodyChange();
      updateUi();
    })();
  });

  for (const id of ["custom-button", "channel", "ac-temperature", "ac-mode", "ac-fan", "ac-power"]) {
    const element = queryRequired<SdpiValueElement>(`#${id}`);
    element.addEventListener("valuechange", () => {
      clearOverridesAfterBodyChange();
      updateUi();
    });
    element.addEventListener("input", updateUi);
  }

  commandOverride.addEventListener("valuechange", () => enableOverride("command", checked(commandOverride)));
  parameterOverride.addEventListener("valuechange", () => enableOverride("parameter", checked(parameterOverride)));
  typeOverride.addEventListener("valuechange", () => enableOverride("type", checked(typeOverride)));

  typeMode.addEventListener("valuechange", () => {
    if (!checked(typeOverride)) return;
    const mode = valueOf(typeMode);
    if (mode !== "custom") {
      // commandType の実値は setting を持つ textfield に集約し、通常保存経路へ任せる。
      typeValue.value = mode;
    }
    updateUi();
  });

  for (const field of [commandValue, parameterValue, typeValue]) {
    field.addEventListener("input", updateUi);
    field.addEventListener("valuechange", updateUi);
  }

  streamDeckClient.sendToPropertyInspector.subscribe(event => {
    const payload = parsePayload(event.payload);
    if (!payload) return;

    void (async () => {
      remotes = new Map(payload.remotes.map(item => [item.value, item]));
      const settings = settingsRecord(await streamDeckClient.getSettings());
      const deviceId = typeof settings.deviceId === "string" ? settings.deviceId : "";
      const info = remotes.get(deviceId);

      suppressBodyChange = true;
      try {
        savedOperation = typeof settings.operation === "string" ? settings.operation : "";
        setOperationOptions(info, savedOperation);
      } finally {
        suppressBodyChange = false;
      }

      catalogStatus.textContent = payload.refreshFailed
        ? window.SwitchBotI18n?.t(
            "Refresh failed. Showing the saved catalog.",
            "更新に失敗しました。保存済みの一覧を表示しています。"
          ) ?? "Refresh failed. Showing the saved catalog."
        : "";
      updateUi();
    })();
  });

  updateUi();
  document.addEventListener("switchbot-locale-changed", () => {
    applyInfraredLocale();
    updateUi();
  });
});
