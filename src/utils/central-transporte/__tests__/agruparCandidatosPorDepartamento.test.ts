import { describe, expect, it } from "vitest";
import {
  agruparCandidatosPorDepartamento,
  ativoDeDepartamentoAlternativo,
  TITULO_MELHORES_OPCOES,
} from "../agruparCandidatosPorDepartamento";
import type { AtivoAnalise } from "@/services/centralTransporteService";

const TRANSPORTE = "11111111-1111-1111-1111-111111111111";
const ASFALTO = "22222222-2222-2222-2222-222222222222";

const ativo = (id: string, dep: string | null, nome: string): AtivoAnalise =>
  ({
    equipamento_id: id,
    frota: nome,
    numero_frota: null,
    placa: null,
    departamento_id: dep,
    departamento_nome: dep === TRANSPORTE ? "TRANSPORTE" : dep === ASFALTO ? "ASFALTO" : null,
    status_operacional: "DISPONIVEL",
  }) as unknown as AtivoAnalise;

const lista = [
  ativo("a", ASFALTO, "LYT-050"),
  ativo("b", TRANSPORTE, "LYT-042"),
  ativo("c", TRANSPORTE, "LYT-078"),
  ativo("d", null, "LYT-900"),
];

describe("agruparCandidatosPorDepartamento", () => {
  it("T2/T3 — preferência Transporte: recomendados primeiro, alternativas preservadas", () => {
    const grupos = agruparCandidatosPorDepartamento(lista, TRANSPORTE, "TRANSPORTE");
    expect(grupos.map((g) => g.id)).toEqual(["RECOMENDADOS", "ALTERNATIVAS"]);
    expect(grupos[0].candidatos.map((c) => c.equipamento_id)).toEqual(["b", "c"]);
    expect(grupos[1].candidatos.map((c) => c.equipamento_id)).toEqual(["a", "d"]);
    // nenhum candidato desaparece
    expect(grupos.flatMap((g) => g.candidatos)).toHaveLength(lista.length);
  });

  it("T4 — preferência Asfalto: Asfalto primeiro", () => {
    const grupos = agruparCandidatosPorDepartamento(lista, ASFALTO, "ASFALTO");
    expect(grupos[0].candidatos.map((c) => c.equipamento_id)).toEqual(["a"]);
    expect(grupos[1].candidatos.map((c) => c.equipamento_id)).toEqual(["b", "c", "d"]);
  });

  it("T5 — sem preferência: bloco único na ordem do matching", () => {
    const grupos = agruparCandidatosPorDepartamento(lista, null);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].titulo).toBe(TITULO_MELHORES_OPCOES);
    expect(grupos[0].candidatos.map((c) => c.equipamento_id)).toEqual(["a", "b", "c", "d"]);
  });

  it("T6 — identifica ativo de departamento alternativo", () => {
    expect(ativoDeDepartamentoAlternativo({ departamento_id: ASFALTO }, TRANSPORTE)).toBe(true);
    expect(ativoDeDepartamentoAlternativo({ departamento_id: TRANSPORTE }, TRANSPORTE)).toBe(false);
    // sem preferência nunca é "alternativo"
    expect(ativoDeDepartamentoAlternativo({ departamento_id: ASFALTO }, null)).toBe(false);
  });
});
