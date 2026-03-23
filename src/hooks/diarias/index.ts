// =====================================================
// HOOKS DIÁRIAS - EXPORTAÇÕES CENTRALIZADAS
// =====================================================

// Escopo de Dados (RBAC)
export { useDiariasDataScope } from './useDiariasDataScope';
export type { DiariasUserScope, DiariasDataScope, DiariasDataScopeFilters } from './useDiariasDataScope';

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
  useCancelarEnvioSolicitacao,
  useCancelarAutorizacao
} from './useSolicitacoesDiaria';

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

// Apontamentos de Campo
export {
  useApontamentosCampo,
  useApontamentoById,
  useApontamentoBySolicitacao,
  useIniciarApontamento,
  useFinalizarApontamento,
  useCancelarApontamento,
  useUpdateApontamentoObservacoes
} from './useApontamentosCampo';

// Pendentes (badge sidebar)
export { useDiariasPendentes } from './useDiariasPendentes';

// Fluxo de Aprovação Administrativo
export {
  useDocumentosFluxo,
  useDocumentosRelacionados,
  useAprovarGerenteAdm,
  useReprovarGerenteAdm,
  useAprovarDiretorOperacional,
  useReprovarDiretorOperacional,
  useAprovarDiretorAdm,
  useReprovarDiretorAdm
} from './useFluxoAprovacao';

// Gestão de Aprovações
export { useGestaoAprovacoesDiarias } from './useGestaoAprovacoesDiarias';
export type { GestaoFluxoRole, GestaoAprovacoesFiltros, GestaoKpis, SolicitacaoGestao } from './useGestaoAprovacoesDiarias';
