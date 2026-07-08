import { useQuery } from "@tanstack/react-query";
import {
  listarOrdensEmitidasPorData,
  listarProximasOrdensEmitidas,
  listarItensDeOrdens,
} from "@/services/ordemDiariaCampo/ordemCampoService";
import type {
  OrdemDiariaObra,
  OrdemDiariaItem,
} from "@/types/ordemDiariaCampo";

export interface OrdemCampoComItens extends OrdemDiariaObra {
  itens: OrdemDiariaItem[];
}

async function carregarComItens(
  dataBrt: string,
  modo: "hoje" | "proximas",
  centroCustoId?: string | null,
): Promise<OrdemCampoComItens[]> {
  const ordens =
    modo === "hoje"
      ? await listarOrdensEmitidasPorData(dataBrt, centroCustoId)
      : await listarProximasOrdensEmitidas(dataBrt, 14, centroCustoId);
  if (ordens.length === 0) return [];
  const itens = await listarItensDeOrdens(ordens.map((o) => o.id));
  const grupos = new Map<string, OrdemDiariaItem[]>();
  for (const it of itens) {
    const arr = grupos.get(it.ordem_id) ?? [];
    arr.push(it);
    grupos.set(it.ordem_id, arr);
  }
  return ordens.map((o) => ({ ...o, itens: grupos.get(o.id) ?? [] }));
}

/** Ordens emitidas para a data BRT informada, com seus itens visíveis. */
export function useOrdensCampoDoDia(
  dataBrt: string,
  centroCustoId?: string | null,
) {
  return useQuery({
    queryKey: ["ordem-campo", "hoje", dataBrt, centroCustoId ?? null],
    queryFn: () => carregarComItens(dataBrt, "hoje", centroCustoId),
    enabled: !!dataBrt,
    staleTime: 60 * 1000,
  });
}

/** Próximas ordens emitidas a partir da data BRT informada. */
export function useProximasOrdensCampo(
  dataBrt: string,
  centroCustoId?: string | null,
) {
  return useQuery({
    queryKey: ["ordem-campo", "proximas", dataBrt, centroCustoId ?? null],
    queryFn: () => carregarComItens(dataBrt, "proximas", centroCustoId),
    enabled: !!dataBrt,
    staleTime: 60 * 1000,
  });
}
