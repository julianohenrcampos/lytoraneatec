import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  validarDispositivoTotem,
  respostaErro,
} from "../_shared/ponto-helpers.ts";

interface Body {
  codigo_dispositivo?: string;
  modo?: "matricula" | "cpf" | "nome";
  valor?: string;
}

function validar(body: any): { ok: true; data: Required<Body> } | { ok: false; erro: string } {
  if (!body || typeof body !== "object") return { ok: false, erro: "payload inválido" };
  const codigo = String(body.codigo_dispositivo || "").trim();
  const modo = String(body.modo || "").trim();
  const valor = String(body.valor || "").trim();
  if (!codigo) return { ok: false, erro: "codigo_dispositivo obrigatório" };
  if (!["matricula", "cpf", "nome"].includes(modo)) return { ok: false, erro: "modo inválido" };
  if (valor.length < 2) return { ok: false, erro: "valor muito curto" };
  if (valor.length > 120) return { ok: false, erro: "valor muito longo" };
  return { ok: true, data: { codigo_dispositivo: codigo, modo: modo as any, valor } };
}

async function montarFuncionario(
  supabaseAdmin: any,
  func: any,
  ccsAutorizados: string[]
) {
  // Verifica vínculo
  const { data: vinc } = await supabaseAdmin
    .from("bd_ponto_vinculos_operacionais")
    .select("centro_custo_id")
    .eq("funcionario_id", func.id)
    .eq("ativo", true)
    .in("centro_custo_id", ccsAutorizados.length ? ccsAutorizados : ["00000000-0000-0000-0000-000000000000"]);

  const temVinculoDireto = !!vinc && vinc.length > 0;
  const temVinculoFallback = !!func.centro_custo_id && ccsAutorizados.includes(func.centro_custo_id);
  if (!temVinculoDireto && !temVinculoFallback) {
    return { ok: false as const, motivo: "sem_vinculo" };
  }

  // CC efetivo
  const ccEfetivo =
    (func.centro_custo_id && ccsAutorizados.includes(func.centro_custo_id) && func.centro_custo_id) ||
    vinc?.[0]?.centro_custo_id ||
    ccsAutorizados[0];

  // Busca biometria ativa+aprovada
  const { data: bio } = await supabaseAdmin
    .from("bd_funcionarios_biometria_facial")
    .select("foto_url, status, ativo")
    .eq("funcionario_id", func.id)
    .eq("ativo", true)
    .eq("status", "aprovado")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let fotoUrl: string | null = bio?.foto_url ?? null;
  // Signed URL se necessário
  if (fotoUrl && !fotoUrl.startsWith("http")) {
    const { data: signed } = await supabaseAdmin.storage
      .from("biometria-facial")
      .createSignedUrl(fotoUrl, 3600);
    fotoUrl = signed?.signedUrl ?? null;
  }

  // Dados do CC para nome
  let ccNome: string | null = null;
  if (ccEfetivo) {
    const { data: ccRow } = await supabaseAdmin
      .from("bd_centros_custo")
      .select("nome_centro_custo, codigo_centro_custo")
      .eq("id", ccEfetivo)
      .maybeSingle();
    if (ccRow) ccNome = `${ccRow.codigo_centro_custo} - ${ccRow.nome_centro_custo}`;
  }

  // Função
  let funcaoNome: string | null = null;
  if (func.funcao_id) {
    const { data: fnRow } = await supabaseAdmin
      .from("bd_funcoes")
      .select("nome_funcao")
      .eq("id", func.funcao_id)
      .maybeSingle();
    funcaoNome = fnRow?.nome_funcao ?? null;
  }

  return {
    ok: true as const,
    funcionario: {
      funcionario_id: func.id,
      nome: func.nome_completo,
      matricula: func.matricula ?? null,
      cpf: func.cpf ?? null,
      funcao: funcaoNome,
      centro_custo: ccNome,
      foto_url: fotoUrl,
      sem_biometria: !bio,
      confianca: 1,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return respostaErro(405, "metodo_nao_permitido", "Método não permitido");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const deviceSecret = req.headers.get("x-device-secret");
    if (!deviceSecret) {
      return respostaErro(401, "auth_ausente", "x-device-secret obrigatório", "auth");
    }

    const body = await req.json().catch(() => ({}));
    const v = validar(body);
    if (!v.ok) return respostaErro(400, "payload_invalido", v.erro, "payload");
    const { codigo_dispositivo, modo, valor } = v.data;

    // Valida dispositivo
    const disp = await validarDispositivoTotem(supabaseAdmin, codigo_dispositivo, deviceSecret);
    if (!disp.valido) {
      return respostaErro(disp.status ?? 401, "dispositivo_invalido", disp.erro || "Dispositivo inválido", "dispositivo");
    }
    const dispositivo = disp.dispositivo!;

    // CCs autorizados
    const { data: ccsRows } = await supabaseAdmin
      .from("bd_ponto_dispositivo_centros_custo")
      .select("centro_custo_id")
      .eq("dispositivo_id", dispositivo.id)
      .eq("ativo", true);
    let ccsAutorizados: string[] = (ccsRows ?? []).map((r: any) => r.centro_custo_id).filter(Boolean);
    if (ccsAutorizados.length === 0 && dispositivo.centro_custo_id) {
      ccsAutorizados = [dispositivo.centro_custo_id];
    }
    console.log("[MANUAL][CCS]", { dispositivo_id: dispositivo.id, ccsAutorizados, modo });

    if (modo === "nome") {
      const { data: rows } = await supabaseAdmin
        .from("bd_funcionarios")
        .select("id, nome_completo, matricula, cpf, status, centro_custo_id, funcao_id")
        .ilike("nome_completo", `%${valor}%`)
        .in("status", ["Ativo", "Ativo sem Registro"])
        .limit(20);

      const sugestoes: any[] = [];
      for (const f of rows ?? []) {
        // Filtra por vínculo
        const r = await montarFuncionario(supabaseAdmin, f, ccsAutorizados);
        if (r.ok) {
          sugestoes.push({
            funcionario_id: r.funcionario.funcionario_id,
            nome: r.funcionario.nome,
            matricula: r.funcionario.matricula,
            funcao: r.funcionario.funcao,
            centro_custo: r.funcionario.centro_custo,
          });
          if (sugestoes.length >= 8) break;
        }
      }
      return new Response(JSON.stringify({ success: true, sugestoes }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // matricula / cpf
    const campo = modo === "cpf" ? "cpf" : "matricula";
    const valorBusca = modo === "cpf" ? valor.replace(/\D/g, "") : valor;
    const { data: func } = await supabaseAdmin
      .from("bd_funcionarios")
      .select("id, nome_completo, matricula, cpf, status, centro_custo_id, funcao_id")
      .eq(campo, valorBusca)
      .maybeSingle();

    if (!func) return respostaErro(404, "funcionario_nao_encontrado", "Funcionário não encontrado", "funcionario");
    if (!["Ativo", "Ativo sem Registro"].includes(func.status)) {
      return respostaErro(403, "funcionario_inativo", "Funcionário inativo", "funcionario");
    }

    const r = await montarFuncionario(supabaseAdmin, func, ccsAutorizados);
    if (!r.ok) {
      return respostaErro(
        403,
        "sem_vinculo",
        "Funcionário sem vínculo com esta obra",
        "vinculo",
        { funcionario_cc: func.centro_custo_id, dispositivo_ccs: ccsAutorizados }
      );
    }

    return new Response(JSON.stringify({ success: true, funcionario: r.funcionario }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[identificar-funcionario-manual] erro:", e?.message || e);
    return respostaErro(500, "erro_interno", e?.message || "Erro interno", "exception");
  }
});
