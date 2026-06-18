// Fase 6G.2 — Construção de árvore EAP/WBS no frontend a partir das atividades já carregadas.
// Puro, sem acesso a banco. Sem dependências.

import type { AtividadePlanejada } from "@/types/planejamentoMacro";

export interface WbsNode {
  key: string;            // codigo_wbs ou key sintético
  codigo: string;         // codigo_wbs visível
  nivel: number;          // 1-based
  virtual: boolean;       // true => nó agrupador inferido (sem atividade real)
  atividade: AtividadePlanejada | null;
  filhos: WbsNode[];
}

export interface ArvoreWbsResultado {
  raizes: WbsNode[];
  semWbs: AtividadePlanejada[];
  hierarquicoDetectado: boolean;
  totalReais: number;
  totalVirtuais: number;
}

/** Compara códigos EAP/WBS de forma natural por segmento (numérico quando possível). */
export function compararCodigoWbs(a: string, b: string): number {
  const pa = a.split(".");
  const pb = b.split(".");
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const sa = pa[i] ?? "";
    const sb = pb[i] ?? "";
    const na = Number(sa);
    const nb = Number(sb);
    const ambosNum =
      !Number.isNaN(na) && !Number.isNaN(nb) && sa !== "" && sb !== "";
    if (ambosNum) {
      if (na !== nb) return na - nb;
    } else {
      const cmp = sa.localeCompare(sb, "pt-BR", { numeric: true });
      if (cmp !== 0) return cmp;
    }
  }
  return 0;
}

function normalizarCodigo(c: string | null | undefined): string {
  return (c ?? "").toString().trim();
}

export function construirArvoreWbs(
  atividades: AtividadePlanejada[]
): ArvoreWbsResultado {
  const semWbs: AtividadePlanejada[] = [];
  const comWbs: { codigo: string; atividade: AtividadePlanejada }[] = [];

  for (const a of atividades) {
    const c = normalizarCodigo(a.codigo_wbs);
    if (!c) semWbs.push(a);
    else comWbs.push({ codigo: c, atividade: a });
  }

  comWbs.sort((x, y) => compararCodigoWbs(x.codigo, y.codigo));

  const map = new Map<string, WbsNode>();
  const raizes: WbsNode[] = [];
  let totalVirtuais = 0;

  const garantirNo = (codigo: string, real: WbsNode | null): WbsNode => {
    const existente = map.get(codigo);
    if (existente) {
      if (real && existente.virtual) {
        existente.virtual = false;
        existente.atividade = real.atividade;
        totalVirtuais--;
      }
      return existente;
    }
    const partes = codigo.split(".");
    const nivel = partes.length;
    const novo: WbsNode = real ?? {
      key: codigo,
      codigo,
      nivel,
      virtual: true,
      atividade: null,
      filhos: [],
    };
    if (!real) totalVirtuais++;
    map.set(codigo, novo);

    if (nivel === 1) {
      raizes.push(novo);
    } else {
      const codigoPai = partes.slice(0, -1).join(".");
      const pai = garantirNo(codigoPai, null);
      pai.filhos.push(novo);
    }
    return novo;
  };

  for (const { codigo, atividade } of comWbs) {
    const partes = codigo.split(".");
    const nivel = partes.length;
    const noReal: WbsNode = {
      key: codigo,
      codigo,
      nivel,
      virtual: false,
      atividade,
      filhos: [],
    };
    garantirNo(codigo, noReal);
  }

  const ordenar = (lista: WbsNode[]) => {
    lista.sort((a, b) => compararCodigoWbs(a.codigo, b.codigo));
    for (const n of lista) ordenar(n.filhos);
  };
  ordenar(raizes);

  const hierarquicoDetectado = comWbs.some((c) => c.codigo.includes("."));

  return {
    raizes,
    semWbs,
    hierarquicoDetectado,
    totalReais: comWbs.length,
    totalVirtuais,
  };
}
