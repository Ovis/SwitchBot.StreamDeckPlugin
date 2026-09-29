import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const rootPackage = JSON.parse(await readFile("package.json", "utf8"));
const baseNotice = await readFile("THIRD-PARTY-NOTICES.md", "utf8");
const output = ["# Third-Party Notices", "", "This file is generated from the repository notice and installed runtime dependencies.", ""];

const baseBody = baseNotice.replace(/^# Third-Party Notices\s*/i, "").trim();
if (baseBody) output.push(baseBody, "");

const dependencies = [];
const visited = new Set();

/**
 * Nodeの実際の解決結果をたどり、bundleへ入り得るproduction dependencyを収集する。
 *
 * package-lock上のpathはnpmのhoisting後の物理配置を保証しないため、
 * lockfileのnode_modules pathを直接ファイルパスとして扱わない。
 */
function collectDependency(name, fromDirectory) {
  const packageJsonPath = require.resolve(`${name}/package.json`, { paths: [fromDirectory] });
  if (visited.has(packageJsonPath)) return;
  visited.add(packageJsonPath);

  const packageJson = require(packageJsonPath);
  const packageDirectory = dirname(packageJsonPath);
  dependencies.push({
    path: packageDirectory,
    name: packageJson.name,
    version: packageJson.version,
    license: packageJson.license ?? "UNKNOWN"
  });

  for (const childName of Object.keys(packageJson.dependencies ?? {})) {
    collectDependency(childName, packageDirectory);
  }
}

for (const name of Object.keys(rootPackage.dependencies ?? {})) {
  collectDependency(name, process.cwd());
}

dependencies.sort((a, b) => `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`));

for (const dependency of dependencies) {
  output.push(`## ${dependency.name}@${dependency.version}`, "", `Declared license: ${dependency.license}`, "");

  const files = await readdir(dependency.path);
  const licenseFile = files.find(name => /^(?:licen[cs]e|copying)(?:\..*)?$/i.test(name));
  if (!licenseFile) {
    // package.jsonのlicense宣言だけでは通知条件を満たせないライセンスがあるため、
    // 配布物生成時に見落としを成功扱いせず、依存更新時にもCIで検出する。
    throw new Error(`License text not found for runtime dependency ${dependency.name}@${dependency.version}`);
  }
  output.push((await readFile(join(dependency.path, licenseFile), "utf8")).trim(), "");
}

await writeFile(
  "com.esheep.switchbot.sdPlugin/THIRD-PARTY-NOTICES.txt",
  output.join("\n").trimEnd() + "\n",
  "utf8"
);

console.log(`Generated notices for ${dependencies.length} runtime dependency packages.`);
