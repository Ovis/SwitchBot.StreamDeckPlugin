import { describe, expect, it } from "vitest";
import { clipboardCommand } from "../src/services/system-clipboard-service.js";

describe("clipboardCommand", () => {
  it("uses PowerShell on Windows", () => {
    expect(clipboardCommand("win32")).toEqual({
      file: "powershell.exe",
      args: [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "$reader = [System.IO.StreamReader]::new([Console]::OpenStandardInput(), [System.Text.UTF8Encoding]::new($false)); try { Set-Clipboard -Value $reader.ReadToEnd() } finally { $reader.Dispose() }"
      ]
    });
  });

  it("uses pbcopy on macOS", () => {
    expect(clipboardCommand("darwin")).toEqual({ file: "pbcopy", args: [] });
  });

  it("rejects unsupported platforms", () => {
    expect(() => clipboardCommand("linux")).toThrow("Clipboard output is not supported");
  });
});
