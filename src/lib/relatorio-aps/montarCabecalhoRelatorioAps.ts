/**
 * Helpers PUROS para aplicar/restaurar/limpar o Carimbo do Relatório AP's
 * sobre o cabeçalho editável.
 *
 * Seis campos do carimbo: obra, empresa, cliente, bairro, revisao, observacoes.
 * A Rua NÃO é tocada pelo carimbo — ela é dinâmica e vem do filtro
 * "Rua / Logradouro" da tela. Preserva peso específico e demais campos operacionais.
 */
import {
  criarCabecalhoDefault,
  type RelatorioApsCabecalhoEditavel,
} from "@/types/relatorioAps";
import {
  CAMPOS_CARIMBO,
  RELATORIO_APS_CARIMBO_REVISAO_DEFAULT,
  type RelatorioApsCarimboCabecalho,
  type RelatorioApsCarimboRow,
} from "@/types/relatorioApsCarimbo";

export function extrairCarimboDoRow(
  row: RelatorioApsCarimboRow,
): RelatorioApsCarimboCabecalho {
  return {
    obra: row.obra ?? "",
    empresa: row.empresa ?? "",
    cliente: row.cliente ?? "",
    bairro: row.bairro ?? "",
    revisao: row.revisao ?? RELATORIO_APS_CARIMBO_REVISAO_DEFAULT,
    observacoes: row.observacoes ?? "",
  };
}

export function extrairCarimboDoCabecalho(
  cab: RelatorioApsCabecalhoEditavel,
): RelatorioApsCarimboCabecalho {
  return {
    obra: cab.obra,
    empresa: cab.empresa,
    cliente: cab.cliente,
    bairro: cab.bairro,
    revisao: cab.revisao,
    observacoes: cab.observacoes,
  };
}

/** Aplica os 6 campos do carimbo — preserva Rua, peso e demais campos operacionais. */
export function aplicarCarimboNoCabecalho(
  atual: RelatorioApsCabecalhoEditavel,
  carimbo: RelatorioApsCarimboCabecalho,
): RelatorioApsCabecalhoEditavel {
  return {
    ...atual,
    obra: carimbo.obra ?? "",
    empresa: carimbo.empresa ?? "",
    cliente: carimbo.cliente ?? "",
    bairro: carimbo.bairro ?? "",
    revisao: carimbo.revisao ?? RELATORIO_APS_CARIMBO_REVISAO_DEFAULT,
    observacoes: carimbo.observacoes ?? "",
  };
}

/** Limpa os 6 campos do carimbo — preserva Rua, peso e demais campos operacionais. */
export function limparCarimboDoCabecalho(
  atual: RelatorioApsCabecalhoEditavel,
): RelatorioApsCabecalhoEditavel {
  const defaults = criarCabecalhoDefault();
  return {
    ...atual,
    obra: defaults.obra,
    empresa: defaults.empresa,
    cliente: defaults.cliente,
    bairro: defaults.bairro,
    revisao: defaults.revisao,
    observacoes: defaults.observacoes,
  };
}

/** Calcula se os 6 campos do carimbo divergem do snapshot. */
export function isCarimboDirty(
  cab: RelatorioApsCabecalhoEditavel,
  snapshot: RelatorioApsCarimboCabecalho | null,
): boolean {
  if (!snapshot) return false;
  const atual = extrairCarimboDoCabecalho(cab);
  return CAMPOS_CARIMBO.some((k) => (atual[k] ?? "") !== (snapshot[k] ?? ""));
}
