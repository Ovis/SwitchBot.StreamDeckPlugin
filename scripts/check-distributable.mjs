import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const root = "com.esheep.switchbot.sdPlugin";
const allowedTopLevel = new Set(["bin", "imgs", "ui", "manifest.json", "en.json", "ja.json", "THIRD-PARTY-NOTICES.txt"]);
const forbiddenPatterns = [
  /DO_NOT_LEAK_SECRET/,
  /(?:token|secret)\s*[:=]\s*["'][A-Za-z0-9+\/_=-]{32,}["']/i
];

const topLevel = await readdir(root);
for (const name of topLevel) {
  if (!allowedTopLevel.has(name)) {
    throw new Error(`Unexpected distributable entry: ${name}`);
  }
}

const files = [];
async function walk(dir) {
  for (const name of await readdir(dir)) {
    const path = join(dir, name);
    const info = await stat(path);
    if (info.isDirectory()) await walk(path);
    else files.push(path);
  }
}
await walk(root);

const forbiddenPiApiPatterns = [
  /streamDeckClient\.sendToPlugin\s*\(/,
  /streamDeckClient\.on\s*\(\s*["']sendToPropertyInspector["']/
];

for (const path of files) {
  if (!/\.(?:js|html|json|css|map)$/i.test(path)) continue;
  const content = await readFile(path, "utf8");
  if (path.includes(`${root}/ui/`) || path.includes(`${root}\\ui\\`)) {
    for (const pattern of forbiddenPiApiPatterns) {
      if (pattern.test(content)) {
        throw new Error(`Unsupported sdpi-components client API found in ${relative(root, path)}`);
      }
    }
  }
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(content)) {
      throw new Error(`Potential credential material found in ${relative(root, path)}`);
    }
  }
}

console.log(`Distributable check passed for ${files.length} files.`);
