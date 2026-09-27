import streamDeck from "@elgato/streamdeck";
import type { ExecutionResult } from "../execution/execution-result.js";
import type { ClipboardOutput } from "./clipboard-output.js";
import type { FeedbackAction } from "./streamdeck-feedback.js";
import { StreamDeckFeedback } from "./streamdeck-feedback.js";

export interface OutputOptions {
  copyResponseToClipboard: boolean;
  prettyPrint: boolean;
  showSuccessFeedback?: boolean;
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
      if (options.showSuccessFeedback !== false) {
        await this.feedback.success(action);
      }
      return true;
    } catch (error) {
      streamDeck.logger.error("Output processing failed", {
        operation: options.copyResponseToClipboard ? "clipboard-write" : "feedback",
        errorName: error instanceof Error ? error.name : "UnknownError"
      });
      await this.feedback.failure(action);
      return false;
    }
  }
}
