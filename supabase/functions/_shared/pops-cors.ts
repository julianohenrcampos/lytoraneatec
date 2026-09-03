// CORS helper do módulo POPs.
// Mesma lista de origens confiáveis usada pelos demais módulos do ERP.

const ALLOWED = new Set<string>([
  "https://app.lytoranea.com.br",
  "https://staging.lytoranea.com.br",
  "https://lytotec.com.br",
  "https://www.lytotec.com.br",
  "https://radiant-company-core.lovable.app",
  "https://id-preview--1adc7942-e288-48d3-a624-545b9db75a12.lovable.app",
  "https://1adc7942-e288-48d3-a624-545b9db75a12.lovableproject.com",
  "http://localhost:8080",
  "http://localhost:5173",
]);

export type CorsResult = {
  headers: Record<string, string>;
  blocked: boolean;
};

export function corsFor(req: Request): CorsResult {
  const origin = req.headers.get("Origin");
  const headers: Record<string, string> = {
    "Vary": "Origin",
    "Access-Control-Allow-Headers":
      "authorization, content-type, apikey, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (!origin) return { headers, blocked: false };

  if (ALLOWED.has(origin)) {
    return {
      headers: { ...headers, "Access-Control-Allow-Origin": origin },
      blocked: false,
    };
  }

  return { headers, blocked: true };
}

export function jsonResponse(
  body: unknown,
  status: number,
  cors: CorsResult,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors.headers, "Content-Type": "application/json" },
  });
}

export const POPS_BUCKET = "pops-documentos";
export const POPS_MAX_BYTES = 20 * 1024 * 1024;

export function isUuid(v: unknown): v is string {
  return typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

export async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function hasPdfMagicBytes(buf: ArrayBuffer): boolean {
  const head = new Uint8Array(buf.slice(0, 5));
  // %PDF-
  return head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 &&
    head[3] === 0x46 && head[4] === 0x2d;
}
