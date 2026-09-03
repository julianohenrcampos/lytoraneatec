/**
 * Tipos do "Carimbo do Relatório AP's".
 * Seis campos administrativos persistidos: obra, empresa, cliente, bairro, revisao, observacoes.
 * A Rua NÃO é persistida — ela é dinâmica e vem do filtro "Rua / Logradouro" da tela.
 */

import type { Database } from "@/integrations/supabase/types";

export type RelatorioApsCarimboRow =
  Database["public"]["Tables"]["bd_relatorio_aps_carimbos"]["Row"];

/** Os 6 campos administrativos que o carimbo persiste. */
export interface RelatorioApsCarimboCabecalho {
  obra: string;
  empresa: string;
  cliente: string;
  bairro: string;
  revisao: string;
  observacoes: string;
}

export const RELATORIO_APS_CARIMBO_REVISAO_DEFAULT = "00";

export const CAMPOS_CARIMBO: ReadonlyArray<keyof RelatorioApsCarimboCabecalho> = [
  "obra",
  "empresa",
  "cliente",
  "bairro",
  "revisao",
  "observacoes",
] as const;

/** Códigos de erro reconhecidos das RPCs. */
export type RelatorioApsCarimboErrorCode =
  | "CARIMBO_CONFLITO_CONCORRENCIA"
  | "CARIMBO_ASSOCIADO_OUTRO_CC"
  | "CARIMBO_GERAL_RESTRITO"
  | "CARIMBO_NAO_ENCONTRADO"
  | "CARIMBO_ACAO_NEGADA"
  | "CARIMBO_CENTRO_CUSTO_OBRIGATORIO"
  | "CARIMBO_NOME_OBRIGATORIO"
  | "CARIMBO_ERRO_DESCONHECIDO";

export interface RelatorioApsCarimboError extends Error {
  code: RelatorioApsCarimboErrorCode;
  original?: unknown;
}

export function criarCarimboError(
  code: RelatorioApsCarimboErrorCode,
  message: string,
  original?: unknown,
): RelatorioApsCarimboError {
  const err = new Error(message) as RelatorioApsCarimboError;
  err.code = code;
  err.original = original;
  return err;
}

const MENSAGENS: Record<RelatorioApsCarimboErrorCode, string> = {
  CARIMBO_CONFLITO_CONCORRENCIA:
    "Este carimbo foi alterado por outro usuário. Recarregue os dados antes de salvar novamente.",
  CARIMBO_ASSOCIADO_OUTRO_CC:
    "Este carimbo pertence a outro Centro de Custo. Salve uma cópia como novo carimbo.",
  CARIMBO_GERAL_RESTRITO:
    "Somente um administrador autorizado pode associar um carimbo geral a um Centro de Custo.",
  CARIMBO_NAO_ENCONTRADO:
    "O carimbo não foi encontrado ou não está mais ativo.",
  CARIMBO_ACAO_NEGADA: "Você não possui permissão para executar esta operação.",
  CARIMBO_CENTRO_CUSTO_OBRIGATORIO:
    "Selecione um Centro de Custo antes de continuar.",
  CARIMBO_NOME_OBRIGATORIO: "Informe um nome para o carimbo.",
  CARIMBO_ERRO_DESCONHECIDO:
    "Não foi possível concluir a operação. Tente novamente.",
};

export function mapearErroSupabase(raw: unknown): RelatorioApsCarimboError {
  const anyErr = raw as { code?: string; message?: string } | null | undefined;
  const code = String(anyErr?.code ?? "");
  const msg = String(anyErr?.message ?? "");

  if (code === "40001" || /CARIMBO_CONFLITO_CONCORRENCIA/i.test(msg)) {
    return criarCarimboError(
      "CARIMBO_CONFLITO_CONCORRENCIA",
      MENSAGENS.CARIMBO_CONFLITO_CONCORRENCIA,
      raw,
    );
  }
  if (/CARIMBO_ASSOCIADO_OUTRO_CC/i.test(msg)) {
    return criarCarimboError(
      "CARIMBO_ASSOCIADO_OUTRO_CC",
      MENSAGENS.CARIMBO_ASSOCIADO_OUTRO_CC,
      raw,
    );
  }
  if (/CARIMBO_GERAL_RESTRITO/i.test(msg)) {
    return criarCarimboError(
      "CARIMBO_GERAL_RESTRITO",
      MENSAGENS.CARIMBO_GERAL_RESTRITO,
      raw,
    );
  }
  if (code === "42501" || /permission denied/i.test(msg) || /CARIMBO_ACAO_NEGADA/i.test(msg)) {
    return criarCarimboError(
      "CARIMBO_ACAO_NEGADA",
      MENSAGENS.CARIMBO_ACAO_NEGADA,
      raw,
    );
  }
  if (
    code === "P0002" ||
    /CARIMBO_NAO_ENCONTRADO/i.test(msg) ||
    /no rows/i.test(msg)
  ) {
    return criarCarimboError(
      "CARIMBO_NAO_ENCONTRADO",
      MENSAGENS.CARIMBO_NAO_ENCONTRADO,
      raw,
    );
  }
  return criarCarimboError(
    "CARIMBO_ERRO_DESCONHECIDO",
    msg || MENSAGENS.CARIMBO_ERRO_DESCONHECIDO,
    raw,
  );
}

export function mensagemAmigavel(code: RelatorioApsCarimboErrorCode): string {
  return MENSAGENS[code];
}
