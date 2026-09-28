import { queryRequired } from "./dom.js";
import {
  parsePluginToPropertyInspectorMessage,
  type ExecutionDiagnosticsMessage
} from "../../protocol/property-inspector-protocol.js";

interface DiagnosticsClient {
  send(event: string, payload?: unknown): Promise<unknown> | void;
  sendToPropertyInspector: {
    subscribe(handler: (event: { payload?: unknown }) => void | Promise<void>): void;
  };
}

/**
 * Property Inspectorへ最新API実行結果の共通診断表示を接続する。
 *
 * Action固有UIから診断通信を分離し、今後追加するPhysical Controlでも同じ表示を再利用する。
 */
export function attachExecutionDiagnostics(streamDeckClient: DiagnosticsClient): void {
  const container = queryRequired<HTMLElement>("#execution-diagnostics");
  const heading = queryRequired<HTMLElement>("#execution-diagnostics-heading");
  const summary = queryRequired<HTMLElement>("#execution-diagnostics-summary");
  const response = queryRequired<HTMLElement>("#execution-diagnostics-response");

  let latestMessage: ExecutionDiagnosticsMessage | undefined;

  function render(message: ExecutionDiagnosticsMessage): void {
    latestMessage = message;
    heading.textContent = window.SwitchBotI18n?.t("Latest execution result", "最新の実行結果") ?? "Latest execution result";
    if (!message.available) {
      summary.textContent = window.SwitchBotI18n?.t("No execution result yet.", "まだ実行結果はありません。") ?? "No execution result yet.";
      response.textContent = "";
      container.hidden = false;
      return;
    }

    const lines = [
      `${message.success ? (window.SwitchBotI18n?.t("Success", "成功") ?? "Success") : (window.SwitchBotI18n?.t("Failed", "失敗") ?? "Failed")}: ${message.method} ${message.path}`,
      message.httpStatus !== undefined ? `HTTP: ${message.httpStatus}` : "",
      message.switchBotStatusCode !== undefined
        ? `SwitchBot: ${message.switchBotStatusCode}${message.switchBotMessage ? ` (${message.switchBotMessage})` : ""}`
        : "",
      message.errorCategory ? `Error: ${message.errorCategory}${message.errorMessage ? ` - ${message.errorMessage}` : ""}` : ""
    ].filter(Boolean);
    summary.textContent = lines.join("\n");
    response.textContent = message.responseBody ?? "";
    container.hidden = false;
  }

  streamDeckClient.sendToPropertyInspector.subscribe(event => {
    const message = parsePluginToPropertyInspectorMessage(event.payload);
    if (message?.event === "executionDiagnostics") render(message);
  });

  document.addEventListener("switchbot-locale-changed", () => {
    if (latestMessage) render(latestMessage);
  });

  void streamDeckClient.send("sendToPlugin", { event: "getExecutionDiagnostics" });
}
