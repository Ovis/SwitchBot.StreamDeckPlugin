import type { SwitchBotCredentials } from "../api/switchbot-auth.js";
import type { SwitchBotClient } from "../api/switchbot-client.js";
import type { ExecutionRequest } from "./execution-request.js";
import type { ExecutionResponse, ExecutionResult } from "./execution-result.js";
import { validateExecutionRequest } from "../utils/validation.js";

export interface CredentialProvider {
  getCredentials(): Promise<SwitchBotCredentials | undefined>;
}

interface SwitchBotEnvelope {
  statusCode: number;
  message?: string;
}

function parseEnvelope(body: unknown): SwitchBotEnvelope | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const record = body as Record<string, unknown>;
  if (typeof record.statusCode !== "number") return undefined;
  return {
    statusCode: record.statusCode,
    ...(typeof record.message === "string" ? { message: record.message } : {})
  };
}

function toResponse(raw: Awaited<ReturnType<SwitchBotClient["request"]>>): ExecutionResponse {
  const envelope = parseEnvelope(raw.body);
  return {
    httpStatus: raw.httpStatus,
    headers: raw.headers,
    body: raw.body,
    rawBody: raw.rawBody,
    ...(envelope ? { switchBot: envelope } : {})
  };
}

export class RequestExecutor {
  constructor(
    private readonly client: SwitchBotClient,
    private readonly credentialProvider: CredentialProvider,
    private readonly now: () => Date = () => new Date()
  ) {}

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const executedAt = this.now().toISOString();
    const base = { request: { method: request.method, path: request.path }, executedAt };

    const validationError = validateExecutionRequest(request);
    if (validationError) {
      return { ...base, success: false, error: { category: "configuration", message: validationError } };
    }

    let credentials: SwitchBotCredentials | undefined;
    try {
      credentials = await this.credentialProvider.getCredentials();
    } catch {
      return { ...base, success: false, error: { category: "internal", message: "Failed to load plugin credentials." } };
    }
    if (!credentials) {
      return { ...base, success: false, error: { category: "configuration", message: "SwitchBot token and secret are required." } };
    }

    try {
      const raw = await this.client.request(request, credentials);
      const response = toResponse(raw);

      if (raw.httpStatus === 401) {
        return { ...base, success: false, response, error: { category: "authentication", message: "SwitchBot authentication failed." } };
      }
      if (raw.httpStatus < 200 || raw.httpStatus >= 300) {
        return { ...base, success: false, response, error: { category: "http", message: `SwitchBot API returned HTTP ${raw.httpStatus}.` } };
      }

      const envelope = parseEnvelope(raw.body);
      if (!envelope) {
        return { ...base, success: false, response, error: { category: "response", message: "SwitchBot API returned an unexpected response." } };
      }
      if (envelope.statusCode !== 100) {
        return {
          ...base,
          success: false,
          response,
          error: {
            category: "switchbot",
            message: envelope.message
              ? `SwitchBot API error ${envelope.statusCode}: ${envelope.message}`
              : `SwitchBot API error ${envelope.statusCode}.`
          }
        };
      }
      return { ...base, success: true, response };
    } catch (error) {
      if (error instanceof TypeError && error.message.startsWith("Path")) {
        return { ...base, success: false, error: { category: "configuration", message: error.message } };
      }
      return {
        ...base,
        success: false,
        error: {
          category: "network",
          message: "SwitchBot network request failed."
        }
      };
    }
  }
}
