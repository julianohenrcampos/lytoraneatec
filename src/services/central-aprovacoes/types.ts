/**
 * Central de Aprovações — contrato genérico multi-módulo.
 */

export type CentralModulo = 'diarias' | 'equipamentos' | 'cedencia' | 'desmobilizacao' | 'outros';

export type CentralView = 'pendentes' | 'concluidas' | 'canceladas' | 'todas';

export interface CentralPostDecisionCapabilities {
  canReverter: boolean;
  canCancelar: boolean;
  blockReason: string | null;
}

export interface CentralApprovalItem {
  id: string;
  modulo: CentralModulo;
  moduloLabel: string;
  protocolo: string;
  titulo: string;
  solicitanteNome: string | null;
  centroCustoLabel: string | null;
  valorEstimado: number | null;
  statusCodigo: string | null;
  statusLabel: string;
  dataReferencia: string | null;
  atualizadoEm: string | null;
  aguardandoMinhaAcao: boolean;
  canApprove: boolean;
  canReject: boolean;
  currentStageExecId: string | null;
  approveBlockReason: string | null;
  rejectBlockReason: string | null;
  authorizationSource: string | null;
  capabilitiesUnavailable: boolean;
  urgente: boolean;
  autoApproval: boolean;
  postDecisionCapabilities?: CentralPostDecisionCapabilities;
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
  view?: CentralView;
}


export interface CentralModuleState {
  enabled: boolean;
  isLoading: boolean;
  isError: boolean;
  errorMessage: string | null;
  refetch: () => void;
}

export interface CentralProviderResult {
  itens: CentralApprovalItem[];
  indicadores: CentralIndicadores;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  centrosCustoOptions: { value: string; label: string }[];
  solicitantesOptions: { value: string; label: string }[];
  statusOptions: { value: string; label: string }[];
  moduleStates: Partial<Record<CentralModulo, CentralModuleState>>;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  loadMore?: () => void;
}
