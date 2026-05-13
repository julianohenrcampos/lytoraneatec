/**
 * Flags da feature Diárias.
 *
 * Padrão: TODAS desligadas. Mudanças exigem variável de ambiente explícita
 * em build/preview. Em produção, sem a env, o comportamento permanece
 * exatamente o atual.
 */

/**
 * Preview visual dos "lotes" (dias da demanda) — Fase 1C.
 *
 * Quando `false` (padrão), o painel de preview NÃO renderiza, NÃO executa
 * `lerConvocadosPre` a partir do preview, NÃO altera nenhum visual e NÃO
 * dispara efeito colateral. Nada do fluxo real (aprovação, apontamento,
 * salvamento, PDF, relatório) muda.
 *
 * Quando `true`, exibe um painel read-only no `SolicitacaoDetalhesModal`
 * mostrando datas e contagem por dia. Sem botões, sem mutação, sem queries.
 */
export const DIARIAS_LOTES_UI_PREVIEW: boolean =
  import.meta.env.VITE_DIARIAS_LOTES_UI_PREVIEW === 'true';
