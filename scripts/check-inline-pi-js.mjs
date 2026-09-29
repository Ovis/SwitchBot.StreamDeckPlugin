import fs from "node:fs";
import vm from "node:vm";

const files = [
  "com.esheep.switchbot.sdPlugin/ui/api-request.html",
  "com.esheep.switchbot.sdPlugin/ui/get-status.html",
  "com.esheep.switchbot.sdPlugin/ui/infrared-remote.html",
  "com.esheep.switchbot.sdPlugin/ui/physical-control.html"
];

for (const file of files) {
  const html = fs.readFileSync(file, "utf8");
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1])
    .filter(source => source.trim());

  for (const [index, source] of scripts.entries()) {
    new vm.Script(source, { filename: `${file}#inline-${index + 1}` });
  }
}
