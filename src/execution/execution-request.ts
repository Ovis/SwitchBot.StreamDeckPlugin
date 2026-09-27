export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface ExecutionRequest {
  method: HttpMethod;
  path: string;
  headers?: Record<string, string>;
  body?: string;
}
