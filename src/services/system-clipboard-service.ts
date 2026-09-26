import clipboard from "clipboardy";
import type { ClipboardService } from "./clipboard-service.js";

export class SystemClipboardService implements ClipboardService {
  async writeText(value: string): Promise<void> {
    await clipboard.write(value);
  }
}
