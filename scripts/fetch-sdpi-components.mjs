import { mkdir, writeFile } from "node:fs/promises";

const url = "https://sdpi-components.dev/releases/v4/sdpi-components.js";
const response = await fetch(url);
if (!response.ok) {
  throw new Error(`Failed to download sdpi-components: HTTP ${response.status}`);
}
const content = await response.text();
if (!content.includes("SDPIComponents")) {
  throw new Error("Downloaded sdpi-components bundle did not contain the expected API.");
}
await mkdir("com.ovis.switchbot.sdPlugin/ui", { recursive: true });
await writeFile("com.ovis.switchbot.sdPlugin/ui/sdpi-components.js", content);
