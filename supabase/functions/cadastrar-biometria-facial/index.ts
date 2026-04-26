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

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function pickClientIp(req: Request): string | null {
  const candidates = [
    req.headers.get("x-forwarded-for"),
    req.headers.get("cf-connecting-ip"),
    req.headers.get("x-real-ip"),
  ];
  const value = candidates.find(Boolean)?.split(",")[0]?.trim() ?? null;
  if (!value) return null;
  const isIPv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(value);
  const isIPv6 = /^[a-f0-9:]+$/i.test(value);
  return isIPv4 || isIPv6 ? value : null;
}

function decodeBase64Jpeg(b64: string): Uint8Array {
  const clean = b64.replace(/^data:image\/\w+;base64,/, "");
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => null);
    if (!body) return json({ error: "payload_invalido" }, 400);

    const origem = String(body.origem || "");
    const descriptor = body.descriptor;
    const fotoB64 = body.foto_base64 ? String(body.foto_base64) : null;

    if (!Array.isArray(descriptor) || descriptor.length !== 128) {
      return json({ error: "descriptor_invalido" }, 400);
    }

    // Auto-enrolamento desabilitado — somente RH cadastra biometria
    if (origem !== "admin_upload") {
      return json(
        {
          error: "auto_enrolamento_desabilitado",
          message:
            "Cadastro biométrico apenas pelo RH no painel administrativo. Procure o RH para cadastrar sua biometria.",
        },
        403,
      );
    }

    // Requer JWT de SuperAdm/AdmRH
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims, error: cErr } = await userClient.auth.getClaims(token);
    if (cErr || !claims?.claims?.sub) return json({ error: "unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const { data: isAdm } = await supabase.rpc("is_superadm_or_rh", { _user_id: userId });
    if (!isAdm) return json({ error: "forbidden" }, 403);

    const funcionario_id = String(body.funcionario_id || "");
    if (!funcionario_id) return json({ error: "funcionario_id_obrigatorio" }, 400);
    const cadastrado_por_user_id = userId;

    // Upload foto opcional
    let foto_url: string | null = null;
    if (fotoB64) {
      try {
        const bytes = decodeBase64Jpeg(fotoB64);
        const path = `${funcionario_id}/${crypto.randomUUID()}.jpg`;
        const { error: upErr } = await supabase.storage
          .from("biometria-facial")
          .upload(path, bytes, { contentType: "image/jpeg", upsert: false });
        if (upErr) console.warn("[cadastrar-biometria] upload falhou:", upErr.message);
        else foto_url = path;
      } catch (e) {
        console.warn("[cadastrar-biometria] decode foto falhou:", (e as Error).message);
      }
    }

    // Captura descriptor anterior (para auditoria)
    let hashAnterior: string | null = null;
    let teveBiometriaAtiva = false;
    try {
      const { data: prev } = await supabase
        .from("bd_funcionarios_biometria_facial")
        .select("descriptor")
        .eq("funcionario_id", funcionario_id)
        .eq("ativo", true)
        .maybeSingle();
      if (prev?.descriptor) {
        teveBiometriaAtiva = true;
        const desc = Array.isArray(prev.descriptor)
          ? prev.descriptor
          : Object.values(prev.descriptor as Record<string, number>);
        hashAnterior = await sha256Hex(JSON.stringify(desc));
      }
    } catch (e) {
      console.warn("[cadastrar-biometria] não foi possível ler descriptor anterior:", (e as Error).message);
    }

    // Admin upload é sempre aprovado e ativo
    await supabase
      .from("bd_funcionarios_biometria_facial")
      .update({ ativo: false })
      .eq("funcionario_id", funcionario_id)
      .eq("ativo", true);

    const vectorLiteral = `[${descriptor.join(",")}]`;
    const nowIso = new Date().toISOString();
    const { data: inserted, error: insErr } = await supabase
      .from("bd_funcionarios_biometria_facial")
      .insert({
        funcionario_id,
        descriptor: vectorLiteral,
        foto_url,
        origem: "admin_upload",
        cadastrado_por_user_id,
        dispositivo_origem_id: null,
        ativo: true,
        status_validacao: "aprovado",
        validado_por_user_id: cadastrado_por_user_id,
        validado_em: nowIso,
      })
      .select("id")
      .single();

    if (insErr) {
      console.error("[cadastrar-biometria] insert error:", insErr);
      // 23505 = unique_violation (índice unique_biometria_ativa)
      if ((insErr as any).code === "23505") {
        return json(
          {
            error: "biometria_ativa_duplicada",
            message:
              "Já existe uma biometria ativa para este funcionário. Recarregue a página e tente novamente.",
          },
          409,
        );
      }
      return json({ error: "erro_inserir", detail: insErr.message }, 500);
    }

    // Auditoria — best effort
    try {
      const hashNovo = await sha256Hex(JSON.stringify(descriptor));
      const ip = pickClientIp(req);
      const userAgent = req.headers.get("user-agent");
      await supabase.rpc("registrar_evento_auditoria_biometria", {
        p_funcionario_id: funcionario_id,
        p_tipo_evento: teveBiometriaAtiva ? "biometria_substituida" : "biometria_cadastrada",
        p_hash_anterior: hashAnterior,
        p_hash_novo: hashNovo,
        p_origem: "admin_web",
        p_ip: ip,
        p_user_agent: userAgent,
        p_metadata: {
          biometria_id: inserted.id,
          foto_path: foto_url,
          status_validacao: "aprovado",
          executor_user_id: cadastrado_por_user_id,
        },
      });
    } catch (auditErr) {
      console.warn("[cadastrar-biometria] auditoria falhou:", (auditErr as Error).message);
    }

    return json({
      success: true,
      id: inserted.id,
      foto_url,
      status_validacao: "aprovado",
      mensagem: "Cadastro aprovado e ativo",
    });
  } catch (e) {
    console.error("[cadastrar-biometria] erro:", (e as Error)?.message || e);
    return json({ error: "erro_interno" }, 500);
  }
});
