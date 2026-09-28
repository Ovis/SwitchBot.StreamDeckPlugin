import type { ExecutionErrorCategory, ExecutionResult } from "./execution-result.js";

export interface ExecutionDiagnosticsView {
  executedAt: string;
  method: string;
  path: string;
  success: boolean;
  errorCategory?: ExecutionErrorCategory;
  errorMessage?: string;
  httpStatus?: number;
  switchBotStatusCode?: number;
  switchBotMessage?: string;
  responseBody?: string;
}

/**
 * ExecutionResultをPI表示用の機密情報を含まない診断モデルへ変換する。
 *
 * Requestの認証ヘッダーはExecutionResult自体に保持していないため公開しない。
 * Response BodyはJSONなら整形し、それ以外は受信したrawBodyをそのまま表示する。
 */
export function executionDiagnosticsView(result: ExecutionResult): ExecutionDiagnosticsView {
  const response = result.response;
  return {
    executedAt: result.executedAt,
    method: result.request.method,
    path: result.request.path,
    success: result.success,
    ...(!result.success ? {
      errorCategory: result.error.category,
      errorMessage: result.error.message
    } : {}),
    ...(response ? {
      httpStatus: response.httpStatus,
      ...(response.switchBot?.statusCode !== undefined ? { switchBotStatusCode: response.switchBot.statusCode } : {}),
      ...(response.switchBot?.message !== undefined ? { switchBotMessage: response.switchBot.message } : {}),
      responseBody: formatResponseBody(response.body, response.rawBody)
    } : {})
  };
}

/** JSONとして解釈済みのBodyは読みやすく整形し、非JSONはrawBodyを保持する。 */
export function formatResponseBody(body: unknown, rawBody: string): string {
  if (body !== undefined) {
    try {
      return JSON.stringify(body, null, 2);
    } catch {
      // 循環参照など想定外の値でも診断表示自体を失わないようrawBodyへフォールバックする。
    }
  }
  return rawBody;
}
