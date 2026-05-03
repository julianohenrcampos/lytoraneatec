// Modo Dispositivo de Obra — proxy fino sobre registrar-ponto-totem.
// Não duplica lógica: valida que o dispositivo é tipo='dispositivo_obra' e
// reencaminha o payload para a edge totem existente, preservando a auditoria,
// score antifraude, geofence, foto_hash e integrações.
//
// Diferenças vs totem:
// - Exige obrigatoriamente x-device-secret (não aceita x-api-key global).
// - Exige operador_id no payload (operador humano que registra a batida).
// - Calcula foto_hash SHA-256 do binário decodificado da foto e bloqueia
//   reutilização da mesma foto no mesmo dispositivo na última 1h.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-device-secret",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function decodeBase64Photo(b64: string): Uint8Array | null {
  try {
    const raw = b64.replace(/^data:image\/[a-zA-Z+]+;base64,/, "");
    const bin = atob(raw);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ success: false, codigo: "metodo_nao_permitido", erro: "Método não permitido" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const deviceSecret = req.headers.get("x-device-secret");
    if (!deviceSecret) {
      return json(
        { success: false, codigo: "device_secret_ausente", erro: "x-device-secret obrigatório" },
        401,
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json({ success: false, codigo: "payload_invalido", erro: "Payload inválido" }, 400);
    }

    const codigoDispositivo = String(body.codigo_dispositivo || "").trim().toUpperCase();
    const operadorId = body.operador_id ? String(body.operador_id) : null;
    const fotoBase64 = body.foto_base64 ? String(body.foto_base64) : null;

    if (!codigoDispositivo) {
      return json({ success: false, codigo: "codigo_ausente", erro: "Código do dispositivo obrigatório" }, 400);
    }
    if (!operadorId) {
      return json(
        { success: false, codigo: "operador_ausente", erro: "operador_id obrigatório no modo dispositivo de obra" },
        400,
      );
    }
    if (!fotoBase64) {
      return json(
        { success: false, codigo: "foto_ausente", erro: "Foto obrigatória no modo dispositivo de obra" },
        400,
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // 1) Validar dispositivo: tipo='dispositivo_obra', ativo, secret válido (compat com gestão de sessão atual).
    const { data: disp, error: dispErr } = await supabase
      .from("bd_ponto_dispositivos")
      .select(
        "id, codigo_dispositivo, tipo, ativo, device_session_token, device_session_expires_at",
      )
      .eq("codigo_dispositivo", codigoDispositivo)
      .maybeSingle();

    if (dispErr || !disp) {
      console.log("[DISPOBRA] dispositivo nao encontrado", codigoDispositivo);
      return json({ success: false, codigo: "dispositivo_invalido", erro: "Dispositivo não encontrado" }, 401);
    }
    if (disp.tipo !== "dispositivo_obra") {
      return json(
        { success: false, codigo: "tipo_invalido", erro: "Esta rota é exclusiva para dispositivos de obra" },
        403,
      );
    }
    if (!disp.ativo) {
      return json({ success: false, codigo: "dispositivo_inativo", erro: "Dispositivo inativo" }, 403);
    }
    if (!disp.device_session_token || disp.device_session_token !== deviceSecret) {
      return json({ success: false, codigo: "secret_invalido", erro: "Sessão inválida" }, 401);
    }
    if (
      disp.device_session_expires_at &&
      new Date(disp.device_session_expires_at).getTime() < Date.now()
    ) {
      return json({ success: false, codigo: "sessao_expirada", erro: "Sessão expirada" }, 401);
    }

    // 2) foto_hash sobre o conteúdo real (sem prefixo data:)
    const fotoBytes = decodeBase64Photo(fotoBase64);
    if (!fotoBytes || fotoBytes.length < 1024) {
      return json({ success: false, codigo: "foto_invalida", erro: "Foto inválida" }, 400);
    }
    const fotoHash = await sha256Hex(fotoBytes);

    // 3) Bloquear reuso da MESMA foto no mesmo dispositivo na última 1h
    const desde = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: dup } = await supabase
      .from("bd_ponto_batidas")
      .select("id")
      .eq("dispositivo_obra_id", disp.id)
      .eq("foto_hash", fotoHash)
      .gte("data_hora_servidor", desde)
      .limit(1);
    if (dup && dup.length > 0) {
      console.log("[DISPOBRA] foto duplicada", { disp: disp.id, hash: fotoHash.slice(0, 8) });
      return json(
        { success: false, codigo: "FOTO_DUPLICADA", erro: "Esta foto já foi usada recentemente neste dispositivo" },
        429,
      );
    }

    // 4) Encaminhar para a edge totem (lógica única e auditável de geofence/score/sequência).
    //    A edge totem aceita x-device-secret e payload idêntico — apenas passamos adiante.
    const totemUrl = `${supabaseUrl}/functions/v1/registrar-ponto-totem`;
    const fwdBody = {
      ...body,
      codigo_dispositivo: codigoDispositivo,
      // marcas extras não-quebrantes para auditoria do log
      origem_modo: "dispositivo_obra",
    };

    const totemResp = await fetch(totemUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-device-secret": deviceSecret,
        // Authorization com service role permite que esta chamada interna passe
        // sem precisar de JWT de usuário, mantendo a edge totem inalterada.
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
      body: JSON.stringify(fwdBody),
    });

    const totemJson = await totemResp.json().catch(() => ({}));

    // 5) Pós-processamento: persistir foto_hash, dispositivo_obra_id e operador_id
    //    na batida criada (a edge totem não conhece esses campos).
    if (totemResp.ok && (totemJson as any)?.batida_id) {
      const batidaId = (totemJson as any).batida_id;
      const { error: updErr } = await supabase
        .from("bd_ponto_batidas")
        .update({
          dispositivo_obra_id: disp.id,
          operador_id: operadorId,
          foto_hash: fotoHash,
        })
        .eq("id", batidaId);
      if (updErr) {
        console.error("[DISPOBRA] update marcadores falhou", updErr);
        // Não falha a operação — a batida já está registrada e válida.
      }
    }

    return new Response(JSON.stringify(totemJson), {
      status: totemResp.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[DISPOBRA] erro geral", (e as Error)?.message || e);
    return json({ success: false, codigo: "erro_interno", erro: "Erro interno" }, 500);
  }
});
