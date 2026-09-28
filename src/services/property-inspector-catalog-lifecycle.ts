export interface PropertyInspectorCatalogLoadResult<T> {
  catalog: T | undefined;
  refreshFailed: boolean;
}

export interface PropertyInspectorCatalogLifecycleOptions<T> {
  isRefresh: boolean;
  loadCached: () => Promise<T | undefined>;
  refresh: () => Promise<{ catalog: T | undefined; refreshed: boolean }>;
}

/**
 * Property Inspectorから要求されたcatalogの取得方針を共通化する。
 *
 * 明示refreshではAPI取得を行い、通常表示では最後に成功したcacheを優先する。
 * cacheがまだ存在しない初回表示だけ自動refreshし、失敗時は利用可能な最後のcatalogを保持する。
 */
export async function loadPropertyInspectorCatalog<T>(
  options: PropertyInspectorCatalogLifecycleOptions<T>
): Promise<PropertyInspectorCatalogLoadResult<T>> {
  if (options.isRefresh) {
    const result = await options.refresh();
    return { catalog: result.catalog, refreshFailed: !result.refreshed };
  }

  const cached = await options.loadCached();
  if (cached !== undefined) return { catalog: cached, refreshFailed: false };

  const result = await options.refresh();
  return { catalog: result.catalog, refreshFailed: !result.refreshed };
}
