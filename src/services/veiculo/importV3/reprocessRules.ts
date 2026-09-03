// PR-3.2 V3 — Regras de reprocessamento por resultado.
// CONFLITO nunca é reprocessável: exige nova exportação.
// Erros definitivos (validação, catálogo, payload, tokens) também não.
// Apenas erros claramente transitórios (rede, timeout, RPC indisponível, exceção interna)
// podem ser reprocessados automaticamente ao clicar "Reprocessar erros".

import type { ResultadoLinhaV3 } from './executarImportacaoV3';
import type { StatusResultado } from './classificarLinhas';

/** Códigos que NUNCA entram em reprocessamento automático. */
export const CODIGOS_NAO_REPROCESSAVEIS: ReadonlySet<string> = new Set([
  'CONFLITO',
  'CONFLITO_DADO_ATUAL_DESATUALIZADO',
  'JA_EXISTENTE',
  'JA_PROCESSADO',
  'IDENTIDADE_CANONICA_AMBIGUA',
  'CAMPO_PAYLOAD_NAO_PERMITIDO',
  'TOKEN_NAO_PERMITIDO',
  'MODELO_INCOMPATIVEL_COM_FABRICANTE',
  'MODELO_INCOMPATIVEL',
  'CAMPO_ATUALIZACAO_SEM_VALOR',
  'CATALOGO_NAO_RESOLVIDO',
  'SUBCATEGORIA_INVALIDA',
  'PROPRIETARIO_INVALIDO',
]);

/** Códigos técnicos que continuam elegíveis a reprocessamento. */
export const CODIGOS_TRANSITORIOS: ReadonlySet<string> = new Set([
  'NETWORK_ERROR',
  'TIMEOUT',
  'RPC_TEMPORARIAMENTE_INDISPONIVEL',
  'ERRO_INTERNO_TRANSITORIO',
  'ERRO_RPC',
  'EXCEPTION',
]);

/** Status finais terminais para o arquivo atual (não podem ser reenviados). */
const STATUS_TERMINAIS: ReadonlySet<StatusResultado> = new Set<StatusResultado>([
  'SUCESSO_INSERT',
  'SUCESSO_UPDATE',
  'JA_PROCESSADO',
  'JA_EXISTENTE',
  'CONFLITO',
  'SEM_ALTERACAO',
  'BLOQUEADO',
  'ERRO_PARSER',
]);

/**
 * Regra oficial de reprocessamento (PR-3.2):
 *   - status_final === 'ERRO'
 *   - codigo_resultado NÃO consta em CODIGOS_NAO_REPROCESSAVEIS.
 * CONFLITO SEMPRE retorna false: exige nova exportação com dados atuais.
 */
export function isReprocessavel(resultado: ResultadoLinhaV3): boolean {
  if (STATUS_TERMINAIS.has(resultado.status_final)) return false;
  if (resultado.status_final !== 'ERRO') return false;
  const cod = String(resultado.codigo_resultado ?? '').toUpperCase();
  if (!cod) return true; // erro genérico sem código explícito: presume-se transitório.
  if (CODIGOS_NAO_REPROCESSAVEIS.has(cod)) return false;
  return true;
}

export const MENSAGEM_ORIENTACAO_CONFLITO =
  'Este ativo foi alterado após a exportação. Gere uma nova exportação e reaplique '
  + 'as mudanças sobre os dados atuais.';
