/**
 * CT-3C R2 — Contratos TypeScript da mobilização real da Central do Transporte.
 *
 * Espelham 1:1 o retorno vivo das RPCs:
 *   fn_ct_mobilizacao_estado           → CtMobilizacaoEstado
 *   fn_ct_mobilizacao_salvar_rascunho  → CtMobilizacaoComandoResult
 *   fn_ct_mobilizacao_programar        → CtMobilizacaoComandoResult
 *   fn_ct_mobilizacao_cancelar         → CtMobilizacaoComandoResult
 *   fn_ct_mobilizacao_nova_revisao     → CtMobilizacaoComandoResult
 *   fn_ct_ativo_edicao_permitida       → CtAtivoEdicaoPermitida
 *
 * Nenhum status é inferido no frontend: viagens, movimentações, snapshots e a
 * versão do planejamento vêm sempre do servidor.
 */

export const CT3C_JUSTIFICATIVA_MIN = 20;

export type CtPlanejamentoStatus = "RASCUNHO" | "PROGRAMADO" | "CANCELADO";

export type CtViagemStatus =
  | "RASCUNHO"
  | "PROGRAMADA"
  | "EM_TRANSITO"
  /* CT-3F — chegada registrada, aguardando conferência do recebedor */
  | "AGUARDANDO_RECEBIMENTO"
  /* CT-3F — houve recusa no recebimento e o caso exige tratativa */
  | "PENDENTE_TRATATIVA"
  | "CONCLUIDA"
  | "CANCELADA";

/** Modalidade de deslocamento — escolha explícita da viagem. */
export type CtModalidade = "RODANTE" | "TRANSPORTADO";

/** Tipo de transporte — só se aplica a viagens TRANSPORTADO. */
export type CtTipoTransporte = "PROPRIO" | "TERCEIRO";

export const CT_MODALIDADE_LABELS: Record<CtModalidade, string> = {
  RODANTE: "Rodante (se desloca por conta própria)",
  TRANSPORTADO: "Transportado (prancha/carreta)",
};

export const CT_TIPO_TRANSPORTE_LABELS: Record<CtTipoTransporte, string> = {
  PROPRIO: "Transportador próprio",
  TERCEIRO: "Transportadora terceira",
};

export const CT_VIAGEM_STATUS_LABELS: Record<CtViagemStatus, string> = {
  RASCUNHO: "Rascunho",
  PROGRAMADA: "Programada",
  EM_TRANSITO: "Em trânsito",
  AGUARDANDO_RECEBIMENTO: "Aguardando recebimento",
  PENDENTE_TRATATIVA: "Pendente de tratativa",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
};

export const CT_PLANEJAMENTO_STATUS_LABELS: Record<CtPlanejamentoStatus, string> = {
  RASCUNHO: "Rascunho",
  PROGRAMADO: "Programado",
  CANCELADO: "Cancelado",
};

/** Versão do planejamento logístico da solicitação. */
export interface CtPlanejamento {
  id: string;
  versao: number;
  status: CtPlanejamentoStatus;
  vigente: boolean;
  lockVersion: number;
  contentHash: string | null;
  dataPrevistaEntrega: string | null;
  observacoes: string | null;
  programadoEm: string | null;
  revisaoDePlanejamentoId: string | null;
  viagens: CtViagem[];
}

/** Ativo reservado elegível a mobilização (1 linha por atendimento). */
export interface CtAtivoMobilizavel {
  atendimentoId: string;
  solicitacaoItemId: string;
  equipamentoId: string;
  frota: string | null;
  numeroFrota: string | null
  placa: string | null;
  statusAtendimento: string;
  periodoInicio: string | null;
  periodoFim: string | null;
  centroCustoAtualId: string | null;
  centroCustoAtualNome: string | null;
  /** null quando o ativo ainda não foi agrupado em nenhuma viagem. */
  movimentacaoId: string | null;
  movimentacaoStatus: string | null;
  viagemId: string | null;
}

/** Viagem persistida (agrupamento de ativos com um transporte). */
export interface CtViagem {
  id: string;
  codigo: string;
  status: CtViagemStatus;
  modalidade: CtModalidade | null;
  tipoTransporte: CtTipoTransporte | null;
  motoristaId: string | null;
  motoristaNomeSnapshot: string | null;
  motoristaCpfSnapshot: string | null;
  veiculoTransportadorId: string | null;
  placaTransportadorSnapshot: string | null;
  empresaTransportadoraId: string | null;
  empresaTransportadoraNomeSnapshot: string | null;
  origemCentroCustoId: string | null;
  origemCcCodigoSnapshot: string | null;
  origemCcNomeSnapshot: string | null;
  origemCcEnderecoSnapshot: string | null;
  origemCcLatitudeSnapshot: number | null;
  origemCcLongitudeSnapshot: number | null;
  /** CT-3D — endereço operacional da coleta (nasce do CC, editável). */
  origemEnderecoOperacional: string | null;
  origemPontoExato: string | null;
  origemColetaLatitude: number | null;
  origemColetaLongitude: number | null;
  destinoCentroCustoId: string | null;
  destinoCcCodigoSnapshot: string | null;
  destinoCcNomeSnapshot: string | null;
  destinoCcEnderecoSnapshot: string | null;
  destinoCcLatitudeSnapshot: number | null;
  destinoCcLongitudeSnapshot: number | null;
  /** CT-3D — endereço operacional da descarga (nasce do CC, editável). */
  destinoEnderecoOperacional: string | null;
  destinoPontoExato: string | null;
  destinoDescargaLatitude: number | null;
  destinoDescargaLongitude: number | null;
  /** CT-3D — recebedor previsto (funcionário cadastrado ou pessoa manual). */
  recebedorPrevistoFuncionarioId: string | null;
  recebedorPrevistoNomeSnapshot: string | null;
  recebedorPrevistoTelefoneSnapshot: string | null;
  dataPrevistaSaida: string | null;
  /** Data principal da mobilização. */
  dataPrevistaEntrega: string | null;
  distanciaKm: number | null;
  /** CT-3D.1 — distância medida na rota escolhida (Mapbox Directions). */
  distanciaRotaKm: number | null;
  duracaoRotaMin: number | null;
  rotaResumo: string | null;
  /** CT-3D.1 — distância operacional calculada pelo servidor (regra dos 28 km). */
  distanciaOperacionalKm: number | null;
  distanciaRegraAplicada: string | null;
  observacoes: string | null;
  atendimentoIds: string[];
}


export interface CtMobilizacaoEstado {
  ok: true;
  solicitacaoId: string;
  planejamentoVigente: CtPlanejamento | null;
  rascunhoEmEdicao: CtPlanejamento | null;
  ativos: CtAtivoMobilizavel[];
  /** Viagens da versão em foco (rascunho quando existe, senão a vigente). */
  viagens: CtViagem[];
}

/** Viagem em edição na UI — só existe no cliente até o rascunho ser salvo. */
export interface CtViagemRascunho {
  /** Chave local estável (não é o id do servidor). */
  chaveLocal: string;
  /** UUID estável gerado no cliente, usado para reconciliar viagens novas. */
  clientRef: string;
  /** id do servidor quando a viagem já foi persistida nesta versão. */
  id: string | null;
  codigo: string | null;
  modalidade: CtModalidade | null;
  tipoTransporte: CtTipoTransporte | null;
  motoristaId: string | null;
  /** Somente para TERCEIRO sem registro canônico. */
  motoristaNome: string;
  motoristaCpf: string;
  veiculoTransportadorId: string | null;
  /** Somente para TERCEIRO. */
  placaTransportador: string;
  empresaTransportadoraId: string | null;
  origemCentroCustoId: string | null;
  destinoCentroCustoId: string | null;
  /** CT-3D — endereços operacionais e pontos exatos. */
  origemEnderecoOperacional: string;
  origemPontoExato: string;
  origemColetaLatitude: number | null;
  origemColetaLongitude: number | null;
  destinoEnderecoOperacional: string;
  destinoPontoExato: string;
  destinoDescargaLatitude: number | null;
  destinoDescargaLongitude: number | null;
  /** CT-3D — recebedor previsto. */
  recebedorPrevistoFuncionarioId: string | null;
  recebedorPrevistoNome: string;
  recebedorPrevistoTelefone: string;
  dataPrevistaSaida: string;
  /** Data programada da mobilização. */
  dataProgramada: string;
  /** Somente leitura na UI — vem do servidor (regra dos 28 km). */
  distanciaKm: string;
  /** CT-3D.1 — rota escolhida entre as alternativas do Mapbox. */
  distanciaRotaKm: number | null;
  duracaoRotaMin: number | null;
  rotaResumo: string;

  observacoes: string;
  atendimentoIds: string[];
}

/** CT-4 — origem do fluxo da viagem. */
export type CtOrigemFluxo = "SOLICITACAO" | "MOVIMENTACAO_DIRETA";

export type CtParadaStatus =
  | "PENDENTE"
  | "CHEGADA_REGISTRADA"
  | "CONCLUIDA"
  | "PENDENTE_TRATATIVA"
  | "CANCELADA";

export const CT_PARADA_STATUS_LABELS: Record<CtParadaStatus, string> = {
  PENDENTE: "Pendente",
  CHEGADA_REGISTRADA: "Aguardando recebimento",
  CONCLUIDA: "Entregue",
  PENDENTE_TRATATIVA: "Pendente de tratativa",
  CANCELADA: "Cancelada",
};

/** CT-4 — carga de uma parada (subconjunto do ativo). */
export interface CtParadaCarga {
  movimentacaoId: string | null;
  statusMovimentacao: string | null;
  equipamentoId: string;
  frota: string | null;
  numeroFrota: string | null;
  placa: string | null;
  tipoAtivo: string | null;
  modelo: string | null;
}

/** CT-4 — parada persistida de uma viagem multiparadas. */
export interface CtViagemParada {
  id: string;
  ordem: number;
  status: CtParadaStatus;
  centroCustoId: string | null;
  ccCodigo: string | null;
  ccNome: string | null;
  endereco: string | null;
  pontoExato: string | null;
  latitude: number | null;
  longitude: number | null;
  dataPrevista: string | null;
  horaPrevista: string | null;
  observacao: string | null;
  recebedorPrevistoFuncionarioId: string | null;
  recebedorPrevistoNome: string | null;
  chegadaRegistradaEm: string | null;
  concluidaEm: string | null;
  cargas: CtParadaCarga[];
}

/** CT-3D — carga transportada em uma ordem do motorista. */
export interface CtOrdemCarga {
  equipamentoId: string;
  /** CT-4 — parada de destino desta carga (null em viagens sem paradas). */
  paradaId?: string | null;
  frota: string | null;
  numeroFrota: string | null;
  placa: string | null;
  /** CT-3E — vínculo material da carga (bd_movimentacoes), usado em checklist e recebimento. */
  movimentacaoId: string | null;
  statusMovimentacao: string | null;
  /** CT-3E.3 — subcategoria canônica: resolve o template oficial de checklist C&E. */
  subcategoriaId: string | null;
  subcategoriaNome: string | null;
  imagemUrl: string | null;
  fabricanteNome: string | null;
  anoFabricacao: number | null;
  tipoAtivo: string | null;
  modelo: string | null;
}

/** CT-3D — ordem operacional na visão do motorista (bd_ct_viagens). */
export interface CtOrdemMotorista {
  id: string;
  codigo: string;
  status: CtViagemStatus;
  dataOrdem: string | null;
  dataPrevistaSaida: string | null;
  dataPrevistaEntrega: string | null;
  modalidade: CtModalidade | null;
  tipoTransporte: CtTipoTransporte | null;
  motoristaNome: string | null;
  /** CT-4 — IDs de cadastro, usados para re-hidratar o planejamento salvo. */
  motoristaId: string | null;
  veiculoTransportadorId: string | null;
  empresaTransportadoraId: string | null;
  origemCentroCustoId: string | null;
  placaTransportador: string | null;
  empresaTransportadora: string | null;
  origemCentroCusto: string | null;
  origemEndereco: string | null;
  origemPontoExato: string | null;
  origemLatitude: number | null;
  origemLongitude: number | null;
  destinoCentroCusto: string | null;
  destinoEndereco: string | null;
  destinoPontoExato: string | null;
  destinoLatitude: number | null;
  destinoLongitude: number | null;
  distanciaKm: number | null;
  /** CT-4 Fase 1 — snapshot da rota planejada (Mapbox Directions). */
  distanciaRotaKm: number | null;
  duracaoRotaMin: number | null;
  rotaResumo: string | null;
  rotaGeometria: { type: "LineString"; coordinates: [number, number][] } | null;
  recebedorPrevistoNome: string | null;
  recebedorPrevistoTelefone: string | null;
  observacoes: string | null;
  cargas: CtOrdemCarga[];
  /** CT-4 — origem do fluxo e paradas (vazio em viagens legadas). */
  origemFluxo: CtOrigemFluxo;
  solicitacaoId: string | null;
  paradas: CtViagemParada[];
}

export interface CtOrdensMotoristaResultado {
  ok: true;
  /** false quando o usuário não possui funcionário vinculado ao perfil. */
  vinculoFuncionario: boolean;
  hoje: string | null;
  ordens: CtOrdemMotorista[];
}

export interface CtMobilizacaoComandoResult {
  ok: true;
  replay: boolean;
  noChange: boolean;
  planejamentoId: string;
  versao: number;
  lockVersion: number;
  status: CtPlanejamentoStatus;
  contentHash: string | null;
  viagens: CtViagem[];
}

/** Resposta de fn_ct_ativo_edicao_permitida (trava CT-2.5). */
export interface CtAtivoEdicaoPermitida {
  ok: true;
  permitida: boolean;
  motivo: string | null;
  compromissoStatus: string | null;
  periodoInicio: string | null;
  periodoFim: string | null;
  exigeJustificativa: boolean;
}

/** Fail-closed: enquanto a trava não for consultada, nada é editável. */
export const EDICAO_NAO_CONSULTADA: CtAtivoEdicaoPermitida = {
  ok: true,
  permitida: false,
  motivo: "CT25_TRAVA_NAO_CONSULTADA",
  compromissoStatus: null,
  periodoInicio: null,
  periodoFim: null,
  exigeJustificativa: false,
};

export const CT25_MSG_TRAVA =
  "Este ativo possui compromisso na Central do Transporte. Encerre o compromisso ou registre uma justificativa de exceção para editar a condição operacional.";

export const CT25_MSG_TRAVA_NAO_CONSULTADA =
  "Não foi possível confirmar se este ativo pode ser editado. Tente novamente antes de alterar a condição operacional.";
