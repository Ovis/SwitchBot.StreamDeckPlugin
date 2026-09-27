interface SdpiEvent<TPayload = unknown> {
  payload?: TPayload;
}

interface SdpiEventManager<TPayload = unknown> {
  subscribe(handler: (event: SdpiEvent<TPayload>) => void | Promise<void>): void;
}

interface SdpiStreamDeckClient {
  readonly sendToPropertyInspector: SdpiEventManager;
  getSettings(): Promise<unknown>;
  setSettings(settings: unknown): Promise<void>;
  getGlobalSettings(): Promise<unknown>;
  send(event: string, payload?: unknown): Promise<unknown> | void;
}

interface SdpiI18n {
  locales: Record<string, Record<string, string>>;
  language: string;
}

interface SdpiComponentsGlobal {
  readonly streamDeckClient: SdpiStreamDeckClient;
  readonly i18n: SdpiI18n;
}

interface SdpiValueElement extends HTMLElement {
  value: unknown;
  disabled?: boolean;
  updateComplete?: Promise<unknown>;
}

interface SwitchBotI18nApi {
  readonly locale: "en" | "ja";
  t(en: string, ja: string): string;
  refreshSdpiLocalization(): void;
}

type ConnectElgatoStreamDeckSocket = (
  port: string,
  uuid: string,
  event: string,
  info: string,
  actionInfo?: string
) => void;

declare const SDPIComponents: SdpiComponentsGlobal;

interface Window {
  SwitchBotI18n?: SwitchBotI18nApi;
  connectElgatoStreamDeckSocket?: ConnectElgatoStreamDeckSocket;
}

interface HTMLElementTagNameMap {
  "sdpi-select": SdpiValueElement;
  "sdpi-textfield": SdpiValueElement;
  "sdpi-textarea": SdpiValueElement;
  "sdpi-checkbox": SdpiValueElement;
  "sdpi-password": SdpiValueElement;
  "sdpi-button": SdpiValueElement;
}
