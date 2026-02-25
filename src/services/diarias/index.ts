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
  checkSolicitacaoCanBeDeleted
} from './solicitacoesService';

// Relatório
export {
  getRelatorioFolha,
  getResumoDiarias,
  getPresencaResumo,
  exportarRelatorioExcel,
  downloadExcel,
  marcarEnviadoSede,
  registrarDivergencia,
  aprovarRelatorioFinal
} from './relatorioService';

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
  verificarPresencasExistentes
} from './presencasService';

export type { PresencaDiaria, PresencaFormData } from './presencasService';

// Notificações de Diárias
export {
  notificarAprovador,
  notificarSolicitanteAprovacao,
  notificarSolicitanteReprovacao,
  notificarApontador,
  getCountPendentesPorAprovador
} from './diariaNotificationService';
