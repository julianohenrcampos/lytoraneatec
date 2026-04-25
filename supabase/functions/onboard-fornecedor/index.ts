import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

const normalizeText = (value?: string | null) => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
};

const parseNullableNumber = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const apiKey = req.headers.get("x-api-key");
  const expectedKey = Deno.env.get("LYTOTEC_API_KEY");

  if (!apiKey || apiKey !== expectedKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let logId: string | null = null;

  try {
    const body = await req.json();
    const { empresa, portfolio, fornecedor_externo_id } = body;

    // Validar campos obrigatórios
    if (!empresa?.cnpj || !empresa?.nome_empresa) {
      return new Response(
        JSON.stringify({ error: "cnpj e nome_empresa são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cnpjLimpo = empresa.cnpj.replace(/\D/g, "");

    // 1. Gravar log com status pendente
    const { data: logData, error: logError } = await supabase
      .from("bd_integracao_fornecedores_log")
      .insert({
        origem: "site",
        fornecedor_externo_id: fornecedor_externo_id || null,
        cnpj: cnpjLimpo,
        payload_json: body,
        status_processamento: "pendente",
      })
      .select("id")
      .single();

    if (logError) throw new Error(`Erro ao criar log: ${logError.message}`);
    logId = logData.id;

    // 2. Verificar CNPJ existente
    const { data: existente } = await supabase
      .from("bd_empresas")
      .select("id, nome_empresa")
      .eq("cnpj", empresa.cnpj)
      .maybeSingle();

    let empresaId: string;
    let acao: "criacao" | "atualizacao";

    if (existente) {
      // Empresa já existe — atualizar flags de integração
      empresaId = existente.id;
      acao = "atualizacao";

      const updateData: Record<string, any> = {
        atualizado_via_integracao: true,
        data_integracao: new Date().toISOString(),
        aprovado_compliance: true,
      };
      if (empresa.endereco_latitude != null) updateData.endereco_latitude = empresa.endereco_latitude;
      if (empresa.endereco_longitude != null) updateData.endereco_longitude = empresa.endereco_longitude;

      await supabase
        .from("bd_empresas")
        .update(updateData)
        .eq("id", empresaId);
    } else {
      // Criar nova empresa
      acao = "criacao";

      const { data: novaEmpresa, error: errEmpresa } = await supabase
        .from("bd_empresas")
        .insert({
          nome_empresa: normalizeText(empresa.nome_empresa),
          cnpj: empresa.cnpj,
          telefone: empresa.telefone || null,
          pessoa_tipo: empresa.pessoa_tipo || "PJ",
          nome_contato: empresa.nome_contato || null,
          endereco_completo: empresa.endereco_completo || null,
          endereco_cidade: empresa.endereco_cidade || null,
          endereco_estado: empresa.endereco_estado || null,
          endereco_cep: empresa.endereco_cep || null,
          endereco_latitude: empresa.endereco_latitude || null,
          endereco_longitude: empresa.endereco_longitude || null,
          tipo_empresa: "FORNECEDOR",
          situacao: "Ativa",
          origem_cadastro: "integracao_site",
          aprovado_compliance: true,
          data_integracao: new Date().toISOString(),
          atualizado_via_integracao: false,
        })
        .select("id")
        .single();

      if (errEmpresa) throw new Error(`Erro ao criar empresa: ${errEmpresa.message}`);
      empresaId = novaEmpresa.id;
    }

    // 3. Criar itens de portfolio
    let portfolioCount = 0;
    const portfolioErrors: string[] = [];
    if (portfolio && Array.isArray(portfolio) && portfolio.length > 0) {
      for (const [index, item] of portfolio.entries()) {
        try {
          // Resolver subcategoria por nome
          let variacaoId: string | null = null;
          const capacidadeValor = parseNullableNumber(item.capacidade_valor);
          const capacidadeUnidade = normalizeText(item.capacidade_unidade);
          const subcategoriaNome = normalizeText(item.subcategoria_nome);

          if (subcategoriaNome) {
            const { data: subcat, error: subcatError } = await supabase
              .from("bd_subcategorias_ativos")
              .select("id")
              .ilike("nome_subcategoria", subcategoriaNome)
              .maybeSingle();

            if (subcatError) {
              throw new Error(`Erro ao buscar subcategoria: ${subcatError.message}`);
            }

            if (subcat) {
              // Buscar ou criar variação
              if (capacidadeValor !== null || capacidadeUnidade) {
                const { data: variacao, error: variacaoError } = await supabase
                  .from("bd_catalogo_variacoes")
                  .select("id")
                  .eq("subcategoria_id", subcat.id)
                  .eq("capacidade_valor", capacidadeValor)
                  .eq("capacidade_unidade", capacidadeUnidade)
                  .maybeSingle();

                if (variacaoError) {
                  throw new Error(`Erro ao buscar variação: ${variacaoError.message}`);
                }

                if (variacao) {
                  variacaoId = variacao.id;
                } else {
                  const { data: novaVar, error: novaVarError } = await supabase
                    .from("bd_catalogo_variacoes")
                    .insert({
                      subcategoria_id: subcat.id,
                      capacidade_valor: capacidadeValor,
                      capacidade_unidade: capacidadeUnidade,
                      origem: "FORNECEDOR",
                    })
                    .select("id")
                    .single();

                  if (novaVarError) {
                    throw new Error(`Erro ao criar variação: ${novaVarError.message}`);
                  }

                  if (novaVar) variacaoId = novaVar.id;
                }
              }
            } else {
              portfolioErrors.push(`Item ${index + 1}: subcategoria '${subcategoriaNome}' não encontrada.`);
            }
          }

          const { error: portfolioInsertError } = await supabase.from("bd_portfolio_empresas").insert({
            empresa_id: empresaId,
            catalogo_variacao_id: variacaoId,
            fabricante: normalizeText(item.fabricante),
            modelo: normalizeText(item.modelo),
            ano_fabricacao: item.ano_fabricacao || null,
            quantidade_estimada: item.quantidade_estimada || 1,
            valor_ref_com_operador: parseNullableNumber(item.valor_ref_com_operador),
            valor_ref_sem_operador: parseNullableNumber(item.valor_ref_sem_operador),
            observacoes: item.observacoes || null,
          });

          if (portfolioInsertError) {
            throw new Error(`Erro ao criar item de portfolio: ${portfolioInsertError.message}`);
          }

          portfolioCount++;
        } catch (itemErr) {
          portfolioErrors.push(`Item ${index + 1}: ${itemErr instanceof Error ? itemErr.message : "Erro desconhecido"}`);
          console.error("Erro ao criar item de portfolio:", itemErr);
        }
      }
    }

    // 4. Criar notificação
    const nomeEmpresa = normalizeText(empresa.nome_empresa) || empresa.nome_empresa;
    const titulo = acao === "criacao"
      ? "Nova empresa cadastrada via portal"
      : "Empresa atualizada via portal";
    const mensagem = `${nomeEmpresa}\nCNPJ: ${empresa.cnpj}\nAprovada no compliance e integrada ao sistema`;

    const { data: notif } = await supabase
      .from("bd_notificacoes")
      .insert({
        tipo: "integracao_fornecedor",
        titulo,
        mensagem,
        link: "/gestao-empresas",
        metadata: { cnpj: empresa.cnpj, empresa_id: empresaId, acao, portfolio_count: portfolioCount },
      })
      .select("id")
      .single();

    if (notif) {
      // Buscar admins (roles com nome contendo admin)
      const { data: adminRoles } = await supabase
        .from("bd_roles")
        .select("id")
        .or("nome.ilike.%admin%,nome.ilike.%superadm%");

      if (adminRoles && adminRoles.length > 0) {
        const roleIds = adminRoles.map((r: any) => r.id);

        const { data: adminUsers } = await supabase
          .from("bd_user_roles")
          .select("user_id")
          .in("role_id", roleIds);

        if (adminUsers && adminUsers.length > 0) {
          const uniqueUsers = [...new Set(adminUsers.map((u: any) => u.user_id))];
          const notifUsuarios = uniqueUsers.map((userId) => ({
            notificacao_id: notif.id,
            usuario_id: userId,
            lida: false,
          }));

          await supabase.from("bd_notificacoes_usuarios").insert(notifUsuarios);
        }
      }
    }

    // 5. Atualizar log para sucesso
    await supabase
      .from("bd_integracao_fornecedores_log")
      .update({
        status_processamento: existente ? "duplicado" : "sucesso",
        mensagem: `Empresa ${acao === "criacao" ? "criada" : "atualizada"} com sucesso. Portfolio: ${portfolioCount} itens.${portfolioErrors.length > 0 ? ` Falhas: ${portfolioErrors.join(" | ")}` : ""}`,
        empresa_id_gerada: empresaId,
        processed_at: new Date().toISOString(),
      })
      .eq("id", logId);

    return new Response(
      JSON.stringify({
        success: true,
        acao,
        empresa_id: empresaId,
        portfolio_itens: portfolioCount,
        mensagem: `Empresa ${acao === "criacao" ? "criada" : "atualizada"} com sucesso`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro no onboard-fornecedor:", error);

    // Atualizar log com erro
    if (logId) {
      await supabase
        .from("bd_integracao_fornecedores_log")
        .update({
          status_processamento: "erro",
          mensagem: (error as any)?.message || "Erro desconhecido",
          processed_at: new Date().toISOString(),
        })
        .eq("id", logId);
    }

    return new Response(
      JSON.stringify({ error: (error as any)?.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
