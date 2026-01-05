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
  palavras_incluir: string[];
  palavras_excluir: string[];
  modalidades_ativas: number[];
  dias_busca_completa: number;
  prazo_minimo_dias: number;
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
// Formato entrada: 33663683000116-1-000637/2025
// Formato saída: https://pncp.gov.br/app/editais/33663683000116/2025/637
function gerarLinkPNCP(numeroControle: string): string {
  try {
    // Extrair partes: "33663683000116-1-000637/2025"
    const [parteIdentificacao, ano] = numeroControle.split('/');
    
    if (!parteIdentificacao || !ano) {
      return `https://pncp.gov.br/app/editais/${numeroControle}`;
    }
    
    // parteIdentificacao = "33663683000116-1-000637"
    const partes = parteIdentificacao.split('-');
    
    if (partes.length < 3) {
      return `https://pncp.gov.br/app/editais/${numeroControle}`;
    }
    
    const cnpj = partes[0]; // "33663683000116"
    const numeroEdital = parseInt(partes[partes.length - 1], 10); // 637 (remove zeros à esquerda)
    
    return `https://pncp.gov.br/app/editais/${cnpj}/${ano}/${numeroEdital}`;
  } catch (e) {
    // Fallback caso o formato seja diferente
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
    
    // Tentar ler o body para verificar se é chamada do cron
    let body: any = {};
    try {
      const clonedReq = req.clone();
      body = await clonedReq.json();
      isCronCall = body?.source === "cron";
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

    // Usar configurações do banco ou defaults
    const config: PNCPConfig = {
      valor_minimo: configData?.valor_minimo || 1000000,
      valor_prioridade_alta: configData?.valor_prioridade_alta || 20000000,
      ufs_ativas: configData?.ufs_ativas?.length > 0 ? configData.ufs_ativas : ["RJ"],
      palavras_incluir: configData?.palavras_incluir || [
        "obra", "engenharia", "pavimentação", "reforma", "recapeamento",
        "drenagem", "infraestrutura", "construção", "execução", "recuperação",
        "manutenção", "urbanização", "saneamento", "edificação", "restauração",
        "asfalto", "terraplenagem", "contenção", "ponte", "viaduto"
      ],
      palavras_excluir: configData?.palavras_excluir || [],
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
    `);

    // Criar log de sincronização
    const { data: logData, error: logError } = await supabase
      .from("bd_pncp_sync_log")
      .insert({ status: "em_andamento" })
      .select("id")
      .single();

    if (logError) {
      console.error("Erro ao criar log:", logError);
    } else {
      syncLogId = logData?.id;
      console.log("📝 Log de sincronização criado:", syncLogId);
    }

    // Filtro de licitações encerradas é feito em processarContratacao

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
              item, uf, config, supabase, processados
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
              item, uf, config, supabase, processados
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

// Função auxiliar para processar uma contratação
async function processarContratacao(
  item: any,
  uf: string,
  config: PNCPConfig,
  supabase: any,
  processados: Set<string>
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

  // Palavras PRIMÁRIAS: específicas de engenharia civil (sozinhas já qualificam)
  const palavrasPrimarias = [
    'obra', 'pavimentação', 'drenagem', 'infraestrutura', 'edificação',
    'urbanização', 'saneamento', 'terraplenagem', 'asfalto', 'ponte',
    'viaduto', 'contenção', 'recapeamento', 'pavimento', 'esgoto',
    'implantação viária', 'implantacao viaria', 'requalificação urbana',
    'duplicação', 'rodovia', 'estrada', 'rede de água', 'rede de esgoto'
  ];

  // Palavras SECUNDÁRIAS: genéricas (precisam de combinação com primária ou 2+ secundárias)
  const palavrasSecundarias = [
    'manutenção', 'execução', 'construção', 'recuperação', 'reforma',
    'restauração', 'engenharia', 'engenharia civil', 'serviços de engenharia'
  ];

  // Verificar matches
  const primariasEncontradas = palavrasPrimarias.filter(p => objeto.includes(p));
  const secundariasEncontradas = palavrasSecundarias.filter(s => objeto.includes(s));

  // Lógica de aceitação:
  // 1. Tem pelo menos UMA palavra primária, OU
  // 2. Tem pelo menos DUAS palavras secundárias
  const temPrimaria = primariasEncontradas.length > 0;
  const temDuasSecundarias = secundariasEncontradas.length >= 2;

  if (!temPrimaria && !temDuasSecundarias) {
    return 'termo';
  }

  // Combinar termos encontrados para registro
  const termosEncontrados = [...primariasEncontradas, ...secundariasEncontradas];

  // Verificar termos de exclusão
  const contemExclusao = config.palavras_excluir.some(
    (termo) => objeto.includes(termo.toLowerCase())
  );

  if (contemExclusao) {
    console.log(`    ⏭️ Exclusão: contém termo bloqueado`);
    return 'exclusao';
  }

  // Verificar valor mínimo
  const valorEstimado = parseFloat(item.valorTotalEstimado || item.valorEstimado || 0);

  if (valorEstimado < config.valor_minimo) {
    console.log(`    ⏭️ Valor: R$ ${valorEstimado.toLocaleString('pt-BR')} < mínimo R$ ${config.valor_minimo.toLocaleString('pt-BR')}`);
    return 'valor';
  }

  // Verificar se prazo já está encerrado (não salvar licitações vencidas)
  const dataFimPropostas = item.dataEncerramentoProposta || item.dataFimProposta;
  if (dataFimPropostas) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataFim = new Date(dataFimPropostas);
    dataFim.setHours(0, 0, 0, 0);
    
    if (dataFim < hoje) {
      return 'prazo';
    }
  }

  // Calcular prioridade
  let prioridade = "media";
  if (valorEstimado >= config.valor_prioridade_alta) {
    prioridade = "alta";
  } else if (valorEstimado < config.valor_minimo * 1.5) {
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

  console.log(`    ✅ ${prioridade.toUpperCase()}: R$ ${valorEstimado.toLocaleString('pt-BR')} - ${municipioNome || uf}`);
  return 'inserido';
}