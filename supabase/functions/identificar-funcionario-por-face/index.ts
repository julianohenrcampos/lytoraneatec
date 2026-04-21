import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-device-secret",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Defaults (sobrescritos pela bd_ponto_config se presentes)
const DEFAULT_MIN_CONFIDENCE = 0.55;     // abaixo disso = outra pessoa
const DEFAULT_STRONG_CONFIDENCE = 0.70;  // acima disso = match forte
const DEFAULT_MIN_DELTA = 0.08;          // diferença mínima top1 vs top2
const LOG_SAMPLE = 3;

let _logCounter = 0;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const deviceSecret = req.headers.get("x-device-secret");
    if (!deviceSecret) return json({ error: "device_secret_obrigatorio", stage: "auth" }, 401);

    const body = await req.json().catch(() => null);
    const codigo = String(body?.codigo_dispositivo || "").trim().toUpperCase();
    const descriptor = body?.face_descriptor;
    if (!codigo || !Array.isArray(descriptor) || descriptor.length !== 128) {
      return json({ error: "payload_invalido", stage: "validate" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Validar dispositivo + sessão
    const { data: disp, error: dispErr } = await supabase
      .from("bd_ponto_dispositivos")
      .select("id, ativo, tipo, device_session_token, device_session_expires_at")
      .eq("codigo_dispositivo", codigo)
      .maybeSingle();

    if (dispErr) {
      console.error("[identificar-face] erro buscar dispositivo:", dispErr);
      return json({ error: "erro_dispositivo", stage: "device_lookup", detail: dispErr.message }, 500);
    }
    if (!disp || disp.tipo !== "dispositivo_obra" || !disp.ativo) {
      return json({ error: "dispositivo_invalido", stage: "device_validate" }, 401);
    }
    if (disp.device_session_token !== deviceSecret) {
      return json({ error: "sessao_invalida", stage: "session" }, 401);
    }
    if (disp.device_session_expires_at && new Date(disp.device_session_expires_at) < new Date()) {
      return json({ error: "sessao_expirada", stage: "session" }, 401);
    }

    // Carrega config (modo estrito + thresholds)
    let modoEstrito = true;
    let minConfidence = DEFAULT_MIN_CONFIDENCE;
    let strongConfidence = DEFAULT_STRONG_CONFIDENCE;
    let minDelta = DEFAULT_MIN_DELTA;
    try {
      const { data: cfg } = await supabase
        .from("bd_ponto_config")
        .select("modo_reconhecimento_estrito, match_min_confidence, match_strong_confidence, match_min_delta")
        .limit(1)
        .maybeSingle();
      if (cfg) {
        if (typeof cfg.modo_reconhecimento_estrito === "boolean") modoEstrito = cfg.modo_reconhecimento_estrito;
        if (typeof cfg.match_min_confidence === "number") minConfidence = cfg.match_min_confidence;
        if (typeof cfg.match_strong_confidence === "number") strongConfidence = cfg.match_strong_confidence;
        if (typeof cfg.match_min_delta === "number") minDelta = cfg.match_min_delta;
      }
    } catch (_e) {
      // mantém defaults
    }

    // RPC v2 — top-2 + confidence
    const vectorLiteral = `[${descriptor.join(",")}]`;
    const { data, error } = await supabase.rpc(
      "identificar_funcionario_por_descriptor_v2",
      {
        p_dispositivo_id: disp.id,
        p_descriptor: vectorLiteral,
      },
    );

    if (error) {
      console.error("[identificar-face] rpc v2 error:", error);
      return json({
        error: "erro_matching",
        stage: "rpc_v2",
        detail: error.message,
      }, 500);
    }

    const row = Array.isArray(data) && data.length > 0 ? data[0] : null;

    // Sem candidato
    if (!row || !row.top1_funcionario_id) {
      const audit = {
        found: false,
        decisao: "rejeitado" as const,
        reason: "sem_candidato" as const,
        top1_confidence: null,
        top2_confidence: null,
        delta: null,
        thresholds: { min: minConfidence, strong: strongConfidence, delta: minDelta },
        modo_estrito: modoEstrito,
      };
      console.log("[identificar-face] AUDIT", audit);
      _logCounter++;
      if (_logCounter % LOG_SAMPLE === 0) {
        await supabase.from("bd_ponto_match_log").insert({
          dispositivo_id: disp.id,
          decisao: "rejeitado",
          motivo: "sem_candidato",
          threshold_aplicado: minConfidence,
          margem_min_aplicada: minDelta,
        });
      }
      return json(audit);
    }

    const top1Id: string = row.top1_funcionario_id;
    const top1D: number = Number(row.top1_distancia_euclid);
    const top1Conf: number = Number(row.top1_confidence);
    const top2Id: string | null = row.top2_funcionario_id ?? null;
    const top2D: number | null = row.top2_distancia_euclid != null ? Number(row.top2_distancia_euclid) : null;
    const top2Conf: number | null = row.top2_confidence != null ? Number(row.top2_confidence) : null;
    const margem: number | null = row.margem_euclid != null ? Number(row.margem_euclid) : null;
    const delta: number | null = row.delta_confidence != null ? Number(row.delta_confidence) : null;

    // ===== TRÊS ZONAS DE DECISÃO =====
    let decisao: "aceito" | "provisorio" | "rejeitado" = "rejeitado";
    let reason: "low_confidence" | "ambiguous_match" | "not_strong_enough" | undefined;

    if (top1Conf < minConfidence) {
      decisao = "rejeitado";
      reason = "low_confidence";
    } else if (top2Conf != null && delta != null && delta < minDelta) {
      decisao = "rejeitado";
      reason = "ambiguous_match";
    } else if (top1Conf < strongConfidence) {
      decisao = "rejeitado";
      reason = "not_strong_enough";
    } else {
      decisao = modoEstrito ? "provisorio" : "aceito";
    }

    // Foto signed URL apenas se vai retornar funcionário
    let fotoUrl: string | null = row.foto_url ?? null;
    if (decisao !== "rejeitado" && fotoUrl && !/^https?:\/\//i.test(fotoUrl)) {
      try {
        const path = String(fotoUrl).replace(/^\/+/, "");
        const { data: signed } = await supabase.storage
          .from("biometria-facial")
          .createSignedUrl(path, 300);
        fotoUrl = signed?.signedUrl ?? null;
      } catch {
        fotoUrl = null;
      }
    }

    const audit = {
      found: decisao !== "rejeitado",
      decisao,
      reason,
      top1_funcionario_id: top1Id,
      top1_distancia: top1D,
      top1_confidence: top1Conf,
      top2_funcionario_id: top2Id,
      top2_distancia: top2D,
      top2_confidence: top2Conf,
      margem,
      delta,
      thresholds: { min: minConfidence, strong: strongConfidence, delta: minDelta },
      modo_estrito: modoEstrito,
    };
    console.log("[identificar-face] AUDIT", audit);

    // Log amostrado
    _logCounter++;
    let logId: string | null = null;
    if (_logCounter % LOG_SAMPLE === 0) {
      const { data: ins } = await supabase
        .from("bd_ponto_match_log")
        .insert({
          dispositivo_id: disp.id,
          top1_funcionario_id: top1Id,
          top1_distancia: top1D,
          top2_funcionario_id: top2Id,
          top2_distancia: top2D,
          margem,
          threshold_aplicado: minConfidence,
          margem_min_aplicada: minDelta,
          decisao,
          motivo: reason ?? null,
        })
        .select("id")
        .single();
      logId = ins?.id ?? null;
    }

    if (decisao === "rejeitado") {
      // Para "not_strong_enough" devolve candidato (UI pode pedir aproximação)
      if (reason === "not_strong_enough") {
        return json({
          ...audit,
          log_id: logId,
          candidate: {
            funcionario_id: top1Id,
            nome: row.nome,
            matricula: row.matricula,
          },
        });
      }
      return json({ ...audit, log_id: logId });
    }

    return json({
      ...audit,
      log_id: logId,
      funcionario_id: top1Id,
      nome: row.nome,
      matricula: row.matricula,
      cpf: row.cpf,
      funcao: row.funcao,
      centro_custo: row.centro_custo,
      foto_url: fotoUrl,
    });
  } catch (e) {
    console.error("[identificar-face] erro:", (e as Error)?.message || e);
    return json({ error: "erro_interno", stage: "exception", detail: (e as Error)?.message }, 500);
  }
});
