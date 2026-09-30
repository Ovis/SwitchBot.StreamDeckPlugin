/**
 * Get Statusキーごとの自動更新状態を管理する。
 *
 * Action本体からタイマー・generation・in-flight共有を分離し、
 * 画面遷移やDevice変更時の競合規則を単体テストできるようにする。
 */
export class GetStatusRefreshCoordinator<T> {
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly inFlight = new Map<string, { deviceId: string; request: Promise<T> }>();
  private readonly generations = new Map<string, number>();

  currentGeneration(actionId: string): number {
    return this.generations.get(actionId) ?? 0;
  }

  nextGeneration(actionId: string): number {
    const next = this.currentGeneration(actionId) + 1;
    this.generations.set(actionId, next);
    return next;
  }

  schedule(actionId: string, delayMs: number, generation: number, callback: () => void): void {
    this.clearTimer(actionId);
    if (generation !== this.currentGeneration(actionId)) return;

    this.timers.set(actionId, setTimeout(() => {
      this.timers.delete(actionId);
      if (generation === this.currentGeneration(actionId)) callback();
    }, delayMs));
  }

  clearTimer(actionId: string): void {
    const timer = this.timers.get(actionId);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.timers.delete(actionId);
    }
  }

  getOrStart(actionId: string, deviceId: string, start: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(actionId);
    // Device変更時は旧Deviceのリクエストを共有しない。旧結果の表示反映はgeneration側で抑止する。
    if (existing?.deviceId === deviceId) return existing.request;

    const request = start();
    this.inFlight.set(actionId, { deviceId, request });
    const cleanup = (): void => {
      if (this.inFlight.get(actionId)?.request === request) this.inFlight.delete(actionId);
    };
    // finally()が返す別Promiseを破棄すると、requestがrejectした場合に未処理rejectionを
    // 生成し得るため、成功・失敗の両経路をthenで明示的にcleanupする。
    void request.then(cleanup, cleanup);
    return request;
  }
}

export interface RefreshRelevantSettings {
  deviceId: string;
  output: { showStatusOnKey: boolean; refreshIntervalMinutes: number };
}

/** API取得周期を作り直す必要がある設定変更だけを判定する。 */
export function hasRefreshConfigurationChanged(
  previous: RefreshRelevantSettings | undefined,
  current: RefreshRelevantSettings
): boolean {
  return !previous
    || previous.deviceId.trim() !== current.deviceId.trim()
    || previous.output.showStatusOnKey !== current.output.showStatusOnKey
    || previous.output.refreshIntervalMinutes !== current.output.refreshIntervalMinutes;
}


export type RefreshSettingsTransition = "unchanged" | "restore" | "schedule" | "refresh-now";

/**
 * 設定変更時にGet Status表示をどう遷移させるかを判定する。
 *
 * 更新間隔だけを変更した場合はAPIを即時実行せず、新しい間隔の経過を待つ。
 * 手動のみに戻す、または表示を無効化した場合はStatus表示を即座に解除する。
 */
export function refreshSettingsTransition(
  previous: RefreshRelevantSettings | undefined,
  current: RefreshRelevantSettings
): RefreshSettingsTransition {
  if (!hasRefreshConfigurationChanged(previous, current)) return "unchanged";
  if (current.output.refreshIntervalMinutes === 0 || !current.output.showStatusOnKey) return "restore";
  if (!previous) return "refresh-now";

  const intervalChanged = previous.output.refreshIntervalMinutes !== current.output.refreshIntervalMinutes;
  const deviceChanged = previous.deviceId.trim() !== current.deviceId.trim();
  const displayEnabledChanged = previous.output.showStatusOnKey !== current.output.showStatusOnKey;

  return intervalChanged && !deviceChanged && !displayEnabledChanged ? "schedule" : "refresh-now";
}
