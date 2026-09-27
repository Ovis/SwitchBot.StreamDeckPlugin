import type { HttpMethod } from "./execution-request.js";

export type ExecutionErrorCategory =
  | "configuration"
  | "authentication"
  | "network"
  | "http"
  | "switchbot"
  | "response"
  | "internal";

export interface ExecutionResponse {
  httpStatus: number;
  headers: Record<string, string>;
  body: unknown;
  rawBody: string;
  switchBot?: {
    statusCode?: number;
    message?: string;
  };
}

export interface ExecutionResult {
  success: boolean;
  request: {
    method: HttpMethod;
    path: string;
  };
  response?: ExecutionResponse;
  error?: {
    category: ExecutionErrorCategory;
    message: string;
  };
  executedAt: string;
}
