import type { ExecutionRequest, HttpMethod } from "../execution/execution-request.js";

export const SWITCHBOT_API_ORIGIN = "https://api.switch-bot.com";
const METHODS = new Set<HttpMethod>(["GET", "POST", "PUT", "DELETE"]);

export function isHttpMethod(value: string): value is HttpMethod {
  return METHODS.has(value as HttpMethod);
}

export function validateApiPath(path: string): string | undefined {
  if (!path.startsWith("/")) return "Path must start with '/'.";
  if (path.startsWith("//")) return "Path must not be protocol-relative.";
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return "Absolute URLs are not allowed.";

  try {
    const url = new URL(path, SWITCHBOT_API_ORIGIN);
    if (url.origin !== SWITCHBOT_API_ORIGIN) return "Path must remain on the SwitchBot API origin.";
  } catch {
    return "Path is not a valid relative URL.";
  }
  return undefined;
}

export function validateExecutionRequest(request: ExecutionRequest): string | undefined {
  if (!isHttpMethod(request.method)) return "Unsupported HTTP method.";
  const pathError = validateApiPath(request.path);
  if (pathError) return pathError;

  if (request.method === "GET" || request.method === "DELETE") {
    if (request.body !== undefined && request.body !== "") return `${request.method} requests must not include a body.`;
    return undefined;
  }

  if (request.body && request.body.trim().length > 0) {
    try { JSON.parse(request.body); }
    catch { return "Request body must be valid JSON."; }
  }
  return undefined;
}
