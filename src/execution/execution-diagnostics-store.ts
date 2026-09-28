import type { ExecutionResult } from "./execution-result.js";

/**
 * Action instanceごとの最新API実行結果をメモリ内だけで保持する。
 *
 * 認証情報や永続設定へ診断情報を混在させないため、Stream Deck再起動時には破棄する。
 */
export class ExecutionDiagnosticsStore {
  private readonly latestResults = new Map<string, ExecutionResult>();

  /** 指定Action instanceの最新結果を記録する。 */
  set(actionId: string, result: ExecutionResult): void {
    this.latestResults.set(actionId, result);
  }

  /** 指定Action instanceの最新結果を返す。未実行ならundefinedを返す。 */
  get(actionId: string): ExecutionResult | undefined {
    return this.latestResults.get(actionId);
  }
}
