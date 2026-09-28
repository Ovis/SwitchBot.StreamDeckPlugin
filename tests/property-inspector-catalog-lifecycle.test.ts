import { describe, expect, it, vi } from "vitest";
import { loadPropertyInspectorCatalog } from "../src/services/property-inspector-catalog-lifecycle.js";

describe("Property Inspector catalog lifecycle", () => {
  it("cacheがあれば通常表示ではrefreshしない", async () => {
    const refresh = vi.fn(async () => ({ catalog: { id: "new" }, refreshed: true }));
    const result = await loadPropertyInspectorCatalog({
      isRefresh: false,
      loadCached: async () => ({ id: "cached" }),
      refresh
    });
    expect(result).toEqual({ catalog: { id: "cached" }, refreshFailed: false });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("cacheがない初回表示では自動refreshする", async () => {
    const refresh = vi.fn(async () => ({ catalog: { id: "new" }, refreshed: true }));
    const result = await loadPropertyInspectorCatalog({
      isRefresh: false,
      loadCached: async () => undefined,
      refresh
    });
    expect(result).toEqual({ catalog: { id: "new" }, refreshFailed: false });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("明示refreshはcacheの有無にかかわらずrefreshする", async () => {
    const loadCached = vi.fn(async () => ({ id: "cached" }));
    const result = await loadPropertyInspectorCatalog({
      isRefresh: true,
      loadCached,
      refresh: async () => ({ catalog: { id: "new" }, refreshed: true })
    });
    expect(result).toEqual({ catalog: { id: "new" }, refreshFailed: false });
    expect(loadCached).not.toHaveBeenCalled();
  });

  it("初回自動refresh失敗をPIへ通知する", async () => {
    const result = await loadPropertyInspectorCatalog({
      isRefresh: false,
      loadCached: async () => undefined,
      refresh: async () => ({ catalog: undefined, refreshed: false })
    });
    expect(result).toEqual({ catalog: undefined, refreshFailed: true });
  });
});
