import { supabase } from "@/integrations/supabase/client";
import type { RegistroDisponibilidadeAtual } from "@/services/centralTransporteDisponibilidadeService";

export interface DisponibilidadeEquipamento {
  id: string;
  equipamento_id: string;
  status_operacional: string;
  centro_custo_id: string | null;
  data_inicio: string | null;
  previsao_liberacao: string | null;
  confiabilidade_previsao: string | null;
  motivo_risco: string | null;
  observacao: string | null;
  created_at: string | null;
  updated_at: string | null;
  // Joins
  equipamento_codigo_frota?: string;
  equipamento_numero_frota?: string;
  tipo_equipamento_descricao?: string;
  empresa_nome?: string;
  centro_custo_nome?: string;
  centro_custo_codigo?: string;
  departamento_nome?: string;
}

export interface DisponibilidadeFilters {
  status_operacional?: string;
  tipo_equipamento_id?: string;
  centro_custo_id?: string;
  empresa_id?: string;
  departamento_id?: string;
}

export const fetchDisponibilidades = async (filters?: DisponibilidadeFilters): Promise<DisponibilidadeEquipamento[]> => {
  let query = supabase
    .from("bd_disponibilidade_equipamentos")
    .select(`
      *,
      equipamento:bd_caminhoes_equipamentos(
        id, frota, numero_frota,
        tipo_equipamento:bd_tipos_equipamento(descricao_padronizada),
        empresa:bd_empresas(nome_empresa)
      ),
      centro_custo:bd_centros_custo(nome_centro_custo, codigo_centro_custo, departamento_id, departamento:bd_departamentos(id, nome_departamento))
    `)
    .order("updated_at", { ascending: false });

  if (filters?.status_operacional) {
    query = query.eq("status_operacional", filters.status_operacional as any);
  }
  if (filters?.centro_custo_id) {
    query = query.eq("centro_custo_id", filters.centro_custo_id);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching disponibilidades:", error);
    throw error;
  }

  let results = (data || []).map((item: any) => ({
    ...item,
    equipamento_codigo_frota: item.equipamento?.frota || null,
    equipamento_numero_frota: item.equipamento?.numero_frota || null,
    tipo_equipamento_descricao: item.equipamento?.tipo_equipamento?.descricao_padronizada || null,
    empresa_nome: item.equipamento?.empresa?.nome_empresa || null,
    centro_custo_nome: item.centro_custo?.nome_centro_custo || null,
    centro_custo_codigo: item.centro_custo?.codigo_centro_custo || null,
    departamento_nome: item.centro_custo?.departamento?.nome_departamento || null,
  }));

  // Client-side filters for joined fields
  if (filters?.tipo_equipamento_id) {
    results = results.filter((r: any) => r.equipamento?.tipo_equipamento_id === filters.tipo_equipamento_id);
  }
  if (filters?.empresa_id) {
    results = results.filter((r: any) => r.equipamento?.empresa_id === filters.empresa_id);
  }
  if (filters?.departamento_id) {
    results = results.filter((r: any) => r.centro_custo?.departamento_id === filters.departamento_id);
  }

  return results;
};

/**
 * ESCRITA REMOVIDA (rodada UUID vazio / upsert único).
 *
 * A gravação da disponibilidade operacional é feita exclusivamente por
 * `regularizarDisponibilidade` (RPC fn_ct_disponibilidade_upsert), em
 * src/services/centralTransporteDisponibilidadeService.ts. Nenhum componente
 * de UI executa insert/update direto em bd_disponibilidade_equipamentos.
 */

export const getEquipamentosDropdown = async () => {
  const { data, error } = await supabase
    .from("bd_caminhoes_equipamentos")
    .select("id, frota, numero_frota")
    .order("frota");
  if (error) throw error;
  return data || [];
};

/* ==================================================================
 * D1 / F1 — Universo reconciliado de ativos
 *
 * A base passa a ser bd_caminhoes_equipamentos (universo completo).
 * bd_disponibilidade_equipamentos é apenas ENRIQUECIMENTO.
 * Ativos sem status e/ou sem Centro de Custo são CLASSIFICADOS e
 * permanecem visíveis — jamais são excluídos da listagem.
 * ================================================================== */

import {
  indexarDisponibilidadePorEquipamento,
  normalizarStatusOperacional,
  reconciliarAtivo,
  ordenarPorChave,
  montarChaveOrdenacao,
  casaBusca,
  type EstadoOperacionalAtivo,
  type LinhaDisponibilidade,
  type StatusOperacionalCanonico,
} from "@/lib/ativos/reconciliacaoOperacional";

/** Tamanho de página do Supabase (limite padrão de 1000 linhas por request). */
export const ATIVOS_PAGE_SIZE = 1000;

export interface AtivoReconciliado extends EstadoOperacionalAtivo {
  frota: string | null;
  numeroFrota: string | null;
  placa: string | null;
  empresaId: string | null;
  empresaNome: string | null;
  tipoEquipamentoId: string | null;
  tipoEquipamentoDescricao: string | null;
  departamentoId: string | null;
  departamentoNome: string | null;
  /** id da linha em bd_disponibilidade_equipamentos (para edição), se houver. */
  disponibilidadeId: string | null;
  dataInicio: string | null;
  motivoRisco: string | null;
  observacao: string | null;
  chaveOrdenacao: string;
}

export interface UniversoAtivosReconciliados {
  ativos: AtivoReconciliado[];
  /** Total de ativos existentes no cadastro (contagem autoritativa `count: exact`). */
  totalAtivos: number;
  /** Linhas efetivamente trazidas pelos lotes. */
  totalCarregados: number;
  /** Itens efetivamente reconciliados e disponíveis para exibição. */
  totalReconciliados: number;
  totalSemStatus: number;
  totalSemCentroCusto: number;
  totalConflitoCadastral: number;
  paginasCarregadas: number;
}

type LinhaDispCompleta = LinhaDisponibilidade & {
  data_inicio: string | null;
  motivo_risco: string | null;
  observacao: string | null;
};

/** Erro de integridade de carga — a lista NUNCA é renderizada incompleta em silêncio. */
export class CargaAtivosIncompletaError extends Error {
  readonly diagnostico: {
    totalAtivos: number;
    totalCarregados: number;
    totalReconciliados: number;
    paginasCarregadas: number;
  };

  constructor(diagnostico: CargaAtivosIncompletaError["diagnostico"]) {
    super(
      `Carga incompleta do universo de ativos: contados=${diagnostico.totalAtivos}, ` +
        `carregados=${diagnostico.totalCarregados}, reconciliados=${diagnostico.totalReconciliados}, ` +
        `páginas=${diagnostico.paginasCarregadas}.`,
    );
    this.name = "CargaAtivosIncompletaError";
    // Diagnóstico sanitizado: somente contadores, nenhum dado de ativo.
    this.diagnostico = diagnostico;
  }
}

/** Contagem autoritativa do universo, independente da paginação. */
const contarAtivos = async (): Promise<number> => {
  const { count, error } = await supabase
    .from("bd_caminhoes_equipamentos")
    .select("id", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
};

/**
 * Linha REAL de bd_caminhoes_equipamentos (mais embeds válidos).
 * Não contém campos derivados: a tabela NÃO possui centro_custo_atual_codigo,
 * centro_custo_atual_nome, centro_custo_origem nem centro_custo_id.
 */
interface CaminhaoEquipamentoRow {
  id: string;
  frota: string | null;
  numero_frota: string | null;
  placa: string | null;
  situacao: string | null;
  capacidade_valor: number | null;
  capacidade_unidade: string | null;
  empresa_id: string | null;
  tipo_equipamento_id: string | null;
  centro_custo_atual_id: string | null;
  centro_custo_atual_origem: string | null;
  empresa: { nome_empresa: string | null } | null;
  tipo_equipamento: { descricao_padronizada: string | null } | null;
}

/** Colunas reais projetadas — exportado para asserção material nos testes. */
export const SELECT_ATIVOS_UNIVERSO = `id, frota, numero_frota, placa, situacao, capacidade_valor, capacidade_unidade,
         empresa_id, tipo_equipamento_id,
         centro_custo_atual_id, centro_custo_atual_origem,
         empresa:bd_empresas(nome_empresa),
         tipo_equipamento:bd_tipos_equipamento(descricao_padronizada)`;

/** Busca paginada — garante o universo completo mesmo acima de 1000 linhas. */
const buscarTodosAtivosPaginado = async (): Promise<{
  rows: CaminhaoEquipamentoRow[];
  paginas: number;
}> => {
  const rows: CaminhaoEquipamentoRow[] = [];
  let pagina = 0;

  // Laço com guarda dura: encerra quando a página vem incompleta.
  for (;;) {
    const from = pagina * ATIVOS_PAGE_SIZE;
    const to = from + ATIVOS_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("bd_caminhoes_equipamentos")
      .select(SELECT_ATIVOS_UNIVERSO)
      .order("id", { ascending: true })
      .range(from, to);

    if (error) throw error;
    const lote = ((data as unknown) as CaminhaoEquipamentoRow[]) || [];
    rows.push(...lote);
    pagina += 1;
    if (lote.length < ATIVOS_PAGE_SIZE) break;
  }

  return { rows, paginas: pagina };
};

/** Enriquecimento em lote (chunks de `.in()`) — evita N+1. */
const buscarDisponibilidadesEmLote = async (
  equipamentoIds: string[],
): Promise<LinhaDispCompleta[]> => {
  const out: LinhaDispCompleta[] = [];
  const CHUNK = 300;
  for (let i = 0; i < equipamentoIds.length; i += CHUNK) {
    const slice = equipamentoIds.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from("bd_disponibilidade_equipamentos")
      .select(
        `id, equipamento_id, status_operacional, centro_custo_id, data_inicio,
         previsao_liberacao, confiabilidade_previsao, motivo_risco, observacao,
         created_at, updated_at`,
      )
      .in("equipamento_id", slice);
    if (error) throw error;
    out.push(...(((data as unknown) as LinhaDispCompleta[]) || []));
  }
  return out;
};

/** Resumo de Centro de Custo obtido por enriquecimento em lote. */
export interface CentroCustoResumo {
  id: string;
  codigo: string | null;
  nome: string | null;
  departamentoId: string | null;
  departamentoNome: string | null;
}

/**
 * Enriquecimento em lote de Centros de Custo por ID (chunks de `.in()`).
 * Não existe FK de bd_caminhoes_equipamentos.centro_custo_atual_id para
 * bd_centros_custo, portanto o PostgREST não expõe embed — a resolução é feita
 * aqui, em lote, nunca por ativo (proibido N+1).
 */
const buscarCentrosCustoEmLote = async (
  centroCustoIds: readonly string[],
): Promise<Map<string, CentroCustoResumo>> => {
  const mapa = new Map<string, CentroCustoResumo>();
  const unicos = Array.from(new Set(centroCustoIds.filter(Boolean)));
  if (!unicos.length) return mapa;

  const CHUNK = 300;
  for (let i = 0; i < unicos.length; i += CHUNK) {
    const slice = unicos.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from("bd_centros_custo")
      .select(
        "id, codigo_centro_custo, nome_centro_custo, departamento_id, departamento:bd_departamentos(nome_departamento)",
      )
      .in("id", slice);
    if (error) {
      console.warn("[DISPONIBILIDADE] enriquecimento de Centro de Custo indisponível:", error.message);
      continue;
    }
    for (const cc of ((data as unknown) as Array<{
      id: string;
      codigo_centro_custo: string | null;
      nome_centro_custo: string | null;
      departamento_id: string | null;
      departamento: { nome_departamento: string | null } | null;
    }>) || []) {
      mapa.set(cc.id, {
        id: cc.id,
        codigo: cc.codigo_centro_custo ?? null,
        nome: cc.nome_centro_custo ?? null,
        departamentoId: cc.departamento_id ?? null,
        departamentoNome: cc.departamento?.nome_departamento ?? null,
      });
    }
  }
  return mapa;
};

/**
 * Universo reconciliado: TODOS os ativos do cadastro, enriquecidos com o
 * registro operacional mais recente e com a projeção autoritativa de CC.
 */
export const fetchAtivosReconciliados = async (): Promise<UniversoAtivosReconciliados> => {
  const [totalAtivos, { rows, paginas }] = await Promise.all([
    contarAtivos(),
    buscarTodosAtivosPaginado(),
  ]);
  const ids = rows.map((r) => r.id);
  const centroCustoIds = rows
    .map((r) => r.centro_custo_atual_id)
    .filter((v): v is string => !!v);

  const [dispRows, mapaCc] = await Promise.all([
    buscarDisponibilidadesEmLote(ids),
    buscarCentrosCustoEmLote(centroCustoIds),
  ]);

  const dispByEquip = indexarDisponibilidadePorEquipamento(dispRows);

  const ativos: AtivoReconciliado[] = rows.map((r) => {
    const disp = dispByEquip.get(r.id) ?? null;
    const empresaNome = r.empresa?.nome_empresa ?? null;
    const cc = r.centro_custo_atual_id ? mapaCc.get(r.centro_custo_atual_id) ?? null : null;

    const estado = reconciliarAtivo(
      {
        id: r.id,
        frota: r.frota,
        numero_frota: r.numero_frota,
        placa: r.placa,
        situacao: r.situacao,
        capacidade_valor: r.capacidade_valor,
        capacidade_unidade: r.capacidade_unidade,
      },
      disp,
      {
        centroCustoAtualId: r.centro_custo_atual_id ?? null,
        centroCustoAtualCodigo: cc?.codigo ?? null,
        centroCustoAtualNome: cc?.nome ?? null,
      },
      { empresaNome, extrasBusca: [r.tipo_equipamento?.descricao_padronizada] },
    );

    const depto = cc ?? undefined;

    return {
      ...estado,
      frota: r.frota ?? null,
      numeroFrota: r.numero_frota ?? null,
      placa: r.placa ?? null,
      empresaId: r.empresa_id ?? null,
      empresaNome,
      tipoEquipamentoId: r.tipo_equipamento_id ?? null,
      tipoEquipamentoDescricao: r.tipo_equipamento?.descricao_padronizada ?? null,
      departamentoId: depto?.departamentoId ?? null,
      departamentoNome: depto?.departamentoNome ?? null,
      disponibilidadeId: disp?.id ?? null,
      dataInicio: disp?.data_inicio ?? null,
      motivoRisco: disp?.motivo_risco ?? null,
      observacao: disp?.observacao ?? null,
      chaveOrdenacao: montarChaveOrdenacao({
        statusOperacional: estado.statusOperacional,
        jaNoCentroCustoDestino: false,
        previsaoLiberacao: estado.previsaoLiberacao,
        matchTipo: "EXATO",
        possuiCentroCustoAtual: estado.possuiCentroCustoAtual,
        frota: r.frota ?? null,
        numeroFrota: r.numero_frota ?? null,
        placa: r.placa ?? null,
        equipamentoId: r.id,
      }),
    };
  });

  const ordenados = ordenarPorChave(ativos);

  const totalCarregados = rows.length;
  const totalReconciliados = ordenados.length;

  // Gate de integridade: contado === carregado === reconciliado, senão erro explícito.
  if (totalAtivos !== totalCarregados || totalCarregados !== totalReconciliados) {
    const diagnostico = { totalAtivos, totalCarregados, totalReconciliados, paginasCarregadas: paginas };
    console.error("[DISPONIBILIDADE] carga incompleta do universo de ativos:", diagnostico);
    throw new CargaAtivosIncompletaError(diagnostico);
  }

  return {
    ativos: ordenados,
    totalAtivos,
    totalCarregados,
    totalReconciliados,
    totalSemStatus: ordenados.filter((a) => a.statusOperacional === "SEM_STATUS").length,
    totalSemCentroCusto: ordenados.filter((a) => !a.possuiCentroCustoAtual).length,
    totalConflitoCadastral: ordenados.filter((a) => a.possuiConflitoCadastral).length,
    paginasCarregadas: paginas,
  };
};

export interface EstadoOperacionalDetalhado {
  statusOperacional: StatusOperacionalCanonico;
  possuiRegistroDisponibilidade: boolean;
  /** Registro real gravado — null quando o ativo não possui linha operacional. */
  registro: RegistroDisponibilidadeAtual | null;
}

/**
 * Estado operacional de UM ativo (leitura, sem inferência a partir de `situacao`).
 * Usado pelo módulo Caminhões e Equipamentos e pelos modais de regularização.
 */
export const fetchEstadoOperacionalAtivo = async (
  equipamentoId: string,
): Promise<EstadoOperacionalDetalhado> => {
  const { data, error } = await supabase
    .from("bd_disponibilidade_equipamentos")
    .select(
      `id, equipamento_id, status_operacional, centro_custo_id, previsao_liberacao,
       confiabilidade_previsao, data_inicio, motivo_risco, observacao, created_at, updated_at`,
    )
    .eq("equipamento_id", equipamentoId);
  if (error) throw error;

  const idx = indexarDisponibilidadePorEquipamento(
    ((data as unknown) as LinhaDispCompleta[]) || [],
  );
  const linha = (idx.get(equipamentoId) ?? null) as LinhaDispCompleta | null;
  const statusOperacional = normalizarStatusOperacional(!!linha, linha?.status_operacional ?? null);

  const statusEditavel =
    statusOperacional === "DISPONIVEL" ||
    statusOperacional === "ALOCADO" ||
    statusOperacional === "MANUTENCAO" ||
    statusOperacional === "INDISPONIVEL"
      ? statusOperacional
      : null;

  return {
    statusOperacional,
    possuiRegistroDisponibilidade: !!linha,
    registro:
      linha && statusEditavel
        ? {
            statusOperacional: statusEditavel,
            centroCustoId: linha.centro_custo_id ?? null,
            dataInicio: linha.data_inicio ?? null,
            previsaoLiberacao: linha.previsao_liberacao ?? null,
            confiabilidadePrevisao:
              (linha.confiabilidade_previsao as RegistroDisponibilidadeAtual["confiabilidadePrevisao"]) ??
              null,
            motivoRisco: linha.motivo_risco ?? null,
            observacao: linha.observacao ?? null,
          }
        : null,
  };
};

export interface FiltrosAtivosReconciliados {
  busca?: string;
  status_operacional?: StatusOperacionalCanonico | "TODOS" | "";
  tipo_equipamento_id?: string;
  centro_custo_id?: string;
  empresa_id?: string;
  departamento_id?: string;
  /** true = mostrar apenas ativos sem Centro de Custo confirmado. */
  somenteSemCentroCusto?: boolean;
  /** true = mostrar apenas ativos com conflito cadastral. */
  somenteConflitoCadastral?: boolean;
}

/** Filtro em memória — nunca remove por ausência de status ou de CC. */
export const filtrarAtivosReconciliados = (
  ativos: readonly AtivoReconciliado[],
  f: FiltrosAtivosReconciliados,
): AtivoReconciliado[] => {
  let out = [...ativos];
  if (f.status_operacional && f.status_operacional !== "TODOS") {
    out = out.filter((a) => a.statusOperacional === f.status_operacional);
  }
  if (f.tipo_equipamento_id) out = out.filter((a) => a.tipoEquipamentoId === f.tipo_equipamento_id);
  if (f.centro_custo_id) out = out.filter((a) => a.centroCustoAtualId === f.centro_custo_id);
  if (f.empresa_id) out = out.filter((a) => a.empresaId === f.empresa_id);
  if (f.departamento_id) out = out.filter((a) => a.departamentoId === f.departamento_id);
  if (f.somenteSemCentroCusto) out = out.filter((a) => !a.possuiCentroCustoAtual);
  if (f.somenteConflitoCadastral) out = out.filter((a) => a.possuiConflitoCadastral);
  if (f.busca?.trim()) out = out.filter((a) => casaBusca(a.textoBusca, f.busca as string));
  return out;
};
