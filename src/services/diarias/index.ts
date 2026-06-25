// =====================================================
// MÓDULO DIÁRIAS - EXPORTAÇÕES CENTRALIZADAS
// =====================================================

// Solicitações
export {
  getSolicitacoes,
  getSolicitacaoById,
  createSolicitacao,
  updateSolicitacao,
  deleteSolicitacao,
  enviarParaAutorizacao,
  autorizarSolicitacao,
  reprovarSolicitacao,
  cancelarEnvioSolicitacao,
  getSolicitacoesResumo,
  getHistoricoAprovacoes,
  checkSolicitacaoCanBeDeleted,
  cancelarAutorizacao
} from './solicitacoesService';

// Relatório
export {
  getRelatorioFolha,
  getRelatorioFolhaPaginadoView,
  getResumoDiarias,
  getPresencaResumo,
  exportarRelatorioExcel,
  downloadExcel,
  marcarEnviadoSede,
  registrarDivergencia,
  aprovarRelatorioFinal
} from './relatorioService';
export type { RelatorioFolhaPage } from './relatorioService';

// Apontamentos
export {
  getApontamentos,
  getApontamentoById,
  getApontamentoBySolicitacaoId,
  iniciarApontamento,
  finalizarApontamento,
  cancelarApontamento,
  updateApontamentoObservacoes
} from './apontamentosService';

// Presenças (Nova estrutura)
export {
  getPresencasPorSolicitacao,
  salvarPresencas,
  getResumoPresencas,
  verificarPresencasExistentes,
  deletePresencaRegistro
} from './presencasService';

export type { PresencaDiaria, PresencaFormData } from './presencasService';

// Fluxo de Aprovação Administrativo
export {
  aprovarComoGerenteAdm,
  reprovarComoGerenteAdm,
  aprovarComoDiretorOperacional,
  reprovarComoDiretorOperacional,
  aprovarComoDiretorAdm,
  reprovarComoDiretorAdm,
  getDocumentosFluxo,
  getDocumentosRelacionados
} from './fluxoAprovacaoService';

// Notificações de Diárias
export {
  notificarAprovador,
  notificarSolicitanteAprovacao,
  notificarSolicitanteReprovacao,
  notificarApontador,
  getCountPendentesPorAprovador
} from './diariaNotificationService';

// Anti-Fraude
export {
  getStatusFuncionarioNaData,
  validarStatusFuncionario,
  validarStatusPorDia,
  validarInconsistencia30Dias,
  verificarDuplicidadeSolicitacao,
  getHistoricoStatusFuncionario,
  registrarStatusFuncionario,
  registrarLogComunicacao
} from './antiFraudeService';

export type { StatusFuncionarioResult } from './antiFraudeService';

// Inclusão de Funcionário (aprovação)
export {
  solicitarInclusaoFuncionario,
  aprovarInclusaoFuncionario,
  recusarInclusaoFuncionario,
  listarInclusoesPendentes,
  contarInclusoesPendentes,
  notificarAprovadorInclusao
} from './inclusaoFuncionarioService';

// Aditivos (Fase I.2 — service layer)
export {
  solicitarAditivoFuncionario,
  solicitarAditivoDia,
  aprovarAditivo,
  reprovarAditivo,
  cancelarAditivo,
  getAditivoById,
  listarAditivosPorSolicitacao,
  listarAditivosPendentes,
  contarAditivosPendentes,
} from './aditivoService';
export type {
  Aditivo,
  AditivoTipo,
  AditivoStatus,
  AditivoDiaAcao,
  SnapshotFuncionario,
  ImpactoFinanceiro,
  SolicitarAditivoFuncionarioInput,
  SolicitarAditivoDiaInput,
  ListarAditivosPendentesFiltros,
} from './aditivoService';
