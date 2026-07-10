/**
 * Matching visual (frontend) de itens de solicitação de equipamento
 * contra o inventário próprio (bd_caminhoes_equipamentos +
 * bd_disponibilidade_equipamentos).
 *
 * NÃO altera schema/RLS/trigger/RPC. Não persiste. Apenas overlay visual.
 */

import type { SolicitacaoItemResumo } from "@/services/solicitacaoEquipamentoService";

export type StatusOperacional =
  | "DISPONIVEL"
  | "ALOCADO"
  | "MANUTENCAO"
  | "INDISPONIVEL"
  | "SEM_STATUS";

export interface InventoryVehicle {
  id: string;
  frota: string | null;
  numero_frota: string | null;
  situacao: string | null;
  subcategoria_ativo_id: string | null;
  tipo_equipamento_id: string | null;
}

export type MatchClassification =
  | "disponivel_total"
  | "disponivel_parcial"
  | "existente_indisponivel"
  | "nao_encontrado"
  | "sem_classificacao";

export interface MatchCounts {
  existentes: number;
  disponiveis: number;
  operandoAlocados: number;
  manutencao: number;
  indisponiveis: number;
  semStatus: number;
}

export interface ItemMatchResult {
  item: SolicitacaoItemResumo;
  classification: MatchClassification;
  counts: MatchCounts;
  message: string;
}

const norm = (s: string | null | undefined) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

/**
 * Deriva status operacional consolidado:
 * 1) bd_disponibilidade_equipamentos.status_operacional (fonte primária)
 * 2) bd_caminhoes_equipamentos.situacao (fallback textual)
 * 3) SEM_STATUS quando não há classificação (NÃO assume DISPONIVEL).
 */
export function deriveStatus(
  situacao: string | null | undefined,
  statusOperacional: string | null | undefined,
): StatusOperacional {
  const s = norm(statusOperacional);
  if (s === "disponivel") return "DISPONIVEL";
  if (s === "alocado" || s === "operando") return "ALOCADO";
  if (s === "manutencao" || s === "em_manutencao") return "MANUTENCAO";
  if (s === "indisponivel") return "INDISPONIVEL";

  const t = norm(situacao);
  if (!t) return "SEM_STATUS";
  if (t === "disponivel") return "DISPONIVEL";
  if (t === "operando" || t === "alocado") return "ALOCADO";
  if (t.includes("manutencao")) return "MANUTENCAO";
  if (t === "inativo" || t === "indisponivel") return "INDISPONIVEL";
  return "SEM_STATUS";
}

export function isClassificavel(item: SolicitacaoItemResumo): boolean {
  return !!item.subcategoria_id || !!item.catalogo_equipamento_id;
}

export function filterVehiclesForItem(
  vehicles: InventoryVehicle[],
  item: SolicitacaoItemResumo,
): InventoryVehicle[] {
  if (!item.subcategoria_id) return [];
  return vehicles.filter((v) => v.subcategoria_ativo_id === item.subcategoria_id);
}

export function classifyItem(
  item: SolicitacaoItemResumo,
  vehicles: InventoryVehicle[],
  dispByEquip: Map<string, string | null>,
): ItemMatchResult {
  const quantidade = Math.max(1, Number(item.quantidade || 1));

  if (!isClassificavel(item)) {
    return {
      item,
      classification: "sem_classificacao",
      counts: { existentes: 0, disponiveis: 0, operandoAlocados: 0, manutencao: 0, indisponiveis: 0, semStatus: 0 },
      message: "Item pendente de classificação pela Central do Transporte.",
    };
  }

  const compatíveis = filterVehiclesForItem(vehicles, item);
  const counts: MatchCounts = {
    existentes: compatíveis.length,
    disponiveis: 0,
    operandoAlocados: 0,
    manutencao: 0,
    indisponiveis: 0,
    semStatus: 0,
  };

  for (const v of compatíveis) {
    const st = deriveStatus(v.situacao, dispByEquip.get(v.id) ?? null);
    if (st === "DISPONIVEL") counts.disponiveis++;
    else if (st === "ALOCADO") counts.operandoAlocados++;
    else if (st === "MANUTENCAO") counts.manutencao++;
    else if (st === "INDISPONIVEL") counts.indisponiveis++;
    else counts.semStatus++;
  }

  let classification: MatchClassification;
  let message: string;

  if (counts.existentes === 0) {
    classification = "nao_encontrado";
    message = "Não encontrado no cadastro próprio — Central deverá cotar/locar.";
  } else if (counts.disponiveis === 0) {
    classification = "existente_indisponivel";
    message = "Existente, porém sem unidade disponível no momento.";
  } else if (counts.disponiveis < quantidade) {
    classification = "disponivel_parcial";
    message = `Disponibilidade parcial: ${counts.disponiveis} de ${quantidade}.`;
  } else {
    classification = "disponivel_total";
    message = `Disponível agora: ${counts.disponiveis} unidade(s).`;
  }

  return { item, classification, counts, message };
}
