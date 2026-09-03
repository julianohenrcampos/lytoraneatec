import { describe, it, expect, beforeEach, vi } from "vitest";

/* --------------------------------------------------------------
 * Mock encadeável do supabase-js suficiente para os métodos usados
 * por fetchAnaliseOperacional: from, select, eq, in, order, maybeSingle
 * e rpc (fn_veiculos_alocacao_atual).
 * -------------------------------------------------------------- */

type Handler = (state: { filters: Array<[string, unknown]> }) => { data: unknown; error: unknown };
type RpcHandler = (args: Record<string, unknown>) => unknown;

const handlers: Record<string, Handler> = {};
const rpcHandlers: Record<string, RpcHandler> = {};
const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];

vi.mock("@/integrations/supabase/client", () => {
  const makeBuilder = (table: string) => {
    const state = { filters: [] as Array<[string, unknown]> };

    const exec = () => {
      const h = handlers[table];
      if (!h) return { data: [], error: null };
      return h(state);
    };

    const builder: Record<string, unknown> = {
      select: () => builder,
      order: () => builder,
      eq: (col: string, val: unknown) => {
        state.filters.push([col, val]);
        return builder;
      },
      in: (col: string, val: unknown) => {
        state.filters.push([col, val]);
        return builder;
      },
      maybeSingle: async () => exec(),
      then: (resolve: (v: ReturnType<typeof exec>) => unknown) => resolve(exec()),
    };
    return builder;
  };

  return {
    supabase: {
      from: (table: string) => makeBuilder(table),
      rpc: async (fn: string, args: Record<string, unknown>) => {
        rpcCalls.push({ fn, args });
        const h = rpcHandlers[fn];
        if (!h) return { data: [], error: null };
        return h(args);
      },
    },
  };
});

import {
  fetchAnaliseOperacional,
  normUnid,
  normPropriedade,
  canon,
  resolverPropriedadeCanonica,
  normStatusOperacional,
  isAccessDenied,
} from "@/services/centralTransporteService";

const resetHandlers = () => {
  for (const k of Object.keys(handlers)) delete handlers[k];
  for (const k of Object.keys(rpcHandlers)) delete rpcHandlers[k];
  rpcCalls.length = 0;
};

beforeEach(() => {
  resetHandlers();
});

const eqRow = (over: Record<string, unknown>) => ({
  id: "eq", frota: null, numero_frota: null, placa: null, imagem_url: null,
  proprietario_tipo: null, empresa_locadora_id: null,
  capacidade_valor: null, capacidade_unidade: null,
  empresa: null, empresa_locadora: null, frota_ref: null,
  ...over,
});

/* ================ Helpers puros ================ */

describe("canon", () => {
  it("remove diacríticos, trim e uppercase", () => {
    expect(canon(" Próprio ")).toBe("PROPRIO");
    expect(canon("Locação")).toBe("LOCACAO");
    expect(canon(null)).toBe("");
  });
});

describe("normUnid", () => {
  it("normaliza para uppercase e trim", () => {
    expect(normUnid(" ton ")).toBe("TON");
    expect(normUnid("m3")).toBe("M3");
  });
  it("retorna null para vazio", () => {
    expect(normUnid("")).toBeNull();
    expect(normUnid(null)).toBeNull();
    expect(normUnid(undefined)).toBeNull();
  });
  it("NÃO faz equivalência T -> TON", () => {
    expect(normUnid("T")).toBe("T");
    expect(normUnid("t")).toBe("T");
    expect(normUnid("TON")).toBe("TON");
  });
});

describe("normPropriedade", () => {
  it("aceita variações de PROPRIA inclusive acentuadas", () => {
    expect(normPropriedade("PROPRIO")).toBe("PROPRIA");
    expect(normPropriedade("Próprio")).toBe("PROPRIA");
    expect(normPropriedade("PRÓPRIA")).toBe("PROPRIA");
    expect(normPropriedade("propria")).toBe("PROPRIA");
  });
  it("aceita GRUPO", () => {
    expect(normPropriedade("grupo")).toBe("GRUPO");
    expect(normPropriedade("GRUPO")).toBe("GRUPO");
  });
  it("aceita LOCADO e sinônimos", () => {
    expect(normPropriedade("Locado")).toBe("LOCADO");
    expect(normPropriedade("TERCEIRO")).toBe("LOCADO");
    expect(normPropriedade("LOCAÇÃO")).toBe("LOCADO");
  });
  it("cai em NAO_CLASSIFICADO para valores desconhecidos", () => {
    expect(normPropriedade("xyz")).toBe("NAO_CLASSIFICADO");
    expect(normPropriedade(null)).toBe("NAO_CLASSIFICADO");
  });
});

describe("resolverPropriedadeCanonica — precedência", () => {
  it('proprietario_tipo "Próprio" vence frota LOCADO', () => {
    expect(
      resolverPropriedadeCanonica({
        proprietario_tipo: "Próprio",
        frota_ref: { tipo_propriedade_padrao: "LOCADO" },
      }),
    ).toBe("PROPRIA");
  });
  it("frota só é usada quando proprietario_tipo é nulo", () => {
    expect(
      resolverPropriedadeCanonica({
        proprietario_tipo: null,
        frota_ref: { tipo_propriedade_padrao: "LOCADO" },
      }),
    ).toBe("LOCADO");
  });
  it("empresa_locadora_id é o último fallback", () => {
    expect(resolverPropriedadeCanonica({ empresa_locadora_id: "loc-1" })).toBe("LOCADO");
    expect(resolverPropriedadeCanonica({})).toBe("NAO_CLASSIFICADO");
  });
});

describe("normStatusOperacional", () => {
  it("SEM_STATUS quando não há linha de disponibilidade", () => {
    expect(normStatusOperacional(false, null)).toBe("SEM_STATUS");
  });
  it("DESCONHECIDO quando há linha mas status é nulo/irreconhecível", () => {
    expect(normStatusOperacional(true, null)).toBe("DESCONHECIDO");
    expect(normStatusOperacional(true, "abc")).toBe("DESCONHECIDO");
  });
  it("reconhece os status canônicos", () => {
    expect(normStatusOperacional(true, "disponivel")).toBe("DISPONIVEL");
    expect(normStatusOperacional(true, "Manutenção")).toBe("MANUTENCAO");
  });
});

describe("isAccessDenied", () => {
  it("detecta 42501, RLS e permission denied", () => {
    expect(isAccessDenied({ code: "42501" })).toBe(true);
    expect(isAccessDenied({ message: "permission denied for table x" })).toBe(true);
    expect(isAccessDenied({ message: "RLS blocked" })).toBe(true);
    expect(isAccessDenied({ message: "some other error" })).toBe(false);
    expect(isAccessDenied(null)).toBe(false);
  });
});

/* ================ CT-1 — visibilidade e reconciliação ================ */

describe("CT-1 — classificação por propriedade independente do status", () => {
  const semDisponibilidade = () => {
    handlers.bd_disponibilidade_equipamentos = () => ({ data: [], error: null });
    handlers.bd_portfolio_empresas = () => ({ data: [], error: null });
  };

  it("A) PROPRIA sem linha de disponibilidade permanece em Própria com SEM_STATUS", async () => {
    handlers.bd_caminhoes_equipamentos = () => ({
      data: [eqRow({ id: "a1", proprietario_tipo: "proprio" })], error: null,
    });
    semDisponibilidade();
    const r = await fetchAnaliseOperacional({ catalogoEquipamentoId: "cat" });
    expect(r.disponibilidadePropria).toHaveLength(1);
    expect(r.disponibilidadePropria[0].status_operacional).toBe("SEM_STATUS");
  });

  it("B) GRUPO sem disponibilidade permanece em Grupo", async () => {
    handlers.bd_caminhoes_equipamentos = () => ({
      data: [eqRow({ id: "b1", proprietario_tipo: "grupo" })], error: null,
    });
    semDisponibilidade();
    const r = await fetchAnaliseOperacional({ catalogoEquipamentoId: "cat" });
    expect(r.disponibilidadeGrupo).toHaveLength(1);
  });

  it("C) LOCADO sem disponibilidade permanece em Externo", async () => {
    handlers.bd_caminhoes_equipamentos = () => ({
      data: [eqRow({ id: "c1", proprietario_tipo: "locado" })], error: null,
    });
    semDisponibilidade();
    const r = await fetchAnaliseOperacional({ catalogoEquipamentoId: "cat" });
    expect(r.externoLocado).toHaveLength(1);
  });

  it("D) PROPRIA ALOCADO sem previsão permanece em Própria", async () => {
    handlers.bd_caminhoes_equipamentos = () => ({
      data: [eqRow({ id: "d1", proprietario_tipo: "proprio" })], error: null,
    });
    handlers.bd_disponibilidade_equipamentos = () => ({
      data: [{
        equipamento_id: "d1", status_operacional: "ALOCADO", previsao_liberacao: null,
        confiabilidade_previsao: null, centro_custo_id: null, updated_at: null,
        created_at: null, centro_custo: null,
      }],
      error: null,
    });
    handlers.bd_portfolio_empresas = () => ({ data: [], error: null });
    const r = await fetchAnaliseOperacional({ catalogoEquipamentoId: "cat" });
    expect(r.disponibilidadePropria).toHaveLength(1);
    expect(r.disponibilidadePropria[0].status_operacional).toBe("ALOCADO");
    expect(r.equipamentosComPrevisao).toHaveLength(0);
  });

  it("E) PROPRIA com previsão aparece em Própria E em Previsão (visão derivada)", async () => {
    handlers.bd_caminhoes_equipamentos = () => ({
      data: [eqRow({ id: "e1", proprietario_tipo: "proprio" })], error: null,
    });
    handlers.bd_disponibilidade_equipamentos = () => ({
      data: [{
        equipamento_id: "e1", status_operacional: "MANUTENCAO", previsao_liberacao: "2026-08-10",
        confiabilidade_previsao: "alta", centro_custo_id: null, updated_at: null,
        created_at: null, centro_custo: null,
      }],
      error: null,
    });
    handlers.bd_portfolio_empresas = () => ({ data: [], error: null });
    const r = await fetchAnaliseOperacional({ catalogoEquipamentoId: "cat" });
    expect(r.disponibilidadePropria).toHaveLength(1);
    expect(r.equipamentosComPrevisao).toHaveLength(1);
    expect(r.totalCandidatos).toBe(1);
    expect(r.reconciliacao_ok).toBe(true);
  });

  it('F) "Próprio" acentuado com frota LOCADO é classificado como PROPRIA', async () => {
    handlers.bd_caminhoes_equipamentos = () => ({
      data: [eqRow({
        id: "f1", proprietario_tipo: "Próprio",
        frota_ref: { tipo_propriedade_padrao: "LOCADO" },
      })],
      error: null,
    });
    semDisponibilidade();
    const r = await fetchAnaliseOperacional({ catalogoEquipamentoId: "cat" });
    expect(r.disponibilidadePropria).toHaveLength(1);
    expect(r.disponibilidadePropria[0].propriedade).toBe("PROPRIA");
    expect(r.externoLocado).toHaveLength(0);
  });

  it("G/H) fixture real 66 = 24 própria + 0 grupo + 42 externo + 0 não classificado, sem duplicatas", async () => {
    const rows = [
      ...Array.from({ length: 42 }, (_, i) =>
        eqRow({ id: `loc${i}`, proprietario_tipo: "locado", frota_ref: { tipo_propriedade_padrao: "LOCADO" } })),
      ...Array.from({ length: 22 }, (_, i) =>
        eqRow({ id: `pro${i}`, proprietario_tipo: "proprio", frota_ref: { tipo_propriedade_padrao: "PROPRIO" } })),
      eqRow({ id: "acentuado", proprietario_tipo: "Próprio", frota_ref: { tipo_propriedade_padrao: "LOCADO" } }),
      eqRow({ id: "semFrota", proprietario_tipo: "proprio", frota_ref: null }),
    ];
    handlers.bd_caminhoes_equipamentos = () => ({ data: rows, error: null });
    handlers.bd_disponibilidade_equipamentos = () => ({
      data: [{
        equipamento_id: "pro0", status_operacional: "ALOCADO", previsao_liberacao: null,
        confiabilidade_previsao: null, centro_custo_id: null, updated_at: null,
        created_at: null, centro_custo: null,
      }],
      error: null,
    });
    handlers.bd_portfolio_empresas = () => ({ data: [], error: null });

    const r = await fetchAnaliseOperacional({ subcategoriaId: "sub-basculante" });

    expect(r.totalCandidatos).toBe(66);
    expect(r.disponibilidadePropria).toHaveLength(24);
    expect(r.disponibilidadeGrupo).toHaveLength(0);
    expect(r.externoLocado).toHaveLength(42);
    expect(r.naoClassificado).toHaveLength(0);
    expect(
      r.disponibilidadePropria.length + r.disponibilidadeGrupo.length +
      r.externoLocado.length + r.naoClassificado.length,
    ).toBe(r.totalCandidatos);
    expect(r.reconciliacao_ok).toBe(true);
    expect(r.resumo.sem_status).toBe(65);
    expect(r.disponibilidadePropria.filter((a) => a.status_operacional === "ALOCADO")).toHaveLength(1);

    // H) nenhum equipamento duplicado dentro da classificação primária
    const ids = [...r.disponibilidadePropria, ...r.disponibilidadeGrupo, ...r.externoLocado, ...r.naoClassificado]
      .map((a) => a.equipamento_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("K) 22 TON com ativos sem capacidade → matching PARCIAL sem equivalência silenciosa", async () => {
    const rows = [
      ...Array.from({ length: 65 }, (_, i) => eqRow({ id: `x${i}`, proprietario_tipo: "locado" })),
      eqRow({ id: "comCap", proprietario_tipo: "proprio", capacidade_valor: 22, capacidade_unidade: null }),
    ];
    handlers.bd_caminhoes_equipamentos = (s) => {
      const hasCap = s.filters.some(([c]) => c === "capacidade_valor");
      if (hasCap) return { data: [], error: null };
      return { data: rows, error: null };
    };
    handlers.bd_disponibilidade_equipamentos = () => ({ data: [], error: null });
    handlers.bd_portfolio_empresas = () => ({ data: [], error: null });

    const r = await fetchAnaliseOperacional({
      subcategoriaId: "sub-1", capacidadeValor: 22, capacidadeUnidade: "TON",
    });
    expect(r.matchingUsed).toBe("subcategoria");
    expect(r.resumo.compatibilidade).toBe("PARCIAL");
    expect(r.diagnosticoCapacidade).toEqual({
      candidatos: 66,
      sem_capacidade: 65,
      com_valor_sem_unidade: 1,
      correspondencia_exata: 0,
      capacidade_solicitada_valor: 22,
      capacidade_solicitada_unidade: "TON",
    });
  });
});

describe("CT-1 — CC atual pela projeção autoritativa", () => {
  it("I/J) uma única chamada batch e CC vindo da projeção (não da disponibilidade)", async () => {
    handlers.bd_caminhoes_equipamentos = () => ({
      data: [
        eqRow({ id: "v1", proprietario_tipo: "proprio" }),
        eqRow({ id: "v1", proprietario_tipo: "proprio" }), // duplicado defensivo
        eqRow({ id: "v2", proprietario_tipo: "locado" }),
      ],
      error: null,
    });
    handlers.bd_disponibilidade_equipamentos = () => ({
      data: [{
        equipamento_id: "v1", status_operacional: "DISPONIVEL", previsao_liberacao: null,
        confiabilidade_previsao: null, centro_custo_id: "cc-antigo", updated_at: null,
        created_at: null, centro_custo: { nome_centro_custo: "CC ANTIGO" },
      }],
      error: null,
    });
    handlers.bd_portfolio_empresas = () => ({ data: [], error: null });
    rpcHandlers.fn_veiculos_alocacao_atual = () => ({
      data: [{
        equipamento_id: "v1",
        centro_custo_atual_id: "cc-novo",
        centro_custo_atual_codigo: "L521",
        centro_custo_atual_nome: "CC NOVO",
        centro_custo_origem: "APONTAMENTO_CE",
        centro_custo_atualizado_em: "2026-07-20T00:00:00Z",
      }],
      error: null,
    });

    const r = await fetchAnaliseOperacional({ catalogoEquipamentoId: "cat" });

    const chamadas = rpcCalls.filter((c) => c.fn === "fn_veiculos_alocacao_atual");
    expect(chamadas).toHaveLength(1);
    const ids = chamadas[0].args.p_equipamento_ids as string[];
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(["v1", "v2"]);

    const v1 = r.disponibilidadePropria[0];
    expect(v1.centro_custo_nome).toBe("CC NOVO");
    expect(v1.centro_custo_origem).toBe("APONTAMENTO_CE");
    expect(v1.centro_custo_disponibilidade_nome).toBe("CC ANTIGO");
    expect(r.externoLocado[0].centro_custo_nome).toBeNull();
    expect(r.localizacao_disponivel).toBe(true);
  });

  it("fail-soft: Promise rejeitada mantém a análise e marca localizacao_disponivel = false", async () => {
    const rows = Array.from({ length: 66 }, (_, i) =>
      eqRow({ id: `z${i}`, proprietario_tipo: i < 24 ? "proprio" : "locado" }));
    handlers.bd_caminhoes_equipamentos = () => ({ data: rows, error: null });
    handlers.bd_disponibilidade_equipamentos = () => ({ data: [], error: null });
    handlers.bd_portfolio_empresas = () => ({ data: [], error: null });
    rpcHandlers.fn_veiculos_alocacao_atual = () => {
      throw new Error("network failure");
    };

    const r = await fetchAnaliseOperacional({ subcategoriaId: "sub-1" });
    expect(r.totalCandidatos).toBe(66);
    expect(r.disponibilidadePropria).toHaveLength(24);
    expect(r.externoLocado).toHaveLength(42);
    expect(r.localizacao_disponivel).toBe(false);
    expect(r.reconciliacao_ok).toBe(true);
    expect(r.status).not.toBe("acesso_negado");
  });

  it("erro transitório da RPC não bloqueia a análise", async () => {
    handlers.bd_caminhoes_equipamentos = () => ({
      data: [eqRow({ id: "t1", proprietario_tipo: "proprio" })], error: null,
    });
    handlers.bd_disponibilidade_equipamentos = () => ({ data: [], error: null });
    handlers.bd_portfolio_empresas = () => ({ data: [], error: null });
    rpcHandlers.fn_veiculos_alocacao_atual = () => ({ data: null, error: { message: "timeout" } });

    const r = await fetchAnaliseOperacional({ catalogoEquipamentoId: "cat" });
    expect(r.disponibilidadePropria).toHaveLength(1);
    expect(r.localizacao_disponivel).toBe(false);
  });

  it("acesso negado comprovado na RPC encerra com acesso_negado", async () => {
    handlers.bd_caminhoes_equipamentos = () => ({
      data: [eqRow({ id: "t2", proprietario_tipo: "proprio" })], error: null,
    });
    handlers.bd_disponibilidade_equipamentos = () => ({ data: [], error: null });
    handlers.bd_portfolio_empresas = () => ({ data: [], error: null });
    rpcHandlers.fn_veiculos_alocacao_atual = () => ({
      data: null, error: { code: "42501", message: "permission denied" },
    });

    const r = await fetchAnaliseOperacional({ catalogoEquipamentoId: "cat" });
    expect(r.status).toBe("acesso_negado");
  });
});


/* ================ fetchAnaliseOperacional ================ */

describe("fetchAnaliseOperacional — sem filtros", () => {
  it("retorna item_sem_classificacao quando nenhum campo classificador é passado", async () => {
    const r = await fetchAnaliseOperacional({});
    expect(r.status).toBe("item_sem_classificacao");
    expect(r.matchingUsed).toBe("nenhum");
  });
});

describe("fetchAnaliseOperacional — cascata de matching", () => {
  it("A) Matching por catalogo_equipamento_id → EXATA / catalogo", async () => {
    handlers.bd_caminhoes_equipamentos = (s) => {
      // só responde quando o filtro é catalogo_equipamento_id
      if (s.filters.some(([c]) => c === "catalogo_equipamento_id")) {
        return {
          data: [{
            id: "eq1", frota: null, numero_frota: "10", placa: null, imagem_url: null,
            proprietario_tipo: "proprio", empresa_locadora_id: null,
            capacidade_valor: 5, capacidade_unidade: "TON",
            empresa: null, empresa_locadora: null, frota_ref: null,
          }],
          error: null,
        };
      }
      return { data: [], error: null };
    };
    handlers.bd_disponibilidade_equipamentos = () => ({
      data: [{
        equipamento_id: "eq1", status_operacional: "DISPONIVEL",
        previsao_liberacao: null, confiabilidade_previsao: null,
        centro_custo_id: "cc1", updated_at: "2026-07-15T10:00:00Z",
        created_at: "2026-07-15T10:00:00Z",
        centro_custo: { nome_centro_custo: "CC-1" },
      }],
      error: null,
    });
    handlers.bd_portfolio_empresas = () => ({ data: [], error: null });

    const r = await fetchAnaliseOperacional({ catalogoEquipamentoId: "cat-1" });
    expect(r.status).toBe("ok");
    expect(r.matchingUsed).toBe("catalogo");
    expect(r.resumo.compatibilidade).toBe("EXATA");
    expect(r.disponibilidadePropria).toHaveLength(1);
  });

  it("B) subcategoria + capacidade → EXATA / subcategoria+capacidade", async () => {
    handlers.bd_caminhoes_equipamentos = (s) => {
      const hasSub = s.filters.some(([c]) => c === "subcategoria_ativo_id");
      const hasCap = s.filters.some(([c]) => c === "capacidade_valor");
      if (hasSub && hasCap) {
        return {
          data: [{
            id: "eq2", frota: null, numero_frota: null, placa: null, imagem_url: null,
            proprietario_tipo: "grupo", empresa_locadora_id: null,
            capacidade_valor: 5, capacidade_unidade: "TON",
            empresa: null, empresa_locadora: null, frota_ref: null,
          }],
          error: null,
        };
      }
      return { data: [], error: null };
    };
    handlers.bd_disponibilidade_equipamentos = () => ({
      data: [{
        equipamento_id: "eq2", status_operacional: "DISPONIVEL",
        previsao_liberacao: null, confiabilidade_previsao: null,
        centro_custo_id: null, updated_at: null, created_at: null,
        centro_custo: null,
      }],
      error: null,
    });
    handlers.bd_portfolio_empresas = () => ({ data: [], error: null });

    const r = await fetchAnaliseOperacional({
      subcategoriaId: "sub-1", capacidadeValor: 5, capacidadeUnidade: "TON",
    });
    expect(r.matchingUsed).toBe("subcategoria+capacidade");
    expect(r.resumo.compatibilidade).toBe("EXATA");
    expect(r.disponibilidadeGrupo).toHaveLength(1);
  });

  it("C) só subcategoria → PARCIAL / subcategoria", async () => {
    handlers.bd_caminhoes_equipamentos = (s) => {
      const hasSubOnly = s.filters.length === 1 && s.filters[0][0] === "subcategoria_ativo_id";
      if (hasSubOnly) {
        return {
          data: [{
            id: "eq3", frota: null, numero_frota: null, placa: null, imagem_url: null,
            proprietario_tipo: "locado", empresa_locadora_id: "loc1",
            capacidade_valor: null, capacidade_unidade: null,
            empresa: null, empresa_locadora: null, frota_ref: null,
          }],
          error: null,
        };
      }
      return { data: [], error: null };
    };
    handlers.bd_disponibilidade_equipamentos = () => ({ data: [], error: null });
    handlers.bd_portfolio_empresas = () => ({ data: [], error: null });

    const r = await fetchAnaliseOperacional({ subcategoriaId: "sub-2" });
    expect(r.matchingUsed).toBe("subcategoria");
    expect(r.resumo.compatibilidade).toBe("PARCIAL");
    expect(r.externoLocado).toHaveLength(1);
  });

  it("D) fallback por tipo_equipamento_id → PARCIAL / tipo_equipamento", async () => {
    handlers.bd_caminhoes_equipamentos = (s) => {
      if (s.filters.some(([c]) => c === "tipo_equipamento_id")) {
        return {
          data: [{
            id: "eq4", frota: null, numero_frota: null, placa: null, imagem_url: null,
            proprietario_tipo: "proprio", empresa_locadora_id: null,
            capacidade_valor: null, capacidade_unidade: null,
            empresa: null, empresa_locadora: null, frota_ref: null,
          }],
          error: null,
        };
      }
      return { data: [], error: null };
    };
    handlers.bd_disponibilidade_equipamentos = () => ({ data: [], error: null });
    handlers.bd_portfolio_empresas = () => ({ data: [], error: null });

    const r = await fetchAnaliseOperacional({ tipoEquipamentoId: "tp-1" });
    expect(r.matchingUsed).toBe("tipo_equipamento");
    expect(r.resumo.compatibilidade).toBe("PARCIAL");
  });
});

describe("fetchAnaliseOperacional — dedup de disponibilidade", () => {
  it("registro atual ALOCADO vence registro antigo DISPONIVEL", async () => {
    handlers.bd_caminhoes_equipamentos = () => ({
      data: [{
        id: "eqDup", frota: null, numero_frota: null, placa: null, imagem_url: null,
        proprietario_tipo: "proprio", empresa_locadora_id: null,
        capacidade_valor: null, capacidade_unidade: null,
        empresa: null, empresa_locadora: null, frota_ref: null,
      }],
      error: null,
    });
    handlers.bd_disponibilidade_equipamentos = () => ({
      data: [
        // Registro antigo DISPONIVEL
        {
          equipamento_id: "eqDup", status_operacional: "DISPONIVEL",
          previsao_liberacao: null, confiabilidade_previsao: null,
          centro_custo_id: null, updated_at: "2026-01-01T00:00:00Z",
          created_at: "2026-01-01T00:00:00Z", centro_custo: null,
        },
        // Registro atual ALOCADO com previsão
        {
          equipamento_id: "eqDup", status_operacional: "ALOCADO",
          previsao_liberacao: "2026-08-01", confiabilidade_previsao: "alta",
          centro_custo_id: "cc9", updated_at: "2026-07-15T09:00:00Z",
          created_at: "2026-07-15T09:00:00Z",
          centro_custo: { nome_centro_custo: "CC-9" },
        },
      ],
      error: null,
    });
    handlers.bd_portfolio_empresas = () => ({ data: [], error: null });

    const r = await fetchAnaliseOperacional({ catalogoEquipamentoId: "cat-x" });
    // CT-1: a classificação primária é por propriedade — o ativo permanece em Própria
    expect(r.disponibilidadePropria).toHaveLength(1);
    expect(r.disponibilidadePropria[0].status_operacional).toBe("ALOCADO");
    expect(r.equipamentosComPrevisao).toHaveLength(1);
    expect(r.equipamentosComPrevisao[0].status_operacional).toBe("ALOCADO");
  });
});

describe("fetchAnaliseOperacional — precedência de propriedade", () => {
  it("proprietario_tipo tem precedência sobre frota.tipo_propriedade_padrao", async () => {
    handlers.bd_caminhoes_equipamentos = () => ({
      data: [{
        id: "eqP", frota: null, numero_frota: null, placa: null, imagem_url: null,
        proprietario_tipo: "proprio",
        empresa_locadora_id: null,
        capacidade_valor: null, capacidade_unidade: null,
        empresa: null, empresa_locadora: null,
        frota_ref: { tipo_propriedade_padrao: "LOCADO" },
      }],
      error: null,
    });
    handlers.bd_disponibilidade_equipamentos = () => ({
      data: [{
        equipamento_id: "eqP", status_operacional: "DISPONIVEL",
        previsao_liberacao: null, confiabilidade_previsao: null,
        centro_custo_id: null, updated_at: null, created_at: null, centro_custo: null,
      }],
      error: null,
    });
    handlers.bd_portfolio_empresas = () => ({ data: [], error: null });

    const r = await fetchAnaliseOperacional({ catalogoEquipamentoId: "cat-p" });
    expect(r.disponibilidadePropria).toHaveLength(1);
    expect(r.disponibilidadeGrupo).toHaveLength(0);
    expect(r.externoLocado).toHaveLength(0);
  });

  it("empresa_locadora_id força LOCADO quando outros campos são nulos", async () => {
    handlers.bd_caminhoes_equipamentos = () => ({
      data: [{
        id: "eqL", frota: null, numero_frota: null, placa: null, imagem_url: null,
        proprietario_tipo: null,
        empresa_locadora_id: "loc-9",
        capacidade_valor: null, capacidade_unidade: null,
        empresa: null, empresa_locadora: null, frota_ref: null,
      }],
      error: null,
    });
    handlers.bd_disponibilidade_equipamentos = () => ({
      data: [{
        equipamento_id: "eqL", status_operacional: "DISPONIVEL",
        previsao_liberacao: null, confiabilidade_previsao: null,
        centro_custo_id: null, updated_at: null, created_at: null, centro_custo: null,
      }],
      error: null,
    });
    handlers.bd_portfolio_empresas = () => ({ data: [], error: null });

    const r = await fetchAnaliseOperacional({ catalogoEquipamentoId: "cat-l" });
    expect(r.externoLocado).toHaveLength(1);
    expect(r.disponibilidadePropria).toHaveLength(0);
  });
});

describe("fetchAnaliseOperacional — tratamento de erros", () => {
  it("erro genérico em disponibilidade → status erro_consulta", async () => {
    handlers.bd_caminhoes_equipamentos = () => ({
      data: [{
        id: "eqE", frota: null, numero_frota: null, placa: null, imagem_url: null,
        proprietario_tipo: "proprio", empresa_locadora_id: null,
        capacidade_valor: null, capacidade_unidade: null,
        empresa: null, empresa_locadora: null, frota_ref: null,
      }],
      error: null,
    });
    handlers.bd_disponibilidade_equipamentos = () => ({
      data: null, error: { message: "network fail" },
    });
    handlers.bd_portfolio_empresas = () => ({ data: [], error: null });

    const r = await fetchAnaliseOperacional({ catalogoEquipamentoId: "cat-e" });
    expect(r.status).toBe("erro_consulta");
    expect(r.errorMessage).toBe("network fail");
  });

  it("erro 42501 em disponibilidade → status acesso_negado", async () => {
    handlers.bd_caminhoes_equipamentos = () => ({
      data: [{
        id: "eqE2", frota: null, numero_frota: null, placa: null, imagem_url: null,
        proprietario_tipo: "proprio", empresa_locadora_id: null,
        capacidade_valor: null, capacidade_unidade: null,
        empresa: null, empresa_locadora: null, frota_ref: null,
      }],
      error: null,
    });
    handlers.bd_disponibilidade_equipamentos = () => ({
      data: null, error: { code: "42501", message: "permission denied" },
    });
    handlers.bd_portfolio_empresas = () => ({ data: [], error: null });

    const r = await fetchAnaliseOperacional({ catalogoEquipamentoId: "cat-e2" });
    expect(r.status).toBe("acesso_negado");
  });

  it("sem ativos cadastrados → status sem_ativos_cadastrados", async () => {
    handlers.bd_caminhoes_equipamentos = () => ({ data: [], error: null });
    handlers.bd_portfolio_empresas = () => ({ data: [], error: null });

    const r = await fetchAnaliseOperacional({ catalogoEquipamentoId: "cat-vazio" });
    expect(r.status).toBe("sem_ativos_cadastrados");
  });
});
