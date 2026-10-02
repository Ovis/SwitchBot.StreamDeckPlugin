import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const managed = ["physical-control", "infrared-remote", "get-status"];
const propertyInspectorRoot = "src/property-inspector";

describe("Property Inspector persistence architecture", () => {
  it.each(managed)("%s Managed Mode HTMLは自動保存writerを持たない", page => {
    const html = fs.readFileSync(path.join(propertyInspectorRoot, page, "index.html"), "utf8");
    expect(html).not.toMatch(/\bsetting\s*=/);
    expect(html).not.toMatch(/\blabel-setting\s*=/);
  });

  it.each(managed)("%s Managed Mode Controllerは共通Storeだけを利用する", page => {
    const source = fs.readFileSync(path.join(propertyInspectorRoot, page, "index.ts"), "utf8");
    expect(source).toContain("createPropertyInspectorSettingsStore");
    expect(source).not.toContain("streamDeckClient.setSettings");
    expect(source).not.toContain("createSettingsPatchQueue");
  });

  it("API Request Simple ModeはSDPI Componentsだけをwriterにする", () => {
    const html = fs.readFileSync(path.join(propertyInspectorRoot, "api-request/index.html"), "utf8");
    const source = fs.readFileSync(path.join(propertyInspectorRoot, "api-request/index.ts"), "utf8");
    expect(html).toMatch(/\bsetting\s*=/);
    expect(source).not.toContain("createPropertyInspectorSettingsStore");
    expect(source).not.toContain("streamDeckClient.setSettings");
  });

  it("release用PIコードに一時的なconsole診断を残さない", () => {
    for (const file of sourceFiles(propertyInspectorRoot)) {
      expect(fs.readFileSync(file, "utf8"), file).not.toMatch(/\bconsole\s*\./);
    }
  });
});

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === "vendor" ? [] : sourceFiles(target);
    return entry.isFile() && target.endsWith(".ts") ? [target] : [];
  });
}
