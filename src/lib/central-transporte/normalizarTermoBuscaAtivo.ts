/**
 * CT-4 — Normalização do termo de busca do catálogo de ativos.
 *
 * A RPC `fn_ct_ativos_movimentacao_listar` compara o termo contra
 * frota||numero_frota||placa||modelo SEM separadores. Quando o usuário copia o
 * rótulo exibido ("LOC - 016 · Caçamba"), os separadores visuais precisam ser
 * removidos antes do envio, senão a busca volta vazia.
 */
export const normalizarTermoBuscaAtivo = (termo?: string | null): string =>
  !termo
    ? ""
    : termo
        .replace(/\s+[-]\s+/g, "")
        .replace(/\s*[—–·|]\s*/g, "")
        .replace(/\s+/g, " ")
        .trim();

export default normalizarTermoBuscaAtivo;
