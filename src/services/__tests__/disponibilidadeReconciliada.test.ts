import { describe, it, expect, beforeEach, vi } from "vitest";

/* --------------------------------------------------------------
 * D1 / F1 — testes do universo reconciliado da Disponibilidade
 * Operacional. Mock encadeável do supabase-js cobrindo:
 * select(count/head), order, range, in.
 * -------------------------------------------------------------- */

type AtivoRow = Record<string, any>;
type DispRow = Record<string, any>;

const db = {
  ativos: [] as AtivoRow[],
  /** Permite simular divergência entre contagem e carga. */
  countOverride: null as number | null,
  disponibilidades: [] as DispRow[],
  centrosCusto: [] as Record<string, any>[],
};

const calls = {
  ativosSelects: 0,
  dispSelects: 0,
  ccSelects: 0,
  ranges: [] as Array<[number, number]>,
  /** Strings de projeção realmente enviadas ao PostgREST, por tabela. */
  selectCols: [] as Array<{ table: string; cols: string }>,
  ccInIds: [] as string[][],
};

vi.mock("@/integrations/supabase/client", () => {
  const makeBuilder = (table: string) => {
    const state: { head: boolean; inIds: string[] | null } = { head: false, inIds: null };

    const exec = () => {
      if (table === "bd_caminhoes_equipamentos") {
        if (state.head) {
          return { data: null, count: db.countOverride ?? db.ativos.length, error: null };
        }
        return { data: db.ativos, error: null };
      }
      if (table === "bd_disponibilidade_equipamentos") {
        const rows = state.inIds
          ? db.disponibilidades.filter((d) => state.inIds!.includes(d.equipamento_id))
          : db.disponibilidades;
        return { data: rows, error: null };
      }
      if (table === "bd_centros_custo") {
        const rows = state.inIds
          ? db.centrosCusto.filter((c) => state.inIds!.includes(c.id))
          : db.centrosCusto;
        return { data: rows, error: null };
      }
      return { data: [], error: null };
    };

    const builder: Record<string, any> = {
      select: (cols?: string, opts?: { head?: boolean }) => {
        if (table === "bd_caminhoes_equipamentos") calls.ativosSelects += 1;
        if (table === "bd_disponibilidade_equipamentos") calls.dispSelects += 1;
        if (table === "bd_centros_custo") calls.ccSelects += 1;
        calls.selectCols.push({ table, cols: cols ?? "" });
        state.head = !!opts?.head;
        return builder;
      },
      order: () => builder,
      eq: (_c: string, v: unknown) => {
        state.inIds = [String(v)];
        return builder;
      },
      in: (_c: string, v: string[]) => {
        state.inIds = v;
        if (table === "bd_centros_custo") calls.ccInIds.push(v);
        return builder;
      },
      range: (from: number, to: number) => {
        calls.ranges.push([from, to]);
        const res = exec();
        const data = Array.isArray(res.data) ? res.data.slice(from, to + 1) : res.data;
        return Promise.resolve({ ...res, data });
      },
      then: (resolve: (v: any) => unknown) => resolve(exec()),
    };
    return builder;
  };

  return { supabase: { from: (table: string) => makeBuilder(table) } };
});

import {
  fetchAtivosReconciliados,
  filtrarAtivosReconciliados,
  fetchEstadoOperacionalAtivo,
  CargaAtivosIncompletaError,
  ATIVOS_PAGE_SIZE,
} from "../disponibilidadeEquipamentoService";
import { filtrarAtivosPorBusca } from "../centralTransporteService";
import {
  casaBusca,
  montarTextoBusca,
  rotuloCentroCusto,
  SEM_CENTRO_CUSTO_LABEL,
  CENTRO_CUSTO_NAO_LOCALIZADO_LABEL,
} from "@/lib/ativos/reconciliacaoOperacional";

/** Linha real da tabela — sem colunas fantasma de Centro de Custo. */
const ativo = (over: Partial<AtivoRow> = {}): AtivoRow => ({
  id: over.id ?? "e1",
  frota: "LYC",
  numero_frota: "001",
  placa: "KMT6874",
  situacao: "Disponível",
  capacidade_valor: 10,
  capacidade_unidade: null,
  empresa_id: "emp-1",
  tipo_equipamento_id: "tp-1",
  centro_custo_atual_id: "cc-1",
  centro_custo_atual_origem: "CADASTRO",
  empresa: { nome_empresa: "Lytorânea" },
  tipo_equipamento: { descricao_padronizada: "Caminhão" },
  ...over,
});

/** Cadastro de Centro de Custo usado no enriquecimento em lote. */
const centroCusto = (over: Partial<Record<string, any>> = {}): Record<string, any> => ({
  id: "cc-1",
  codigo_centro_custo: "CC-1",
  nome_centro_custo: "OBRA TESTE GEO",
  departamento_id: "dep-1",
  departamento: { nome_departamento: "Operações" },
  ...over,
});

const disp = (over: Partial<DispRow> = {}): DispRow => ({
  id: "d1",
  equipamento_id: "e1",
  status_operacional: "ALOCADO",
  centro_custo_id: "cc-1",
  data_inicio: null,
  previsao_liberacao: null,
  confiabilidade_previsao: null,
  motivo_risco: null,
  observacao: null,
  created_at: null,
  updated_at: null,
  ...over,
});

beforeEach(() => {
  db.ativos = [];
  db.disponibilidades = [];
  db.centrosCusto = [centroCusto()];
  db.countOverride = null;
  calls.ativosSelects = 0;
  calls.dispSelects = 0;
  calls.ccSelects = 0;
  calls.ranges = [];
  calls.selectCols = [];
  calls.ccInIds = [];
});

const projecaoAtivos = (): string =>
  calls.selectCols
    .filter((c) => c.table === "bd_caminhoes_equipamentos" && c.cols.includes("frota"))
    .map((c) => c.cols)
    .join("\n");

describe("D1 / F1 — projeção Supabase sem colunas fantasma", () => {
  it("select de bd_caminhoes_equipamentos não contém centro_custo_atual_codigo", async () => {
    db.ativos = [ativo({ id: "e1" })];
    await fetchAtivosReconciliados();
    expect(projecaoAtivos()).not.toContain("centro_custo_atual_codigo");
  });

  it("select de bd_caminhoes_equipamentos não contém centro_custo_atual_nome", async () => {
    db.ativos = [ativo({ id: "e1" })];
    await fetchAtivosReconciliados();
    expect(projecaoAtivos()).not.toContain("centro_custo_atual_nome");
  });

  it("select usa centro_custo_atual_id", async () => {
    db.ativos = [ativo({ id: "e1" })];
    await fetchAtivosReconciliados();
    expect(projecaoAtivos()).toContain("centro_custo_atual_id");
  });

  it("select usa centro_custo_atual_origem", async () => {
    db.ativos = [ativo({ id: "e1" })];
    await fetchAtivosReconciliados();
    expect(projecaoAtivos()).toContain("centro_custo_atual_origem");
  });

  it("carga de 817 ativos não gera erro de coluna inexistente", async () => {
    db.ativos = Array.from({ length: 817 }, (_, i) => ativo({ id: `e${i}` }));
    const u = await fetchAtivosReconciliados();
    expect(u.totalReconciliados).toBe(817);
    expect(projecaoAtivos()).not.toContain("centro_custo_atual_codigo");
  });
});

describe("D1 / F1 — enriquecimento de Centro de Custo em lote", () => {
  it("Centro de Custo é resolvido em lote, sem N+1", async () => {
    db.ativos = Array.from({ length: 250 }, (_, i) => ativo({ id: `e${i}` }));
    await fetchAtivosReconciliados();
    expect(calls.ccSelects).toBe(1);
    expect(calls.ccInIds).toEqual([["cc-1"]]);
  });

  it("ativo com CC localizado recebe código e nome", async () => {
    db.ativos = [ativo({ id: "e1" })];
    const u = await fetchAtivosReconciliados();
    expect(u.ativos[0].centroCustoAtualCodigo).toBe("CC-1");
    expect(u.ativos[0].centroCustoAtualNome).toBe("OBRA TESTE GEO");
    expect(u.ativos[0].referenciaCentroCustoNaoResolvida).toBe(false);
    expect(rotuloCentroCusto(u.ativos[0])).toBe("CC-1 — OBRA TESTE GEO");
  });

  it("LYC001 recebe o Centro de Custo do cadastro", async () => {
    db.ativos = [ativo({ id: "lyc001", frota: "LYC", numero_frota: "001" })];
    const u = await fetchAtivosReconciliados();
    const lyc = u.ativos.find((a) => a.equipamentoId === "lyc001")!;
    expect(lyc.centroCustoAtualNome).toBe("OBRA TESTE GEO");
    expect(lyc.statusOperacional).toBe("SEM_STATUS");
    expect(lyc.situacaoCadastral).toBe("Disponível");
  });

  it("ID NULL mostra “Sem Centro de Custo confirmado”", async () => {
    db.ativos = [ativo({ id: "e1", centro_custo_atual_id: null })];
    const u = await fetchAtivosReconciliados();
    expect(u.ativos[0].possuiCentroCustoAtual).toBe(false);
    expect(u.ativos[0].referenciaCentroCustoNaoResolvida).toBe(false);
    expect(rotuloCentroCusto(u.ativos[0])).toBe(SEM_CENTRO_CUSTO_LABEL);
  });

  it("ID preenchido e não resolvido mostra “Centro de Custo não localizado”", async () => {
    db.ativos = [ativo({ id: "e1", centro_custo_atual_id: "cc-orfao" })];
    const u = await fetchAtivosReconciliados();
    expect(u.ativos[0].possuiCentroCustoAtual).toBe(true);
    expect(u.ativos[0].referenciaCentroCustoNaoResolvida).toBe(true);
    expect(rotuloCentroCusto(u.ativos[0])).toBe(CENTRO_CUSTO_NAO_LOCALIZADO_LABEL);
  });

  it("departamento vem do mesmo enriquecimento em lote", async () => {
    db.ativos = [ativo({ id: "e1" })];
    const u = await fetchAtivosReconciliados();
    expect(u.ativos[0].departamentoNome).toBe("Operações");
  });
});

describe("D1 / F1 — universo reconciliado", () => {
  it("universo inicial vem de bd_caminhoes_equipamentos", async () => {
    db.ativos = [ativo({ id: "e1" }), ativo({ id: "e2" })];
    db.disponibilidades = []; // nenhuma linha operacional
    const u = await fetchAtivosReconciliados();
    expect(u.totalAtivos).toBe(2);
    expect(u.ativos.map((a) => a.equipamentoId).sort()).toEqual(["e1", "e2"]);
  });

  it("ativo sem linha operacional aparece na lista", async () => {
    db.ativos = [ativo({ id: "e1" })];
    const u = await fetchAtivosReconciliados();
    expect(u.ativos).toHaveLength(1);
    expect(u.ativos[0].possuiRegistroDisponibilidade).toBe(false);
  });

  it("ativo sem linha operacional recebe SEM_STATUS", async () => {
    db.ativos = [ativo({ id: "e1" })];
    const u = await fetchAtivosReconciliados();
    expect(u.ativos[0].statusOperacional).toBe("SEM_STATUS");
    expect(u.totalSemStatus).toBe(1);
  });

  it("ativo sem centro de custo aparece na lista", async () => {
    db.ativos = [ativo({ id: "e1", centro_custo_atual_id: null })];
    const u = await fetchAtivosReconciliados();
    expect(u.ativos).toHaveLength(1);
    expect(u.ativos[0].possuiCentroCustoAtual).toBe(false);
    expect(u.totalSemCentroCusto).toBe(1);
  });

  it("filtro Disponível exclui SEM_STATUS", async () => {
    db.ativos = [ativo({ id: "e1" }), ativo({ id: "e2" })];
    db.disponibilidades = [disp({ id: "d1", equipamento_id: "e2", status_operacional: "DISPONIVEL" })];
    const u = await fetchAtivosReconciliados();
    const out = filtrarAtivosReconciliados(u.ativos, { status_operacional: "DISPONIVEL" });
    expect(out.map((a) => a.equipamentoId)).toEqual(["e2"]);
  });

  it("filtro Sem status inclui apenas ausência de linha operacional", async () => {
    db.ativos = [ativo({ id: "e1" }), ativo({ id: "e2" })];
    db.disponibilidades = [disp({ equipamento_id: "e2" })];
    const u = await fetchAtivosReconciliados();
    const out = filtrarAtivosReconciliados(u.ativos, { status_operacional: "SEM_STATUS" });
    expect(out.map((a) => a.equipamentoId)).toEqual(["e1"]);
  });

  it("filtro Sem Centro de Custo independe do status", async () => {
    db.ativos = [
      ativo({ id: "e1", centro_custo_atual_id: null }),
      ativo({ id: "e2", centro_custo_atual_id: null }),
      ativo({ id: "e3" }),
    ];
    db.disponibilidades = [disp({ equipamento_id: "e2", status_operacional: "MANUTENCAO" })];
    const u = await fetchAtivosReconciliados();
    const out = filtrarAtivosReconciliados(u.ativos, { somenteSemCentroCusto: true });
    expect(out.map((a) => a.equipamentoId).sort()).toEqual(["e1", "e2"]);
  });

  it("situação cadastral não vira status operacional", async () => {
    db.ativos = [ativo({ id: "e1", situacao: "Em Manutenção" })];
    const u = await fetchAtivosReconciliados();
    expect(u.ativos[0].situacaoCadastral).toBe("Em Manutenção");
    expect(u.ativos[0].statusOperacional).toBe("SEM_STATUS");
  });

  it("conflito cadastral é sinalizado", async () => {
    db.ativos = [ativo({ id: "e1", situacao: "Em Manutenção" })];
    db.disponibilidades = [disp({ equipamento_id: "e1", status_operacional: "DISPONIVEL" })];
    const u = await fetchAtivosReconciliados();
    expect(u.ativos[0].possuiConflitoCadastral).toBe(true);
    expect(u.totalConflitoCadastral).toBe(1);
  });

  it("múltiplos lotes não perdem registros", async () => {
    const total = ATIVOS_PAGE_SIZE + 137;
    db.ativos = Array.from({ length: total }, (_, i) => ativo({ id: `e${i}` }));
    const u = await fetchAtivosReconciliados();
    expect(u.totalCarregados).toBe(total);
    expect(u.totalReconciliados).toBe(total);
    expect(u.paginasCarregadas).toBe(2);
    expect(calls.ranges.length).toBe(2);
  });

  it("total divergente gera erro de carregamento", async () => {
    db.ativos = [ativo({ id: "e1" })];
    db.countOverride = 5; // banco diz 5, carga trouxe 1
    await expect(fetchAtivosReconciliados()).rejects.toBeInstanceOf(CargaAtivosIncompletaError);
  });

  it("registro mais recente por updated_at", async () => {
    db.ativos = [ativo({ id: "e1" })];
    db.disponibilidades = [
      disp({ id: "d1", status_operacional: "ALOCADO", updated_at: "2026-01-01T00:00:00Z" }),
      disp({ id: "d2", status_operacional: "MANUTENCAO", updated_at: "2026-05-01T00:00:00Z" }),
    ];
    const u = await fetchAtivosReconciliados();
    expect(u.ativos[0].statusOperacional).toBe("MANUTENCAO");
    expect(u.ativos[0].disponibilidadeId).toBe("d2");
  });

  it("empate de updated_at desempata por created_at", async () => {
    db.ativos = [ativo({ id: "e1" })];
    db.disponibilidades = [
      disp({ id: "d1", status_operacional: "ALOCADO", created_at: "2026-01-01T00:00:00Z" }),
      disp({ id: "d2", status_operacional: "INDISPONIVEL", created_at: "2026-03-01T00:00:00Z" }),
    ];
    const u = await fetchAtivosReconciliados();
    expect(u.ativos[0].disponibilidadeId).toBe("d2");
    expect(u.ativos[0].statusOperacional).toBe("INDISPONIVEL");
  });

  it("empate completo desempata por id", async () => {
    db.ativos = [ativo({ id: "e1" })];
    db.disponibilidades = [
      disp({ id: "d-a", status_operacional: "ALOCADO" }),
      disp({ id: "d-z", status_operacional: "DISPONIVEL" }),
    ];
    const u = await fetchAtivosReconciliados();
    expect(u.ativos[0].disponibilidadeId).toBe("d-z");
  });

  it("enriquecimento em lote não faz N+1", async () => {
    db.ativos = Array.from({ length: 250 }, (_, i) => ativo({ id: `e${i}` }));
    await fetchAtivosReconciliados();
    // 250 ativos ⇒ 1 chunk de disponibilidades (chunk = 300), nunca 250 consultas.
    expect(calls.dispSelects).toBe(1);
  });

  it("busca encontra LYC001", async () => {
    db.ativos = [ativo({ id: "e1" }), ativo({ id: "e2", frota: "XPT", numero_frota: "999", placa: "AAA1111" })];
    const u = await fetchAtivosReconciliados();
    const out = filtrarAtivosReconciliados(u.ativos, { busca: "LYC001" });
    expect(out.map((a) => a.equipamentoId)).toEqual(["e1"]);
  });

  it("busca encontra KMT6874", async () => {
    db.ativos = [ativo({ id: "e1" }), ativo({ id: "e2", frota: "XPT", numero_frota: "999", placa: "AAA1111" })];
    const u = await fetchAtivosReconciliados();
    const out = filtrarAtivosReconciliados(u.ativos, { busca: "kmt6874" });
    expect(out.map((a) => a.equipamentoId)).toEqual(["e1"]);
  });

  it("paginação visual não elimina resultados", async () => {
    db.ativos = Array.from({ length: 45 }, (_, i) => ativo({ id: `e${i}` }));
    const u = await fetchAtivosReconciliados();
    const filtrados = filtrarAtivosReconciliados(u.ativos, {});
    const PAGE = 10;
    const paginado: string[] = [];
    for (let p = 0; p * PAGE < filtrados.length; p += 1) {
      paginado.push(...filtrados.slice(p * PAGE, (p + 1) * PAGE).map((a) => a.equipamentoId));
    }
    expect(paginado).toHaveLength(45);
    expect(new Set(paginado).size).toBe(45);
  });

  it("Central do Transporte usa a mesma reconciliação", () => {
    const texto = montarTextoBusca(["LYC", "001", "KMT6874", "Lytorânea"]);
    expect(casaBusca(texto, "lytoranea")).toBe(true);
    const out = filtrarAtivosPorBusca(
      [{ texto_busca: texto } as any, { texto_busca: montarTextoBusca(["XPT"]) } as any],
      "lytoranea",
    );
    expect(out).toHaveLength(1);
  });

  it("CT-1 sem regressão", () => {
    // Busca vazia devolve a lista intacta (comportamento CT-1 do funil de candidatos).
    const lista = [{ texto_busca: montarTextoBusca(["A"]) } as any, { texto_busca: montarTextoBusca(["B"]) } as any];
    expect(filtrarAtivosPorBusca(lista, "")).toHaveLength(2);
  });

  it("CT-2/M4 sem regressão", async () => {
    // Estado operacional individual não infere status a partir de `situacao`.
    db.ativos = [ativo({ id: "e1", situacao: "Disponível" })];
    const estado = await fetchEstadoOperacionalAtivo("e1");
    expect(estado.possuiRegistroDisponibilidade).toBe(false);
    expect(estado.statusOperacional).toBe("SEM_STATUS");
  });
});
