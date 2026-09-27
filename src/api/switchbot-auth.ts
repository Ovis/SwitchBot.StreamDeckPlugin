import { createHmac, randomUUID } from "node:crypto";

export interface SwitchBotCredentials {
  token: string;
  secret: string;
}

export interface SwitchBotAuthHeaders {
  Authorization: string;
  sign: string;
  t: string;
  nonce: string;
}

export interface SwitchBotAuthOptions {
  now?: () => number;
  nonce?: () => string;
}

export class SwitchBotAuth {
  readonly #now: () => number;
  readonly #nonce: () => string;

  constructor(options: SwitchBotAuthOptions = {}) {
    this.#now = options.now ?? Date.now;
    this.#nonce = options.nonce ?? randomUUID;
  }

  createHeaders(credentials: SwitchBotCredentials): SwitchBotAuthHeaders {
    const t = this.#now().toString();
    const nonce = this.#nonce();
    const sign = createHmac("sha256", credentials.secret)
      .update(credentials.token + t + nonce)
      .digest("base64");

    return { Authorization: credentials.token, sign, t, nonce };
  }
}
