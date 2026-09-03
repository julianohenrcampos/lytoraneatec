/**
 * CT-5 UX — paginação do wizard de Puxada (mesmo conceito do CT-4).
 *
 * SOMENTE apresentação: reparticiona os invariantes já cobrados por
 * `validarPuxada` para permitir/bloquear o avanço de etapa.
 */
import type { CtPuxadaRascunho } from "@/types/centralTransportePuxada";
import { podeCalcularRotaPuxada } from "./puxadaRascunho";

export type PuxadaEtapa = "DADOS" | "CAMINHOES" | "TRAJETO" | "REVISAO";

export const ETAPAS_PUXADA: { id: PuxadaEtapa; label: string }[] = [
  { id: "DADOS", label: "Dados da puxada" },
  { id: "CAMINHOES", label: "Caminhões e motoristas" },
  { id: "TRAJETO", label: "Coleta e descarga" },
  { id: "REVISAO", label: "Revisão" },
];

export const indiceEtapaPuxada = (etapa: PuxadaEtapa): number =>
  ETAPAS_PUXADA.findIndex((e) => e.id === etapa);

export const errosEtapaDados = (r: CtPuxadaRascunho): string[] => {
  const erros: string[] = [];
  if (!r.dataPuxada) erros.push("Informe a data da puxada.");
  if (!r.centroCustoId) erros.push("Informe o centro de custo da puxada.");
  return erros;
};

export const errosEtapaCaminhoes = (r: CtPuxadaRascunho): string[] => {
  const erros: string[] = [];
  if (r.caminhoes.length === 0) erros.push("Adicione ao menos um caminhão com motorista.");
  r.caminhoes.forEach((c) => {
    if (!c.motoristaFuncionarioId) erros.push(`Informe o motorista do caminhão ${c.rotulo}.`);
  });
  return erros;
};

export const errosEtapaTrajeto = (r: CtPuxadaRascunho): string[] =>
  podeCalcularRotaPuxada(r)
    ? []
    : ["Confirme no mapa os pontos de coleta e de descarga da puxada."];

export const errosDaEtapaPuxada = (r: CtPuxadaRascunho, etapa: PuxadaEtapa): string[] =>
  etapa === "DADOS"
    ? errosEtapaDados(r)
    : etapa === "CAMINHOES"
      ? errosEtapaCaminhoes(r)
      : etapa === "TRAJETO"
        ? errosEtapaTrajeto(r)
        : [];
