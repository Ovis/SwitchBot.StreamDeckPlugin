export interface FeedbackAction {
  showOk(): Promise<void>;
  showAlert(): Promise<void>;
}

export class StreamDeckFeedback {
  async success(action: FeedbackAction): Promise<void> {
    await action.showOk();
  }

  async failure(action: FeedbackAction): Promise<void> {
    await action.showAlert();
  }
}
