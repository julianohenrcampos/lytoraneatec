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
  // Mantido só para compatibilidade com chamadas antigas:
  | "funcao_sem_mapeamento";

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
}

export const JORNADA_DIARIA_HORAS = 8;

