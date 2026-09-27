import type { HttpMethod } from "./execution-request.js";

export type ExecutionErrorCategory =
  | "configuration"
  | "authentication"
  | "network"
  | "http"
  | "switchbot"
  | "response"
  | "internal";

export interface ExecutionRequestSummary {
  method: HttpMethod;
  path: string;
}

export interface SwitchBotResponseEnvelope {
  statusCode?: number;
  message?: string;
}

export interface ExecutionResponse {
  httpStatus: number;
  headers: Record<string, string>;
  body: unknown;
  rawBody: string;
  switchBot?: SwitchBotResponseEnvelope;
}

interface ExecutionResultBase {
  request: ExecutionRequestSummary;
  executedAt: string;
}

/**
 * API実行に成功した結果を表す。
 *
 * successによる判別後にresponseを必須として扱えるよう、失敗結果とは別の型として定義する。
 */
export interface ExecutionSuccessResult extends ExecutionResultBase {
  success: true;
  response: ExecutionResponse;
}

/**
 * API実行に失敗した結果を表す。
 *
 * errorを必須にすることで、呼び出し側が失敗理由を機械的に分類できる状態を保証する。
 * HTTP応答を受信する前の失敗ではresponseを持たない。
 */
export interface ExecutionFailureResult extends ExecutionResultBase {
  success: false;
  error: {
    category: ExecutionErrorCategory;
    message: string;
  };
  response?: ExecutionResponse;
}

export type ExecutionResult = ExecutionSuccessResult | ExecutionFailureResult;
