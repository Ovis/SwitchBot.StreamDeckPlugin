import type { ExecutionResult } from "../execution/execution-result.js";
import type { ClipboardService } from "../services/clipboard-service.js";

export class ClipboardOutput {
  constructor(private readonly clipboard: ClipboardService) {}

  async write(result: ExecutionResult, prettyPrint: boolean): Promise<void> {
    if (!result.success) throw new Error("Failed execution results cannot be copied.");
    const response = result.response;

    let value = response.rawBody;
    if (prettyPrint && response.body !== undefined && typeof response.body !== "string") {
      try {
        value = JSON.stringify(response.body, null, 2);
      } catch {
        value = response.rawBody;
      }
    }

    await this.clipboard.writeText(value);
  }
}
