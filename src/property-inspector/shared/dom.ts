/**
 * Property Inspector の HTML と TypeScript の不整合を早期に検出するため、
 * 必須要素が存在しない場合はその場で例外にする。
 */
export function queryRequired<T extends Element>(selector: string, root: ParentNode = document): T {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Required Property Inspector element was not found: ${selector}`);
  }
  return element;
}

/**
 * sdpi-components の value は型定義上広い値を取り得るため、
 * PI で文字列設定として扱う箇所だけを一か所で正規化する。
 */
export function valueOf(element: SdpiValueElement, fallback = ""): string {
  const value = element.value;
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return element.getAttribute("value") || fallback;
}

/**
 * sdpi-checkbox は native checkbox ではなく value に設定状態を保持するため、
 * checked 属性ではなく value を基準に判定する。
 */
export function checked(element: SdpiValueElement): boolean {
  return element.value === true || element.value === "true";
}


/**
 * Property Inspector内のsettings read-modify-writeを直列化する。
 *
 * SDKのgetSettings/setSettingsは部分更新ではないため、複数イベントが並行すると
 * 古い取得結果が後から保存され、新しい入力を巻き戻す可能性がある。
 */
export function createSettingsPatchQueue(
  streamDeckClient: { getSettings(): Promise<unknown>; setSettings(settings: Record<string, unknown>): Promise<unknown> }
): (mutator: (settings: Record<string, unknown>) => void) => Promise<void> {
  let queue = Promise.resolve();

  return mutator => {
    const update = queue.then(async () => {
      const value = await streamDeckClient.getSettings();
      const settings = typeof value === "object" && value !== null && !Array.isArray(value)
        ? { ...(value as Record<string, unknown>) }
        : {};
      mutator(settings);
      await streamDeckClient.setSettings(settings);
    });
    // 一度のSDKエラーで後続更新まで停止しないよう、内部キューだけ成功状態へ戻す。
    queue = update.catch(() => undefined);
    return update.then(() => undefined);
  };
}
