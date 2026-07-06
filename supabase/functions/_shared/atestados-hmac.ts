// HMAC token helpers para o módulo de Atestados Médicos.
// Formato: base64url(JSON({funcionario_id, iat, exp, nonce})) + "." + base64url(HMAC-SHA256)

const enc = new TextEncoder();

function b64urlEncode(bytes: Uint8Array): string {
  let s = btoa(String.fromCharCode(...bytes));
  return s.replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? 0 : 4 - (s.length % 4);
  const norm = s.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat(pad);
  const bin = atob(norm);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export type TokenClaims = {
  funcionario_id: string;
  iat: number; // epoch seconds
  exp: number; // epoch seconds
  nonce: string; // uuid
};

export async function signToken(
  claims: TokenClaims,
  secret: string,
): Promise<string> {
  const payloadStr = JSON.stringify(claims);
  const payloadB64 = b64urlEncode(enc.encode(payloadStr));
  const key = await importKey(secret);
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, enc.encode(payloadB64)),
  );
  return payloadB64 + "." + b64urlEncode(sig);
}

export async function verifyToken(
  token: string,
  secret: string,
): Promise<TokenClaims | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;

  let expectedSig: Uint8Array;
  try {
    const key = await importKey(secret);
    expectedSig = new Uint8Array(
      await crypto.subtle.sign("HMAC", key, enc.encode(payloadB64)),
    );
  } catch {
    return null;
  }

  let providedSig: Uint8Array;
  try {
    providedSig = b64urlDecode(sigB64);
  } catch {
    return null;
  }

  if (!timingSafeEqual(expectedSig, providedSig)) return null;

  let claims: TokenClaims;
  try {
    claims = JSON.parse(new TextDecoder().decode(b64urlDecode(payloadB64)));
  } catch {
    return null;
  }

  if (
    typeof claims.funcionario_id !== "string" ||
    typeof claims.iat !== "number" ||
    typeof claims.exp !== "number" ||
    typeof claims.nonce !== "string"
  ) return null;

  const now = Math.floor(Date.now() / 1000);
  if (now > claims.exp) return null;
  return claims;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function getClientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") || null;
}
