import fs from "node:fs";
import { describe, expect, it } from "vitest";

const files = [
  "com.esheep.switchbot.sdPlugin/ui/api-request.html",
  "com.esheep.switchbot.sdPlugin/ui/get-status.html",
  "com.esheep.switchbot.sdPlugin/ui/infrared-remote.html"
];

describe("Property Inspector checkbox defaults", () => {
  it.each(files)("%s does not use the truthy string default=false", file => {
    const html = fs.readFileSync(file, "utf8");
    expect(html).not.toMatch(/<sdpi-checkbox[^>]*default=["']false["']/);
  });

  it.each(files)("%s keeps clipboard copying visually off when the setting is absent", file => {
    const html = fs.readFileSync(file, "utf8");
    const checkbox = html.match(/<sdpi-checkbox[^>]*setting=["']output\.copyResponseToClipboard["'][^>]*>/)?.[0];
    expect(checkbox).toBeDefined();
    expect(checkbox).not.toContain("default=");
  });
});


describe("API Request command sample control", () => {
  it("provides an explicit sample JSON button below the request body", () => {
    const html = fs.readFileSync("com.esheep.switchbot.sdPlugin/ui/api-request.html", "utf8");
    expect(html).toContain('id="sample-body-button"');
    expect(html).toContain('sampleBodyButton.addEventListener("click", setDeviceCommandSample)');
    expect(html).toContain('selectedEndpoint() === "send-device-command"');
  });
});
