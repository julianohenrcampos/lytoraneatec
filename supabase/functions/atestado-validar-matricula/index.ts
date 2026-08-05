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

/** Segundos restantes de bloqueio (mínimo 60) para exibir ao usuário. */
function retryAfter(bloqueadoAte: string | null | undefined): number {
  if (!bloqueadoAte) return 600;
  const ms = new Date(bloqueadoAte).getTime() - Date.now();
  return Math.max(60, Math.ceil(ms / 1000));
}

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
      p_max_tentativas: 30,
      p_janela_segundos: 900,
      p_bloqueio_segundos: 600,
    },
  );
  if (rlIpErr) {
    return jsonResponse({ error: "rate_limit_error" }, 500, cors);
  }
  if (rlIp && rlIp[0] && rlIp[0].permitido === false) {
    return jsonResponse(
      { error: "rate_limited", retry_after_segundos: retryAfter(rlIp[0].bloqueado_ate) },
      429,
      cors,
    );
  }

  // Rate limit por matrícula (hash): 5/15 min, bloqueio 1h.
  const { data: rlMat } = await supabase.rpc("fn_rate_limit_check", {
    p_escopo: "atestado_validar",
    p_chave_tipo: "matricula_hash",
    p_chave_valor: matriculaHash,
    p_max_tentativas: 8,
    p_janela_segundos: 900,
    p_bloqueio_segundos: 600,
  });
  if (rlMat && rlMat[0] && rlMat[0].permitido === false) {
    return jsonResponse(
      { error: "rate_limited", retry_after_segundos: retryAfter(rlMat[0].bloqueado_ate) },
      429,
      cors,
    );
  }

  // Matrícula NÃO é única no cadastro: buscamos todos os candidatos e
  // desempatamos pelos 4 últimos dígitos do CPF.
  const { data: candidatos, error: funcErr } = await supabase
    .from("bd_funcionarios")
    .select("id, nome_completo, matricula, status, centro_custo_id, cpf")
    .eq("matricula", matricula)
    .limit(20);

  if (funcErr || !candidatos || candidatos.length === 0) {
    await delay(500, 1200);
    return jsonResponse(GENERIC_ERROR, 401, cors);
  }

  const elegiveis = candidatos.filter((c) => STATUS_PERMITIDOS.has(c.status));
  if (elegiveis.length === 0) {
    await delay(500, 1200);
    return jsonResponse(GENERIC_ERROR, 401, cors);
  }

  const { data: sensRows } = await supabase
    .from("bd_funcionarios_sensivel")
    .select("funcionario_id, cpf")
    .in("funcionario_id", elegiveis.map((c) => c.id));

  const cpfPorFuncionario = new Map<string, string>();
  for (const r of sensRows ?? []) {
    cpfPorFuncionario.set(
      String(r.funcionario_id),
      String(r.cpf || "").replace(/\D/g, ""),
    );
  }

  // Fonte dupla de CPF: prioriza bd_funcionarios_sensivel; quando ausente/vazio,
  // usa bd_funcionarios.cpf (há cadastros ativos sem linha na tabela sensível).
  const onlyDigits = (v: unknown) => String(v || "").replace(/\D/g, "");
  const cpfEfetivo = (c: { id: string; cpf?: string | null }) => {
    const sens = cpfPorFuncionario.get(c.id) || "";
    if (sens.length >= 4) return { cpf: sens, fonte: "sensivel" as const };
    return { cpf: onlyDigits(c.cpf), fonte: "funcionarios" as const };
  };

  const compativeis = elegiveis
    .map((c) => ({ func: c, ...cpfEfetivo(c) }))
    .filter((x) => x.cpf.length >= 4 && x.cpf.slice(-4) === cpfUlt4);

  if (compativeis.length === 0) {
    await delay(500, 1200);
    return jsonResponse(GENERIC_ERROR, 401, cors);
  }


  if (compativeis.length > 1) {
    // Cadastro ambíguo: nunca escolher "no chute".
    try {
      await supabase.from("bd_security_audit_log").insert({
        event_type: "atestado_validar_matricula_ambiguo",
        table_name: "bd_funcionarios",
        ip,
        contexto: {
          matricula_hash: matriculaHash,
          candidatos: compativeis.map((c) => c.func.id),
        },
      });
    } catch (_) { /* noop */ }
    return jsonResponse(
      { ok: false, error: "identidade_ambigua" },
      409,
      cors,
    );
  }

  const escolhido = compativeis[0];
  const func = escolhido.func;

  // Observabilidade de saneamento: validou apenas pela fonte bd_funcionarios.
  if (escolhido.fonte === "funcionarios") {
    try {
      await supabase.from("bd_security_audit_log").insert({
        event_type: "atestado_validar_cpf_fallback_funcionarios",
        table_name: "bd_funcionarios",
        ip,
        contexto: { funcionario_id: func.id, fonte_cpf: "bd_funcionarios" },
      });
    } catch (_) { /* noop */ }
  }




  // Validação correta: zera contadores para não punir quem acertou.
  try {
    await supabase.rpc("fn_rate_limit_reset", {
      p_escopo: "atestado_validar",
      p_chave_tipo: "matricula_hash",
      p_chave_valor: matriculaHash,
    });
    await supabase.rpc("fn_rate_limit_reset", {
      p_escopo: "atestado_validar",
      p_chave_tipo: "ip",
      p_chave_valor: ip,
    });
  } catch (_) { /* noop */ }

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
