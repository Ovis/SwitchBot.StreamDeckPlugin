import { describe, expect, it, vi } from "vitest";
import { createSettingsPatchQueue } from "../src/property-inspector/shared/dom.js";

describe("createSettingsPatchQueue", () => {
  it.each([
    [{ first: "old" }],
    [{ settings: { first: "old" } }]
  ])("updates both direct and wrapped getSettings responses without persisting the wrapper", async response => {
    const setSettings = vi.fn(async (_settings: Record<string, unknown>) => undefined);
    const patch = createSettingsPatchQueue({
      getSettings: async () => response,
      setSettings
    });

    await patch(settings => {
      settings.first = "new";
    });

    expect(setSettings).toHaveBeenCalledWith({ first: "new" });
  });

  it("serializes read-modify-write updates so a later patch sees the preceding saved value", async () => {
    let saved: Record<string, unknown> = { first: 0, second: 0 };
    let releaseFirstRead: (() => void) | undefined;
    const firstReadGate = new Promise<void>(resolve => { releaseFirstRead = resolve; });
    let reads = 0;

    const patch = createSettingsPatchQueue({
      getSettings: async () => {
        reads += 1;
        if (reads === 1) await firstReadGate;
        return { settings: { ...saved } };
      },
      setSettings: async settings => {
        saved = { ...settings };
      }
    });

    const first = patch(settings => { settings.first = 1; });
    const second = patch(settings => { settings.second = 2; });
    releaseFirstRead?.();
    await Promise.all([first, second]);

    expect(saved).toEqual({ first: 1, second: 2 });
  });

  it("continues processing later patches after an SDK error", async () => {
    let attempts = 0;
    const saved: Record<string, unknown>[] = [];
    const patch = createSettingsPatchQueue({
      getSettings: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error("temporary failure");
        return {};
      },
      setSettings: async settings => {
        saved.push(settings);
      }
    });

    await expect(patch(settings => { settings.value = 1; })).rejects.toThrow("temporary failure");
    await expect(patch(settings => { settings.value = 2; })).resolves.toBeUndefined();
    expect(saved).toEqual([{ value: 2 }]);
  });
});
