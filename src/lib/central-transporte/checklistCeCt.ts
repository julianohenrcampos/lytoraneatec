/**
 * CT-3E.3 / CT-3F.1 — Adapter entre a Central do Transporte e o motor OFICIAL de
 * checklist do Apontamento de C&E.
 *
 * A Central NÃO possui templates próprios de equipamento: a fonte única é
 * `CHECKLIST_CE_TEMPLATES` + `resolveTemplateCE(subcategoria_ativo_id)`.
 * Aqui só traduzimos entre o estado do componente `ChecklistDinamico` e o
 * snapshot JSONB persistido pelas RPCs CT-3E (`bd_ct_checklists.respostas`).
 */
import {
  CHECKLIST_CE_SCHEMA_VERSAO,
  resolveTemplateCE,
  type ChecklistCeGrupoDef,
  type ChecklistCeItemDef,
} from "@/constants/checklistCeTemplates";
import { CT_CHECKLIST_TEMPLATES } from "@/constants/ctChecklistTemplates";
import type {
  ChecklistDetalhadoState,
  ChecklistItemState,
} from "@/components/apontamento-caminhoes/checklist/ChecklistDinamico";
import type { ChecklistValor } from "@/types/checklistCe";
import type { CtOrdemCarga } from "@/types/centralTransporteMobilizacao";
import type { CtChecklistPersistido } from "@/types/centralTransporteOperacao";
import { uploadFotoCt } from "@/services/ctOperacaoService";

/** Template renderizável (mesma forma dos templates C&E). */
export interface CtTemplateChecklist {
  codigo: string;
  nome: string;
  versao: number;
  grupos: ChecklistCeGrupoDef[];
}

/** Template do conjunto transportador (prancha/carreta) — complementar, nunca substitui a carga. */
export const TEMPLATE_TRANSPORTADOR: CtTemplateChecklist =
  CT_CHECKLIST_TEMPLATES["CT-TRANSPORTADOR-V1"] as unknown as CtTemplateChecklist;

/** Fail-closed: sem subcategoria canônica mapeada não existe checklist oficial. */
export const resolveTemplateCarga = (carga: CtOrdemCarga): CtTemplateChecklist | null => {
  const t = resolveTemplateCE(carga.subcategoriaId);
  return t ? (t as unknown as CtTemplateChecklist) : null;
};

export const todosItens = (template: CtTemplateChecklist): ChecklistCeItemDef[] =>
  template.grupos.flatMap((g) => g.itens);

/* ------------------------- snapshot persistido ------------------------- */

export interface CtChecklistItemSnapshot {
  status: ChecklistValor | null;
  observacao: string | null;
  fotos: string[];
}

export interface CtChecklistSnapshot {
  schema_version: number;
  template_codigo: string;
  template_versao: number;
  ativo: Record<string, unknown> | null;
  vinculo: {
    viagem_id: string;
    movimentacao_id: string | null;
    equipamento_id: string | null;
    fase: "SAIDA" | "RECEBIMENTO";
  };
  grupos: {
    codigo: string;
    titulo: string;
    ordem: number;
    itens: (CtChecklistItemSnapshot & {
      codigo: string;
      ordem: number;
      descricao: string;
      criticidade: string;
      obrigatorio: boolean;
    })[];
  }[];
  itens: Record<string, CtChecklistItemSnapshot>;
  observacoes_gerais: string | null;
  resumo: {
    total_itens: number;
    obrigatorios_total: number;
    obrigatorios_respondidos: number;
    ok: number;
    nao_ok: number;
    na: number;
    aprovado: boolean;
  };
  gerado_em: string;
}

const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** Lê o mapa de itens tanto do snapshot novo quanto do formato plano legado. */
export const itensDoPersistido = (
  persistido: CtChecklistPersistido | null | undefined,
): Record<string, CtChecklistItemSnapshot> => {
  const raw = asRecord(persistido?.respostas);
  const fonte = raw.itens !== undefined ? asRecord(raw.itens) : raw;
  const out: Record<string, CtChecklistItemSnapshot> = {};
  for (const [codigo, valor] of Object.entries(fonte)) {
    const r = asRecord(valor);
    const status = typeof r.status === "string" ? (r.status as ChecklistValor) : null;
    out[codigo] = {
      status: status === "OK" || status === "NAO_OK" || status === "NA" ? status : null,
      observacao: typeof r.observacao === "string" && r.observacao !== "" ? r.observacao : null,
      fotos: Array.isArray(r.fotos) ? r.fotos.filter((f): f is string => typeof f === "string") : [],
    };
  }
  return out;
};

export const observacoesGeraisDoPersistido = (
  persistido: CtChecklistPersistido | null | undefined,
): string => {
  const raw = asRecord(persistido?.respostas);
  return typeof raw.observacoes_gerais === "string" ? raw.observacoes_gerais : "";
};

/* --------------------------- estado do form --------------------------- */

const itemVazio = (status: ChecklistValor | null): ChecklistItemState => ({
  status: status ?? undefined,
  observacao: "",
  fotosSalvas: [],
  fotosNovas: [],
});

/**
 * CREATE: todos os itens iniciam como "OK" (paridade com o Apontamento C&E).
 * EDIT: hidrata exatamente o que está persistido.
 */
export const estadoInicial = (
  template: CtTemplateChecklist,
  persistido?: CtChecklistPersistido | null,
  /** Seed alternativo (usado no recebimento: statuses da saída). */
  seed?: Record<string, CtChecklistItemSnapshot>,
): ChecklistDetalhadoState => {
  const gravado = itensDoPersistido(persistido);
  const temGravado = Object.keys(gravado).length > 0;
  const state: ChecklistDetalhadoState = {};
  for (const item of todosItens(template)) {
    const fonte = temGravado ? gravado[item.codigo] : seed?.[item.codigo];
    if (!temGravado && !seed) {
      state[item.codigo] = itemVazio("OK");
      continue;
    }
    state[item.codigo] = {
      status: (fonte?.status ?? "OK") as ChecklistValor,
      observacao: fonte?.observacao ?? "",
      fotosSalvas: fonte?.fotos ?? [],
      fotosNovas: [],
    };
  }
  return state;
};

/** Regras oficiais: obrigatório sem status, NÃO OK sem observação, NÃO OK sem foto. */
export const validarEstado = (
  template: CtTemplateChecklist,
  state: ChecklistDetalhadoState,
): string[] => {
  const pendentes: string[] = [];
  for (const item of todosItens(template)) {
    const e = state[item.codigo];
    if (item.obrigatorio && !e?.status) {
      pendentes.push(item.codigo);
      continue;
    }
    if (e?.status === "NAO_OK") {
      if (!e.observacao.trim()) pendentes.push(item.codigo);
      else if (item.exigeFotoNaoOk && e.fotosSalvas.length + e.fotosNovas.length === 0)
        pendentes.push(item.codigo);
    }
  }
  return pendentes;
};

/** Sobe as fotos pendentes para o bucket privado e devolve o estado consolidado. */
export const uploadFotosPendentes = async (
  viagemId: string,
  escopo: string,
  state: ChecklistDetalhadoState,
): Promise<ChecklistDetalhadoState> => {
  const out: ChecklistDetalhadoState = {};
  for (const [codigo, item] of Object.entries(state)) {
    const novos: string[] = [];
    for (const foto of item.fotosNovas) {
      novos.push(await uploadFotoCt(viagemId, `${escopo}/${codigo}`, foto.file));
    }
    out[codigo] = {
      ...item,
      fotosSalvas: [...item.fotosSalvas, ...novos],
      fotosNovas: [],
    };
  }
  return out;
};

export const mapaItens = (
  state: ChecklistDetalhadoState,
): Record<string, CtChecklistItemSnapshot> => {
  const out: Record<string, CtChecklistItemSnapshot> = {};
  for (const [codigo, item] of Object.entries(state)) {
    out[codigo] = {
      status: (item.status ?? null) as ChecklistValor | null,
      observacao: item.observacao.trim() || null,
      fotos: item.fotosSalvas,
    };
  }
  return out;
};

/** Snapshot completo (mesma natureza do snapshot do Apontamento C&E). */
export const montarSnapshot = (args: {
  template: CtTemplateChecklist;
  state: ChecklistDetalhadoState;
  viagemId: string;
  movimentacaoId: string | null;
  carga: CtOrdemCarga | null;
  fase: "SAIDA" | "RECEBIMENTO";
  observacoesGerais: string;
}): CtChecklistSnapshot => {
  const { template, state, carga } = args;
  const itens = mapaItens(state);
  const lista = todosItens(template);
  const conta = (v: ChecklistValor) =>
    lista.filter((i) => itens[i.codigo]?.status === v).length;
  const obrigatorios = lista.filter((i) => i.obrigatorio);
  return {
    schema_version: CHECKLIST_CE_SCHEMA_VERSAO,
    template_codigo: template.codigo,
    template_versao: template.versao,
    ativo: carga
      ? {
          equipamento_id: carga.equipamentoId,
          frota: carga.frota,
          numero_frota: carga.numeroFrota,
          placa: carga.placa,
          subcategoria_id: carga.subcategoriaId,
          subcategoria_nome: carga.subcategoriaNome,
          imagem_url: carga.imagemUrl,
          fabricante: carga.fabricanteNome,
          ano_fabricacao: carga.anoFabricacao,
          modelo: carga.modelo,
        }
      : null,
    vinculo: {
      viagem_id: args.viagemId,
      movimentacao_id: args.movimentacaoId,
      equipamento_id: carga?.equipamentoId ?? null,
      fase: args.fase,
    },
    grupos: template.grupos.map((g) => ({
      codigo: g.codigo,
      titulo: g.titulo,
      ordem: g.ordem,
      itens: g.itens.map((i) => ({
        codigo: i.codigo,
        ordem: i.ordem,
        descricao: i.descricao,
        criticidade: i.criticidade,
        obrigatorio: i.obrigatorio,
        status: itens[i.codigo]?.status ?? null,
        observacao: itens[i.codigo]?.observacao ?? null,
        fotos: itens[i.codigo]?.fotos ?? [],
      })),
    })),
    itens,
    observacoes_gerais: args.observacoesGerais.trim() || null,
    resumo: {
      total_itens: lista.length,
      obrigatorios_total: obrigatorios.length,
      obrigatorios_respondidos: obrigatorios.filter((i) => itens[i.codigo]?.status).length,
      ok: conta("OK"),
      nao_ok: conta("NAO_OK"),
      na: conta("NA"),
      aprovado: conta("NAO_OK") === 0,
    },
    gerado_em: new Date().toISOString(),
  };
};

/** Divergências entre a saída (imutável) e a avaliação do recebimento. */
export const divergencias = (
  template: CtTemplateChecklist,
  saida: Record<string, CtChecklistItemSnapshot>,
  state: ChecklistDetalhadoState,
): string[] =>
  todosItens(template)
    .filter((i) => (state[i.codigo]?.status ?? null) !== (saida[i.codigo]?.status ?? null))
    .map((i) => i.codigo);

export const rotuloCarga = (c: CtOrdemCarga): string =>
  [c.frota, c.numeroFrota].filter(Boolean).join("-") || c.placa || "Ativo";
