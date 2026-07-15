import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Ban, CircleCheck, Clock, HelpCircle, type LucideIcon } from "lucide-react";

export type StatusMapa =
  | "NAO_CONFORME"
  | "PARADO"
  | "DESATUALIZADO"
  | "OPERACIONAL"
  | "SEM_STATUS";

export type PeriodoLocalizacao = "TODAS" | "2H" | "24H" | "7D" | "PERSONALIZADO";

export interface MapaOperacionalAtivo {
  localizacao_id: string;
  apontamento_id: string;
  equipamento_id: string;
  latitude: number;
  longitude: number;
  precisao_gps: number | null;
  data_registro: string;
  origem: string;
  frota: string | null;
  numero_frota: string | null;
  placa: string | null;
  imagem_url: string | null;
  categoria_id: string | null;
  categoria_nome: string | null;
  subcategoria_id: string | null;
  subcategoria_nome: string | null;
  centro_custo_id: string | null;
  centro_custo_nome: string | null;
  centro_custo_codigo: string | null;
  operador_id: string | null;
  operador_nome: string | null;
  data_apontamento: string | null;
  hora_apontamento: string | null;
  horimetro_final: number | null;
  situacao_veiculo: string | null;
  checklist_codigo: string | null;
  total_checklist: number;
  qtd_nao_ok: number;
  status_mapa: StatusMapa;
  status_label: string;
  status_prioridade: number;
  coordenada_precisa: boolean;
}

export interface MapaOperacionalResumo {
  total_ativos_acessiveis: number;
  localizados: number;
  sem_localizacao: number;
  operacionais: number;
  nao_conformes: number;
  parados: number;
  desatualizados: number;
  sem_status: number;
}

export interface MapaOperacionalCentroCustoEquipamento {
  equipamento_id: string;
  frota: string | null;
  numero_frota: string | null;
  placa: string | null;
  imagem_url: string | null;
  situacao: string | null;
  tem_gps: boolean;
}

export interface MapaOperacionalCentroCusto {
  centro_custo_id: string;
  codigo: string | null;
  nome: string | null;
  endereco: string | null;
  latitude: number;
  longitude: number;
  total_alocados: number;
  total_com_gps: number;
  total_sem_gps: number;
  equipamentos: MapaOperacionalCentroCustoEquipamento[];
}

export interface MapaOperacionalResponse {
  ativos: MapaOperacionalAtivo[];
  centros_custo: MapaOperacionalCentroCusto[];
  resumo: MapaOperacionalResumo;
  gerado_em: string;
  coordenada_precisa: boolean;
}

export interface MapaOperacionalFiltros {
  busca?: string;
  status_mapa?: StatusMapa[];
  situacao?: string[];
  somente_nao_conformes?: boolean;
  limite_desatualizado_horas?: number;
  periodo_localizacao?: PeriodoLocalizacao;
  periodo_inicio?: string;
  periodo_fim?: string;
  centro_custo_ids?: string[];
  categoria_ids?: string[];
  subcategoria_ids?: string[];
  operador_ids?: string[];
}

export const EMPTY_MAPA_RESPONSE: MapaOperacionalResponse = {
  ativos: [],
  centros_custo: [],
  resumo: {
    total_ativos_acessiveis: 0,
    localizados: 0,
    sem_localizacao: 0,
    operacionais: 0,
    nao_conformes: 0,
    parados: 0,
    desatualizados: 0,
    sem_status: 0,
  },
  gerado_em: new Date(0).toISOString(),
  coordenada_precisa: false,
};

export async function fetchMapaOperacional(
  filtros: MapaOperacionalFiltros = {},
): Promise<MapaOperacionalResponse> {
  const payload: Record<string, unknown> = {};
  if (filtros.busca) payload.busca = filtros.busca;
  if (filtros.status_mapa?.length) payload.status_mapa = filtros.status_mapa;
  if (filtros.situacao?.length) payload.situacao = filtros.situacao;
  if (filtros.somente_nao_conformes) payload.somente_nao_conformes = true;
  if (filtros.limite_desatualizado_horas)
    payload.limite_desatualizado_horas = filtros.limite_desatualizado_horas;
  if (filtros.periodo_localizacao && filtros.periodo_localizacao !== "TODAS")
    payload.periodo_localizacao = filtros.periodo_localizacao;
  if (filtros.periodo_inicio) payload.periodo_inicio = filtros.periodo_inicio;
  if (filtros.periodo_fim) payload.periodo_fim = filtros.periodo_fim;
  if (filtros.centro_custo_ids?.length) payload.centro_custo_ids = filtros.centro_custo_ids;
  if (filtros.categoria_ids?.length) payload.categoria_ids = filtros.categoria_ids;
  if (filtros.subcategoria_ids?.length) payload.subcategoria_ids = filtros.subcategoria_ids;
  if (filtros.operador_ids?.length) payload.operador_ids = filtros.operador_ids;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc(
    "fn_mapa_operacional_ultimas_localizacoes",
    { p_filtros: payload },
  );
  if (error) throw error;
  if (!data) return EMPTY_MAPA_RESPONSE;
  const raw = data as Partial<MapaOperacionalResponse>;
  return {
    ativos: Array.isArray(raw.ativos) ? raw.ativos : [],
    centros_custo: Array.isArray(raw.centros_custo) ? raw.centros_custo : [],
    resumo: raw.resumo ?? EMPTY_MAPA_RESPONSE.resumo,
    gerado_em: raw.gerado_em ?? new Date().toISOString(),
    coordenada_precisa: !!raw.coordenada_precisa,
  };
}

export interface StatusVisual {
  mapboxColor: string;
  badgeClass: string;
  label: string;
  icon: LucideIcon;
}

export const STATUS_COLORS: Record<StatusMapa, StatusVisual> = {
  NAO_CONFORME: {
    mapboxColor: "#DC2626",
    badgeClass: "bg-red-500/15 text-red-500 border-red-500/30",
    label: "Não conforme",
    icon: AlertTriangle,
  },
  PARADO: {
    mapboxColor: "#F59E0B",
    badgeClass: "bg-amber-500/15 text-amber-500 border-amber-500/30",
    label: "Parado/indisponível",
    icon: Ban,
  },
  DESATUALIZADO: {
    mapboxColor: "#6B7280",
    badgeClass: "bg-gray-500/15 text-gray-400 border-gray-500/30",
    label: "Desatualizado",
    icon: Clock,
  },
  OPERACIONAL: {
    mapboxColor: "#16A34A",
    badgeClass: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
    label: "Operacional",
    icon: CircleCheck,
  },
  SEM_STATUS: {
    mapboxColor: "#3B82F6",
    badgeClass: "bg-blue-500/15 text-blue-500 border-blue-500/30",
    label: "Sem status",
    icon: HelpCircle,
  },
};

export const STATUS_ORDER: StatusMapa[] = [
  "NAO_CONFORME",
  "PARADO",
  "DESATUALIZADO",
  "OPERACIONAL",
  "SEM_STATUS",
];

export const SITUACOES_VEICULO = ["Operando", "Disponível", "Em Manutenção", "Intempérie"] as const;
