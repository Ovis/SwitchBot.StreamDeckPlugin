import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";

const sourceRoot = "src/property-inspector";
const outputRoot = "com.esheep.switchbot.sdPlugin/ui";

const files = [
  ["api-request/index.html", "api-request.html"],
  ["get-status/index.html", "get-status.html"],
  ["infrared-remote/index.html", "infrared-remote.html"],
  ["shared/authentication.css", "authentication.css"],
  ["shared/vendor/sdpi-components.js", "sdpi-components.js"]
];

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

for (const [source, destination] of files) {
  const output = join(outputRoot, destination);
  await mkdir(dirname(output), { recursive: true });
  await cp(join(sourceRoot, source), output);
}
