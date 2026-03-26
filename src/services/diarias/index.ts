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
