import type { ExecutionResult } from "../execution/execution-result.js";
import type { ClipboardOutput } from "./clipboard-output.js";
import type { FeedbackAction } from "./streamdeck-feedback.js";
import { StreamDeckFeedback } from "./streamdeck-feedback.js";

export interface OutputOptions {
  copyResponseToClipboard: boolean;
  prettyPrint: boolean;
}

export class OutputProcessor {
  constructor(
    private readonly clipboardOutput: ClipboardOutput,
    private readonly feedback = new StreamDeckFeedback()
  ) {}

  async process(result: ExecutionResult, options: OutputOptions, action: FeedbackAction): Promise<boolean> {
    if (!result.success) {
      await this.feedback.failure(action);
      return false;
    }

    try {
      if (options.copyResponseToClipboard) {
        await this.clipboardOutput.write(result, options.prettyPrint);
      }
      await this.feedback.success(action);
      return true;
    } catch {
      await this.feedback.failure(action);
      return false;
    }
  }
}
