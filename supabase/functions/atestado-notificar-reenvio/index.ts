// Edge: atestado-notificar-reenvio
// Autenticada. Reenvia notificação por e-mail para atestados com status pendente/erro.
// Requer SuperAdm OU saude_atestados_analisar.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsFor, jsonResponse } from "../_shared/atestados-cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const EMAIL_DESTINO = "saude@lytoranea.com.br";
const EMAIL_FROM = '"LYTOTEC ERP - Atestados Medicos" <no-reply@lytotec.com.br>';

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

  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) {
    return jsonResponse({ error: "unauthorized" }, 401, cors);
  }
  const token = auth.slice(7);
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
  });
  const { data: claimsData, error: claimsErr } = await userClient.auth
    .getClaims(token);
  if (claimsErr || !claimsData?.claims?.sub) {
    return jsonResponse({ error: "unauthorized" }, 401, cors);
  }
  const userId = claimsData.claims.sub as string;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: isSA } = await admin.rpc("has_role", {
    p_role: "SuperAdm",
    p_user_id: userId,
  });
  const { data: canAnalisar } = await admin.rpc("has_permission", {
    p_permission_name: "saude_atestados_analisar",
    p_user_id: userId,
  });
  if (!isSA && !canAnalisar) {
    return jsonResponse({ error: "forbidden" }, 403, cors);
  }

  let body: { atestado_id?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400, cors);
  }
  const atestadoId = String(body.atestado_id || "");
  if (!/^[0-9a-f-]{36}$/i.test(atestadoId)) {
    return jsonResponse({ error: "invalid_input" }, 400, cors);
  }

  const { data: atm, error: atmErr } = await admin
    .from("bd_atestados_medicos")
    .select(
      "id, protocolo, matricula_snapshot, nome_snapshot, dias_afastamento, dentro_prazo_24h, notificacao_email_tentativas, notificacao_email_status",
    )
    .eq("id", atestadoId)
    .maybeSingle();
  if (atmErr || !atm) {
    return jsonResponse({ error: "nao_encontrado" }, 404, cors);
  }

  const statusEmail = String(atm.notificacao_email_status ?? "").toLowerCase();
  if (statusEmail === "enviado" || statusEmail === "enviada") {
    return jsonResponse({
      ok: true,
      status: "ja_enviado",
      reenviado: false,
    }, 200, cors);
  }

  if (!RESEND_API_KEY) {
    await admin.from("bd_atestados_medicos").update({
      notificacao_email_status: "desabilitada",
      notificacao_email_erro: "resend_key_missing",
      notificacao_email_tentativas: (atm.notificacao_email_tentativas || 0) + 1,
    }).eq("id", atm.id);
    return jsonResponse({ error: "resend_key_missing" }, 500, cors);
  }

  const html = `
    <p>Reenvio de notificação de atestado médico.</p>
    <ul>
      <li><b>Protocolo:</b> ${atm.protocolo}</li>
      <li><b>Colaborador:</b> ${atm.nome_snapshot} (matrícula ${atm.matricula_snapshot})</li>
      <li><b>Dias:</b> ${atm.dias_afastamento}</li>
      <li><b>Dentro de 24h:</b> ${atm.dentro_prazo_24h ? "Sim" : "Não"}</li>
    </ul>`;

  let ok = false, erro: string | null = null;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [EMAIL_DESTINO],
        reply_to: EMAIL_DESTINO,
        subject: `[Atestado - Reenvio] ${atm.protocolo}`,
        html,
      }),
    });
    ok = r.ok;
    if (!r.ok) erro = `resend_${r.status}: ${(await r.text()).slice(0, 200)}`;
  } catch (e) {
    erro = String(e).slice(0, 200);
  }

  await admin.from("bd_atestados_medicos").update({
    notificacao_email_status: ok ? "enviada" : "erro",
    notificacao_email_enviada_em: ok ? new Date().toISOString() : null,
    notificacao_email_erro: ok ? null : erro,
    notificacao_email_tentativas: (atm.notificacao_email_tentativas || 0) + 1,
  }).eq("id", atm.id);

  return jsonResponse({ ok, erro }, ok ? 200 : 500, cors);
});
