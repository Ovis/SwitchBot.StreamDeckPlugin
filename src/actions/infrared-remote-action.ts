import streamDeck, { action, type KeyDownEvent, type WillDisappearEvent } from "@elgato/streamdeck";
import type { RequestExecutor } from "../execution/request-executor.js";
import type { ExecutionDiagnosticsStore } from "../execution/execution-diagnostics-store.js";
import type { ExecutionRequest } from "../execution/execution-request.js";
import type { OutputProcessor } from "../output/output-processor.js";
import type { DeviceCatalogStore } from "../settings/device-catalog-store.js";
import type { CatalogRefreshService } from "../services/catalog-refresh-service.js";
import type { GlobalSettingsStore } from "../settings/global-settings-store.js";
import { AuthenticatedAction } from "./authenticated-action.js";
import { propertyInspectorMessage } from "../settings/property-inspector-messages.js";
import { parsePropertyInspectorToPluginMessage } from "../protocol/property-inspector-protocol.js";
import { normalizeInfraredRemoteSettings, type InfraredRemoteSettingsV1 } from "../settings/infrared-remote-settings.js";
import { buildInfraredRequest, truncateInfraredDisplayText } from "../api/infrared-request-builder.js";
import { displayLocale, type DisplayLocale } from "../output/status-title-formatter.js";
import { infraredCommandPropertyInspectorData } from "../api/infrared-remote-commands.js";
import type { InfraredRemotesResultMessage } from "../protocol/property-inspector-protocol.js";
import { ActionInstanceFifo } from "../execution/action-instance-fifo.js";

interface QueuedCommand {
  request: ExecutionRequest;
  settings: InfraredRemoteSettingsV1;
  displayText: string;
  action: KeyDownEvent<InfraredRemoteSettingsV1>["action"];
}

const MAX_QUEUED_COMMANDS = 5;
const TEMPORARY_TITLE_MS = 3_000;

@action({ UUID: "com.esheep.switchbot.infrared-remote" })
export class InfraredRemoteAction extends AuthenticatedAction {
  private readonly locale: DisplayLocale;
  private readonly commandQueue: ActionInstanceFifo<QueuedCommand>;
  private readonly restoreTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly executor: RequestExecutor,
    private readonly output: OutputProcessor,
    private readonly catalogStore: DeviceCatalogStore,
    private readonly catalogRefresh: CatalogRefreshService,
    globalSettings: GlobalSettingsStore,
    executionDiagnostics: ExecutionDiagnosticsStore,
    locale?: string
  ) {
    super(executor, globalSettings, executionDiagnostics);
    this.locale = displayLocale(locale);
    this.commandQueue = new ActionInstanceFifo(
      MAX_QUEUED_COMMANDS,
      (actionId, item, isDisposed) => this.executeQueuedCommand(actionId, item, isDisposed),
      (actionId, error) => {
        streamDeck.logger.error("Infrared Remote queue item failed unexpectedly", {
          actionId,
          errorName: error instanceof Error ? error.name : "UnknownError"
        });
      }
    );
  }

  override async onSendToPlugin(value: unknown): Promise<void> {
    const ev = propertyInspectorMessage(value);
    const request = parsePropertyInspectorToPluginMessage(ev.payload);
    if (request?.event !== "getInfraredRemotes") {
      await super.onSendToPlugin(value);
      return;
    }

    const refresh = request.isRefresh === true;
    const result = refresh
      ? await this.catalogRefresh.refreshDevices()
      : { catalog: await this.catalogStore.get(), refreshed: true };
    const actionInstance = typeof ev.context === "string" ? streamDeck.actions.getActionById(ev.context) : undefined;
    const settings = actionInstance
      ? normalizeInfraredRemoteSettings(await actionInstance.getSettings())
      : normalizeInfraredRemoteSettings({});

    streamDeck.logger.info("Infrared Remote PI catalog requested", {
      actionId: typeof ev.context === "string" ? ev.context : undefined,
      deviceId: settings.deviceId,
      remoteType: settings.remoteType,
      operation: settings.operation
    });

    const remotes = (result.catalog?.infraredRemotes ?? [])
      .filter(remote => !remote.deleted || remote.deviceId === settings.deviceId)
      .map(remote => ({
        label: remoteLabel(remote.deviceName, remote.remoteType, remote.deviceId, remote.deleted, this.locale),
        value: remote.deviceId,
        remoteType: remote.remoteType,
        hubDeviceId: remote.hubDeviceId,
        commands: infraredCommandPropertyInspectorData(remote.remoteType, this.locale)
      }));

    const message: InfraredRemotesResultMessage = {
      event: "getInfraredRemotes",
      items: remotes.map(({ label, value }) => ({ label, value })),
      remotes,
      refreshFailed: refresh && !result.refreshed
    };
    await streamDeck.ui.sendToPropertyInspector({ ...message });
  }

  override async onKeyDown(ev: KeyDownEvent<InfraredRemoteSettingsV1>): Promise<void> {
    const settings = normalizeInfraredRemoteSettings(await ev.action.getSettings());
    const built = buildInfraredRequest(settings);

    if (!built.request || !built.displayText) {
      this.clearTemporaryTitle(ev.action.id);
      streamDeck.logger.info("Infrared Remote command was not sent", {
        category: "configuration",
        reason: built.error ?? "invalid-request"
      });
      await this.restoreNormalTitle(ev.action);
      await ev.action.showAlert();
      return;
    }

    const enqueueResult = this.commandQueue.enqueue(ev.action.id, {
      request: built.request,
      settings,
      displayText: truncateInfraredDisplayText(built.displayText),
      action: ev.action
    });
    if (enqueueResult === "full") {
      this.clearTemporaryTitle(ev.action.id);
      streamDeck.logger.warn("Infrared Remote command queue is full", {
        actionId: ev.action.id,
        limit: MAX_QUEUED_COMMANDS
      });
      await this.restoreNormalTitle(ev.action);
      await ev.action.showAlert();
    }
  }

  override onWillDisappear(ev: WillDisappearEvent<InfraredRemoteSettingsV1>): void {
    this.commandQueue.dispose(ev.action.id);
    this.clearTemporaryTitle(ev.action.id);
  }

  private async executeQueuedCommand(
    actionId: string,
    item: QueuedCommand,
    isDisposed: () => boolean
  ): Promise<void> {
    const result = await this.executor.execute(item.request);
    this.recordExecutionDiagnostics(actionId, result);

    if (!result.success) {
      streamDeck.logger.error("Infrared Remote command failed", {
        category: result.error.category,
        method: result.request.method,
        path: result.request.path,
        httpStatus: result.response?.httpStatus,
        switchBotStatus: result.response?.switchBot?.statusCode
      });
      if (!isDisposed()) {
        this.clearTemporaryTitle(actionId);
        await this.restoreNormalTitle(item.action);
      }
    }

    if (isDisposed()) return;

    const succeeded = await this.output.process(result, {
      copyResponseToClipboard: item.settings.output.copyResponseToClipboard,
      prettyPrint: item.settings.output.prettyPrint
    }, item.action);

    if (succeeded && item.settings.output.showOperationOnKey) {
      this.clearTemporaryTitle(actionId);
      await item.action.setTitle(item.displayText);
      this.restoreTimers.set(actionId, setTimeout(() => {
        this.restoreTimers.delete(actionId);
        void this.restoreNormalTitle(item.action);
      }, TEMPORARY_TITLE_MS));
    } else if (!succeeded) {
      this.clearTemporaryTitle(actionId);
      await this.restoreNormalTitle(item.action);
    }
  }

  private clearTemporaryTitle(actionId: string): void {
    const timer = this.restoreTimers.get(actionId);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.restoreTimers.delete(actionId);
    }
  }

  private async restoreNormalTitle(actionInstance: QueuedCommand["action"]): Promise<void> {
    try {
      // 引数なしの setTitle はプラグインによる一時上書きを解除し、
      // Stream Deck 側でユーザーが設定している現在のタイトルへ戻すために使用する。
      await actionInstance.setTitle();
    } catch (error) {
      streamDeck.logger.warn("Failed to restore Infrared Remote title", {
        errorName: error instanceof Error ? error.name : "UnknownError"
      });
    }
  }
}

function remoteLabel(name: string, remoteType: string, id: string, deleted: boolean, locale: DisplayLocale): string {
  const base = name.trim() ? `${name} (${remoteType || id})` : (remoteType ? `${remoteType} (${id})` : id);
  if (!deleted) return base;
  return locale === "ja" ? `${base} [削除済み]` : `${base} [Deleted]`;
}
