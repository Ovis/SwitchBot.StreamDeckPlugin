import { access, readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";

const root = "com.esheep.switchbot.sdPlugin/ui";
const pages = ["api-request", "get-status", "infrared-remote", "bot-control"];

for (const page of pages) {
  for (const extension of [".html", ".js", ".js.map"]) {
    await access(join(root, page + extension));
  }

  const html = await readFile(join(root, page + ".html"), "utf8");
  const references = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map(match => match[1])
    .filter(value => value && !/^(?:https?:|data:|#)/i.test(value));

  for (const reference of references) {
    await access(join(root, reference));
  }

  if (/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?\S[\s\S]*?<\/script>/i.test(html)) {
    throw new Error(`Inline Property Inspector JavaScript remains in ${page}.html`);
  }
}

const allowed = new Set([
  "api-request.html", "api-request.js", "api-request.js.map",
  "get-status.html", "get-status.js", "get-status.js.map",
  "infrared-remote.html", "infrared-remote.js", "infrared-remote.js.map",
  "bot-control.html", "bot-control.js", "bot-control.js.map",
  "authentication.css", "sdpi-components.js"
]);

for (const name of await readdir(root)) {
  if (!allowed.has(name)) {
    throw new Error(`Unexpected Property Inspector artifact: ${name}`);
  }
  if (![".html", ".js", ".map", ".css"].includes(extname(name))) {
    throw new Error(`Unsupported Property Inspector artifact: ${name}`);
  }
}

console.log("Property Inspector distributable check passed.");
