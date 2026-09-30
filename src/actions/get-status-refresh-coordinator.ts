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
    void request.finally(() => {
      if (this.inFlight.get(actionId)?.request === request) this.inFlight.delete(actionId);
    });
    return request;
  }
}
\nexport interface RefreshRelevantSettings {\n  deviceId: string;\n  output: { showStatusOnKey: boolean; refreshIntervalMinutes: number };\n}\n\n/** API取得周期を作り直す必要がある設定変更だけを判定する。 */\nexport function hasRefreshConfigurationChanged(previous: RefreshRelevantSettings | undefined, current: RefreshRelevantSettings): boolean {\n  return !previous\n    || previous.deviceId.trim() !== current.deviceId.trim()\n    || previous.output.showStatusOnKey !== current.output.showStatusOnKey\n    || previous.output.refreshIntervalMinutes !== current.output.refreshIntervalMinutes;\n}\n