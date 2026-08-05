// Fase 6J.1 — Tipos locais do Plano Semanal derivado (read-only).
// Não persistido em banco; tudo derivado em memória.

export interface SemanaRef {
  /** Semana ISO. */
  ano: number;
  semana: number;
  /** Segunda-feira 00:00 BRT (ISO YYYY-MM-DD). */
  inicio: string;
  /** Domingo 23:59 BRT (ISO YYYY-MM-DD — usar como limite inclusivo). */
  fim: string;
  /** Lista de dias úteis (seg-sex) da semana em ISO YYYY-MM-DD. */
  diasUteis: string[];
  /** Chave estável para memoização: "YYYY-Www". */
  key: string;
}

export interface AtividadeBruta {
  id: string;
  planejamento_id: string;
  codigo_wbs: string | null;
  outline_number: string | null;
  outline_level: number | null;
  nome: string;
  frente_servico: string | null;
  data_inicio: string;
  data_fim: string;
  status: string;
  is_marco: boolean;
  is_resumo: boolean;
  duracao_horas: number | null;
  quantidade_prevista: number | null;
  unidade: string | null;
  /** Fase C — progresso da atividade. */
  percentual_concluido_importado?: number | null;
  percentual_manual?: number | null;
  percentual_manual_observacao?: string | null;
  percentual_manual_atualizado_em?: string | null;
  fonte_progresso?: "manual" | "importado" | "apontamento" | "diario" | null;
  /** Fase 1C — atividade crítica importada do MS Project. */
  is_critica?: boolean;
  /** Fase 1C — origem do quantitativo: 'planilha' | 'indefinido' | 'manual'. */
  quantidade_origem?: string | null;
}

export interface RecursoBruto {
  id: string;
  planejamento_id: string;
  atividade_id: string;
  tipo_recurso: "mao_obra" | "equipamento" | "material" | string;
  funcao_id: string | null;
  descricao: string;
  unidade: string | null;
  quantidade_prevista: number;
  horas_previstas: number | null;
  data_necessaria_inicio: string | null;
  data_necessaria_fim: string | null;
  grupo: string | null;
  familia: string | null;
}

/** 7A — Classificação semanal por flags. Reservado: reprogramada/antecipavel. */
export type ClassificacaoSemanaAtividade =
  | "inicia_semana"
  | "em_andamento"
  | "termina_semana"
  | "atrasada"
  | "reprogramada"
  | "antecipavel"
  | "marco";

export interface AtividadeNaSemana {
  atividade: AtividadeBruta;
  inicioNaSemana: string;
  fimNaSemana: string;
  diasUteisNaSemana: number;
  /** 7A — flags da semana (pode ter mais de uma). */
  flags: ClassificacaoSemanaAtividade[];
  /** 7A — flag principal pela prioridade explícita. */
  flagPrincipal: ClassificacaoSemanaAtividade;
}

export interface LinhaMO {
  funcao: string;
  horasSemana: number;
  diasHomem: number;
  qtdEquivalente: number;
  picoDiario: number;
  qtdSugerida: number;
  /** Fase 7B — Planejado (pico) operacional, em pessoas. */
  planejadoPico: number;
  atividades: Array<{ wbs: string | null; nome: string }>;
}

export interface LinhaEQ {
  chave: string;
  /** Fase 7B — somente "equipamento". SUB/ADM não compõem mais a aba. */
  tipo: "equipamento";
  grupo: string | null;
  familia: string | null;
  descricao: string;
  unidade: string | null;
  picoSemana: number;
  inicioNecessario: string;
  fimNecessario: string;
  atividades: Array<{ wbs: string | null; nome: string }>;
}


export interface LinhaMAT {
  descricao: string;
  unidade: string;
  quantidadeSemana: number;
  unidadesDivergentes: boolean;
  atividades: Array<{ wbs: string | null; nome: string }>;
}

// Fase 7B — Pendências operacionais (somente leitura/derivado).
export type TipoPendencia =
  // legados de cálculo:
  | "recurso_sem_horas"
  | "recurso_sem_data"
  | "unidade_divergente"
  | "atividade_sem_duracao"
  // Fase 7B — diagnóstico operacional:
  | "FUNCAO_NAO_MAPEADA"
  | "FAMILIA_DESCONHECIDA"
  | "FORA_DO_ESCOPO_OPERACIONAL"
  | "EQUIPAMENTO_SEM_CATALOGO"
  | "MATERIAL_SEM_UNIDADE"
  | "RECURSO_SEM_ATIVIDADE"
  // Fase 1C — saneamento da atividade:
  | "ATIVIDADE_SEM_QUANTIDADE"
  | "ATIVIDADE_SEM_UNIDADE"
  | "ATIVIDADE_CRITICA_SEM_EQUIPE"
  // Mantido só para compatibilidade com chamadas antigas:
  | "funcao_sem_mapeamento";

export type SeveridadePendenciaOp = "aviso" | "critica";

/** Fase 1C-2A — agrupamento visual da pendência na aba Saneamento. */
export type GrupoPendencia =
  | "critica"
  | "atividade"
  | "mao_obra"
  | "equipamento"
  | "material"
  | "fora_escopo"
  | "outros";

export interface Pendencia {
  tipo: TipoPendencia;
  descricao: string;
  atividadeId?: string;
  recursoId?: string;
  /** Fase 7B — sugestão de ação humana ("Cadastrar função em bd_funcoes", etc.). */
  acaoSugerida?: string;
  /** Fase 7B — família detectada (quando aplicável). */
  familiaDetectada?: string | null;
  /** Fase 7B — item alvo (descrição do recurso/equipamento). */
  item?: string;
  /** Fase 1C — severidade operacional ('aviso' por padrão). */
  severidade?: SeveridadePendenciaOp;
  // ===== Fase 1C-2A — Rastreabilidade =====
  grupo?: GrupoPendencia;
  eap?: string | null;
  periodoInicio?: string | null;
  periodoFim?: string | null;
  statusAtividade?: string | null;
  isCritica?: boolean;
  quantidadePrevista?: number | null;
  unidade?: string | null;
  quantidadeOrigem?: string | null;
  /** True quando a atividade cruza a semana ativa do usuário no Planejamento Semanal. */
  dentroDaSemanaSelecionada?: boolean;
}

export const JORNADA_DIARIA_HORAS = 8;

