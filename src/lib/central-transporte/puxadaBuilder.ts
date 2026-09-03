/**
 * CT-5 — Camada PURA do Puxada Builder (canvas No-Code de caminhões).
 *
 * Nada aqui toca rede, React ou banco: são apenas transformações do rascunho
 * `CtPuxadaRascunho` já existente. A gravação continua em
 * `fn_ct_puxada_salvar_rascunho` e a programação em `fn_ct_puxada_programar`.
 *
 * LIMITAÇÃO DECLARADA (backend atual, sem migration): a RPC de rascunho exige
 * motorista em TODO caminhão (`CT5_MOTORISTA_OBRIGATORIO`). Portanto um caminhão
 * arrastado sem motorista vive apenas no estado React e o salvamento é bloqueado
 * no cliente com pendência explícita (`pendenciasFrota`).
 */
import { caminhaoRascunho } from "./puxadaRascunho";
import type { MovLocal } from "./movDiretaBuilder";
import type {
  CtPuxadaCaminhaoRascunho,
  CtPuxadaRascunho,
} from "@/types/centralTransportePuxada";

/* ------------------------------------------------------------------ */
/* Identificadores de drag-and-drop (dnd-kit)                          */
/* ------------------------------------------------------------------ */

export type PuxDragTipo = "PUX_CAMINHAO" | "PUX_MOTORISTA" | "PUX_LOCAL";

const DRAG_TIPOS: PuxDragTipo[] = ["PUX_CAMINHAO", "PUX_MOTORISTA", "PUX_LOCAL"];

export const puxDragId = (tipo: PuxDragTipo, id: string): string => `${tipo}:${id}`;

export const parsePuxDragId = (
  raw: string | number | null | undefined,
): { tipo: PuxDragTipo; id: string } | null => {
  if (typeof raw !== "string") return null;
  const [tipo, ...resto] = raw.split(":");
  if (!DRAG_TIPOS.includes(tipo as PuxDragTipo)) return null;
  const id = resto.join(":");
  return id ? { tipo: tipo as PuxDragTipo, id } : null;
};

export type PuxDropAlvo =
  | { tipo: "PUX_CANVAS" }
  | { tipo: "PUX_CENTRO_CUSTO" }
  | { tipo: "PUX_MOTORISTA_SLOT"; chaveLocal: string };

export const puxDropId = (alvo: PuxDropAlvo): string =>
  alvo.tipo === "PUX_CANVAS"
    ? "PUXDROP:CANVAS"
    : alvo.tipo === "PUX_CENTRO_CUSTO"
      ? "PUXDROP:CENTRO_CUSTO"
      : `PUXDROP:MOTORISTA_SLOT:${alvo.chaveLocal}`;

export const parsePuxDropId = (
  raw: string | number | null | undefined,
): PuxDropAlvo | null => {
  if (typeof raw !== "string" || !raw.startsWith("PUXDROP:")) return null;
  const [, tipo, ...resto] = raw.split(":");
  if (tipo === "CANVAS") return { tipo: "PUX_CANVAS" };
  if (tipo === "CENTRO_CUSTO") return { tipo: "PUX_CENTRO_CUSTO" };
  const chaveLocal = resto.join(":");
  if (tipo === "MOTORISTA_SLOT" && chaveLocal) {
    return { tipo: "PUX_MOTORISTA_SLOT", chaveLocal };
  }
  return null;
};

/** Compatibilidade explícita: cada recurso só entra no alvo que lhe pertence. */
export const puxDropAceita = (tipo: PuxDragTipo, alvo: PuxDropAlvo): boolean => {
  switch (tipo) {
    case "PUX_CAMINHAO":
      return alvo.tipo === "PUX_CANVAS";
    case "PUX_MOTORISTA":
      return alvo.tipo === "PUX_MOTORISTA_SLOT";
    case "PUX_LOCAL":
      return alvo.tipo === "PUX_CENTRO_CUSTO";
    default:
      return false;
  }
};


/* ------------------------------------------------------------------ */
/* Transformações do rascunho                                          */
/* ------------------------------------------------------------------ */

export interface PuxCaminhaoNovo {
  caminhaoEquipamentoId: string;
  rotulo: string;
  placa?: string | null;
}

/** Adiciona um caminhão ao canvas. Duplicado é ignorado (mesma regra da RPC). */
export const adicionarCaminhao = (
  r: CtPuxadaRascunho,
  dados: PuxCaminhaoNovo,
): CtPuxadaRascunho => {
  if (r.caminhoes.some((c) => c.caminhaoEquipamentoId === dados.caminhaoEquipamentoId)) {
    return r;
  }
  return { ...r, caminhoes: [...r.caminhoes, caminhaoRascunho(dados)] };
};

export const removerCaminhao = (
  r: CtPuxadaRascunho,
  chaveLocal: string,
): CtPuxadaRascunho => ({
  ...r,
  caminhoes: r.caminhoes.filter((c) => c.chaveLocal !== chaveLocal),
});

/** Define (ou substitui) o motorista de um caminhão. `null` limpa o slot. */
export const definirMotorista = (
  r: CtPuxadaRascunho,
  chaveLocal: string,
  motorista: { id: string; nome: string } | null,
): CtPuxadaRascunho => ({
  ...r,
  caminhoes: r.caminhoes.map((c) =>
    c.chaveLocal === chaveLocal
      ? {
          ...c,
          motoristaFuncionarioId: motorista?.id ?? null,
          motoristaNome: motorista?.nome ?? "",
        }
      : c,
  ),
});

/* ------------------------------------------------------------------ */
/* Vereditos visuais                                                   */
/* ------------------------------------------------------------------ */

export type PuxCardEstado = "INCOMPLETO" | "PRONTO";

export const vereditoCaminhao = (c: CtPuxadaCaminhaoRascunho): PuxCardEstado =>
  c.motoristaFuncionarioId ? "PRONTO" : "INCOMPLETO";

/** Motorista já usado em outro caminhão desta mesma puxada. */
export const motoristaEmUso = (
  r: CtPuxadaRascunho,
  motoristaId: string,
  exceto?: string,
): boolean =>
  r.caminhoes.some(
    (c) => c.chaveLocal !== exceto && c.motoristaFuncionarioId === motoristaId,
  );

/**
 * Pendências que impedem até o SALVAMENTO do rascunho (limitação E1 do backend:
 * a RPC recusa caminhão sem motorista).
 */
export const pendenciasFrota = (r: CtPuxadaRascunho): string[] =>
  r.caminhoes
    .filter((c) => !c.motoristaFuncionarioId)
    .map((c) => `Caminhão ${c.rotulo} sem motorista.`);

export const frotaCompleta = (r: CtPuxadaRascunho): boolean =>
  r.caminhoes.length > 0 && pendenciasFrota(r).length === 0;

/* ------------------------------------------------------------------ */
/* Centro de custo por LOCAL canônico (drag/clique)                    */
/* ------------------------------------------------------------------ */

/**
 * Define o centro de custo da puxada a partir do local canônico
 * (`bd_centros_custo`, já lido por `useCtMobilizacaoCadastros`).
 *
 * Conveniência de preenchimento: quando a DESCARGA ainda está vazia e o CC tem
 * endereço cadastrado, o ponto de descarga é pré-preenchido. Nada é sobrescrito
 * quando o usuário já editou a descarga. A coleta é sempre independente.
 */
export const definirCentroCustoPorLocal = (
  r: CtPuxadaRascunho,
  local: MovLocal,
): CtPuxadaRascunho => {
  const descargaVazia = !r.descargaEndereco.trim();
  const podePrefill = descargaVazia && !!local.endereco;
  return {
    ...r,
    centroCustoId: local.id,
    ...(podePrefill
      ? {
          descargaEndereco: local.endereco as string,
          descargaLatitude: local.latitude,
          descargaLongitude: local.longitude,
        }
      : {}),
  };
};

/* ------------------------------------------------------------------ */
/* Pendências compactas de "Montar puxada"                             */
/* ------------------------------------------------------------------ */

const coordOk = (lat: number | null, lng: number | null): boolean =>
  Number.isFinite(lat as number) &&
  Number.isFinite(lng as number) &&
  !(lat === 0 && lng === 0);

/** Pendências exibidas no builder — espelham os invariantes já existentes. */
export const pendenciasPuxada = (r: CtPuxadaRascunho): string[] => {
  const p: string[] = [];
  if (!r.dataPuxada) p.push("Informe a data");
  if (!r.centroCustoId) p.push("Informe Centro de Custo");
  if (!coordOk(r.coletaLatitude, r.coletaLongitude)) p.push("Informe coleta");
  if (!coordOk(r.descargaLatitude, r.descargaLongitude)) p.push("Informe descarga");
  if (r.caminhoes.length === 0) p.push("Adicione um caminhão");
  r.caminhoes.forEach((c) => {
    if (!c.motoristaFuncionarioId) p.push(`Caminhão ${c.rotulo} sem motorista`);
  });
  return p;
};
