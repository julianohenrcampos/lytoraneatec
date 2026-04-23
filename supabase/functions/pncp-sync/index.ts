import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Normalização de texto para comparação de órgãos
function normalizeText(value?: string | null): string {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

interface AliasCache {
  alias_normalizado: string;
  orgao_id: string;
  orgao_sigla: string;
  orgao_nome: string;
}

const KEYWORD_MAP = [
  { sigla: 'SECID', keywords: ['SECRETARIA DE ESTADO DAS CIDADES', 'SECID'] },
  { sigla: 'INEA', keywords: ['INSTITUTO ESTADUAL DO AMBIENTE', 'INEA'] },
  { sigla: 'SEIOP', keywords: ['SECRETARIA DE ESTADO DE INFRAESTRUTURA E OBRAS PUBLICAS', 'SEIOP'] },
  { sigla: 'SEHIS', keywords: ['SECRETARIA DE ESTADO DE HABITACAO DE INTERESSE SOCIAL', 'SEHIS'] },
  { sigla: 'SEAS', keywords: ['SECRETARIA DE ESTADO DO AMBIENTE E SUSTENTABILIDADE', 'SEAS'] },
];

function findOrgaoMatch(
  apiName: string | null | undefined,
  aliases: AliasCache[],
  orgaosBySigla: Map<string, { id: string; nome: string; sigla: string }>
): { orgaoId: string | null; orgaoSigla: string | null; strategy: string } {
  const normalized = normalizeText(apiName);
  if (!normalized) return { orgaoId: null, orgaoSigla: null, strategy: 'not_found' };

  const exact = aliases.find(a => a.alias_normalizado === normalized);
  if (exact) return { orgaoId: exact.orgao_id, orgaoSigla: exact.orgao_sigla, strategy: 'exact_alias' };

  const contains = aliases.find(a =>
    normalized.includes(a.alias_normalizado) || a.alias_normalizado.includes(normalized)
  );
  if (contains) return { orgaoId: contains.orgao_id, orgaoSigla: contains.orgao_sigla, strategy: 'contains_alias' };

  for (const item of KEYWORD_MAP) {
    if (item.keywords.some(kw => normalized.includes(kw))) {
      const orgao = orgaosBySigla.get(item.sigla);
      if (orgao) return { orgaoId: orgao.id, orgaoSigla: orgao.sigla, strategy: 'contains_keyword' };
    }
  }

  return { orgaoId: null, orgaoSigla: null, strategy: 'manual_needed' };
}

// ============================================================
// DICIONÁRIO DE SINÔNIMOS TÉCNICOS (Matching Inteligente)
// ============================================================
interface GrupoSinonimo {
  id: string;
  nome: string;
  palavras: string[];
}

const DICIONARIO_SINONIMOS: GrupoSinonimo[] = [
  {
    id: 'pavimentacao', nome: 'Pavimentação',
    palavras: [
      'PAVIMENTACAO', 'ASFALTO', 'RECAPEAMENTO', 'VIAS', 'RODOVIA', 'RODOVIAS',
      'CONSTRUCAO DE ESTRUTURAS', 'CBUQ', 'CONCRETO ASFALTICO', 'TAPA BURACO',
      'PAVIMENTO', 'REVESTIMENTO ASFALTICO', 'MASSA ASFALTICA',
    ],
  },
  {
    id: 'drenagem', nome: 'Drenagem',
    palavras: [
      'DRENAGEM', 'CANALIZACAO', 'SANEAMENTO', 'HIDRAULICO', 'SERVICOS HIDRAULICOS',
      'CONTROLE DE INUNDACAO', 'REDE PLUVIAL', 'GALERIA', 'BUEIRO', 'MICRODRENAGEM',
      'MACRODRENAGEM', 'ESGOTAMENTO',
    ],
  },
  {
    id: 'infraestrutura', nome: 'Infraestrutura',
    palavras: [
      'INFRAESTRUTURA', 'OBRA PUBLICA', 'OBRAS PUBLICAS', 'ENGENHARIA CIVIL',
      'CONSTRUCAO CIVIL', 'URBANIZACAO', 'IMPLANTACAO VIARIA', 'REVITALIZACAO',
      'REQUALIFICACAO URBANA',
    ],
  },
  {
    id: 'terraplanagem', nome: 'Terraplanagem',
    palavras: [
      'TERRAPLANAGEM', 'MOVIMENTACAO DE TERRA', 'ESCAVACAO', 'COMPACTACAO',
      'ATERRO', 'CORTE E ATERRO', 'TERRAPLENAGEM',
    ],
  },
  {
    id: 'ambiental', nome: 'Ambiental',
    palavras: [
      'RECUPERACAO AMBIENTAL', 'MEIO AMBIENTE', 'SUSTENTABILIDADE',
      'REFLORESTAMENTO', 'AREA DEGRADADA', 'LICENCIAMENTO AMBIENTAL',
      'COMPENSACAO AMBIENTAL',
    ],
  },
];

const ORGAOS_ESTRATEGICOS = ['SECID', 'INEA', 'SEIOP', 'SEHIS', 'SEAS'];

interface SmartMatchResult {
  score: number;
  gruposEncontrados: string[];
  incluir: boolean;
}

interface MatchingPeso {
  grupo: string;
  peso: number;
  ativo: boolean;
}

interface MatchingExclusao {
  termo: string;
  ativo: boolean;
}

function calcularSmartMatch(
  textoObjeto: string,
  orgaoSigla: string | null,
  valorEstimado: number | null,
  pesosConfig: MatchingPeso[] | null,
  exclusoes: MatchingExclusao[] | null,
  scoreMinimo: number,
): SmartMatchResult {
  const normalizado = normalizeText(textoObjeto);

  // Check exclusions first
  if (exclusoes && exclusoes.length > 0) {
    const excluido = exclusoes.some(e => e.ativo && normalizado.includes(e.termo));
    if (excluido) return { score: 0, gruposEncontrados: [], incluir: false };
  }

  let score = 0;
  const gruposEncontrados: string[] = [];

  // Use dynamic weights from DB if available, otherwise fallback to hardcoded +5
  for (const grupo of DICIONARIO_SINONIMOS) {
    const configPeso = pesosConfig?.find(p => p.grupo === grupo.id);
    // Skip if explicitly disabled
    if (configPeso && !configPeso.ativo) continue;
    
    const match = grupo.palavras.some((p) => normalizado.includes(p));
    if (match) {
      const peso = configPeso?.peso ?? 5;
      score += peso;
      gruposEncontrados.push(grupo.id);
    }
  }

  if (orgaoSigla && ORGAOS_ESTRATEGICOS.includes(orgaoSigla.toUpperCase())) {
    score += 10;
  }

  const valor = valorEstimado ?? 0;
  if (valor >= 15_000_000) score += 10;
  else if (valor >= 5_000_000) score += 5;

  const isOrgaoEstrategico = !!(orgaoSigla && ORGAOS_ESTRATEGICOS.includes(orgaoSigla.toUpperCase()));
  const incluir = score >= scoreMinimo || isOrgaoEstrategico;

  return { score, gruposEncontrados, incluir };
}

// ============================================================

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
  palavras_incluir: string[] | null;
  palavras_primarias: string[] | null;
  palavras_secundarias: string[] | null;
  palavras_excluir: string[] | null;
  ativo: boolean;
  user_id: string | null;
  valor_minimo: number | null;
  valor_maximo: number | null;
}

function calcularDiasRestantes(dataFim: string | null): number | null {
  if (!dataFim) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const fim = new Date(dataFim);
  fim.setHours(0, 0, 0, 0);
  const diffTime = fim.getTime() - hoje.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function gerarLinkPNCP(numeroControle: string): string {
  try {
    const [parteIdentificacao, ano] = numeroControle.split('/');
    if (!parteIdentificacao || !ano) return `https://pncp.gov.br/app/editais/${numeroControle}`;
    const partes = parteIdentificacao.split('-');
    if (partes.length < 3) return `https://pncp.gov.br/app/editais/${numeroControle}`;
    const cnpj = partes[0];
    const numeroEdital = parseInt(partes[partes.length - 1], 10);
    return `https://pncp.gov.br/app/editais/${cnpj}/${ano}/${numeroEdital}`;
  } catch {
    return `https://pncp.gov.br/app/editais/${numeroControle}`;
  }
}

async function fetchContratacoes(
  endpoint: string,
  params: Record<string, string>,
  descricao: string
): Promise<any[]> {
  const url = `${PNCP_BASE_URL}${endpoint}?` + new URLSearchParams(params).toString();
  console.log(`    📡 ${descricao}...`);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "Lytotec-PNCP-Monitor/1.0" },
      signal: controller.signal,
    });

    const contentType = response.headers.get("content-type") || "";
    const contentLength = response.headers.get("content-length");

    if (response.status === 204 || contentLength === "0") {
      console.log(`    📭 Sem resultados`);
      return [];
    }

    if (!response.ok) {
      if (response.status === 404) console.log(`    📭 Nenhum resultado encontrado`);
      else console.error(`    ❌ Erro API: ${response.status}`);
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
    if (!Array.isArray(contratacoes)) return [];

    console.log(`    📦 ${contratacoes.length} registros recebidos`);
    return contratacoes;
  } catch (error) {
    if (error?.name === "AbortError") {
      console.error(`    ⏱️ Timeout ao buscar ${descricao}`);
      return [];
    }
    console.error(`    ❌ Erro ao buscar: ${error.message}`);
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

async function registrarOrgaoPendente(
  supabase: any,
  pendentesRegistrados: Set<string>,
  orgaoNomeApi: string,
  numeroControle: string,
): Promise<void> {
  const nomeApiNormalizado = normalizeText(orgaoNomeApi);
  if (!nomeApiNormalizado || pendentesRegistrados.has(nomeApiNormalizado)) return;

  pendentesRegistrados.add(nomeApiNormalizado);

  try {
    const { data: existente, error: buscaError } = await supabase
      .from("bd_licitacoes_orgaos_pendentes")
      .select("id")
      .eq("nome_api_normalizado", nomeApiNormalizado)
      .limit(1)
      .maybeSingle();

    if (buscaError && buscaError.code !== "PGRST116") {
      console.warn("    ⚠️ Erro ao verificar órgão pendente:", buscaError.message);
      return;
    }

    if (existente?.id) return;

    const { error: insertError } = await supabase
      .from("bd_licitacoes_orgaos_pendentes")
      .insert({
        nome_api_original: orgaoNomeApi,
        nome_api_normalizado: nomeApiNormalizado,
        licitacao_numero: numeroControle,
        origem: 'PNCP',
        status: 'pendente',
        observacoes: 'Órgão não reconhecido automaticamente no pipeline de importação',
      });

    if (insertError) {
      console.warn('    ⚠️ Órgão pendente (não-bloqueante):', insertError.message);
    }
  } catch (e) {
    console.warn('    ⚠️ Erro ao registrar órgão pendente (não-bloqueante):', e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let syncLogId: string | null = null;

  try {
    const authHeader = req.headers.get("Authorization");
    let isCronCall = false;
    let salvarTodas = false;
    let body: any = {};
    let userId: string | null = null;
    try {
      const clonedReq = req.clone();
      body = await clonedReq.json();
      isCronCall = body?.source === "cron";
      salvarTodas = body?.salvarTodas === true;
      userId = body?.user_id || null;
    } catch {}

    if (!authHeader && !isCronCall) {
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

    // Check modo_engenharia flag
    const { data: modoEngData } = await supabase
      .from("bd_configuracoes_sistema")
      .select("valor")
      .eq("chave", "modo_engenharia_licitacoes")
      .eq("ativo", true)
      .maybeSingle();
    
    const modoEngenharia = modoEngData?.valor === 'true';
    console.log(`🧠 Modo Engenharia (matching inteligente): ${modoEngenharia ? 'ATIVO' : 'INATIVO'}`);

    // Load dynamic matching config (weights + exclusions + score minimum)
    let pesosConfig: MatchingPeso[] | null = null;
    let exclusoesConfig: MatchingExclusao[] | null = null;
    let scoreMinimo = 5;

    if (modoEngenharia) {
      const { data: pesosData } = await supabase.from("bd_matching_config").select("grupo, peso, ativo");
      pesosConfig = (pesosData || []) as unknown as MatchingPeso[];

      const { data: exclData } = await supabase.from("bd_matching_exclusoes").select("termo, ativo").eq("ativo", true);
      exclusoesConfig = (exclData || []).map((e: any) => ({ ...e, termo: normalizeText(e.termo) })) as MatchingExclusao[];

      const { data: scoreMinData } = await supabase
        .from("bd_configuracoes_sistema")
        .select("valor")
        .eq("chave", "score_minimo_inclusao")
        .eq("ativo", true)
        .maybeSingle();
      scoreMinimo = parseInt(scoreMinData?.valor || '5', 10) || 5;

      console.log(`⚙️ Config dinâmica: ${pesosConfig.length} pesos, ${exclusoesConfig.length} exclusões, score mínimo=${scoreMinimo}`);
    }

    const { data: configData, error: configError } = await supabase
      .from("bd_pncp_config_monitoramento")
      .select("*")
      .eq("ativo", true)
      .limit(1)
      .maybeSingle();

    if (configError) console.error("❌ Erro ao buscar configurações:", configError);

    let perfisQuery = supabase
      .from("bd_pncp_perfis_busca")
      .select("id, nome, cor, palavras_incluir, palavras_primarias, palavras_secundarias, palavras_excluir, ativo, user_id, valor_minimo, valor_maximo")
      .eq("ativo", true);
    if (userId) perfisQuery = perfisQuery.eq("user_id", userId);

    const { data: perfisData, error: perfisError } = await perfisQuery;
    if (perfisError) console.error("❌ Erro ao buscar perfis:", perfisError);

    const perfisAtivos: PerfilBusca[] = perfisData || [];

    const config: PNCPConfig = {
      valor_minimo: configData?.valor_minimo || 1000000,
      valor_prioridade_alta: configData?.valor_prioridade_alta || 20000000,
      ufs_ativas: configData?.ufs_ativas?.length > 0 ? configData.ufs_ativas : ["RJ"],
      modalidades_ativas: configData?.modalidades_ativas || [4, 5, 6, 7, 8, 9, 12, 13],
      dias_busca_completa: configData?.dias_busca_completa || 90,
      prazo_minimo_dias: configData?.prazo_minimo_dias || 7,
    };

    console.log(`📋 Configurações: UFs=${config.ufs_ativas.join(',')} | Perfis=${perfisAtivos.length} | SalvarTodas=${salvarTodas} | ModoEng=${modoEngenharia}`);

    if (perfisAtivos.length === 0 && !modoEngenharia) {
      return new Response(
        JSON.stringify({ success: true, message: "Nenhum perfil de busca ativo.", total_encontrados: 0, total_inseridos: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load organ cache
    const { data: orgaosData } = await supabase.from("bd_orgaos_publicos").select("id, nome, sigla").eq("ativo", true);
    const { data: aliasesData } = await supabase
      .from("bd_orgaos_alias")
      .select("alias_normalizado, orgao_id, orgao:bd_orgaos_publicos!bd_orgaos_alias_orgao_id_fkey(id, nome, sigla)");

    const aliasCache: AliasCache[] = (aliasesData || []).map((a: any) => ({
      alias_normalizado: a.alias_normalizado,
      orgao_id: a.orgao?.id || a.orgao_id,
      orgao_sigla: a.orgao?.sigla || '',
      orgao_nome: a.orgao?.nome || '',
    }));

    const orgaosBySigla = new Map((orgaosData || []).map((o: any) => [o.sigla, o]));

    console.log(`🏛️ Cache: ${aliasCache.length} aliases, ${orgaosData?.length || 0} órgãos`);

    const { data: logData, error: logError } = await supabase
      .from("bd_pncp_sync_log")
      .insert({ status: "em_andamento", user_id: userId })
      .select("id")
      .single();

    if (logError) console.error("Erro ao criar log:", logError);
    else syncLogId = logData?.id;

    const hojeDate = new Date();
    const dataInicio = new Date();
    dataInicio.setDate(hojeDate.getDate() - config.dias_busca_completa);

    const dataFinalStr = hojeDate.toISOString().split("T")[0].replace(/-/g, "");
    const dataInicioStr = dataInicio.toISOString().split("T")[0].replace(/-/g, "");

    let totalEncontrados = 0, totalInseridos = 0, totalAtualizados = 0, totalDuplicados = 0;
    let rejeitadosPorTermo = 0, rejeitadosPorValor = 0, rejeitadosPorExclusao = 0, rejeitadosPorPrazo = 0;
    let totalOrgaosClassificados = 0, totalOrgaosPendentes = 0;

    const processados = new Set<string>();
    const pendentesRegistrados = new Set<string>();

    for (const uf of config.ufs_ativas) {
      console.log(`\n🗺️ Processando UF: ${uf}`);
      for (const modalidade of config.modalidades_ativas) {
        console.log(`  🔍 Modalidade ${modalidade}...`);
        
        // BUSCA 1: Propostas abertas
        let pagina = 1;
        let temMaisPaginas = true;
        const MAX_PAGINAS_PROPOSTA = 5;

        while (temMaisPaginas && pagina <= MAX_PAGINAS_PROPOSTA) {
          const contratacoes = await fetchContratacoes(
            "/v1/contratacoes/proposta",
            { dataFinal: dataFinalStr, codigoModalidadeContratacao: modalidade.toString(), uf, pagina: pagina.toString(), tamanhoPagina: "50" },
            `Propostas abertas - Página ${pagina}`
          );

          if (contratacoes.length === 0) { temMaisPaginas = false; continue; }

          for (const item of contratacoes) {
            try {
              const resultado = await processarContratacao(
                item, uf, config, perfisAtivos, supabase, processados, pendentesRegistrados, salvarTodas, syncLogId, aliasCache, orgaosBySigla, modoEngenharia, pesosConfig, exclusoesConfig, scoreMinimo
              );
              totalEncontrados++;
              if (resultado.startsWith('inserido')) {
                totalInseridos++;
                if (resultado === 'inserido:classificado') totalOrgaosClassificados++;
                else if (resultado === 'inserido:pendente') totalOrgaosPendentes++;
              }
              else if (resultado === 'termo') rejeitadosPorTermo++;
              else if (resultado === 'valor') rejeitadosPorValor++;
              else if (resultado === 'exclusao') rejeitadosPorExclusao++;
              else if (resultado === 'prazo') rejeitadosPorPrazo++;
              else if (resultado === 'duplicado') totalDuplicados++;
            } catch (itemError) {
              console.error('    ❌ Erro ao processar item (continuando):', itemError);
              totalEncontrados++;
            }
          }

          if (contratacoes.length < 50) temMaisPaginas = false;
          else pagina++;
          await new Promise((resolve) => setTimeout(resolve, 200));
        }

        // BUSCA 2: Publicações
        pagina = 1;
        temMaisPaginas = true;
        const MAX_PAGINAS_PUBLICACAO = 3;

        while (temMaisPaginas && pagina <= MAX_PAGINAS_PUBLICACAO) {
          const contratacoes = await fetchContratacoes(
            "/v1/contratacoes/publicacao",
            { dataInicial: dataInicioStr, dataFinal: dataFinalStr, codigoModalidadeContratacao: modalidade.toString(), uf, pagina: pagina.toString(), tamanhoPagina: "50" },
            `Publicações recentes - Página ${pagina}`
          );

          if (contratacoes.length === 0) { temMaisPaginas = false; continue; }

          for (const item of contratacoes) {
            try {
              const resultado = await processarContratacao(
                item, uf, config, perfisAtivos, supabase, processados, pendentesRegistrados, salvarTodas, syncLogId, aliasCache, orgaosBySigla, modoEngenharia, pesosConfig, exclusoesConfig, scoreMinimo
              );
              totalEncontrados++;
              if (resultado.startsWith('inserido')) {
                totalInseridos++;
                if (resultado === 'inserido:classificado') totalOrgaosClassificados++;
                else if (resultado === 'inserido:pendente') totalOrgaosPendentes++;
              }
              else if (resultado === 'termo') rejeitadosPorTermo++;
              else if (resultado === 'valor') rejeitadosPorValor++;
              else if (resultado === 'exclusao') rejeitadosPorExclusao++;
              else if (resultado === 'prazo') rejeitadosPorPrazo++;
              else if (resultado === 'duplicado') totalDuplicados++;
            } catch (itemError) {
              console.error('    ❌ Erro ao processar item (continuando):', itemError);
              totalEncontrados++;
            }
          }

          if (contratacoes.length < 50) temMaisPaginas = false;
          else pagina++;
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }
    }

    const duracao = (Date.now() - startTime) / 1000;

    console.log(`
📊 Sincronização concluída!
   ModoEng: ${modoEngenharia}
   Total analisados: ${totalEncontrados}
   Rejeitados termo: ${rejeitadosPorTermo} | valor: ${rejeitadosPorValor} | exclusão: ${rejeitadosPorExclusao} | prazo: ${rejeitadosPorPrazo}
   Já processados: ${totalDuplicados}
   Inseridos: ${totalInseridos}
   Órgãos classificados: ${totalOrgaosClassificados} | pendentes: ${totalOrgaosPendentes}
   Duração: ${duracao.toFixed(1)}s
    `);

    if (syncLogId) {
      await supabase.from("bd_pncp_sync_log").update({
        status: "concluido",
        total_encontrados: totalEncontrados,
        total_inseridos: totalInseridos,
        total_atualizados: totalAtualizados,
        total_duplicados: totalDuplicados,
        duracao_segundos: duracao,
      }).eq("id", syncLogId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_encontrados: totalEncontrados,
        total_inseridos: totalInseridos,
        total_duplicados: totalDuplicados,
        total_orgaos_classificados: totalOrgaosClassificados,
        total_orgaos_pendentes: totalOrgaosPendentes,
        duracao_segundos: duracao,
        modo_engenharia: modoEngenharia,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Erro fatal na sincronização:", error);

    if (syncLogId) {
      const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
      await supabase.from("bd_pncp_sync_log").update({
        status: "erro",
        mensagem_erro: error.message || "Erro desconhecido",
        duracao_segundos: (Date.now() - startTime) / 1000,
      }).eq("id", syncLogId);
    }

    return new Response(
      JSON.stringify({ success: false, error: error.message || "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function salvarLicitacaoCompleta(
  item: any, uf: string, motivoNaoMatch: string | null, syncId: string | null, supabase: any
): Promise<void> {
  const numeroControle = item.numeroControlePNCP || item.numeroControle || item.id;
  const valorEstimado = parseFloat(item.valorTotalEstimado || item.valorEstimado || 0);
  const municipioNome = item.municipio?.nome || item.municipioTermo || item.localEntrega?.municipio || item.localExecucao?.municipio || null;
  const municipioIbge = item.municipio?.codigoIbge || item.codigoMunicipioIbge || item.localExecucao?.codigoIbge || null;

  const registro = {
    numero_controle_pncp: numeroControle,
    objeto: item.objetoCompra || item.objeto || item.descricao || "Sem descrição",
    orgao_nome: item.orgaoEntidade?.razaoSocial || item.nomeOrgao || item.orgao || null,
    orgao_cnpj: item.orgaoEntidade?.cnpj || item.cnpjOrgao || null,
    unidade_nome: item.unidadeOrgao?.nomeUnidade || item.unidade || null,
    municipio_nome: municipioNome,
    municipio_ibge: municipioIbge?.toString() || null,
    uf,
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

  await supabase.from("bd_pncp_todas_licitacoes").upsert(registro, { onConflict: "numero_controle_pncp", ignoreDuplicates: false });
}

async function processarContratacao(
  item: any, uf: string, config: PNCPConfig, perfisAtivos: PerfilBusca[],
  supabase: any, processados: Set<string>, pendentesRegistrados: Set<string>, salvarTodas: boolean = false,
  syncLogId: string | null = null, aliasCache: AliasCache[] = [],
  orgaosBySigla: Map<string, any> = new Map(), modoEngenharia: boolean = false,
  pesosConfig: MatchingPeso[] | null = null, exclusoesConfig: MatchingExclusao[] | null = null, scoreMinimo: number = 5
): Promise<string> {
  const numeroControle = item.numeroControlePNCP || item.numeroControle || item.id;
  if (!numeroControle) return 'sem_controle';
  if (processados.has(numeroControle)) return 'duplicado';
  processados.add(numeroControle);

  const objeto = (item.objetoCompra || item.objeto || item.descricao || "").toLowerCase();

  const extrairValor = (valor: any): number => {
    if (!valor) return 0;
    if (typeof valor === 'number') return valor;
    const valorStr = String(valor).replace(/\./g, '').replace(',', '.');
    return parseFloat(valorStr) || 0;
  };

  const valorEstimado = extrairValor(item.valorTotalEstimado || item.valorEstimado);

  // Check deadline
  const dataFimPropostas = item.dataEncerramentoProposta || item.dataFimProposta;
  if (dataFimPropostas) {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const dataFim = new Date(dataFimPropostas); dataFim.setHours(0, 0, 0, 0);
    if (dataFim < hoje) {
      if (salvarTodas) await salvarLicitacaoCompleta(item, uf, 'prazo', syncLogId, supabase);
      return 'prazo';
    }
  }

  // Normalizar órgão (needed for smart matching score)
  const orgaoNomeApi = item.orgaoEntidade?.razaoSocial || item.nomeOrgao || item.orgao || null;
  const orgaoMatch = findOrgaoMatch(orgaoNomeApi, aliasCache, orgaosBySigla);

  // ============================================================
  // MODO ENGENHARIA: Smart matching por sinônimos
  // ============================================================
  if (modoEngenharia) {
    const smartResult = calcularSmartMatch(objeto, orgaoMatch.orgaoSigla, valorEstimado, pesosConfig, exclusoesConfig, scoreMinimo);

    // Se não passou no critério de inclusão E nenhum perfil normal deu match
    if (!smartResult.incluir) {
      // Tentar ainda os perfis normais como fallback
      let perfilFallback = false;
      for (const perfil of perfisAtivos) {
        const todasPalavras = [...(perfil.palavras_incluir || []), ...(perfil.palavras_primarias || []), ...(perfil.palavras_secundarias || [])];
        const matches = todasPalavras.filter(termo => {
          const termoLower = termo.toLowerCase().trim();
          const palavras = termoLower.split(/\s+/).filter(p => p.length > 2);
          if (palavras.length === 0) return false;
          if (palavras.length === 1) return objeto.includes(palavras[0]);
          return palavras.every(palavra => objeto.includes(palavra));
        });
        if (matches.length >= 1) { perfilFallback = true; break; }
      }

      if (!perfilFallback) {
        if (salvarTodas) await salvarLicitacaoCompleta(item, uf, 'smart_no_match', syncLogId, supabase);
        return 'termo';
      }
    }

    // Passou no smart match OU no perfil fallback - incluir com score
    let perfilMatch: PerfilBusca | null = null;
    let termosEncontrados: string[] = smartResult.gruposEncontrados;

    // Try to find a profile match for metadata
    for (const perfil of perfisAtivos) {
      const palavrasExcluir = perfil.palavras_excluir || [];
      const contemExclusao = palavrasExcluir.some((termo) => objeto.includes(termo.toLowerCase()));
      if (contemExclusao) continue;

      const todasPalavras = [...(perfil.palavras_incluir || []), ...(perfil.palavras_primarias || []), ...(perfil.palavras_secundarias || [])];
      const matches = todasPalavras.filter(termo => {
        const termoLower = termo.toLowerCase().trim();
        const palavras = termoLower.split(/\s+/).filter(p => p.length > 2);
        if (palavras.length === 0) return false;
        if (palavras.length === 1) return objeto.includes(palavras[0]);
        return palavras.every(palavra => objeto.includes(palavra));
      });
      if (matches.length >= 1) {
        perfilMatch = perfil;
        termosEncontrados = [...new Set([...termosEncontrados, ...matches])];
        break;
      }
    }

    // Use first active profile as default if none matched
    if (!perfilMatch && perfisAtivos.length > 0) {
      perfilMatch = perfisAtivos[0];
    }

    // Value check
    if (perfilMatch) {
      const perfilValorMinimo = perfilMatch.valor_minimo ?? 0;
      if (perfilValorMinimo > 0 && valorEstimado < perfilValorMinimo) {
        if (salvarTodas) await salvarLicitacaoCompleta(item, uf, 'valor', syncLogId, supabase);
        return 'valor';
      }
    }

    let prioridade = "media";
    const valorAltaPrioridade = perfilMatch?.valor_maximo ?? config.valor_prioridade_alta ?? Infinity;
    if (valorAltaPrioridade > 0 && valorEstimado >= valorAltaPrioridade) prioridade = "alta";
    else if ((perfilMatch?.valor_minimo ?? 0) > 0 && valorEstimado < (perfilMatch?.valor_minimo ?? 0) * 1.5) prioridade = "baixa";

    const municipioNome = item.municipio?.nome || item.municipioTermo || item.localEntrega?.municipio || item.localExecucao?.municipio || null;
    const municipioIbge = item.municipio?.codigoIbge || item.codigoMunicipioIbge || item.localExecucao?.codigoIbge || null;

    const registro = {
      numero_controle_pncp: numeroControle,
      objeto: item.objetoCompra || item.objeto || item.descricao || "Sem descrição",
      orgao_nome: orgaoNomeApi,
      orgao_cnpj: item.orgaoEntidade?.cnpj || item.cnpjOrgao || null,
      unidade_nome: item.unidadeOrgao?.nomeUnidade || item.unidade || null,
      municipio_nome: municipioNome,
      municipio_ibge: municipioIbge?.toString() || null,
      uf,
      valor_total_estimado: valorEstimado,
      data_publicacao: item.dataPublicacaoPncp || item.dataPublicacao || null,
      data_inicio_propostas: item.dataAberturaProposta || item.dataInicioProposta || null,
      data_fim_propostas: item.dataEncerramentoProposta || item.dataFimProposta || null,
      link_origem_pncp: gerarLinkPNCP(numeroControle),
      modalidade_contratacao: item.modalidadeContratacao?.nome || item.modalidade || null,
      prioridade,
      match_termos: termosEncontrados,
      perfil_busca_id: perfilMatch?.id || null,
      perfil_busca_nome: perfilMatch?.nome || null,
      user_id: perfilMatch?.user_id || null,
      orgao_id: orgaoMatch.orgaoId,
      orgao_sigla: orgaoMatch.orgaoSigla,
      score_busca: smartResult.score,
      grupos_match: smartResult.gruposEncontrados,
      raw_data: item,
    };

    if (orgaoMatch.strategy === 'manual_needed' && orgaoNomeApi) {
      await registrarOrgaoPendente(supabase, pendentesRegistrados, orgaoNomeApi, numeroControle);
    }

    const { error: upsertError } = await supabase
      .from("bd_pncp_contratacoes")
      .upsert(registro, { onConflict: "numero_controle_pncp", ignoreDuplicates: false });

    if (upsertError) {
      if (upsertError.code === "23505") return 'duplicado';
      console.error("    ❌ Erro ao inserir:", upsertError.message);
      return 'erro';
    }

    if (salvarTodas) await salvarLicitacaoCompleta(item, uf, 'smart_match', syncLogId, supabase);

    console.log(`    🧠 [Smart:${smartResult.score}] ${prioridade.toUpperCase()}: R$ ${valorEstimado.toLocaleString('pt-BR')} - ${municipioNome || uf} | Grupos: ${smartResult.gruposEncontrados.join(',') || 'perfil'}`);
    return orgaoMatch.orgaoId ? 'inserido:classificado' : 'inserido:pendente';
  }

  // ============================================================
  // MODO PADRÃO: lógica original de perfis
  // ============================================================
  let perfilMatch: PerfilBusca | null = null;
  let termosEncontrados: string[] = [];

  for (const perfil of perfisAtivos) {
    const todasPalavras = [...(perfil.palavras_incluir || []), ...(perfil.palavras_primarias || []), ...(perfil.palavras_secundarias || [])];
    const palavrasExcluir = perfil.palavras_excluir || [];

    const contemExclusao = palavrasExcluir.some((termo) => objeto.includes(termo.toLowerCase()));
    if (contemExclusao) {
      if (salvarTodas) await salvarLicitacaoCompleta(item, uf, 'exclusao', syncLogId, supabase);
      continue;
    }

    const matches = todasPalavras.filter(termo => {
      const termoLower = termo.toLowerCase().trim();
      const palavras = termoLower.split(/\s+/).filter(p => p.length > 2);
      if (palavras.length === 0) return false;
      if (palavras.length === 1) return objeto.includes(palavras[0]);
      return palavras.every(palavra => objeto.includes(palavra));
    });

    if (matches.length >= 1) {
      perfilMatch = perfil;
      termosEncontrados = matches;
      break;
    }
  }

  if (!perfilMatch) {
    if (salvarTodas) await salvarLicitacaoCompleta(item, uf, 'termo', syncLogId, supabase);
    return 'termo';
  }

  const perfilValorMinimo = perfilMatch.valor_minimo ?? 0;
  if (perfilValorMinimo > 0 && valorEstimado < perfilValorMinimo) {
    if (salvarTodas) await salvarLicitacaoCompleta(item, uf, 'valor', syncLogId, supabase);
    return 'valor';
  }

  let prioridade = "media";
  const valorAltaPrioridade = perfilMatch.valor_maximo ?? config.valor_prioridade_alta ?? Infinity;
  if (valorAltaPrioridade > 0 && valorEstimado >= valorAltaPrioridade) prioridade = "alta";
  else if (perfilValorMinimo > 0 && valorEstimado < perfilValorMinimo * 1.5) prioridade = "baixa";

  const municipioNome = item.municipio?.nome || item.municipioTermo || item.localEntrega?.municipio || item.localExecucao?.municipio || null;
  const municipioIbge = item.municipio?.codigoIbge || item.codigoMunicipioIbge || item.localExecucao?.codigoIbge || null;

  // Calculate smart score even in standard mode (for display)
  const smartResult = calcularSmartMatch(objeto, orgaoMatch.orgaoSigla, valorEstimado, pesosConfig, exclusoesConfig, scoreMinimo);

  const registro = {
    numero_controle_pncp: numeroControle,
    objeto: item.objetoCompra || item.objeto || item.descricao || "Sem descrição",
    orgao_nome: orgaoNomeApi,
    orgao_cnpj: item.orgaoEntidade?.cnpj || item.cnpjOrgao || null,
    unidade_nome: item.unidadeOrgao?.nomeUnidade || item.unidade || null,
    municipio_nome: municipioNome,
    municipio_ibge: municipioIbge?.toString() || null,
    uf,
    valor_total_estimado: valorEstimado,
    data_publicacao: item.dataPublicacaoPncp || item.dataPublicacao || null,
    data_inicio_propostas: item.dataAberturaProposta || item.dataInicioProposta || null,
    data_fim_propostas: item.dataEncerramentoProposta || item.dataFimProposta || null,
    link_origem_pncp: gerarLinkPNCP(numeroControle),
    modalidade_contratacao: item.modalidadeContratacao?.nome || item.modalidade || null,
    prioridade,
    match_termos: termosEncontrados,
    perfil_busca_id: perfilMatch.id,
    perfil_busca_nome: perfilMatch.nome,
    user_id: perfilMatch.user_id,
    orgao_id: orgaoMatch.orgaoId,
    orgao_sigla: orgaoMatch.orgaoSigla,
    score_busca: smartResult.score,
    grupos_match: smartResult.gruposEncontrados,
    raw_data: item,
  };

  if (orgaoMatch.strategy === 'manual_needed' && orgaoNomeApi) {
    await registrarOrgaoPendente(supabase, pendentesRegistrados, orgaoNomeApi, numeroControle);
  }

  const { error: upsertError } = await supabase
    .from("bd_pncp_contratacoes")
    .upsert(registro, { onConflict: "numero_controle_pncp", ignoreDuplicates: false });

  if (upsertError) {
    if (upsertError.code === "23505") return 'duplicado';
    console.error("    ❌ Erro ao inserir:", upsertError.message);
    return 'erro';
  }

  if (salvarTodas) await salvarLicitacaoCompleta(item, uf, 'match', syncLogId, supabase);

  console.log(`    ✅ [${perfilMatch.nome}|S:${smartResult.score}] ${prioridade.toUpperCase()}: R$ ${valorEstimado.toLocaleString('pt-BR')} - ${municipioNome || uf}`);
  return orgaoMatch.orgaoId ? 'inserido:classificado' : 'inserido:pendente';
}
