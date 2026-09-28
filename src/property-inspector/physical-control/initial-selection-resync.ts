/**
 * PI初期表示時に、保存済みDeviceを指定したcatalog再要求が必要か判定する。
 *
 * Stream Deck SDKではPI起動直後のPlugin側settings復元が最初のcatalog要求に間に合わない場合がある。
 * 応答がどのDevice向けに生成されたかを照合し、同一Deviceへの再要求は一度だけに制限する。
 */
export function shouldResyncInitialSelection(
  selectedDeviceId: string,
  availableDeviceIds: readonly string[],
  responseDeviceId: string,
  retriedDeviceId: string
): boolean {
  return selectedDeviceId !== ""
    && availableDeviceIds.includes(selectedDeviceId)
    && responseDeviceId !== selectedDeviceId
    && retriedDeviceId !== selectedDeviceId;
}
