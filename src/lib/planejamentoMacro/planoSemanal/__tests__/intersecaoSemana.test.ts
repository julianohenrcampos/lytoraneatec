import { describe, it, expect } from "vitest";
import { filtrarAtividadesDaSemana } from "../filtrarAtividadesDaSemana";
import { classificarAtividadeNaSemana } from "../classificarAtividadeNaSemana";
import { calcularSemanaDaData } from "../calcularSemana";
import type { AtividadeBruta } from "../tipos";

function ativ(over: Partial<AtividadeBruta>): AtividadeBruta {
  return {
    id: "a1",
    planejamento_id: "p",
    codigo_wbs: null,
    outline_number: null,
    outline_level: null,
    nome: "X",
    frente_servico: null,
    data_inicio: "2026-07-13",
    data_fim: "2026-07-17",
    status: "planejada",
    is_marco: false,
    is_resumo: false,
    duracao_horas: 40,
    quantidade_prevista: null,
    unidade: null,
    ...over,
  };
}

describe("filtrarAtividadesDaSemana — interseção (7A)", () => {
  const semana = calcularSemanaDaData("2026-07-15"); // 2026-07-13 → 2026-07-19

  it("inclui atividade que apenas começa antes e termina na semana", () => {
    const r = filtrarAtividadesDaSemana(
      [ativ({ data_inicio: "2026-07-10", data_fim: "2026-07-15" })],
      semana,
    );
    expect(r.length).toBe(1);
    expect(r[0].flags).toContain("termina_semana");
  });

  it("inclui atividade longa em andamento (não inicia nem termina na semana)", () => {
    const r = filtrarAtividadesDaSemana(
      [ativ({ data_inicio: "2026-07-01", data_fim: "2026-08-01" })],
      semana,
    );
    expect(r.length).toBe(1);
    expect(r[0].flags).toContain("em_andamento");
  });

  it("inclui marcos com duração 0", () => {
    const r = filtrarAtividadesDaSemana(
      [ativ({ is_marco: true, duracao_horas: 0, data_inicio: "2026-07-15", data_fim: "2026-07-15" })],
      semana,
    );
    expect(r.length).toBe(1);
    expect(r[0].flags).toContain("marco");
  });

  it("exclui resumos e canceladas", () => {
    const r = filtrarAtividadesDaSemana(
      [
        ativ({ is_resumo: true }),
        ativ({ status: "cancelada" }),
      ],
      semana,
    );
    expect(r.length).toBe(0);
  });

  it("aplica prioridade na flag principal (atrasada vence)", () => {
    const a = ativ({
      data_inicio: "2026-07-10",
      data_fim: "2026-07-15",
      status: "planejada",
    });
    const r = classificarAtividadeNaSemana(a, semana, "2026-07-20");
    expect(r.flags).toContain("atrasada");
    expect(r.flags).toContain("termina_semana");
    expect(r.flagPrincipal).toBe("atrasada");
  });

  it("inicia_semana detectado quando data_inicio cai dentro da semana", () => {
    const a = ativ({ data_inicio: "2026-07-15", data_fim: "2026-07-25" });
    const r = classificarAtividadeNaSemana(a, semana, "2026-07-14");
    expect(r.flags).toContain("inicia_semana");
  });
});
