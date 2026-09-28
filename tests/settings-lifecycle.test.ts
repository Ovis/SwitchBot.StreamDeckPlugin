import { z } from "zod";
import { describe, expect, it } from "vitest";
import { normalizeVersionedSettings } from "../src/settings/settings-lifecycle.js";

describe("settings lifecycle", () => {
  const V2Schema = z.object({
    version: z.literal(2),
    name: z.string(),
    enabled: z.boolean()
  });
  const defaults = () => ({ version: 2 as const, name: "", enabled: false });

  it("versionなしをv1としてmigrationしてから現在schemaで検証する", () => {
    const result = normalizeVersionedSettings({ name: "Bot" }, {
      currentVersion: 2,
      schema: V2Schema,
      defaults,
      migrations: {
        1: source => ({ ...source, version: 2, enabled: true })
      }
    });
    expect(result).toEqual({ version: 2, name: "Bot", enabled: true });
  });

  it("migrationが欠けている旧versionはfail closedする", () => {
    expect(normalizeVersionedSettings({ version: 1, name: "Bot" }, {
      currentVersion: 2,
      schema: V2Schema,
      defaults
    })).toEqual(defaults());
  });

  it("未知の将来versionはfail closedする", () => {
    expect(normalizeVersionedSettings({ version: 3, name: "future", enabled: true }, {
      currentVersion: 2,
      schema: V2Schema,
      defaults
    })).toEqual(defaults());
  });

  it("不正なversion値はfail closedする", () => {
    expect(normalizeVersionedSettings({ version: "2", name: "Bot", enabled: true }, {
      currentVersion: 2,
      schema: V2Schema,
      defaults
    })).toEqual(defaults());
  });

  it("現在versionでもschema不一致ならfail closedする", () => {
    expect(normalizeVersionedSettings({ version: 2, name: 123, enabled: true }, {
      currentVersion: 2,
      schema: V2Schema,
      defaults
    })).toEqual(defaults());
  });
});
