import type { SwitchBotCredentials } from "./switchbot-auth.js";
import { SwitchBotAuth } from "./switchbot-auth.js";
import type { SwitchBotRawResponse } from "./switchbot-response.js";
import type { ExecutionRequest } from "../execution/execution-request.js";
import { SWITCHBOT_API_ORIGIN, validateExecutionRequest } from "../utils/validation.js";

export type FetchLike = typeof fetch;

export class SwitchBotClient {
  constructor(
    private readonly auth = new SwitchBotAuth(),
    private readonly fetchImpl: FetchLike = fetch
  ) {}

  async request(request: ExecutionRequest, credentials: SwitchBotCredentials): Promise<SwitchBotRawResponse> {
    const validationError = validateExecutionRequest(request);
    if (validationError) throw new TypeError(validationError);

    const authHeaders = this.auth.createHeaders(credentials);
    const headers = new Headers(request.headers);
    for (const name of ["authorization", "sign", "t", "nonce", "host", "content-length"]) {
      headers.delete(name);
    }
    for (const [name, value] of Object.entries(authHeaders)) {
      headers.set(name, value);
    }

    const init: RequestInit = {
      method: request.method,
      headers
    };

    if ((request.method === "POST" || request.method === "PUT") && request.body !== undefined) {
      headers.set("Content-Type", "application/json");
      init.body = request.body;
    }

    const response = await this.fetchImpl(new URL(request.path, SWITCHBOT_API_ORIGIN), init);
    const rawBody = await response.text();
    let body: unknown = rawBody;
    if (rawBody.length > 0) {
      try { body = JSON.parse(rawBody) as unknown; }
      catch { /* preserve raw body */ }
    } else {
      body = undefined;
    }

    return {
      httpStatus: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      rawBody,
      body
    };
  }
}
