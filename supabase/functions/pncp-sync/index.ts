import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PNCP_BASE_URL = "https://pncp.gov.br/api/consulta";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PNCPConfig {
  valor_minimo: number;
  valor_prioridade_alta: number;
  ufs_ativas: string[];
  modalidades_ativas: number[];
  dias_busca_completa: number;
  prazo_minimo_dias: number;
}

interface PerfilBusca {
  id: string;
  nome: string;
  cor: string | null;
  palavras_incluir: string[] | null;     // Palavras-chave - basta 1 match
  palavras_primarias: string[] | null;   // Legado - combina com incluir
  palavras_secundarias: string[] | null; // Legado - combina com incluir
  palavras_excluir: string[] | null;
  ativo: boolean;
  user_id: string | null; // Dono do perfil
  valor_minimo: number | null;  // Valor mínimo específico do perfil
  valor_maximo: number | null;  // Valor alta prioridade específico do perfil
}

// Função para calcular dias até o fim das propostas
function calcularDiasRestantes(dataFim: string | null): number | null {
  if (!dataFim) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const fim = new Date(dataFim);
  fim.setHours(0, 0, 0, 0);
  const diffTime = fim.getTime() - hoje.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

// Função para gerar link correto do PNCP
function gerarLinkPNCP(numeroControle: string): string {
  try {
    const [parteIdentificacao, ano] = numeroControle.split('/');
    
    if (!parteIdentificacao || !ano) {
      return `https://pncp.gov.br/app/editais/${numeroControle}`;
    }
    
    const partes = parteIdentificacao.split('-');
    
    if (partes.length < 3) {
      return `https://pncp.gov.br/app/editais/${numeroControle}`;
    }
    
    const cnpj = partes[0];
    const numeroEdital = parseInt(partes[partes.length - 1], 10);
    
    return `https://pncp.gov.br/app/editais/${cnpj}/${ano}/${numeroEdital}`;
  } catch (e) {
    return `https://pncp.gov.br/app/editais/${numeroControle}`;
  }
}

// Função para buscar contratações da API PNCP
async function fetchContratacoes(
  endpoint: string,
  params: Record<string, string>,
  descricao: string
): Promise<any[]> {
  const url = `${PNCP_BASE_URL}${endpoint}?` + new URLSearchParams(params).toString();
  
  console.log(`    📡 ${descricao}...`);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Lytotec-PNCP-Monitor/1.0",
      },
    });

    const contentType = response.headers.get("content-type") || "";
    const contentLength = response.headers.get("content-length");

    if (response.status === 204 || contentLength === "0") {
      console.log(`    📭 Sem resultados`);
      return [];
    }

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`    📭 Nenhum resultado encontrado`);
      } else {
        console.error(`    ❌ Erro API: ${response.status}`);
      }
      return [];
    }

    if (!contentType.includes("application/json")) {
      console.log(`    ⚠️ Resposta não é JSON`);
      return [];
    }

    const responseText = await response.text();
    
    if (!responseText || responseText.trim() === "") {
      console.log(`    📭 Resposta vazia`);
      return [];
    }

    const data = JSON.parse(responseText);
    const contratacoes = data.data || data.resultado || data || [];
    
    if (!Array.isArray(contratacoes)) {
      return [];
    }

    console.log(`    📦 ${contratacoes.length} registros recebidos`);
    return contratacoes;
  } catch (error) {
    console.error(`    ❌ Erro ao buscar: ${error.message}`);
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let syncLogId: string | null = null;

  try {
    // Verificar autorização - aceitar chamadas autenticadas ou do cron
    const authHeader = req.headers.get("Authorization");
    let isCronCall = false;
    let salvarTodas = false;
    
    // Tentar ler o body para verificar se é chamada do cron e opção salvarTodas
    let body: any = {};
    let userId: string | null = null;
    try {
      const clonedReq = req.clone();
      body = await clonedReq.json();
      isCronCall = body?.source === "cron";
      salvarTodas = body?.salvarTodas === true;
      userId = body?.user_id || null;
    } catch {
      // Body vazio ou inválido - ok, pode ser chamada manual
    }

    // Se não tem header de auth e não é do cron, rejeitar
    if (!authHeader && !isCronCall) {
      console.log("❌ Chamada não autorizada - sem Authorization header e não é do cron");
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🚀 Iniciando sincronização PNCP... (fonte: ${isCronCall ? 'cron' : 'manual'})`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Buscar configurações do banco
    const { data: configData, error: configError } = await supabase
      .from("bd_pncp_config_monitoramento")
      .select("*")
      .eq("ativo", true)
      .limit(1)
      .maybeSingle();

    if (configError) {
      console.error("❌ Erro ao buscar configurações:", configError);
    }

    // Buscar perfis de busca ativos - filtrar por usuário se especificado
    let perfisQuery = supabase
      .from("bd_pncp_perfis_busca")
      .select("id, nome, cor, palavras_incluir, palavras_primarias, palavras_secundarias, palavras_excluir, ativo, user_id, valor_minimo, valor_maximo")
      .eq("ativo", true);
    
    // Se usuário especificado, buscar apenas perfis dele
    if (userId) {
      perfisQuery = perfisQuery.eq("user_id", userId);
    }

    const { data: perfisData, error: perfisError } = await perfisQuery;

    if (perfisError) {
      console.error("❌ Erro ao buscar perfis:", perfisError);
    }

    const perfisAtivos: PerfilBusca[] = perfisData || [];

    // Usar configurações do banco ou defaults
    const config: PNCPConfig = {
      valor_minimo: configData?.valor_minimo || 1000000,
      valor_prioridade_alta: configData?.valor_prioridade_alta || 20000000,
      ufs_ativas: configData?.ufs_ativas?.length > 0 ? configData.ufs_ativas : ["RJ"],
      modalidades_ativas: configData?.modalidades_ativas || [4, 5, 6, 7, 8, 9, 12, 13],
      dias_busca_completa: configData?.dias_busca_completa || 90,
      prazo_minimo_dias: configData?.prazo_minimo_dias || 7,
    };

    console.log(`📋 Configurações carregadas:
      - Valor mínimo: R$ ${config.valor_minimo.toLocaleString('pt-BR')}
      - Valor alta prioridade: R$ ${config.valor_prioridade_alta.toLocaleString('pt-BR')}
      - UFs ativas: ${config.ufs_ativas.join(', ')}
      - Modalidades: ${config.modalidades_ativas.join(', ')}
      - Dias de busca: ${config.dias_busca_completa}
      - Prazo mínimo para alerta: ${config.prazo_minimo_dias} dias
      - Perfis ativos: ${perfisAtivos.length} (${perfisAtivos.map(p => p.nome).join(', ') || 'nenhum'})
      - Salvar todas as licitações: ${salvarTodas ? 'SIM' : 'NÃO'}
    `);

    // Se não há perfis ativos, não há o que buscar
    if (perfisAtivos.length === 0) {
      console.log("⚠️ Nenhum perfil de busca ativo. Crie pelo menos um perfil para capturar licitações.");
      return new Response(
        JSON.stringify({
          success: true,
          message: "Nenhum perfil de busca ativo. Crie pelo menos um perfil para capturar licitações.",
          total_encontrados: 0,
          total_inseridos: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Criar log de sincronização (vinculado ao usuário)
    const { data: logData, error: logError } = await supabase
      .from("bd_pncp_sync_log")
      .insert({ status: "em_andamento", user_id: userId })
      .select("id")
      .single();

    if (logError) {
      console.error("Erro ao criar log:", logError);
    } else {
      syncLogId = logData?.id;
      console.log("📝 Log de sincronização criado:", syncLogId);
    }

    // Configurar datas para consulta
    const hojeDate = new Date();
    const dataInicio = new Date();
    dataInicio.setDate(hojeDate.getDate() - config.dias_busca_completa);

    const dataFinalStr = hojeDate.toISOString().split("T")[0].replace(/-/g, "");
    const dataInicioStr = dataInicio.toISOString().split("T")[0].replace(/-/g, "");

    let totalEncontrados = 0;
    let totalInseridos = 0;
    let totalAtualizados = 0;
    let totalDuplicados = 0;
    let rejeitadosPorTermo = 0;
    let rejeitadosPorValor = 0;
    let rejeitadosPorExclusao = 0;
    let rejeitadosPorPrazo = 0;

    // Set para evitar processar duplicados
    const processados = new Set<string>();

    // Iterar por cada UF ativa
    for (const uf of config.ufs_ativas) {
      console.log(`\n🗺️ Processando UF: ${uf}`);

      // Iterar por cada modalidade
      for (const modalidade of config.modalidades_ativas) {
        console.log(`  🔍 Modalidade ${modalidade}...`);
        
        // BUSCA 1: Por propostas abertas (endpoint atual)
        let pagina = 1;
        let temMaisPaginas = true;

        while (temMaisPaginas && pagina <= 20) {
          const contratacoes = await fetchContratacoes(
            "/v1/contratacoes/proposta",
            {
              dataFinal: dataFinalStr,
              codigoModalidadeContratacao: modalidade.toString(),
              uf: uf,
              pagina: pagina.toString(),
              tamanhoPagina: "50",
            },
            `Propostas abertas - Página ${pagina}`
          );

          if (contratacoes.length === 0) {
            temMaisPaginas = false;
            continue;
          }

          // Processar cada contratação
          for (const item of contratacoes) {
            const resultado = await processarContratacao(
              item, uf, config, perfisAtivos, supabase, processados, salvarTodas, syncLogId
            );
            
            totalEncontrados++;
            if (resultado === 'inserido') totalInseridos++;
            else if (resultado === 'termo') rejeitadosPorTermo++;
            else if (resultado === 'valor') rejeitadosPorValor++;
            else if (resultado === 'exclusao') rejeitadosPorExclusao++;
            else if (resultado === 'prazo') rejeitadosPorPrazo++;
            else if (resultado === 'duplicado') totalDuplicados++;
          }

          if (contratacoes.length < 50) {
            temMaisPaginas = false;
          } else {
            pagina++;
          }

          await new Promise((resolve) => setTimeout(resolve, 300));
        }

        // BUSCA 2: Por data de publicação (para licitações recém-publicadas com prazo maior)
        pagina = 1;
        temMaisPaginas = true;

        while (temMaisPaginas && pagina <= 10) {
          const contratacoes = await fetchContratacoes(
            "/v1/contratacoes/publicacao",
            {
              dataInicial: dataInicioStr,
              dataFinal: dataFinalStr,
              codigoModalidadeContratacao: modalidade.toString(),
              uf: uf,
              pagina: pagina.toString(),
              tamanhoPagina: "50",
            },
            `Publicações recentes - Página ${pagina}`
          );

          if (contratacoes.length === 0) {
            temMaisPaginas = false;
            continue;
          }

          for (const item of contratacoes) {
            const resultado = await processarContratacao(
              item, uf, config, perfisAtivos, supabase, processados, salvarTodas, syncLogId
            );
            
            totalEncontrados++;
            if (resultado === 'inserido') totalInseridos++;
            else if (resultado === 'termo') rejeitadosPorTermo++;
            else if (resultado === 'valor') rejeitadosPorValor++;
            else if (resultado === 'exclusao') rejeitadosPorExclusao++;
            else if (resultado === 'prazo') rejeitadosPorPrazo++;
            else if (resultado === 'duplicado') totalDuplicados++;
          }

          if (contratacoes.length < 50) {
            temMaisPaginas = false;
          } else {
            pagina++;
          }

          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }
    }

    const duracao = (Date.now() - startTime) / 1000;

    console.log(`
📊 Sincronização concluída!
   UFs processadas: ${config.ufs_ativas.join(', ')}
   Perfis utilizados: ${perfisAtivos.map(p => p.nome).join(', ')}
   Total analisados: ${totalEncontrados}
   ⏭️ Rejeitados por termo: ${rejeitadosPorTermo}
   ⏭️ Rejeitados por valor: ${rejeitadosPorValor}
   ⏭️ Rejeitados por exclusão: ${rejeitadosPorExclusao}
   ⏭️ Rejeitados por prazo encerrado: ${rejeitadosPorPrazo}
   ⏭️ Já processados: ${totalDuplicados}
   ✅ Inseridos/atualizados: ${totalInseridos}
   Duração: ${duracao.toFixed(1)}s
    `);

    // Atualizar log de sincronização
    if (syncLogId) {
      await supabase
        .from("bd_pncp_sync_log")
        .update({
          status: "concluido",
          total_encontrados: totalEncontrados,
          total_inseridos: totalInseridos,
          total_atualizados: totalAtualizados,
          total_duplicados: totalDuplicados,
          duracao_segundos: duracao,
        })
        .eq("id", syncLogId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_encontrados: totalEncontrados,
        total_inseridos: totalInseridos,
        total_duplicados: totalDuplicados,
        duracao_segundos: duracao,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ Erro fatal na sincronização:", error);

    if (syncLogId) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      await supabase
        .from("bd_pncp_sync_log")
        .update({
          status: "erro",
          mensagem_erro: error.message || "Erro desconhecido",
          duracao_segundos: (Date.now() - startTime) / 1000,
        })
        .eq("id", syncLogId);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Erro desconhecido",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// Função auxiliar para salvar licitação na tabela de todas
async function salvarLicitacaoCompleta(
  item: any,
  uf: string,
  motivoNaoMatch: string | null,
  syncId: string | null,
  supabase: any
): Promise<void> {
  const numeroControle = item.numeroControlePNCP || item.numeroControle || item.id;
  const valorEstimado = parseFloat(item.valorTotalEstimado || item.valorEstimado || 0);
  
  const municipioNome = 
    item.municipio?.nome || 
    item.municipioTermo || 
    item.localEntrega?.municipio ||
    item.localExecucao?.municipio ||
    null;

  const municipioIbge = 
    item.municipio?.codigoIbge || 
    item.codigoMunicipioIbge || 
    item.localExecucao?.codigoIbge ||
    null;

  const registro = {
    numero_controle_pncp: numeroControle,
    objeto: item.objetoCompra || item.objeto || item.descricao || "Sem descrição",
    orgao_nome: item.orgaoEntidade?.razaoSocial || item.nomeOrgao || item.orgao || null,
    orgao_cnpj: item.orgaoEntidade?.cnpj || item.cnpjOrgao || null,
    unidade_nome: item.unidadeOrgao?.nomeUnidade || item.unidade || null,
    municipio_nome: municipioNome,
    municipio_ibge: municipioIbge?.toString() || null,
    uf: uf,
    valor_total_estimado: valorEstimado,
    data_publicacao: item.dataPublicacaoPncp || item.dataPublicacao || null,
    data_inicio_propostas: item.dataAberturaProposta || item.dataInicioProposta || null,
    data_fim_propostas: item.dataEncerramentoProposta || item.dataFimProposta || null,
    link_origem_pncp: gerarLinkPNCP(numeroControle),
    modalidade_contratacao: item.modalidadeContratacao?.nome || item.modalidade || null,
    motivo_nao_match: motivoNaoMatch,
    sync_id: syncId,
    raw_data: item,
  };

  await supabase
    .from("bd_pncp_todas_licitacoes")
    .upsert(registro, {
      onConflict: "numero_controle_pncp",
      ignoreDuplicates: false,
    });
}

// Função auxiliar para processar uma contratação
async function processarContratacao(
  item: any,
  uf: string,
  config: PNCPConfig,
  perfisAtivos: PerfilBusca[],
  supabase: any,
  processados: Set<string>,
  salvarTodas: boolean = false,
  syncLogId: string | null = null
): Promise<string> {
  const numeroControle = item.numeroControlePNCP || item.numeroControle || item.id;

  if (!numeroControle) {
    return 'sem_controle';
  }

  // Verificar se já foi processado nesta sincronização
  if (processados.has(numeroControle)) {
    return 'duplicado';
  }
  processados.add(numeroControle);

  // Extrair objeto da contratação
  const objeto = (item.objetoCompra || item.objeto || item.descricao || "").toLowerCase();

  // Extrair valor estimado
  const valorEstimado = parseFloat(item.valorTotalEstimado || item.valorEstimado || 0);

  // Verificar se prazo já está encerrado (não salvar licitações vencidas)
  const dataFimPropostas = item.dataEncerramentoProposta || item.dataFimProposta;
  if (dataFimPropostas) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataFim = new Date(dataFimPropostas);
    dataFim.setHours(0, 0, 0, 0);
    
    if (dataFim < hoje) {
      // Salvar na tabela completa se opção ativada
      if (salvarTodas) {
        await salvarLicitacaoCompleta(item, uf, 'prazo', syncLogId, supabase);
      }
      return 'prazo';
    }
  }

  // Tentar fazer match com um dos perfis ativos
  let perfilMatch: PerfilBusca | null = null;
  let termosEncontrados: string[] = [];

  for (const perfil of perfisAtivos) {
    // Combinar todas as palavras-chave (incluir + primarias + secundarias legado)
    const todasPalavras = [
      ...(perfil.palavras_incluir || []),
      ...(perfil.palavras_primarias || []),
      ...(perfil.palavras_secundarias || [])
    ];
    const palavrasExcluir = perfil.palavras_excluir || [];

    // Verificar se contém algum termo de exclusão do perfil
    const contemExclusao = palavrasExcluir.some(
      (termo) => objeto.includes(termo.toLowerCase())
    );

    if (contemExclusao) {
      // Salvar na tabela completa se opção ativada (com motivo exclusão)
      if (salvarTodas) {
        await salvarLicitacaoCompleta(item, uf, 'exclusao', syncLogId, supabase);
      }
      continue; // Pular este perfil, mas tentar próximo
    }

    // Verificar matches - BASTA 1 match de qualquer palavra-chave
    // Para termos compostos, verificar se TODAS as palavras aparecem (ex: "material escritório" -> "material" E "escritório")
    const matches = todasPalavras.filter(termo => {
      const termoLower = termo.toLowerCase().trim();
      
      // Dividir em palavras, ignorando palavras pequenas (de, da, do, para, etc)
      const palavras = termoLower.split(/\s+/).filter(p => p.length > 2);
      
      if (palavras.length === 0) {
        return false;
      }
      
      if (palavras.length === 1) {
        // Palavra única: busca direta
        return objeto.includes(palavras[0]);
      }
      
      // Múltiplas palavras: TODAS devem aparecer no objeto (em qualquer ordem)
      return palavras.every(palavra => objeto.includes(palavra));
    });

    if (matches.length >= 1) {
      perfilMatch = perfil;
      termosEncontrados = matches;
      break; // Encontrou match, usar este perfil
    }
  }

  // Se nenhum perfil deu match, rejeitar a licitação
  if (!perfilMatch) {
    // Salvar na tabela completa se opção ativada (sem match de termo)
    if (salvarTodas) {
      await salvarLicitacaoCompleta(item, uf, 'termo', syncLogId, supabase);
    }
    return 'termo';
  }

  // Verificar valor mínimo DO PERFIL (após encontrar match)
  const perfilValorMinimo = perfilMatch.valor_minimo || 0;
  if (valorEstimado < perfilValorMinimo) {
    // Salvar na tabela completa se opção ativada
    if (salvarTodas) {
      await salvarLicitacaoCompleta(item, uf, 'valor', syncLogId, supabase);
    }
    return 'valor';
  }

  // Calcular prioridade usando valor do perfil ou fallback para config global
  const valorAltaPrioridade = perfilMatch.valor_maximo || config.valor_prioridade_alta;
  let prioridade = "media";
  if (valorEstimado >= valorAltaPrioridade) {
    prioridade = "alta";
  } else if (perfilValorMinimo > 0 && valorEstimado < perfilValorMinimo * 1.5) {
    prioridade = "baixa";
  }

  // Capturar município dinamicamente de várias fontes
  const municipioNome = 
    item.municipio?.nome || 
    item.municipioTermo || 
    item.localEntrega?.municipio ||
    item.localExecucao?.municipio ||
    null;

  const municipioIbge = 
    item.municipio?.codigoIbge || 
    item.codigoMunicipioIbge || 
    item.localExecucao?.codigoIbge ||
    null;

  const registro = {
    numero_controle_pncp: numeroControle,
    objeto: item.objetoCompra || item.objeto || item.descricao || "Sem descrição",
    orgao_nome: item.orgaoEntidade?.razaoSocial || item.nomeOrgao || item.orgao || null,
    orgao_cnpj: item.orgaoEntidade?.cnpj || item.cnpjOrgao || null,
    unidade_nome: item.unidadeOrgao?.nomeUnidade || item.unidade || null,
    municipio_nome: municipioNome,
    municipio_ibge: municipioIbge?.toString() || null,
    uf: uf,
    valor_total_estimado: valorEstimado,
    data_publicacao: item.dataPublicacaoPncp || item.dataPublicacao || null,
    data_inicio_propostas: item.dataAberturaProposta || item.dataInicioProposta || null,
    data_fim_propostas: item.dataEncerramentoProposta || item.dataFimProposta || null,
    link_origem_pncp: gerarLinkPNCP(numeroControle),
    modalidade_contratacao: item.modalidadeContratacao?.nome || item.modalidade || null,
    prioridade: prioridade,
    match_termos: termosEncontrados,
    perfil_busca_id: perfilMatch.id,
    perfil_busca_nome: perfilMatch.nome,
    user_id: perfilMatch.user_id, // Herdar user_id do perfil que deu match
    raw_data: item,
  };

  // Tentar inserir ou atualizar (upsert)
  const { error: upsertError } = await supabase
    .from("bd_pncp_contratacoes")
    .upsert(registro, {
      onConflict: "numero_controle_pncp",
      ignoreDuplicates: false,
    });

  if (upsertError) {
    if (upsertError.code === "23505") {
      return 'duplicado';
    } else {
      console.error("    ❌ Erro ao inserir:", upsertError.message);
      return 'erro';
    }
  }

  // Salvar também na tabela completa se opção ativada (com match)
  if (salvarTodas) {
    await salvarLicitacaoCompleta(item, uf, 'match', syncLogId, supabase);
  }

  console.log(`    ✅ [${perfilMatch.nome}] ${prioridade.toUpperCase()}: R$ ${valorEstimado.toLocaleString('pt-BR')} - ${municipioNome || uf}`);
  return 'inserido';
}
