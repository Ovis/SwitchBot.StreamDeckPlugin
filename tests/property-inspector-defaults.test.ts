import fs from "node:fs";
import { describe, expect, it } from "vitest";

const checkboxFiles = [
  "src/property-inspector/api-request/index.html",
  "src/property-inspector/get-status/index.html",
  "src/property-inspector/infrared-remote/index.html"
];

describe("Property Inspector checkbox defaults", () => {
  it.each(checkboxFiles)("%s does not use the truthy string default=false", file => {
    const html = fs.readFileSync(file, "utf8");
    expect(html).not.toMatch(/<sdpi-checkbox[^>]*default=["']false["']/);
  });

  it("API Request keeps clipboard copying visually off when the setting is absent", () => {
    const file = "src/property-inspector/api-request/index.html";
    const html = fs.readFileSync(file, "utf8");
    const checkbox = html.match(/<sdpi-checkbox[^>]*setting=["']output\.copyResponseToClipboard["'][^>]*>/)?.[0];
    expect(checkbox).toBeDefined();
    expect(checkbox).not.toContain("default=");
  });
});

describe("API Request command sample control", () => {
  it("provides an explicit sample JSON button below the request body", () => {
    const html = fs.readFileSync("src/property-inspector/api-request/index.html", "utf8");
    const source = fs.readFileSync("src/property-inspector/api-request/index.ts", "utf8");
    expect(html).toContain('id="sample-body-button"');
    expect(source).toContain('sampleBodyButton.addEventListener("click", setDeviceCommandSample)');
    expect(source).toContain('selectedEndpoint() === "send-device-command"');
  });
});
