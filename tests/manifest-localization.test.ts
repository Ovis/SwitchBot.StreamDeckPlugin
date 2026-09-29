import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

interface ManifestAction {
  UUID: string;
  Name: string;
  Tooltip: string;
}

interface LocalizationEntry {
  Name?: string;
  Tooltip?: string;
}

const manifest = JSON.parse(readFileSync("com.esheep.switchbot.sdPlugin/manifest.json", "utf8")) as {
  Actions: ManifestAction[];
};
const localizations = [
  ["en", JSON.parse(readFileSync("com.esheep.switchbot.sdPlugin/en.json", "utf8")) as Record<string, LocalizationEntry>],
  ["ja", JSON.parse(readFileSync("com.esheep.switchbot.sdPlugin/ja.json", "utf8")) as Record<string, LocalizationEntry>]
] as const;

describe("manifest action localization", () => {
  it.each(localizations)("%s defines Name and Tooltip for every manifest action", (_locale, localization) => {
    for (const action of manifest.Actions) {
      const entry = localization[action.UUID];
      expect(entry, `Missing localization for ${action.UUID}`).toBeDefined();
      expect(entry?.Name?.trim(), `Missing Name for ${action.UUID}`).toBeTruthy();
      expect(entry?.Tooltip?.trim(), `Missing Tooltip for ${action.UUID}`).toBeTruthy();
    }
  });

  it("manifest action UUIDs are unique", () => {
    const uuids = manifest.Actions.map(action => action.UUID);
    expect(new Set(uuids).size).toBe(uuids.length);
  });
});
