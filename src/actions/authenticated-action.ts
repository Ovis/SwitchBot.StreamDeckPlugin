import streamDeck, { SingletonAction, type WillDisappearEvent  } from "@elgato/streamdeck";
import type { RequestExecutor } from "../execution/request-executor.js";
import type { ExecutionResult } from "../execution/execution-result.js";
import type { ExecutionDiagnosticsStore } from "../execution/execution-diagnostics-store.js";
import { executionDiagnosticsView } from "../execution/execution-diagnostics.js";
import type { GlobalSettingsStore } from "../settings/global-settings-store.js";
import { parsePropertyInspectorToPluginMessage } from "../protocol/property-inspector-protocol.js";
import type {
  PropertyInspectorCredentials,
  TestConnectionResultMessage,
  ExecutionDiagnosticsMessage
} from "../protocol/property-inspector-protocol.js";

export type PropertyInspectorEvent = Parameters<NonNullable<SingletonAction["onSendToPlugin"]>>[0];

export abstract class AuthenticatedAction extends SingletonAction<any> {
  protected constructor(
    private readonly authExecutor: RequestExecutor,
    private readonly globalSettings: GlobalSettingsStore,
    private readonly executionDiagnostics: ExecutionDiagnosticsStore
  ) {
    super();
  }

  override async onSendToPlugin(ev: PropertyInspectorEvent): Promise<void> {
    const message = parsePropertyInspectorToPluginMessage(ev.payload);

    if (message?.event === "getExecutionDiagnostics") {
      const actionId = ev.action.id;
      const result = this.executionDiagnostics.get(actionId);
      const response: ExecutionDiagnosticsMessage = result
        ? { event: "executionDiagnostics", available: true, ...executionDiagnosticsView(result) }
        : { event: "executionDiagnostics", available: false };
      await streamDeck.ui.sendToPropertyInspector({ ...response });
      return;
    }

    if (message?.event === "saveCredentials") {
      await this.saveCredentials(message.credentials);
      return;
    }

    if (message?.event !== "testConnection") return;

    await this.saveCredentials(message.credentials);

    const result = await this.authExecutor.execute({ method: "GET", path: "/v1.1/devices" });
    if (!result.success) {
      streamDeck.logger.error("Test Connection failed", {
        category: result.error.category,
        httpStatus: result.response?.httpStatus,
        switchBotStatus: result.response?.switchBot?.statusCode
      });
    }

    const response: TestConnectionResultMessage = {
      event: "testConnectionResult",
      success: result.success,
      ...(!result.success ? { errorCategory: result.error.category } : {})
    };
    await streamDeck.ui.sendToPropertyInspector({ ...response });
  }

  /**
   * Actionが画面から消えた時点で、そのinstance専用の診断結果を破棄する。
   *
   * 診断情報にはAPIレスポンス本文を含むため、削除済みActionの結果を
   * プラグイン終了まで保持し続けないようライフサイクルに合わせて解放する。
   */
  override onWillDisappear(ev: WillDisappearEvent<any>): void {
    this.executionDiagnostics.delete(ev.action.id);
  }

  /** Action instanceの最新実行結果をPI診断表示用に記録する。 */
  protected recordExecutionDiagnostics(actionId: string, result: ExecutionResult): void {
    this.executionDiagnostics.set(actionId, result);
    const message: ExecutionDiagnosticsMessage = {
      event: "executionDiagnostics",
      available: true,
      ...executionDiagnosticsView(result)
    };
    // sendToPropertyInspectorは現在表示中のPI宛てなので、別Actionの結果を誤表示しないよう
    // 現在のPIがこのAction instanceを編集している場合だけpushする。
    if (streamDeck.ui.action?.id === actionId) {
      void streamDeck.ui.sendToPropertyInspector({ ...message }).catch(error => {
        streamDeck.logger.warn("Failed to send execution diagnostics to Property Inspector", {
          actionId,
          errorName: error instanceof Error ? error.name : "UnknownError"
        });
      });
    }
  }

  private async saveCredentials(credentials: PropertyInspectorCredentials): Promise<void> {
    await this.globalSettings.update(current => ({
      ...current,
      version: 1,
      credentials
    }));
  }
}
