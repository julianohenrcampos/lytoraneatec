/**
 * Cria a chave estável de identidade de rua no Relatório AP's.
 *
 * Ordem de prioridade da base:
 *   1) `chave_normalizada` já persistida em `bd_registro_aplicacao_ruas`
 *      (representa a identidade geográfica adotada pelo sistema).
 *   2) `logradouro_nome` (mapa) normalizado.
 *   3) sentinela `__sem_logradouro__`.
 *
 * O nome local sempre entra no sufixo `|local:<normalizado>` para separar
 * aliases distintos da mesma identidade geográfica. Aliases vazios geram
 * `|local:` (sufixo estável).
 *
 * A chave NÃO deve ser derivada apenas do label combinado "Mapa / Local":
 * mudanças de caixa/acento/espaço no digitado do apontador causariam
 * fragmentação de grupos.
 */
import { normalizarTextoLogradouro } from "./normalizarTextoLogradouro";

export interface CriarChaveRelatorioRuaParams {
  chaveNormalizada?: string | null;
  logradouroMapa?: string | null;
  logradouroLocal?: string | null;
}

export const SEM_LOGRADOURO_SENTINELA = "__sem_logradouro__";

export function criarChaveRelatorioRua(
  params: CriarChaveRelatorioRuaParams,
): string {
  const base =
    normalizarTextoLogradouro(params.chaveNormalizada) ||
    normalizarTextoLogradouro(params.logradouroMapa) ||
    SEM_LOGRADOURO_SENTINELA;
  const local = normalizarTextoLogradouro(params.logradouroLocal);
  return `${base}|local:${local}`;
}
