/**
 * Tipos do Dashboard de Chamados Internos.
 * Apenas leitura agregada — todas as fontes são RPCs `fn_chamado_interno_dash_*`.
 */
import type {
  ChamadoInternoPrioridade,
  ChamadoInternoSetor,
  ChamadoInternoStatus,
} from "@/types/chamadosInternos";

export type SlaFiltro = "todos" | "no_prazo" | "a_vencer" | "estourado";

export interface ChamadosDashFiltro {
  /** ISO string início (inclusive). */
  de: string;
  /** ISO string fim (exclusive). */
  ate: string;
  setor?: ChamadoInternoSetor[] | null;
  prioridade?: ChamadoInternoPrioridade[] | null;
  responsavelProfileId?: string | null;
  centroCustoId?: string | null;
  sla?: SlaFiltro;
}

export interface ChamadosDashKpis {
  total: number;
  total_anterior: number;
  abertos: number;
  abertos_anterior: number;
  em_andamento: number;
  em_andamento_anterior: number;
  encerrados: number;
  encerrados_anterior: number;
  criticos: number;
  sla_estourado: number;
  sla_avaliados: number;
  sla_no_prazo: number;
  frt_minutos: number | null;
  frt_minutos_anterior: number | null;
  mttr_minutos: number | null;
  mttr_minutos_anterior: number | null;
  sem_resposta: number;
  csat_media: number | null;
  csat_respostas: number;
}


export interface ChamadosDashSeriePonto {
  dia: string;
  abertos: number;
  resolvidos: number;
}

export interface ChamadosDashDistribuicao {
  chave: string;
  valor: number;
}

export interface ChamadosDashHeatCell {
  dia_semana: number;
  hora: number;
  valor: number;
}

export interface ChamadosDashCentroCustoRow {
  chave: string;
  total: number;
  abertos: number;
  encerrados: number;
}

export interface ChamadosDashSeries {
  serie: ChamadosDashSeriePonto[];
  status: ChamadosDashDistribuicao[];
  setores: ChamadosDashDistribuicao[];
  categorias: ChamadosDashDistribuicao[];
  centros_custo: ChamadosDashCentroCustoRow[];
  heatmap: ChamadosDashHeatCell[];
}


export interface ChamadosDashAtendenteRow {
  atendente_profile_id: string;
  atendente_nome: string;
  atribuidos: number;
  resolvidos: number;
  mttr_minutos: number | null;
  frt_minutos: number | null;
}

export interface ChamadosDashFilaRiscoRow {
  id: string;
  protocolo: string;
  titulo: string;
  status: ChamadoInternoStatus;
  setor: ChamadoInternoSetor;
  prioridade: ChamadoInternoPrioridade;
  is_critico: boolean;
  sla_prazo: string;
  minutos_restantes: number | null;
  solicitante_nome: string;
  responsavel_nome: string;
  centro_custo_codigo: string;
  created_at: string;
}

export interface ChamadosDashSolicitanteRow {
  adm_sede_funcionario_id: string | null;
  nome: string;
  total: number;
  respondidos: number;
  sem_resposta: number;
  em_aberto: number;
  encerrados: number;
  centros_custo: number;
  frt_minutos: number | null;
}

