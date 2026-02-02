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
  getHistoricoAprovacoes
} from './solicitacoesService';

// Convocações
export {
  getConvocacoes,
  getConvocacaoById,
  createConvocacao,
  updateConvocacao,
  deleteConvocacao,
  enviarParaAprovacao,
  aprovarConvocacao,
  reprovarConvocacao,
  iniciarExecucao,
  finalizarConvocacao,
  cancelarConvocacao,
  getConvocacoesResumo
} from './convocacoesService';

// Convocados
export {
  getConvocadosByConvocacao,
  getConvocadoById,
  addConvocado,
  removeConvocado,
  updateConvocadoHorarios,
  confirmarPresenca,
  getConvocadosParaPresenca,
  getConvocadosStats
} from './convocadosService';

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
