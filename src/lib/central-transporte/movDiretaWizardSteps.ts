/**
 * CT-4 UX — regras puras de paginação do wizard de Movimentação Direta.
 *
 * SOMENTE apresentação: reaproveita os mesmos invariantes já cobrados por
 * `validarRascunho`, apenas particionados por etapa para permitir/bloquear o
 * avanço. Nada aqui altera payload, RPC ou validação server-side.
 *
 * A antiga etapa visual "Origem da coleta" foi absorvida pelo Movimentação
 * Builder: os DADOS da origem continuam idênticos no rascunho e nas RPCs.
 */
import type { CtMovDiretaRascunho } from "@/types/centralTransporteMovDireta";
import { ativosSemParada } from "./movDiretaRascunho";

export type MovDiretaEtapa = "MONTAGEM" | "REVISAO";

export const ETAPAS: { id: MovDiretaEtapa; label: string }[] = [
  { id: "MONTAGEM", label: "Montar movimentação" },
  { id: "REVISAO", label: "Revisar" },
];

export const indiceEtapa = (etapa: MovDiretaEtapa): number =>
  ETAPAS.findIndex((e) => e.id === etapa);

/** Invariantes da viagem (subconjunto de validarRascunho/PROGRAMAR). */
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

/** Invariantes das paradas e ativos entregues. */
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

/** Montagem reúne origem + paradas; revisão não bloqueia (o servidor decide). */
export const errosDaEtapa = (r: CtMovDiretaRascunho, etapa: MovDiretaEtapa): string[] =>
  etapa === "MONTAGEM" ? [...errosEtapaOrigem(r), ...errosEtapaParadas(r)] : [];
