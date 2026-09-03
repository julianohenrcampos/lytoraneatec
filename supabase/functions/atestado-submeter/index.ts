// Edge: atestado-submeter
// Público (verify_jwt=false). Valida HMAC + consome nonce; valida arquivo por magic bytes;
// grava linha em bd_atestados_medicos; dispara notificação por e-mail não-bloqueante.
//
// Fase 2-C.1:
// - data_emissao = data atual em BRT (definida pelo backend, ignora client).
// - Regra prazo: envio até (data_inicio_afastamento + 1 dia) em BRT.
// - sistema_afetado_codigo obrigatório (01..21) SOMENTE para atestado_medico,
//   descrição derivada no backend; código 21 => observação obrigatória (3..2000).
//
// Fase 2-D (tipos de documento):
// - tipo_documento obrigatório; descrição e e-mail destino derivados no backend.
// - atestado_medico => saude@lytoranea.com.br + regras de sistema afetado/alertas.
// - demais tipos => ronald.ventura@lytoranea.com.br, sem sistema afetado,
//   sem alertas médicos (mantém apenas prazo_ok/prazo_fora).
// - Limites (checados ANTES de consumir o nonce e antes do insert):
//   acompanhamento_filho: 1 envio / 12 meses; acompanhamento_esposa_gestante: 3 / 12 meses.
//   Bloqueio => remove arquivo do storage (best-effort) e retorna erro específico.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsFor, jsonResponse } from "../_shared/atestados-cors.ts";
import {
  getClientIp,
  sha256Hex,
  verifyToken,
} from "../_shared/atestados-hmac.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const HMAC_SECRET = Deno.env.get("ATESTADO_HMAC_SECRET")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const BUCKET = "atestados-medicos";
const EMAIL_FROM = '"LYTOTEC ERP - Atestados Medicos" <no-reply@lytotec.com.br>';
const MAX_BYTES = 15 * 1024 * 1024;

const EMAIL_SAUDE = "saude@lytoranea.com.br";
const EMAIL_DP = "ronald.ventura@lytoranea.com.br";

const TIPOS_DOCUMENTO: Record<string, { descricao: string; email_destino: string }> = {
  atestado_medico: { descricao: "Atestado Médico", email_destino: EMAIL_SAUDE },
  declaracao_comparecimento: { descricao: "Declaração de Comparecimento", email_destino: EMAIL_DP },
  licenca_judicial: { descricao: "Licença Judicial", email_destino: EMAIL_DP },
  doacao_sangue: { descricao: "Doação de Sangue", email_destino: EMAIL_DP },
  acompanhamento_filho: { descricao: "Acompanhamento de Filho", email_destino: EMAIL_DP },
  acompanhamento_esposa_gestante: { descricao: "Acompanhamento de Esposa Gestante", email_destino: EMAIL_DP },
};

// Limites por tipo (janela móvel em meses, máximo de envios no período).
const LIMITES: Record<string, { max: number; meses: number; erro: string }> = {
  acompanhamento_filho: { max: 1, meses: 12, erro: "limite_acompanhamento_filho" },
  acompanhamento_esposa_gestante: { max: 3, meses: 12, erro: "limite_acompanhamento_esposa_gestante" },
};

const SISTEMAS_AFETADOS: Record<string, string> = {
  "01": "Sistema Respiratório",
  "02": "Sistema Cardiovascular",
  "03": "Sistema Digestório (Gastrointestinal)",
  "04": "Sistema Neurológico (Sistema Nervoso)",
  "05": "Sistema Musculoesquelético",
  "06": "Sistema Geniturinário",
  "07": "Sistema Endócrino",
  "08": "Sistema Hematológico",
  "09": "Sistema Imunológico",
  "10": "Sistema Dermatológico (Tegumentar)",
  "11": "Sistema Oftalmológico (Visual)",
  "12": "Sistema Otorrinolaringológico (Ouvido, Nariz e Garganta)",
  "13": "Sistema Reprodutor",
  "14": "Sistema Psiquiátrico / Saúde Mental",
  "15": "Sistema Renal",
  "16": "Sistema Linfático",
  "17": "Sistema Metabólico",
  "18": "Sistema Odontológico / Bucal",
  "19": "Múltiplos Sistemas",
  "20": "Não Especificado",
  "21": "Outros",
};

const STATUS_EXCLUIDOS = ["cancelado", "rejeitado"];

type Kind = "pdf" | "jpg" | "png";

function detectKind(bytes: Uint8Array): { kind: Kind; mime: string } | null {
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 &&
    bytes[2] === 0x44 && bytes[3] === 0x46
  ) return { kind: "pdf", mime: "application/pdf" };
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) return { kind: "jpg", mime: "image/jpeg" };
  if (
    bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 &&
    bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d &&
    bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return { kind: "png", mime: "image/png" };
  return null;
}

/** Retorna a data atual em BRT (America/Sao_Paulo) no formato YYYY-MM-DD. */
function hojeBRT(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${d}`;
}

function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function addDaysISO(s: string, days: number): string {
  const d = parseISO(s);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function addMonthsISO(s: string, months: number): string {
  const d = parseISO(s);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

function maskMatricula(m: string): string {
  if (!m || m.length <= 3) return m || "";
  return `${m.slice(0, 2)}${"*".repeat(Math.max(0, m.length - 3))}${m.slice(-1)}`;
}

async function enviarEmail(params: {
  protocolo: string;
  matricula: string;
  nome: string;
  dias: number;
  dentroPrazo: boolean;
  tipoDescricao: string;
  emailDestino: string;
  enviadoEm: string;
}): Promise<{ ok: boolean; erro?: string }> {
  if (!RESEND_API_KEY) return { ok: false, erro: "resend_key_missing" };
  const html = `
    <p>Novo documento recebido no LYTOTEC.</p>
    <ul>
      <li><b>Protocolo:</b> ${params.protocolo}</li>
      <li><b>Tipo de documento:</b> ${params.tipoDescricao}</li>
      <li><b>Colaborador:</b> ${params.nome} (matrícula ${maskMatricula(params.matricula)})</li>
      <li><b>Dias de afastamento:</b> ${params.dias}</li>
      <li><b>Data de envio:</b> ${params.enviadoEm}</li>
      <li><b>Envio dentro do prazo de 24h:</b> ${params.dentroPrazo ? "Sim" : "Não"}</li>
    </ul>
    <p>Acesse o painel interno para análise. Este e-mail não contém anexo.</p>`;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(10000),
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [params.emailDestino],
        reply_to: params.emailDestino,
        subject: `[Documento] Novo envio — ${params.protocolo}`,
        html,
      }),
    });
    if (!r.ok) {
      const txt = await r.text();
      return { ok: false, erro: `resend_${r.status}: ${txt.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: String(e).slice(0, 200) };
  }
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

  let body: {
    token_validacao?: string;
    arquivo_path?: string;
    data_inicio_afastamento?: string;
    dias_afastamento?: number;
    declaracao_veracidade?: boolean;
    declaracao_original_48h?: boolean;
    declaracao_ciencia_nao_validacao?: boolean;
    tipo_documento?: string;
    sistema_afetado_codigo?: string;
    sistema_afetado_observacao?: string;
    // legado, opcionais (não coletados)
    cid?: string;
    medico_nome?: string;
    medico_registro?: string;
    observacao?: string;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400, cors);
  }

  const token = String(body.token_validacao || "");
  const arquivoPath = String(body.arquivo_path || "");
  const dataInicio = String(body.data_inicio_afastamento || "");
  const dias = Number(body.dias_afastamento);
  const decVer = body.declaracao_veracidade === true;
  const decOrig = body.declaracao_original_48h === true;
  const decCie = body.declaracao_ciencia_nao_validacao === true;

  const tipoDocumento = String(body.tipo_documento || "").trim();
  const sistemaCodigo = String(body.sistema_afetado_codigo || "").trim();
  const sistemaObs = (body.sistema_afetado_observacao || "").toString().trim();

  const isValidISODate = (s: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const d = new Date(`${s}T00:00:00.000Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  };

  const hoje = hojeBRT();

  // Validações de payload (antes de qualquer efeito colateral).
  if (
    !token || !arquivoPath ||
    !isValidISODate(dataInicio) ||
    dataInicio > hoje ||
    !Number.isInteger(dias) || dias < 1 || dias > 365
  ) {
    return jsonResponse({ error: "invalid_input" }, 400, cors);
  }

  if (!decVer || !decOrig || !decCie) {
    return jsonResponse({ error: "declaracoes_obrigatorias" }, 400, cors);
  }

  // Tipo de documento — descrição e destino derivados no backend.
  const tipoInfo = TIPOS_DOCUMENTO[tipoDocumento];
  if (!tipoInfo) {
    return jsonResponse({ error: "tipo_documento_invalido" }, 400, cors);
  }
  const isAtestadoMedico = tipoDocumento === "atestado_medico";

  // Sistema afetado — obrigatório apenas para atestado médico.
  let sistemaDescricao: string | null = null;
  if (isAtestadoMedico) {
    sistemaDescricao = SISTEMAS_AFETADOS[sistemaCodigo] ?? null;
    if (!sistemaDescricao) {
      return jsonResponse({ error: "sistema_afetado_invalido" }, 400, cors);
    }
    if (sistemaCodigo === "21") {
      if (sistemaObs.length < 3 || sistemaObs.length > 2000) {
        return jsonResponse(
          { error: "sistema_afetado_observacao_obrigatoria" },
          400,
          cors,
        );
      }
    } else if (sistemaObs.length > 0 && (sistemaObs.length < 3 || sistemaObs.length > 2000)) {
      return jsonResponse(
        { error: "sistema_afetado_observacao_invalida" },
        400,
        cors,
      );
    }
  }

  const claims = await verifyToken(token, HMAC_SECRET);
  if (!claims) return jsonResponse({ error: "token_invalido" }, 401, cors);

  if (!/^\d{4}\/\d{2}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(pdf|jpg|jpeg|png)$/i.test(arquivoPath)) {
    return jsonResponse({ error: "invalid_path" }, 400, cors);
  }

  const ip = getClientIp(req);

  // Limites por tipo de documento — ANTES de consumir o nonce e antes do insert.
  const limite = LIMITES[tipoDocumento];
  if (limite) {
    const inicioJanela = addMonthsISO(hoje, -limite.meses);
    const { data: rowsLimite, error: limiteErr } = await supabase
      .from("bd_atestados_medicos")
      .select("id, status")
      .eq("funcionario_id", claims.funcionario_id)
      .eq("tipo_documento", tipoDocumento)
      .gte("enviado_em", `${inicioJanela}T00:00:00`);
    if (limiteErr) {
      return jsonResponse({ error: "limite_check_error" }, 500, cors);
    }
    const validos = (rowsLimite || []).filter((r) =>
      !STATUS_EXCLUIDOS.includes(String(r.status || "").toLowerCase())
    );
    if (validos.length >= limite.max) {
      // Best-effort: remove o arquivo já enviado ao storage; nonce NÃO é consumido.
      await supabase.storage.from(BUCKET).remove([arquivoPath]).catch(() => {});
      return jsonResponse({ error: limite.erro }, 409, cors);
    }
  }

  const { data: nonceOk, error: nonceErr } = await supabase.rpc(
    "fn_registrar_nonce_atestado",
    { p_nonce: claims.nonce, p_funcionario_id: claims.funcionario_id, p_ip: ip },
  );
  if (nonceErr) return jsonResponse({ error: "nonce_error" }, 500, cors);
  if (nonceOk === false) {
    return jsonResponse({ error: "token_ja_utilizado" }, 409, cors);
  }

  const { data: dl, error: dlErr } = await supabase.storage
    .from(BUCKET)
    .download(arquivoPath);
  if (dlErr || !dl) {
    return jsonResponse({ error: "arquivo_nao_encontrado" }, 404, cors);
  }
  const buf = new Uint8Array(await dl.arrayBuffer());
  if (buf.length === 0 || buf.length > MAX_BYTES) {
    return jsonResponse({ error: "tamanho_invalido" }, 400, cors);
  }
  const kind = detectKind(buf);
  if (!kind) {
    await supabase.storage.from(BUCKET).remove([arquivoPath]).catch(() => {});
    return jsonResponse({ error: "tipo_arquivo_invalido" }, 400, cors);
  }
  const hash = await sha256Hex(buf);

  const { data: func, error: funcErr } = await supabase
    .from("bd_funcionarios")
    .select("id, nome_completo, matricula, centro_custo_id")
    .eq("id", claims.funcionario_id)
    .maybeSingle();
  if (funcErr || !func) {
    return jsonResponse({ error: "funcionario_nao_encontrado" }, 404, cors);
  }

  let ccSnapshot: string | null = null;
  if (func.centro_custo_id) {
    const { data: cc } = await supabase
      .from("bd_centros_custo")
      .select("codigo_centro_custo, nome_centro_custo")
      .eq("id", func.centro_custo_id)
      .maybeSingle();
    if (cc) {
      ccSnapshot = `${cc.codigo_centro_custo} — ${cc.nome_centro_custo}`;
    }
  }

  const { data: protoData, error: protoErr } = await supabase.rpc(
    "fn_gerar_protocolo_atestado",
  );
  if (protoErr || !protoData) {
    return jsonResponse({ error: "protocolo_error" }, 500, cors);
  }
  const protocolo = String(protoData);

  // Regra de prazo BRT (por data): envio até (dataInicio + 1 dia).
  const limitePrazo = addDaysISO(dataInicio, 1);
  const dentroPrazo = hoje <= limitePrazo;

  const alertas: Array<{ codigo: string; meta?: Record<string, unknown> }> = [];
  alertas.push({ codigo: dentroPrazo ? "prazo_ok" : "prazo_fora" });

  // Alertas médicos — somente para atestado médico.
  if (isAtestadoMedico) {
    if (dias >= 5) alertas.push({ codigo: "afastamento_5_dias", meta: { dias } });

    const inicioMes = `${hoje.slice(0, 7)}-01`;
    const inicio60d = addDaysISO(hoje, -59);

    const { data: mesRows } = await supabase
      .from("bd_atestados_medicos")
      .select("id, dias_afastamento, status, data_inicio_afastamento")
      .eq("funcionario_id", func.id)
      .eq("tipo_documento", "atestado_medico")
      .gte("data_inicio_afastamento", inicioMes)
      .lte("data_inicio_afastamento", hoje);

    const mesValidos = (mesRows || []).filter((r) =>
      !STATUS_EXCLUIDOS.includes(String(r.status || "").toLowerCase())
    );
    const totalMes = mesValidos.length + 1; // inclui o atual
    if (totalMes > 5) {
      alertas.push({ codigo: "recorrencia_mes", meta: { total_mes: totalMes } });
    }

    const { data: rows60 } = await supabase
      .from("bd_atestados_medicos")
      .select("id, dias_afastamento, status, data_inicio_afastamento")
      .eq("funcionario_id", func.id)
      .eq("tipo_documento", "atestado_medico")
      .gte("data_inicio_afastamento", inicio60d)
      .lte("data_inicio_afastamento", hoje);

    const rows60Validos = (rows60 || []).filter((r) =>
      !STATUS_EXCLUIDOS.includes(String(r.status || "").toLowerCase())
    );
    const total60 = rows60Validos.length + 1;
    const somaDias60 =
      rows60Validos.reduce((s, r) => s + (Number(r.dias_afastamento) || 0), 0) +
      dias;
    if (somaDias60 >= 16 || total60 > 5) {
      alertas.push({
        codigo: "acompanhamento_60d",
        meta: { soma_dias_60d: somaDias60, total_60d: total60 },
      });
    }
  }

  const { data: inserted, error: insErr } = await supabase
    .from("bd_atestados_medicos")
    .insert({
      protocolo,
      funcionario_id: func.id,
      matricula_snapshot: func.matricula,
      nome_snapshot: func.nome_completo,
      centro_custo_id: func.centro_custo_id,
      centro_custo_snapshot: ccSnapshot,
      data_emissao: hoje,
      dias_afastamento: dias,
      cid: null,
      medico_nome: null,
      medico_registro: null,
      observacao: null,
      data_inicio_afastamento: dataInicio,
      declaracao_veracidade: true,
      declaracao_original_48h: true,
      declaracao_ciencia_nao_validacao: true,
      declaracoes_aceitas_em: new Date().toISOString(),
      arquivo_path: arquivoPath,
      arquivo_mime: kind.mime,
      arquivo_tamanho_bytes: buf.length,
      arquivo_hash_sha256: hash,
      dentro_prazo_24h: dentroPrazo,
      prazo_calculo_regra: "inicio_afastamento_d1_brt",
      tipo_documento: tipoDocumento,
      tipo_documento_descricao: tipoInfo.descricao,
      notificacao_email_destino: tipoInfo.email_destino,
      sistema_afetado_codigo: isAtestadoMedico ? sistemaCodigo : null,
      sistema_afetado_descricao: isAtestadoMedico ? sistemaDescricao : null,
      sistema_afetado_observacao:
        isAtestadoMedico && sistemaObs.length > 0 ? sistemaObs : null,
      alertas_gerados: alertas,
      origem_hmac_nonce: claims.nonce,
      ip_origem: ip,
      user_agent: req.headers.get("User-Agent")?.slice(0, 500) || null,
    })
    .select("id, protocolo")
    .single();

  if (insErr || !inserted) {
    return jsonResponse({ error: "insert_failed", detalhe: insErr?.message }, 500, cors);
  }

  // E-mail em segundo plano: o colaborador nunca espera pelo Resend.
  const enviadoEmFmt = new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
  const notificar = (async () => {
    const mail = await enviarEmail({
      protocolo,
      matricula: func.matricula,
      nome: func.nome_completo,
      dias,
      dentroPrazo,
      tipoDescricao: tipoInfo.descricao,
      emailDestino: tipoInfo.email_destino,
      enviadoEm: enviadoEmFmt,
    });
    await supabase.from("bd_atestados_medicos").update({
      notificacao_email_status: mail.ok
        ? "enviada"
        : (RESEND_API_KEY ? "erro" : "desabilitada"),
      notificacao_email_enviada_em: mail.ok ? new Date().toISOString() : null,
      notificacao_email_erro: mail.ok ? null : (mail.erro || null),
      notificacao_email_tentativas: 1,
    }).eq("id", inserted.id);
  })().catch(() => {});

  const runtime = (globalThis as any).EdgeRuntime;
  if (runtime?.waitUntil) runtime.waitUntil(notificar);

  return jsonResponse({
    ok: true,
    protocolo,
    dentro_prazo_24h: dentroPrazo,
    tipo_documento: tipoDocumento,
    tipo_documento_descricao: tipoInfo.descricao,
    sistema_afetado_codigo: isAtestadoMedico ? sistemaCodigo : null,
    sistema_afetado_descricao: isAtestadoMedico ? sistemaDescricao : null,
    alertas_gerados: alertas,
  }, 200, cors);
});
