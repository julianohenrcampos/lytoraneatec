/**
 * Central de Aprovações — contrato genérico multi-módulo.
 * Fase 1: apenas Diárias.
 */

export type CentralModulo = 'diarias' | 'equipamentos' | 'cedencia' | 'desmobilizacao' | 'outros';

export interface CentralApprovalItem {
  /** ID interno do provider (ex.: id da solicitação). */
  id: string;
  /** Origem do item (módulo). */
  modulo: CentralModulo;
  /** Rótulo humano do módulo (ex.: "Diárias"). */
  moduloLabel: string;
  /** Protocolo/identificador visível (ex.: "SOL-XXXXXXXX" ou número da solicitação). */
  protocolo: string;
  /** Título curto (ex.: "Diárias — CC 12 - Obra X"). */
  titulo: string;
  /** Solicitante (nome). */
  solicitanteNome: string | null;
  /** Centro de custo formatado (código + nome). */
  centroCustoLabel: string | null;
  /** Valor estimado (opcional). */
  valorEstimado: number | null;
  /** Status técnico interno (para lógica). */
  statusCodigo: string | null;
  /** Rótulo humano do status (para exibição). */
  statusLabel: string;
  /** Data-base da solicitação (ISO). */
  dataReferencia: string | null;
  /** Última atualização (ISO). */
  atualizadoEm: string | null;
  /** Indica se o usuário atual pode agir neste item (fila prioritária = canApprove). */
  aguardandoMinhaAcao: boolean;
  /** Permission-first: pode aprovar (gate canônico). */
  canApprove: boolean;
  /** Permission-first: pode reprovar/rejeitar (gate canônico). */
  canReject: boolean;
  /** ID da etapa de execução atual (motor dinâmico). Null quando legado ou não aplicável. */
  currentStageExecId: string | null;
  /** Motivo textual quando canApprove=false (ex.: 'sem_permissao_aprovar', 'assinatura_ausente'). */
  approveBlockReason: string | null;
  /** Motivo textual quando canReject=false. */
  rejectBlockReason: string | null;
  /** Origem da autorização ('permission_stage' | 'superadmin' | 'dynamic_stage' | 'denied'). */
  authorizationSource: string | null;
  /** True quando a resolução de capacidades falhou (fail-closed). */
  capabilitiesUnavailable: boolean;
  /** Marcadores de urgência (Fase 1: nunca true — sem fonte confiável). */
  urgente: boolean;
  /** Payload bruto retornado pelo provider — usado pelas ações de aprovação/reprovação. */
  raw: unknown;
}


export interface CentralIndicadores {
  pendentes: number | null;
  urgentes: number | null;
  aguardandoMinhaAcao: number | null;
  concluidasHoje: number | null;
  tempoMedioHojeMin: number | null;
}

export interface CentralFiltrosBase {
  modulos?: CentralModulo[];
  centroCustoId?: string;
  solicitanteId?: string;
  status?: string;
  periodoInicio?: string;
  periodoFim?: string;
  apenasMinhas?: boolean;
  busca?: string;
}

export interface CentralProviderResult {
  itens: CentralApprovalItem[];
  indicadores: CentralIndicadores;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  /** Opções de filtro específicas do módulo (Fase 1: exposto pelo provider de Diárias). */
  centrosCustoOptions: { value: string; label: string }[];
  solicitantesOptions: { value: string; label: string }[];
  statusOptions: { value: string; label: string }[];
}
