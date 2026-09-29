import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const lock = JSON.parse(await readFile("package-lock.json", "utf8"));
const baseNotice = await readFile("THIRD-PARTY-NOTICES.md", "utf8");
const output = ["# Third-Party Notices", "", "This file is generated from the repository notice and installed runtime dependencies.", ""];

const baseBody = baseNotice.replace(/^# Third-Party Notices\s*/i, "").trim();
if (baseBody) output.push(baseBody, "");

const dependencies = [];
for (const [packagePath, metadata] of Object.entries(lock.packages ?? {})) {
  if (!packagePath.startsWith("node_modules/") || metadata.dev === true) continue;

  const packageJson = JSON.parse(await readFile(join(packagePath, "package.json"), "utf8"));
  dependencies.push({
    path: packagePath,
    name: packageJson.name,
    version: packageJson.version,
    license: packageJson.license ?? metadata.license ?? "UNKNOWN"
  });
}

dependencies.sort((a, b) => `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`));

for (const dependency of dependencies) {
  output.push(`## ${dependency.name}@${dependency.version}`, "", `Declared license: ${dependency.license}`, "");

  const files = await readdir(dependency.path);
  const licenseFile = files.find(name => /^(?:licen[cs]e|copying)(?:\..*)?$/i.test(name));
  if (licenseFile) {
    output.push((await readFile(join(dependency.path, licenseFile), "utf8")).trim(), "");
  } else {
    // package.jsonのlicense宣言だけでは通知条件を満たせないライセンスがあるため、
    // 配布物生成時に見落としを成功扱いせず、依存更新時にもCIで検出する。
    throw new Error(`License text not found for runtime dependency ${dependency.name}@${dependency.version}`);
  }
}

await writeFile(
  "com.esheep.switchbot.sdPlugin/THIRD-PARTY-NOTICES.txt",
  output.join("\n").trimEnd() + "\n",
  "utf8"
);

console.log(`Generated notices for ${dependencies.length} runtime dependency packages.`);
