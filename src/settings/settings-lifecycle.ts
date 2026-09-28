import { z } from "zod";

export type SettingsMigration = (value: Record<string, unknown>) => unknown;

export interface SettingsLifecycleOptions<T> {
  currentVersion: number;
  schema: z.ZodType<T>;
  defaults: () => T;
  migrations?: Readonly<Record<number, SettingsMigration>>;
  normalize?: (value: Record<string, unknown>) => unknown;
}

/**
 * 永続化されたAction settingsを現在versionの型へ復元する。
 *
 * versionなしは初期versionとして扱い、登録済みmigrationを順番に適用する。
 * migration完了後にAction固有のnested normalizationを行い、最後に現在schemaで検証する。
 * 未知の将来versionは現行schemaで誤解釈せず、安全な既定値へfail closedする。
 */
export function normalizeVersionedSettings<T>(
  value: unknown,
  options: SettingsLifecycleOptions<T>
): T {
  const source = recordOf(value);
  const version = settingsVersion(source);
  if (version === undefined || version > options.currentVersion) return options.defaults();

  try {
    let migrated: unknown = source;
    for (let current = version; current < options.currentVersion; current += 1) {
      const migration = options.migrations?.[current];
      if (!migration || !isRecord(migrated)) return options.defaults();
      migrated = migration(migrated);
    }

    if (!isRecord(migrated)) return options.defaults();
    const normalized = options.normalize ? options.normalize(migrated) : migrated;
    const parsed = options.schema.safeParse(normalized);
    return parsed.success ? parsed.data : options.defaults();
  } catch {
    // 永続設定はユーザー操作や旧version由来で壊れている可能性がある。
    // migration/normalizationの想定外入力でAction全体を停止させず、安全な既定値へ戻す。
    return options.defaults();
  }
}

/** settingsとして扱えるplain objectだけを返す。 */
export function recordOf(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

/**
 * 指定fieldがobjectならその値を返し、それ以外は空objectを返す。
 *
 * nested settingsの個別既定値を維持しながら、壊れた永続値を局所的に正規化するために使う。
 */
export function nestedRecord(source: Record<string, unknown>, field: string): Record<string, unknown> {
  return recordOf(source[field]);
}

function settingsVersion(source: Record<string, unknown>): number | undefined {
  if (source.version === undefined) return 1;
  return Number.isInteger(source.version) && typeof source.version === "number" && source.version >= 1
    ? source.version
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
