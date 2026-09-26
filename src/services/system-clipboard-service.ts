import { spawn } from "node:child_process";
import type { ClipboardService } from "./clipboard-service.js";

export type ClipboardPlatform = "win32" | "darwin";
export type SpawnProcess = typeof spawn;

export class SystemClipboardService implements ClipboardService {
  constructor(
    private readonly platform: NodeJS.Platform = process.platform,
    private readonly spawnProcess: SpawnProcess = spawn
  ) {}

  async writeText(value: string): Promise<void> {
    const command = clipboardCommand(this.platform);
    await writeToProcess(command.file, command.args, value, this.spawnProcess);
  }
}

export function clipboardCommand(platform: NodeJS.Platform): { file: string; args: string[] } {
  switch (platform) {
    case "win32":
      return {
        file: "powershell.exe",
        args: ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", "$input | Set-Clipboard"]
      };
    case "darwin":
      return { file: "pbcopy", args: [] };
    default:
      throw new Error(`Clipboard output is not supported on platform '${platform}'.`);
  }
}

function writeToProcess(file: string, args: string[], value: string, spawnProcess: SpawnProcess): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawnProcess(file, args, {
      windowsHide: true,
      stdio: ["pipe", "ignore", "ignore"]
    });

    child.once("error", reject);
    child.once("close", code => {
      if (code === 0) resolve();
      else reject(new Error(`Clipboard command exited with code ${code ?? "unknown"}.`));
    });

    child.stdin.once("error", reject);
    child.stdin.end(value, "utf8");
  });
}
