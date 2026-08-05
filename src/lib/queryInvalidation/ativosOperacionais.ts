/**
 * CT-2 / G1+G2 — Invalidação por PREFIXO das caches que dependem do estado
 * operacional de um ativo (disponibilidade, capacidade, Centro de Custo).
 *
 * Regra: nunca depender de chaves exatas com filtros variáveis. Toda query
 * cuja PRIMEIRA posição da queryKey estiver nesta lista é invalidada.
 */
import type { QueryClient } from "@tanstack/react-query";

/** Prefixos de queryKey afetados por mudanças operacionais/cadastrais do ativo. */
export const PREFIXOS_ATIVOS_OPERACIONAIS = [
  "ativos-reconciliados",
  "disponibilidades",
  "status-operacional-map",
  "estado-operacional-ativo",
  "veiculos",
  "equipamentos-dd",
  "mapa-operacional",
  "central-transporte",
  "central-transporte-analise",
  "central-transporte-atendimentos",
  // CT-2.2: estado efetivo (condição operacional + compromisso ativo) em lote.
  "ct-estado-efetivo",
  // CT-2.5: trava de edição da condição operacional do ativo.
  "ct-edicao-ativo",
  // CT-3C: estado de mobilização (viagens, movimentações, planejamento vigente).
  "ct-mobilizacao",
] as const;


export type PrefixoAtivoOperacional = (typeof PREFIXOS_ATIVOS_OPERACIONAIS)[number];

const primeiroSegmento = (key: unknown): string | null => {
  if (!Array.isArray(key) || key.length === 0) return null;
  return typeof key[0] === "string" ? key[0] : null;
};

/** true quando a queryKey pertence a um dos prefixos operacionais. */
export const chaveEhAtivoOperacional = (key: unknown): boolean => {
  const raiz = primeiroSegmento(key);
  return !!raiz && (PREFIXOS_ATIVOS_OPERACIONAIS as readonly string[]).includes(raiz);
};

/**
 * Invalida todas as caches de ativos/Central por predicate tipado.
 * Usar após qualquer escrita de disponibilidade, capacidade ou unidade.
 */
export const invalidarCachesAtivosOperacionais = (queryClient: QueryClient): Promise<void> =>
  queryClient
    .invalidateQueries({ predicate: (q) => chaveEhAtivoOperacional(q.queryKey) })
    .then(() => undefined);
