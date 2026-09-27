import { describe, expect, it } from "vitest";
import { mergeSceneCatalog, sceneCatalogFromResponse } from "../src/settings/scene-catalog.js";

describe("scene catalog", () => {
  it("extracts scenes from a SwitchBot response", () => {
    expect(sceneCatalogFromResponse({ statusCode: 100, body: [{ sceneId: "S1", sceneName: "おやすみ" }] }, "now")).toEqual({
      fetchedAt: "now",
      scenes: [{ sceneId: "S1", sceneName: "おやすみ", lastSeenAt: "now", deleted: false }]
    });
  });

  it("soft-deletes missing scenes and restores them when seen again", () => {
    const first = sceneCatalogFromResponse({ body: [{ sceneId: "S1", sceneName: "Old" }] }, "first")!;
    const empty = sceneCatalogFromResponse({ body: [] }, "second")!;
    const missing = mergeSceneCatalog(first, empty);
    expect(missing.scenes[0]).toMatchObject({ sceneId: "S1", deleted: true, lastSeenAt: "first" });
    const restored = mergeSceneCatalog(missing, sceneCatalogFromResponse({ body: [{ sceneId: "S1", sceneName: "New" }] }, "third")!);
    expect(restored.scenes[0]).toEqual({ sceneId: "S1", sceneName: "New", lastSeenAt: "third", deleted: false });
  });

  it("rejects a non-array scene response", () => {
    expect(sceneCatalogFromResponse({ body: {} }, "now")).toBeUndefined();
  });
});
