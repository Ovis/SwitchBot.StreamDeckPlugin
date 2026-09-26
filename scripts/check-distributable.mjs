import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const root = "com.ovis.switchbot.sdPlugin";
const allowedTopLevel = new Set(["bin", "imgs", "ui", "manifest.json"]);
const forbiddenPatterns = [
  /authorization\s*[:=]\s*["'][^"']+["']/i,
  /switchbot[_-]?(token|secret)\s*[:=]\s*["'][^"']+["']/i,
  /DO_NOT_LEAK_SECRET/
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

for (const path of files) {
  if (path.endsWith(".map")) throw new Error(`Source map must not be distributed: ${path}`);
  if (!/\.(?:js|html|json|css)$/i.test(path)) continue;
  const content = await readFile(path, "utf8");
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(content)) {
      throw new Error(`Potential credential material found in ${relative(root, path)}`);
    }
  }
}

console.log(`Distributable check passed for ${files.length} files.`);
