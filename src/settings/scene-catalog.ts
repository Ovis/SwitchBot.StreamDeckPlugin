import { z } from "zod";

const SceneSchema = z.object({
  sceneId: z.string(),
  sceneName: z.string().catch(""),
  lastSeenAt: z.string().optional().default(""),
  deleted: z.boolean().catch(false).default(false)
});

export const SceneCatalogSchema = z.object({
  fetchedAt: z.string(),
  scenes: z.array(SceneSchema)
});

export type SceneCatalog = z.infer<typeof SceneCatalogSchema>;

export function sceneCatalogFromResponse(body: unknown, fetchedAt: string): SceneCatalog | undefined {
  if (!isRecord(body) || !Array.isArray(body.body)) return undefined;
  const scenes = z.array(SceneSchema).safeParse(body.body);
  if (!scenes.success) return undefined;
  return {
    fetchedAt,
    scenes: scenes.data.map(scene => ({ ...scene, lastSeenAt: fetchedAt, deleted: false }))
  };
}

export function mergeSceneCatalog(previous: SceneCatalog | undefined, latest: SceneCatalog): SceneCatalog {
  const latestById = new Map(latest.scenes.map(scene => [scene.sceneId, scene]));
  const scenes = latest.scenes.map(scene => ({ ...scene, deleted: false }));
  for (const old of previous?.scenes ?? []) {
    if (!latestById.has(old.sceneId)) scenes.push({ ...old, deleted: true });
  }
  return { fetchedAt: latest.fetchedAt, scenes };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
