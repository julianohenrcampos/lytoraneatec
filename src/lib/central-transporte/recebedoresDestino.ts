/**
 * CT-6.1 — Camada PURA do recebedor da viagem.
 *
 * O recebedor é propriedade da VIAGEM (não do ativo) e sai SEMPRE dos
 * funcionários ativos vinculados ao Centro de Custo DESTINO da viagem.
 *
 * Aparecer na lista NÃO concede autorização alguma: a RPC de gravação segue
 * sendo a autoridade sobre escopo e permissão.
 */

export interface FuncionarioCcRecebedor {
  id: string;
  nomeCompleto: string;
  funcaoNome: string | null;
}

export type CtRecebedorPrioridade = 0 | 1 | 2;

const semAcento = (v: string): string =>
  v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

/**
 * Prioridade de sugestão (não é filtro): engenheiro do CC, depois apontador
 * compatível, depois os demais funcionários ativos do CC.
 */
export const prioridadeRecebedor = (funcaoNome: string | null | undefined): CtRecebedorPrioridade => {
  const f = semAcento(String(funcaoNome ?? "").trim());
  if (!f) return 2;
  if (f.includes("ENGENH")) return 0;
  if (f.includes("APONTAD")) return 1;
  return 2;
};

/** Ordena por prioridade e, dentro dela, alfabeticamente (pt-BR). */
export const ordenarRecebedores = (
  lista: FuncionarioCcRecebedor[],
): FuncionarioCcRecebedor[] =>
  [...lista].sort((a, b) => {
    const pa = prioridadeRecebedor(a.funcaoNome);
    const pb = prioridadeRecebedor(b.funcaoNome);
    if (pa !== pb) return pa - pb;
    return a.nomeCompleto.localeCompare(b.nomeCompleto, "pt-BR");
  });

/** Rótulo exibido no seletor: nome + função (quando existir). */
export const rotuloRecebedor = (f: FuncionarioCcRecebedor): string =>
  f.funcaoNome ? `${f.nomeCompleto} — ${f.funcaoNome}` : f.nomeCompleto;
