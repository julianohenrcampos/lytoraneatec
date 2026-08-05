// Fase 6F / 6H.1.1 / 6I.2-B — tipos da importação de cronograma (CSV/XLSX) + recursos planejados.

import type { OrigemPlanejamento } from "@/types/planejamentoMacro";

export type FormatoArquivoImportacao =
  | "csv"
  | "xlsx"
  | "xml_msproject"
  | "csv_com_xml";

/** 7A — Cabeçalho do projeto detectado em arquivos MS Project XML. */
export interface ProjetoDetectado {
  uid: string | null;
  nome: string | null;
  autor: string | null;
  dataCriacao: string | null;
  dataInicioProjeto: string | null;
  dataFimProjeto: string | null;
  calendarioPadrao: string | null;
}

/** 7A — Aviso operacional do parser (não bloqueante). */
export interface AvisoParser {
  codigo: string;
  mensagem: string;
  ref?: string | null;
}

export const LIMITE_LINHAS_IMPORTACAO = 5000;

export interface AtividadeImportadaPreview {
  linhaOriginal: number;
  codigo_wbs: string | null;
  uidTarefa: string | null;
  idTarefa: string | null;
  nome: string;
  descricao: string | null;
  frente_servico: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  unidade: string | null;
  quantidade_prevista: number | null;
  producao_prevista: number | null;
  prioridade: "baixa" | "media" | "alta";
  status: "planejada";
  ordem_execucao: number;
  warnings: string[];
  errors: string[];
  ignored: boolean;
  // ----- 7A — enriquecimentos MS Project (persistidos apenas se na whitelist) -----
  outline_number?: string | null;
  outline_level?: number | null;
  is_resumo?: boolean;
  is_marco?: boolean;
  duracao_horas?: number | null;
  trabalho_previsto_horas?: number | null;
  /** Apenas preview/diagnóstico nesta fase — nunca persiste em 7A. */
  percentual_concluido_importado?: number | null;
  // Fase 1C — atividade crítica do MS Project (<Critical>).
  is_critica?: boolean;
  // Fase 1C — origem do par quantidade/unidade.
  quantidade_origem?: "msproject_extattr" | "planilha" | "manual" | "indefinido" | null;
}

export interface CcDoArquivo {
  presente: boolean;
  valorBruto: string | null;
  divergente: boolean;
}

// ---------- 6H.1.1 / 6I.2-B — Alocações / Recursos ----------

export type FamiliaRecurso =
  | "MOD"
  | "MOI"
  | "EQ"
  | "MAT"
  | "SUB"
  | "ADM"
  | "ADM_CONTRATUAL"
  | "SE"
  | "desconhecida";

export type GrupoRecurso = "INSUMOS" | "FATURAMENTO" | "desconhecido";

export type NaturezaOperacional = "operacional" | "diagnostico" | "referencia";

/**
 * 6I.2-B — Catálogo de recursos (aba Tabela_Recursos1).
 * Apenas leitura/diagnóstico nesta fase. SEM campos financeiros.
 */
export interface RecursoCatalogoPreview {
  linhaOriginal: number;
  uidRecurso: string | null;
  idRecurso: string | null;
  nomeRecurso: string;
  grupoBruto: string | null;
  grupo: GrupoRecurso;
  familiaBruta: string | null;
  familia: FamiliaRecurso;
  unidadeMedida: string | null;
  observacoes: string | null;
}

export type MotivoIgnoradoAlocacao =
  | "familia_fora_escopo"
  | "sem_atividade"
  | "sem_funcao"
  | "ambiguo"
  | "grupo_faturamento"
  | "familia_nao_persistida_fase"
  | "eq_sem_uid"
  | "mat_sem_unidade"
  | null;


export interface AlocacaoPreview {
  linhaOriginal: number;
  uidTarefa: string | null;
  idTarefa: string | null;
  wbsTarefa: string | null;
  nomeTarefa: string | null;
  uidRecurso: string | null;
  idRecurso: string | null;
  nomeRecurso: string | null;
  // Grupo / família declarados na atribuição vs. efetivos (catálogo vence)
  grupoBruto: string | null;
  grupo: GrupoRecurso;
  familiaBruta: string | null;
  familiaDeclarada: FamiliaRecurso;
  familiaEfetiva: FamiliaRecurso;
  /** Compat: mantém campo "familia" = familiaEfetiva (usado por código legado). */
  familia: FamiliaRecurso;
  divergenciaFamilia: boolean;
  natureza: NaturezaOperacional;
  trabalhoHoras: number | null;
  unidades: number | null;
  vinculoAtividadeLinha: number | null;
  ambiguo: boolean;
  funcaoId: string | null;
  funcaoNomeResolvido: string | null;
  motivoIgnorado: MotivoIgnoradoAlocacao;
}

export interface DivergenciaFamiliaItem {
  linha: number;
  nomeRecurso: string;
  declarada: FamiliaRecurso;
  efetiva: FamiliaRecurso;
}

export interface SuspeitaClassificacaoItem {
  linha: number;
  nomeRecurso: string;
  familiaInformada: FamiliaRecurso;
  familiaSugerida: FamiliaRecurso;
  motivo: string;
}

export interface RecursosImportacaoResumo {
  totalLinhasAba: number;
  detectadasMaoObra: number;
  ignoradasPorFamilia: number;
  semAtividade: number;
  ambiguos: number;
  semFuncao: number;
  mapeados: number;
  consolidacoes: number;
  funcoesNaoMapeadas: { nomeRecurso: string; ocorrencias: number }[];
  alocacoesSemAtividade: {
    uidRecurso: string | null;
    nomeRecurso: string | null;
    uidTarefa: string | null;
    nomeTarefa: string | null;
  }[];
  ignoradasPorFamiliaDetalhe: Record<string, number>;
  // ---- 6I.2-B ----
  catalogo: {
    total: number;
    porGrupo: Record<string, number>;
    porFamilia: Record<string, number>;
  };
  /** Atribuições por família efetiva (operacional + diagnóstico). */
  porFamiliaEfetiva: Record<string, number>;
  /** Atribuições EQ/MAT/SUB/ADM — diagnóstico não persistido. */
  diagnosticoNaoPersistido: {
    total: number;
    porFamilia: Record<string, number>;
    horas: number;
  };
  /** Atribuições/recursos do grupo FATURAMENTO — referência, nunca persistido. */
  faturamento: {
    atribuicoes: number;
    recursosCatalogo: number;
    horas: number;
  };
  divergenciasFamilia: DivergenciaFamiliaItem[];
  suspeitasClassificacao: SuspeitaClassificacaoItem[];
  /** 6I.2-C — telemetria de persistência operacional ampliada. */
  persistidosPorFamilia?: Record<string, number>;
  pendencias?: {
    eqSemUid: Array<{ atividade_uid_externo: string | null; descricao: string }>;
    matSemUnidade: Array<{ atividade_uid_externo: string | null; descricao: string }>;
    faturamentoBloqueado: number;
  };
}

export interface ResultadoParse {
  formato: FormatoArquivoImportacao;
  origem: OrigemPlanejamento;
  nomeArquivo: string;
  totalLinhas: number;
  atividades: AtividadeImportadaPreview[];
  cc: CcDoArquivo;
  globalErrors: string[];
  globalWarnings: string[];
  bloqueado: boolean;
  motivoBloqueio: string | null;
  periodo: { inicio: string | null; fim: string | null };
  resumo: { validas: number; ignoradas: number; comErro: number };
  alocacoes: AlocacaoPreview[];
  /** 6I.2-B — catálogo de recursos (aba Recursos). Apenas diagnóstico. */
  recursosCatalogo: RecursoCatalogoPreview[];
  recursos: RecursosImportacaoResumo | null;
  /** 7A — Dados do projeto detectados (apenas XML MS Project). */
  projetoDetectado?: ProjetoDetectado | null;
  /** 7A — Avisos do parser (não bloqueantes). */
  avisos?: AvisoParser[];
  /** 7A — Campos preservados em preview mas não persistíveis nesta fase. */
  camposNaoPersistidos?: string[];
}

export interface CentroCustoSelecionado {
  id: string;
  codigo_centro_custo: string;
  nome_centro_custo: string;
}

export interface AtividadeParaInserir {
  linhaOriginal: number; // chave de correlação em memória; não vai ao banco
  codigo_wbs: string | null;
  nome: string;
  descricao: string | null;
  frente_servico: string | null;
  data_inicio: string;
  data_fim: string;
  unidade: string | null;
  quantidade_prevista: number | null;
  producao_prevista: number | null;
  prioridade: string | null;
  status: string;
  ordem_execucao: number;
  // ----- 7A — enriquecimentos MS Project (opcionais, gravados via whitelist) -----
  uid_externo?: string | null;
  id_externo?: string | null;
  outline_number?: string | null;
  outline_level?: number | null;
  duracao_horas?: number | null;
  trabalho_previsto_horas?: number | null;
  is_resumo?: boolean;
  is_marco?: boolean;
  arquivo_origem_nome?: string | null;
  // Fase 1C
  is_critica?: boolean;
  quantidade_origem?: "msproject_extattr" | "planilha" | "manual" | "indefinido" | null;
}

