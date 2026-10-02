export interface PropertyInspectorSettingsClient {
  getSettings(): Promise<unknown>;
  setSettings(settings: unknown): Promise<void>;
}

export type PropertyInspectorSettingsNormalizer<T extends object> = (value: unknown) => T;

export interface PropertyInspectorSettingsStore<T extends object> {
  readonly current: T;
  initialize(): Promise<T>;
  reload(): Promise<T>;
  update(mutator: (settings: T) => void): Promise<T>;
}

/**
 * Managed Mode の Property Inspector から Action settings を読み書きする唯一の窓口を作る。
 *
 * initialize/reload は永続値を正規化して内部stateへ取り込むだけで、保存は行わない。
 * ユーザー操作による update だけが setSettings を呼び出すため、PIを開いただけで
 * settingsを上書きすることはない。
 */
export function createPropertyInspectorSettingsStore<T extends object>(
  client: PropertyInspectorSettingsClient,
  normalize: PropertyInspectorSettingsNormalizer<T>
): PropertyInspectorSettingsStore<T> {
  let state: T | undefined;
  let queue = Promise.resolve();

  function enqueue<TResult>(operation: () => Promise<TResult>): Promise<TResult> {
    const result = queue.then(operation);
    // 一度のSDKエラーで後続のreload/updateまで停止しないよう、内部キューだけ復旧する。
    queue = result.then(() => undefined, () => undefined);
    return result;
  }

  function normalized(value: unknown): T {
    return clone(normalize(clone(unwrapSettingsEnvelope(value))));
  }

  function currentState(): T {
    if (state === undefined) {
      throw new Error("Property Inspector settings store has not been initialized.");
    }
    return state;
  }

  async function reload(): Promise<T> {
    return enqueue(async () => {
      const next = normalized(await client.getSettings());
      state = next;
      return clone(next);
    });
  }

  return {
    get current(): T {
      return clone(currentState());
    },

    initialize(): Promise<T> {
      return reload();
    },

    reload,

    update(mutator: (settings: T) => void): Promise<T> {
      return enqueue(async () => {
        const draft = clone(currentState());
        mutator(draft);
        const next = normalized(draft);
        await client.setSettings(clone(next));
        state = next;
        return clone(next);
      });
    }
  };
}

function unwrapSettingsEnvelope(value: unknown): unknown {
  if (!isRecord(value)) return {};
  return isRecord(value.settings) ? value.settings : value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
