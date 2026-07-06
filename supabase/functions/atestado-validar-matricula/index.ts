// Edge: atestado-validar-matricula
// Público (verify_jwt=false). Rate-limitado por IP e por hash de matrícula.
// Valida matrícula + 4 últimos dígitos do CPF do funcionário e devolve token HMAC.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsFor, jsonResponse } from "../_shared/atestados-cors.ts";
import {
  getClientIp,
  sha256Hex,
  signToken,
} from "../_shared/atestados-hmac.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const HMAC_SECRET = Deno.env.get("ATESTADO_HMAC_SECRET")!;
const STATUS_PERMITIDOS = new Set([
  "Ativo",
  "Ativo sem Registro",
  "Férias",
]);

// Mesma resposta genérica em qualquer falha de validação, para evitar enumeração.
const GENERIC_ERROR = { ok: false, error: "credenciais_invalidas" };

async function delay(minMs: number, maxMs: number) {
  const ms = minMs + Math.floor(Math.random() * (maxMs - minMs));
  await new Promise((r) => setTimeout(r, ms));
}

Deno.serve(async (req) => {
  const cors = corsFor(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors.headers });
  }
  if (cors.blocked) {
    return new Response("forbidden", { status: 403, headers: cors.headers });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405, cors);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  let body: { matricula?: string; cpf_ultimos_4?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400, cors);
  }

  const matricula = String(body.matricula || "").trim();
  const cpfUlt4 = String(body.cpf_ultimos_4 || "").trim();

  // Matrículas no ERP LYTOTEC são alfanuméricas (ex.: "PJobra002", "001.373").
  if (!/^[A-Za-z0-9._-]{1,32}$/.test(matricula) || !/^\d{4}$/.test(cpfUlt4)) {
    await delay(300, 700);
    return jsonResponse(GENERIC_ERROR, 400, cors);
  }

  const ip = getClientIp(req) || "0.0.0.0";
  const matriculaHash = await sha256Hex(new TextEncoder().encode(matricula));

  // Rate limit por IP: 10 tentativas / 15 min, bloqueio 1h.
  const { data: rlIp, error: rlIpErr } = await supabase.rpc(
    "fn_rate_limit_check",
    {
      p_escopo: "atestado_validar",
      p_chave_tipo: "ip",
      p_chave_valor: ip,
      p_max_tentativas: 10,
      p_janela_segundos: 900,
      p_bloqueio_segundos: 3600,
    },
  );
  if (rlIpErr) {
    return jsonResponse({ error: "rate_limit_error" }, 500, cors);
  }
  if (rlIp && rlIp[0] && rlIp[0].permitido === false) {
    return jsonResponse({ error: "rate_limited" }, 429, cors);
  }

  // Rate limit por matrícula (hash): 5/15 min, bloqueio 1h.
  const { data: rlMat } = await supabase.rpc("fn_rate_limit_check", {
    p_escopo: "atestado_validar",
    p_chave_tipo: "matricula_hash",
    p_chave_valor: matriculaHash,
    p_max_tentativas: 5,
    p_janela_segundos: 900,
    p_bloqueio_segundos: 3600,
  });
  if (rlMat && rlMat[0] && rlMat[0].permitido === false) {
    return jsonResponse({ error: "rate_limited" }, 429, cors);
  }

  // Busca funcionário + CPF sensível.
  const { data: func, error: funcErr } = await supabase
    .from("bd_funcionarios")
    .select("id, nome_completo, matricula, status, centro_custo_id")
    .eq("matricula", matricula)
    .maybeSingle();

  if (funcErr || !func) {
    await delay(500, 1200);
    return jsonResponse(GENERIC_ERROR, 401, cors);
  }

  if (!STATUS_PERMITIDOS.has(func.status)) {
    await delay(500, 1200);
    return jsonResponse(GENERIC_ERROR, 401, cors);
  }

  const { data: sens } = await supabase
    .from("bd_funcionarios_sensivel")
    .select("cpf")
    .eq("funcionario_id", func.id)
    .maybeSingle();

  const cpfLimpo = String(sens?.cpf || "").replace(/\D/g, "");
  if (!cpfLimpo || cpfLimpo.slice(-4) !== cpfUlt4) {
    await delay(500, 1200);
    return jsonResponse(GENERIC_ERROR, 401, cors);
  }

  // Emite token HMAC (10 min).
  const nonce = crypto.randomUUID();
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 600;
  const token = await signToken(
    { funcionario_id: func.id, iat, exp, nonce },
    HMAC_SECRET,
  );

  // Log opcional (sem CPF/matrícula). Best-effort: nunca deve derrubar o fluxo.
  try {
    await supabase.from("bd_security_audit_log").insert({
      event_type: "atestado_validar_matricula_ok",
      table_name: "bd_funcionarios",
      ip,
      contexto: { funcionario_id: func.id, nonce },
    });
  } catch (_) { /* noop */ }

  return jsonResponse({
    ok: true,
    token_validacao: token,
    expira_em: exp,
    funcionario: {
      id: func.id,
      nome: func.nome_completo,
      matricula: func.matricula,
    },
  }, 200, cors);
});
