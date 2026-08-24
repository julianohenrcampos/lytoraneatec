/**
 * CT-4 UX — regras puras de paginação do wizard de Movimentação Direta.
 *
 * SOMENTE apresentação: reaproveita os mesmos invariantes já cobrados por
 * `validarRascunho`, apenas particionados por etapa para permitir/bloquear o
 * avanço. Nada aqui altera payload, RPC ou validação server-side.
 */
import type { CtMovDiretaRascunho } from "@/types/centralTransporteMovDireta";
import { ativosSemParada } from "./movDiretaRascunho";

export type MovDiretaEtapa = "ORIGEM" | "PARADAS" | "REVISAO";

export const ETAPAS: { id: MovDiretaEtapa; label: string }[] = [
  { id: "ORIGEM", label: "Origem da coleta" },
  { id: "PARADAS", label: "Paradas de entrega" },
  { id: "REVISAO", label: "Revisão" },
];

export const indiceEtapa = (etapa: MovDiretaEtapa): number =>
  ETAPAS.findIndex((e) => e.id === etapa);

/** Invariantes da etapa 1 (subconjunto de validarRascunho/PROGRAMAR). */
export const errosEtapaOrigem = (r: CtMovDiretaRascunho): string[] => {
  const erros: string[] = [];
  if (!r.dataPrevistaSaida) erros.push("Informe a data prevista de saída.");
  if (!r.origemCentroCustoId) erros.push("Informe a origem (obra/centro de custo da coleta).");
  if (!r.modalidade) erros.push("Selecione a modalidade de deslocamento.");
  if (r.modalidade === "TRANSPORTADO" && !r.tipoTransporte)
    erros.push("Selecione o tipo de transporte (próprio ou terceiro).");
  if (!r.motoristaId && !r.motoristaNome.trim())
    erros.push("Informe o motorista/operador responsável.");
  return erros;
};

/** Invariantes da etapa 2 (paradas e ativos entregues). */
export const errosEtapaParadas = (r: CtMovDiretaRascunho): string[] => {
  const erros: string[] = [];
  if (r.paradas.length === 0) erros.push("Adicione ao menos uma parada de entrega.");
  r.paradas.forEach((p, i) => {
    if (!p.centroCustoId) erros.push(`Parada ${i + 1}: informe a obra/centro de custo.`);
    if (p.equipamentos.length === 0)
      erros.push(`Parada ${i + 1}: selecione os ativos entregues nesta parada.`);
  });
  if (ativosSemParada(r).length > 0)
    erros.push("Existem ativos da movimentação ainda sem parada de entrega.");
  return erros;
};

export const errosDaEtapa = (r: CtMovDiretaRascunho, etapa: MovDiretaEtapa): string[] =>
  etapa === "ORIGEM"
    ? errosEtapaOrigem(r)
    : etapa === "PARADAS"
      ? errosEtapaParadas(r)
      : [];
