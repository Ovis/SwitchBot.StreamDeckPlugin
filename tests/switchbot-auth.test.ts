import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { SwitchBotAuth } from "../src/api/switchbot-auth.js";

describe("SwitchBotAuth", () => {
  it("creates the v1.1 signature from token + timestamp + nonce", () => {
    const token = "test-token";
    const secret = "test-secret";
    const t = 1_700_000_000_123;
    const nonce = "fixed-nonce";
    const auth = new SwitchBotAuth({ now: () => t, nonce: () => nonce });

    const headers = auth.createHeaders({ token, secret });
    const expected = createHmac("sha256", secret)
      .update(token + t.toString() + nonce)
      .digest("base64");

    expect(headers).toEqual({
      Authorization: token,
      sign: expected,
      t: t.toString(),
      nonce
    });
  });
});
