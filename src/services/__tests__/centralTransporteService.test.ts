import { describe, it, expect, beforeEach, vi } from "vitest";

/* --------------------------------------------------------------
 * Mock encadeável do supabase-js suficiente para os métodos usados
 * por fetchAnaliseOperacional: from, select, eq, in, order, maybeSingle.
 * O comportamento é controlado por `handlers` por tabela.
 * -------------------------------------------------------------- */

type Handler = (state: { filters: Array<[string, unknown]> }) => { data: unknown; error: unknown };

const handlers: Record<string, Handler> = {};

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
    },
  };
});

import {
  fetchAnaliseOperacional,
  normUnid,
  normPropriedade,
  isAccessDenied,
} from "@/services/centralTransporteService";

const resetHandlers = () => {
  for (const k of Object.keys(handlers)) delete handlers[k];
};

beforeEach(() => {
  resetHandlers();
});

/* ================ Helpers puros ================ */

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
  it("aceita variações de PROPRIA", () => {
    expect(normPropriedade("proprio")).toBe("PROPRIA");
    expect(normPropriedade("PROPRIO")).toBe("PROPRIA");
    expect(normPropriedade("Própria")).toBe("PROPRIA");
  });
  it("aceita GRUPO", () => {
    expect(normPropriedade("grupo")).toBe("GRUPO");
    expect(normPropriedade("GRUPO")).toBe("GRUPO");
  });
  it("aceita LOCADO e sinônimos", () => {
    expect(normPropriedade("locado")).toBe("LOCADO");
    expect(normPropriedade("terceiro")).toBe("LOCADO");
    expect(normPropriedade("LOCAÇÃO")).toBe("LOCADO");
  });
  it("cai em NAO_CLASSIFICADO para valores desconhecidos", () => {
    expect(normPropriedade("xyz")).toBe("NAO_CLASSIFICADO");
    expect(normPropriedade(null)).toBe("NAO_CLASSIFICADO");
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
    expect(r.disponibilidadePropria).toHaveLength(0);
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
