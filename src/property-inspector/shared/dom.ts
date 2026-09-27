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
