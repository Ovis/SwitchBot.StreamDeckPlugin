import streamDeck, { action, type KeyDownEvent, type WillDisappearEvent } from "@elgato/streamdeck";
import type { RequestExecutor } from "../execution/request-executor.js";
import type { ExecutionRequest } from "../execution/execution-request.js";
import type { OutputProcessor } from "../output/output-processor.js";
import type { DeviceCatalogStore } from "../settings/device-catalog-store.js";
import type { CatalogRefreshService } from "../services/catalog-refresh-service.js";
import type { GlobalSettingsStore } from "../settings/global-settings-store.js";
import { AuthenticatedAction } from "./authenticated-action.js";
import { propertyInspectorMessage } from "../settings/property-inspector-messages.js";
import { normalizeInfraredRemoteSettings, type InfraredRemoteSettingsV1 } from "../settings/infrared-remote-settings.js";
import { buildInfraredRequest, truncateInfraredDisplayText } from "../api/infrared-request-builder.js";
import { displayLocale, type DisplayLocale } from "../output/status-title-formatter.js";
import { infraredCommandPropertyInspectorData } from "../api/infrared-remote-commands.js";

interface QueuedCommand {
  request: ExecutionRequest;
  settings: InfraredRemoteSettingsV1;
  displayText: string;
  action: KeyDownEvent<InfraredRemoteSettingsV1>["action"];
}

interface ActionQueue {
  running: boolean;
  disposed: boolean;
  items: QueuedCommand[];
}

const MAX_QUEUED_COMMANDS = 5;
const TEMPORARY_TITLE_MS = 3_000;

@action({ UUID: "com.esheep.switchbot.infrared-remote" })
export class InfraredRemoteAction extends AuthenticatedAction {
  private readonly locale: DisplayLocale;
  private readonly queues = new Map<string, ActionQueue>();
  private readonly restoreTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly executor: RequestExecutor,
    private readonly output: OutputProcessor,
    private readonly catalogStore: DeviceCatalogStore,
    private readonly catalogRefresh: CatalogRefreshService,
    globalSettings: GlobalSettingsStore,
    locale?: string
  ) {
    super(executor, globalSettings);
    this.locale = displayLocale(locale);
  }

  override async onSendToPlugin(value: unknown): Promise<void> {
    const ev = propertyInspectorMessage(value);
    if (ev.payload?.event !== "getInfraredRemotes") {
      await super.onSendToPlugin(value);
      return;
    }

    const refresh = ev.payload.isRefresh === true;
    const result = refresh
      ? await this.catalogRefresh.refreshDevices()
      : { catalog: await this.catalogStore.get(), refreshed: true };
    const actionInstance = typeof ev.context === "string" ? streamDeck.actions.getActionById(ev.context) : undefined;
    const settings = actionInstance
      ? normalizeInfraredRemoteSettings(await actionInstance.getSettings())
      : normalizeInfraredRemoteSettings({});

    const remotes = (result.catalog?.infraredRemotes ?? [])
      .filter(remote => !remote.deleted || remote.deviceId === settings.deviceId)
      .map(remote => ({
        label: remoteLabel(remote.deviceName, remote.remoteType, remote.deviceId, remote.deleted, this.locale),
        value: remote.deviceId,
        remoteType: remote.remoteType,
        hubDeviceId: remote.hubDeviceId,
        commands: infraredCommandPropertyInspectorData(remote.remoteType, this.locale)
      }));

    await streamDeck.ui.sendToPropertyInspector({
      event: "getInfraredRemotes",
      items: remotes.map(({ label, value }) => ({ label, value })),
      remotes,
      refreshFailed: refresh && !result.refreshed
    });
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

    const queue = this.getQueue(ev.action.id);
    const inFlightAndQueued = queue.items.length + (queue.running ? 1 : 0);
    if (inFlightAndQueued >= MAX_QUEUED_COMMANDS) {
      this.clearTemporaryTitle(ev.action.id);
      streamDeck.logger.warn("Infrared Remote command queue is full", {
        actionId: ev.action.id,
        limit: MAX_QUEUED_COMMANDS
      });
      await this.restoreNormalTitle(ev.action);
      await ev.action.showAlert();
      return;
    }

    queue.items.push({
      request: built.request,
      settings,
      displayText: truncateInfraredDisplayText(built.displayText),
      action: ev.action
    });
    if (!queue.running) void this.processQueue(ev.action.id, queue);
  }

  override onWillDisappear(ev: WillDisappearEvent<InfraredRemoteSettingsV1>): void {
    const queue = this.queues.get(ev.action.id);
    if (queue) {
      queue.disposed = true;
      queue.items.length = 0;
      if (!queue.running) this.queues.delete(ev.action.id);
    }
    this.clearTemporaryTitle(ev.action.id);
  }

  private getQueue(actionId: string): ActionQueue {
    const existing = this.queues.get(actionId);
    if (existing && !existing.disposed) return existing;
    const created: ActionQueue = { running: false, disposed: false, items: [] };
    this.queues.set(actionId, created);
    return created;
  }

  private async processQueue(actionId: string, queue: ActionQueue): Promise<void> {
    queue.running = true;
    try {
      while (!queue.disposed && queue.items.length > 0) {
        const item = queue.items.shift();
        if (!item) continue;
        await this.executeQueuedCommand(actionId, queue, item);
      }
    } finally {
      queue.running = false;
      if (queue.disposed || queue.items.length === 0) this.queues.delete(actionId);
    }
  }

  private async executeQueuedCommand(actionId: string, queue: ActionQueue, item: QueuedCommand): Promise<void> {
    const result = await this.executor.execute(item.request);

    if (!result.success) {
      streamDeck.logger.error("Infrared Remote command failed", {
        category: result.error?.category,
        method: result.request.method,
        path: result.request.path,
        httpStatus: result.response?.httpStatus,
        switchBotStatus: result.response?.switchBot?.statusCode
      });
      if (!queue.disposed) {
        this.clearTemporaryTitle(actionId);
        await this.restoreNormalTitle(item.action);
      }
    }

    if (queue.disposed) return;

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
