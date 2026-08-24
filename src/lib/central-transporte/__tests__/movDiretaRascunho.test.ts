import { describe, expect, it } from "vitest";
import {
  equipamentosJaAlocados,
  paradaVazia,
  rascunhoVazio,
  validarRascunho,
  montarPayloadRascunho,
} from "@/lib/central-transporte/movDiretaRascunho";

describe("movDiretaRascunho", () => {
  it("rascunho exige apenas centro de custo em cada parada", () => {
    const r = rascunhoVazio();
    expect(validarRascunho(r, "RASCUNHO")).toContain(
      "Parada 1: informe a obra/centro de custo.",
    );
    r.paradas[0].centroCustoId = "cc-1";
    expect(validarRascunho(r, "RASCUNHO")).toEqual([]);
  });

  it("programar exige modalidade, motorista, origem, data e ativos", () => {
    const r = rascunhoVazio();
    r.paradas[0].centroCustoId = "cc-1";
    const erros = validarRascunho(r, "PROGRAMAR");
    expect(erros.length).toBeGreaterThan(0);

    r.modalidade = "RODANTE";
    r.motoristaId = "f-1";
    r.origemCentroCustoId = "cc-0";
    r.dataPrevistaSaida = "2026-08-11";
    r.paradas[0].equipamentos = ["eq-1"];
    expect(validarRascunho(r, "PROGRAMAR")).toEqual([]);
  });

  it("bloqueia o mesmo equipamento em duas paradas", () => {
    const r = rascunhoVazio();
    r.paradas[0].centroCustoId = "cc-1";
    r.paradas[0].equipamentos = ["eq-1"];
    const p2 = paradaVazia();
    p2.centroCustoId = "cc-2";
    p2.equipamentos = ["eq-1"];
    r.paradas.push(p2);

    expect(validarRascunho(r, "RASCUNHO")).toContain(
      "Um mesmo equipamento não pode ser entregue em duas paradas da mesma viagem.",
    );
    expect(equipamentosJaAlocados(r, p2.chaveLocal).has("eq-1")).toBe(true);
    expect(equipamentosJaAlocados(r, r.paradas[0].chaveLocal).has("eq-1")).toBe(true);
  });

  it("payload envia tipo_transporte apenas em modalidade transportada", () => {
    const r = rascunhoVazio();
    r.modalidade = "RODANTE";
    r.tipoTransporte = "PROPRIO";
    expect(montarPayloadRascunho(r).tipo_transporte).toBeNull();

    r.modalidade = "TRANSPORTADO";
    expect(montarPayloadRascunho(r).tipo_transporte).toBe("PROPRIO");
  });

  it("envia o snapshot completo da rota no contrato validado pela RPC", () => {
    const r = rascunhoVazio();
    r.rotaPlanejada = {
      distanciaKm: 3.7,
      duracaoMin: 8,
      resumo: "Estrada do Guandu",
      geometria: {
        type: "LineString",
        coordinates: [
          [-43.767851, -22.857036],
          [-43.76, -22.85],
          [-43.748005, -22.845221],
        ],
      },
    };

    expect(montarPayloadRascunho(r).rota).toEqual({
      distancia_km: 3.7,
      duracao_min: 8,
      resumo: "Estrada do Guandu",
      geometria: r.rotaPlanejada.geometria,
    });
  });
});
