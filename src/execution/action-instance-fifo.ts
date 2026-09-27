interface QueueState<T> {
  running: boolean;
  disposed: boolean;
  items: T[];
}

export type EnqueueResult = "accepted" | "full";

/**
 * Action instanceごとにコマンドを直列化するFIFOキュー。
 *
 * SwitchBotへの短時間の並列送信を避けつつ、キー連打は指定上限まで保持する。
 * dispose後は待機中の項目を破棄するが、既に開始した処理は中断しない。
 */
export class ActionInstanceFifo<T> {
  private readonly queues = new Map<string, QueueState<T>>();

  constructor(
    private readonly maxInFlightAndQueued: number,
    private readonly execute: (actionId: string, item: T, isDisposed: () => boolean) => Promise<void>
  ) {
    if (!Number.isInteger(maxInFlightAndQueued) || maxInFlightAndQueued < 1) {
      throw new Error("Queue limit must be a positive integer.");
    }
  }

  /**
   * 指定Action instanceへ項目を追加する。
   *
   * 上限は実行中の1件を含むため、running中は待機可能件数が1件少なくなる。
   */
  enqueue(actionId: string, item: T): EnqueueResult {
    const queue = this.getQueue(actionId);
    const inFlightAndQueued = queue.items.length + (queue.running ? 1 : 0);
    if (inFlightAndQueued >= this.maxInFlightAndQueued) return "full";

    queue.items.push(item);
    if (!queue.running) void this.process(actionId, queue);
    return "accepted";
  }

  /**
   * Action instanceを破棄し、まだ開始していない項目をすべて取り除く。
   */
  dispose(actionId: string): void {
    const queue = this.queues.get(actionId);
    if (!queue) return;

    queue.disposed = true;
    queue.items.length = 0;
    if (!queue.running) this.queues.delete(actionId);
  }

  private getQueue(actionId: string): QueueState<T> {
    const existing = this.queues.get(actionId);
    if (existing && !existing.disposed) return existing;

    const created: QueueState<T> = { running: false, disposed: false, items: [] };
    this.queues.set(actionId, created);
    return created;
  }

  private async process(actionId: string, queue: QueueState<T>): Promise<void> {
    queue.running = true;
    try {
      while (!queue.disposed && queue.items.length > 0) {
        const item = queue.items.shift();
        if (item === undefined) continue;

        // 個々の処理失敗で後続コマンドを失わないよう、例外はこの項目だけで閉じる。
        try {
          await this.execute(actionId, item, () => queue.disposed);
        } catch {
          // 呼び出し側の処理が例外を投げてもFIFO自体は次の項目を継続する。
        }
      }
    } finally {
      queue.running = false;
      if (queue.disposed || queue.items.length === 0) this.queues.delete(actionId);
    }
  }
}
