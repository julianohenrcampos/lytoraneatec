import { describe, it, expect } from "vitest";
import {
  rankCandidatosPorDepartamentoPreferencial,
  agruparCandidatosPorPreferencia,
} from "../rankCandidatosPorDepartamento";

const TRANSPORTE = "dep-transporte";
const ASFALTO = "dep-asfalto";

const candidatos = [
  { id: "LYT-050", departamento_id: ASFALTO },
  { id: "LYT-042", departamento_id: TRANSPORTE },
  { id: "LYT-078", departamento_id: TRANSPORTE },
  { id: "LYT-099", departamento_id: null },
];

describe("ranking por departamento preferencial", () => {
  it("prioriza o preferencial SEM remover alternativas", () => {
    const out = rankCandidatosPorDepartamentoPreferencial(candidatos, TRANSPORTE);
    expect(out.map((c) => c.id)).toEqual(["LYT-042", "LYT-078", "LYT-050", "LYT-099"]);
    expect(out).toHaveLength(candidatos.length);
  });

  it("sem preferência mantém a ordem de matching original", () => {
    const out = rankCandidatosPorDepartamentoPreferencial(candidatos, null);
    expect(out.map((c) => c.id)).toEqual(candidatos.map((c) => c.id));
  });

  it("agrupa em preferenciais e alternativas", () => {
    const grupos = agruparCandidatosPorPreferencia(candidatos, TRANSPORTE, "TRANSPORTE");
    expect(grupos[0].titulo).toBe("Preferenciais — TRANSPORTE");
    expect(grupos[0].candidatos.map((c) => c.id)).toEqual(["LYT-042", "LYT-078"]);
    expect(grupos[1].titulo).toBe("Alternativas — outros departamentos");
    expect(grupos[1].candidatos.map((c) => c.id)).toEqual(["LYT-050", "LYT-099"]);
  });

  it("sem preferência devolve um único grupo", () => {
    const grupos = agruparCandidatosPorPreferencia(candidatos, null);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].candidatos).toHaveLength(4);
  });
});
