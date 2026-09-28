interface PendingConfirmation {
  operationKey: string;
  expiresAt: number;
}

/**
 * 危険操作の二度押し確認状態をAction instance単位で保持する。
 *
 * 1回目の押下ではAPI requestを送らず、同じ操作を期限内に再押下した場合だけ実行を許可する。
 * DeviceやOperationが変わった場合に以前の確認を流用しないよう、確認対象はoperationKeyで識別する。
 */
export class PhysicalControlConfirmationGate {
  private readonly pending = new Map<string, PendingConfirmation>();

  constructor(private readonly timeoutMs = 3_000) {}

  /** 指定操作が確認済みかを判定し、未確認なら今回の押下を確認待ちとして記録する。 */
  confirm(actionId: string, operationKey: string, now = Date.now()): "required" | "confirmed" {
    const current = this.pending.get(actionId);
    if (current && current.operationKey === operationKey && current.expiresAt >= now) {
      this.pending.delete(actionId);
      return "confirmed";
    }

    this.pending.set(actionId, { operationKey, expiresAt: now + this.timeoutMs });
    return "required";
  }

  /** Action消滅や設定変更時に、以前の確認状態を次の操作へ持ち越さない。 */
  clear(actionId: string): void {
    this.pending.delete(actionId);
  }
}
