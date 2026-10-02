import { describe, expect, it, vi } from "vitest";
import { createPropertyInspectorSettingsStore } from "../src/property-inspector/shared/property-inspector-settings-store.js";

interface TestSettings {
  version: 1;
  count: number;
  nested: { value: string };
}

function normalize(value: unknown): TestSettings {
  const source = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  const nested = typeof source.nested === "object" && source.nested !== null
    ? source.nested as Record<string, unknown>
    : {};
  return {
    version: 1,
    count: typeof source.count === "number" ? source.count : 0,
    nested: { value: typeof nested.value === "string" ? nested.value : "" }
  };
}

describe("Property Inspector settings store", () => {
  it("initializeはenvelopeを展開して正規化するが保存しない", async () => {
    const client = {
      getSettings: vi.fn(async () => ({ settings: { count: 2, nested: { value: "saved" } } })),
      setSettings: vi.fn(async () => undefined)
    };
    const store = createPropertyInspectorSettingsStore(client, normalize);

    expect(() => store.current).toThrow("has not been initialized");
    await expect(store.initialize()).resolves.toEqual({ version: 1, count: 2, nested: { value: "saved" } });
    expect(client.setSettings).not.toHaveBeenCalled();
  });

  it("同時updateを直列化し、常に直前の確定stateを基準にする", async () => {
    let releaseFirstWrite!: () => void;
    const firstWrite = new Promise<void>(resolve => { releaseFirstWrite = resolve; });
    const writes: TestSettings[] = [];
    const client = {
      getSettings: vi.fn(async () => ({ count: 0, nested: {} })),
      setSettings: vi.fn(async (value: unknown) => {
        writes.push(structuredClone(value as TestSettings));
        if (writes.length === 1) await firstWrite;
      })
    };
    const store = createPropertyInspectorSettingsStore(client, normalize);
    await store.initialize();

    const first = store.update(settings => { settings.count += 1; });
    const second = store.update(settings => { settings.count += 10; });
    await Promise.resolve();
    expect(writes).toEqual([{ version: 1, count: 1, nested: { value: "" } }]);

    releaseFirstWrite();
    await Promise.all([first, second]);
    expect(writes).toEqual([
      { version: 1, count: 1, nested: { value: "" } },
      { version: 1, count: 11, nested: { value: "" } }
    ]);
    expect(store.current.count).toBe(11);
  });

  it("write失敗後もqueueを継続し、失敗したstateを確定しない", async () => {
    let writeCount = 0;
    const client = {
      getSettings: vi.fn(async () => ({ count: 3, nested: {} })),
      setSettings: vi.fn(async () => {
        writeCount += 1;
        if (writeCount === 1) throw new Error("write failed");
      })
    };
    const store = createPropertyInspectorSettingsStore(client, normalize);
    await store.initialize();

    await expect(store.update(settings => { settings.count = 99; })).rejects.toThrow("write failed");
    expect(store.current.count).toBe(3);
    await expect(store.update(settings => { settings.count += 2; })).resolves.toMatchObject({ count: 5 });
  });

  it("reloadはPlugin側の外部変更を読み直すが保存しない", async () => {
    let persisted: unknown = { count: 1, nested: { value: "before" } };
    const client = {
      getSettings: vi.fn(async () => persisted),
      setSettings: vi.fn(async () => undefined)
    };
    const store = createPropertyInspectorSettingsStore(client, normalize);
    await store.initialize();
    persisted = { settings: { count: 7, nested: { value: "after" } } };

    await expect(store.reload()).resolves.toEqual({ version: 1, count: 7, nested: { value: "after" } });
    expect(client.setSettings).not.toHaveBeenCalled();
  });

  it("current、更新結果、SDKへ渡した値から内部stateへのmutation漏れを防ぐ", async () => {
    let written: TestSettings | undefined;
    const client = {
      getSettings: vi.fn(async () => ({ count: 1, nested: { value: "original" } })),
      setSettings: vi.fn(async (value: unknown) => { written = value as TestSettings; })
    };
    const store = createPropertyInspectorSettingsStore(client, normalize);
    const initialized = await store.initialize();
    initialized.nested.value = "caller mutation";
    expect(store.current.nested.value).toBe("original");

    const updated = await store.update(settings => { settings.nested.value = "saved"; });
    updated.nested.value = "result mutation";
    if (written) written.nested.value = "SDK mutation";
    expect(store.current.nested.value).toBe("saved");
  });
});
