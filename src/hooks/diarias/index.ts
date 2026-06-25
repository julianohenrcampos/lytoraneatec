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
  useRelatorioFolhaPaginado,
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

// Anti-Fraude
export {
  useValidarStatusFuncionario,
  useValidarStatusPorDia,
  useValidarInconsistencia,
  useVerificarDuplicidade,
  useHistoricoStatusFuncionario,
  useRegistrarStatus,
  useRegistrarLogComunicacao,
  useValidacaoCompletaFuncionario
} from './useAntiFraude';

// Inclusão de Funcionário
export {
  useInclusoesPendentes,
  useContarInclusoesPendentes,
  useSolicitarInclusao,
  useAprovarInclusao,
  useRecusarInclusao,
  useNotificarAprovadorInclusao
} from './useInclusaoFuncionario';

// Busca server-side padronizada (Solicitação, Apontamento, Equipamento)
export {
  useFuncionariosBuscaAtivos,
  fetchFuncionariosAtivos,
  type UseFuncionariosBuscaAtivosParams,
} from './useFuncionariosBuscaAtivos';

// Elegibilidade 3 estados (livre / alerta / bloqueado)
export {
  useFuncionarioElegibilidade,
  type EstadoElegibilidade,
  type EstadoElegibilidadeStatus,
} from './useFuncionarioElegibilidade';

// Mappers compartilhados
export {
  mapRpcRow,
  mapFuncionarioRecord,
  mergeFuncionarios,
  type FuncionarioOption,
} from './_funcionarioMappers';

// Média histórica de presença em FDS (para simulação de refeições)
export {
  useMediaPresencaFds,
  type MediaPresencaFdsResult,
  type FonteMediaFds,
} from './useMediaPresencaFds';

// Aditivos (Fase I.2)
export {
  useAditivos,
  useAditivoById,
  useSolicitarAditivoFuncionario,
  useSolicitarAditivoDia,
  useCancelarAditivo,
} from './useAditivos';
export {
  useAditivosPendentes,
  useContarAditivosPendentes,
  useAprovarAditivo,
  useReprovarAditivo,
} from './useAditivosPendentes';
