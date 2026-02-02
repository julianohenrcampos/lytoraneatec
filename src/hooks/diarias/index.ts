// =====================================================
// HOOKS DIÁRIAS - EXPORTAÇÕES CENTRALIZADAS
// =====================================================

// Solicitações
export {
  useSolicitacoesDiaria,
  useSolicitacaoById,
  useSolicitacoesResumo,
  useHistoricoAprovacoes,
  useCreateSolicitacao,
  useUpdateSolicitacao,
  useDeleteSolicitacao,
  useEnviarParaAutorizacao,
  useAutorizarSolicitacao,
  useReprovarSolicitacao,
  useCancelarEnvioSolicitacao
} from './useSolicitacoesDiaria';

// Convocações
export {
  useConvocacoesDiaria,
  useConvocacaoById,
  useConvocacoesResumo,
  useCreateConvocacao,
  useUpdateConvocacao,
  useDeleteConvocacao,
  useEnviarParaAprovacao,
  useAprovarConvocacao,
  useReprovarConvocacao,
  useIniciarExecucao,
  useFinalizarConvocacao,
  useCancelarConvocacao
} from './useConvocacoesDiaria';

// Convocados
export {
  useConvocadosByConvocacao,
  useConvocadoById,
  useConvocadosStats,
  useConvocadosParaPresenca,
  useAddConvocado,
  useRemoveConvocado,
  useUpdateConvocadoHorarios,
  useConfirmarPresenca
} from './useConvocadosDiaria';

// Relatório
export {
  useRelatorioFolha,
  useResumoDiarias,
  usePresencaResumo,
  useExportarExcel,
  useMarcarEnviadoSede,
  useRegistrarDivergencia,
  useAprovarRelatorioFinal
} from './useRelatorioDiaria';
