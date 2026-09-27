import { describe, expect, it } from "vitest";
import { ActionInstanceFifo } from "../src/execution/action-instance-fifo.js";

const flush = async (): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 0));
};

describe("ActionInstanceFifo", () => {
  it("同一Action instanceをFIFO順で直列実行する", async () => {
    const order: number[] = [];
    let releaseFirst: (() => void) | undefined;
    const firstGate = new Promise<void>(resolve => { releaseFirst = resolve; });
    const queue = new ActionInstanceFifo<number>(5, async (_id, item) => {
      if (item === 1) await firstGate;
      order.push(item);
    });

    expect(queue.enqueue("a", 1)).toBe("accepted");
    expect(queue.enqueue("a", 2)).toBe("accepted");
    await flush();
    expect(order).toEqual([]);

    releaseFirst?.();
    await flush();
    expect(order).toEqual([1, 2]);
  });

  it("上限は実行中を含めて数える", async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const queue = new ActionInstanceFifo<number>(2, async () => { await gate; });

    expect(queue.enqueue("a", 1)).toBe("accepted");
    await flush();
    expect(queue.enqueue("a", 2)).toBe("accepted");
    expect(queue.enqueue("a", 3)).toBe("full");
    release?.();
    await flush();
  });

  it("Action消失時は待機中を破棄し実行中だけ完了させる", async () => {
    const completed: number[] = [];
    let release: (() => void) | undefined;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const queue = new ActionInstanceFifo<number>(5, async (_id, item, isDisposed) => {
      if (item === 1) await gate;
      if (!isDisposed()) completed.push(item);
    });

    queue.enqueue("a", 1);
    queue.enqueue("a", 2);
    await flush();
    queue.dispose("a");
    release?.();
    await flush();

    expect(completed).toEqual([]);
  });

  it("1件の例外で後続処理を停止しない", async () => {
    const completed: number[] = [];
    const queue = new ActionInstanceFifo<number>(5, async (_id, item) => {
      if (item === 1) throw new Error("failed");
      completed.push(item);
    });

    queue.enqueue("a", 1);
    queue.enqueue("a", 2);
    await flush();
    expect(completed).toEqual([2]);
  });

  it("異なるAction instanceは互いにブロックしない", async () => {
    const started: string[] = [];
    let release: (() => void) | undefined;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const queue = new ActionInstanceFifo<number>(5, async (id) => {
      started.push(id);
      if (id === "a") await gate;
    });

    queue.enqueue("a", 1);
    queue.enqueue("b", 1);
    await flush();
    expect(started).toEqual(["a", "b"]);
    release?.();
  });
});
