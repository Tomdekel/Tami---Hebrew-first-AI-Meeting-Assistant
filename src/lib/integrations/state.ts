import { createHmac, randomUUID } from "crypto";

const STATE_TTL_MS = 30 * 60 * 1000;

function requireStateSecret(): string {
  const secret = process.env.OAUTH_STATE_SECRET;
  if (!secret) {
    throw new Error("Missing OAUTH_STATE_SECRET environment variable");
  }
  return secret;
}

export function createOAuthState(userId: string, provider: string): string {
  const payload = {
    userId,
    provider,
    nonce: randomUUID(),
    ts: Date.now(),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", requireStateSecret())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyOAuthState(state: string): { userId: string; provider: string } | null {
  const [encoded, signature] = state.split(".");
  if (!encoded || !signature) return null;

  const expected = createHmac("sha256", requireStateSecret())
    .update(encoded)
    .digest("base64url");

  if (expected !== signature) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8")) as {
      userId: string;
      provider: string;
      ts: number;
    };

    if (!payload.userId || !payload.provider) return null;
    if (Date.now() - payload.ts > STATE_TTL_MS) return null;

    return { userId: payload.userId, provider: payload.provider };
  } catch {
    return null;
  }
}
