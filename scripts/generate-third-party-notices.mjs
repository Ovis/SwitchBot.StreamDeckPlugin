import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, parse } from "node:path";
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
async function findPackageRoot(entryPath, expectedName) {
  let directory = dirname(entryPath);
  const root = parse(directory).root;

  while (directory !== root) {
    try {
      const packageJsonPath = join(directory, "package.json");
      const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
      if (packageJson.name === expectedName) return { packageJson, packageDirectory: directory };
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    directory = dirname(directory);
  }

  throw new Error(`Package root not found for ${expectedName} from ${entryPath}`);
}

async function collectDependency(name, fromDirectory) {
  // package.jsonをexportsしていないpackageもあるため、公開entry pointからpackage rootを逆探索する。
  const entryPath = require.resolve(name, { paths: [fromDirectory] });
  const { packageJson, packageDirectory } = await findPackageRoot(entryPath, name);
  if (visited.has(packageDirectory)) return;
  visited.add(packageDirectory);
  dependencies.push({
    path: packageDirectory,
    name: packageJson.name,
    version: packageJson.version,
    license: packageJson.license ?? "UNKNOWN"
  });

  for (const childName of Object.keys(packageJson.dependencies ?? {})) {
    await collectDependency(childName, packageDirectory);
  }
}

for (const name of Object.keys(rootPackage.dependencies ?? {})) {
  await collectDependency(name, process.cwd());
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
