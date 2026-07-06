// CORS helper para o módulo de Atestados Médicos.
// Retorna headers + flag `blocked` separadamente para que o chamador decida
// se responde 200/OPTIONS ou 403.

const ALLOWED = new Set<string>([
  "https://app.lytoranea.com.br",
  "https://staging.lytoranea.com.br",
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
