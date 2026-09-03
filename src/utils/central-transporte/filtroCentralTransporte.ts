/**
 * T24–T27 — Critérios de filtro e busca da listagem da Central do Transporte.
 *
 * DISTINÇÃO CONCEITUAL OBRIGATÓRIA
 *  - `departamento_id`      → departamento do CENTRO DE CUSTO solicitante
 *                             (bd_centros_custo.departamento_id). NÃO é tocado.
 *  - `atendimento_preferencial` → direcionamento da SOLICITAÇÃO
 *                             (bd_solicitacoes_equipamento
 *                              .departamento_atendimento_preferencial_id).
 *
 * `SEM_PREFERENCIA` significa exatamente `IS NULL` = "Avaliar disponibilidade".
 * Nunca existe a string "A_DEFINIR" no banco.
 */

/** Valor do filtro de atendimento preferencial (UUID real ou o sentinela de NULL). */
export const SEM_PREFERENCIA = "SEM_PREFERENCIA";

export type CriterioPreferencia =
  | { tipo: "TODOS" }
  | { tipo: "IS_NULL" }
  | { tipo: "EQ"; departamentoId: string };

/** Traduz a escolha da UI no critério aplicado à query (sem UUID hardcoded). */
export function montarCriterioPreferencia(
  valor: string | null | undefined,
): CriterioPreferencia {
  if (!valor || valor === "all") return { tipo: "TODOS" };
  if (valor === SEM_PREFERENCIA) return { tipo: "IS_NULL" };
  return { tipo: "EQ", departamentoId: valor };
}

const norm = (s: string | null | undefined): string =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

/** Campos pesquisáveis de uma linha já carregada da Central. */
export interface LinhaBuscavelCentral {
  id: string;
  chamado_protocolo?: string | null;
  codigo_centro_custo?: string | null;
  nome_centro_custo?: string | null;
}

/** Protocolo técnico derivado do id (SOL-XXXXXXXX), igual ao formatProtocolo. */
const protocoloSol = (id: string): string => `SOL-${(id.split("-")[0] || id).toUpperCase()}`;

/**
 * Busca client-side sobre o conjunto JÁ CARREGADO (nenhuma query por linha,
 * nenhum N+1, nenhum acesso ampliado). Aceita CHI, SOL, código e nome do CC,
 * ignorando acentuação, hífens e espaços.
 */
export function filtrarPorBusca<T extends LinhaBuscavelCentral>(
  linhas: T[],
  termo: string | null | undefined,
): T[] {
  const alvo = norm(termo);
  if (!alvo) return linhas;
  return linhas.filter((l) =>
    [
      l.chamado_protocolo ?? null,
      protocoloSol(l.id),
      l.codigo_centro_custo ?? null,
      l.nome_centro_custo ?? null,
    ]
      .filter(Boolean)
      .some((campo) => norm(campo).includes(alvo)),
  );
}
