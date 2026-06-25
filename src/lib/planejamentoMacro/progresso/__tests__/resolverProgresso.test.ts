import { describe, it, expect } from "vitest";
import { resolverProgresso, parsePercentualPtBR, formatarPercentualBR } from "../resolverProgresso";

describe("resolverProgresso", () => {
  it("prioriza percentual_manual sobre importado", () => {
    const r = resolverProgresso({
      status: "Em andamento",
      percentual_manual: 35.5,
      percentual_concluido_importado: 80,
    });
    expect(r.fonte).toBe("manual");
    expect(r.pct).toBe(35.5);
    expect(r.chipLabel).toBe("Manual");
  });

  it("usa importado quando não há manual", () => {
    const r = resolverProgresso({
      status: "Em andamento",
      percentual_concluido_importado: 42,
    });
    expect(r.fonte).toBe("importado");
    expect(r.pct).toBe(42);
  });

  it("aceita 0 manual como valor válido", () => {
    const r = resolverProgresso({ status: "Planejada", percentual_manual: 0 });
    expect(r.fonte).toBe("manual");
    expect(r.pct).toBe(0);
  });

  it("status Concluída sem percentual mostra chip Concluída sem inventar 100%", () => {
    const r = resolverProgresso({ status: "Concluída" });
    expect(r.fonte).toBe("concluida");
    expect(r.pct).toBeNull();
    expect(r.destacarConcluida).toBe(true);
  });

  it("sem nada retorna 'sem_apontamento'", () => {
    const r = resolverProgresso({ status: "Planejada" });
    expect(r.fonte).toBe("sem_apontamento");
    expect(r.pct).toBeNull();
  });
});

describe("parsePercentualPtBR / formatarPercentualBR", () => {
  it("converte vírgula decimal para número", () => {
    expect(parsePercentualPtBR("35,5")).toBe(35.5);
    expect(parsePercentualPtBR("0")).toBe(0);
    expect(parsePercentualPtBR("")).toBeNull();
    expect(Number.isNaN(parsePercentualPtBR("abc"))).toBe(true);
  });

  it("formata em pt-BR com 1 casa", () => {
    expect(formatarPercentualBR(35.5)).toBe("35,5%");
    expect(formatarPercentualBR(0)).toBe("0,0%");
    expect(formatarPercentualBR(null)).toBe("—");
  });
});
