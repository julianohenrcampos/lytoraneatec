/**
 * CT-5 — Matriz P06–P09/P15 do Puxada Builder unificado (camada pura).
 */
import { describe, expect, it } from "vitest";
import {
  adicionarCaminhao,
  definirCentroCustoPorLocal,
  parsePuxDragId,
  parsePuxDropId,
  pendenciasPuxada,
  puxDragId,
  puxDropAceita,
  puxDropId,
} from "@/lib/central-transporte/puxadaBuilder";
import { rascunhoPuxadaVazio } from "@/lib/central-transporte/puxadaRascunho";
import type { MovLocal } from "@/lib/central-transporte/movDiretaBuilder";

const local = (over: Partial<MovLocal> = {}): MovLocal => ({
  id: "cc-1",
  rotulo: "TESTE-001 — OBRA TESTE GEO",
  endereco: "Rua Y, 100",
  latitude: -22.9,
  longitude: -43.2,
  ...over,
});

describe("puxadaBuilder — CC por local e pendências", () => {
  it("P06 drag de local é aceito somente no alvo de centro de custo", () => {
    expect(puxDropAceita("PUX_LOCAL", { tipo: "PUX_CENTRO_CUSTO" })).toBe(true);
    expect(puxDropAceita("PUX_LOCAL", { tipo: "PUX_CANVAS" })).toBe(false);
    expect(puxDropAceita("PUX_CAMINHAO", { tipo: "PUX_CENTRO_CUSTO" })).toBe(false);
    expect(parsePuxDragId(puxDragId("PUX_LOCAL", "cc-1"))).toEqual({
      tipo: "PUX_LOCAL",
      id: "cc-1",
    });
    expect(parsePuxDropId(puxDropId({ tipo: "PUX_CENTRO_CUSTO" }))).toEqual({
      tipo: "PUX_CENTRO_CUSTO",
    });
  });

  it("P09 CC preenche descarga vazia com o endereço cadastrado", () => {
    const r = definirCentroCustoPorLocal(rascunhoPuxadaVazio(), local());
    expect(r.centroCustoId).toBe("cc-1");
    expect(r.descargaEndereco).toBe("Rua Y, 100");
    expect(r.descargaLatitude).toBe(-22.9);
    expect(r.coletaEndereco).toBe("");
  });

  it("P08 CC não sobrescreve descarga já editada", () => {
    const base = { ...rascunhoPuxadaVazio(), descargaEndereco: "Pátio informado", descargaLatitude: -23, descargaLongitude: -43 };
    const r = definirCentroCustoPorLocal(base, local());
    expect(r.descargaEndereco).toBe("Pátio informado");
    expect(r.descargaLatitude).toBe(-23);
    expect(r.centroCustoId).toBe("cc-1");
  });

  it("CC sem endereço apenas vincula o centro de custo", () => {
    const r = definirCentroCustoPorLocal(rascunhoPuxadaVazio(), local({ endereco: null }));
    expect(r.descargaEndereco).toBe("");
  });

  it("P23 pendências compactas cobrem data, CC, coleta, descarga e motorista", () => {
    expect(pendenciasPuxada(rascunhoPuxadaVazio())).toEqual([
      "Informe a data",
      "Informe Centro de Custo",
      "Informe coleta",
      "Informe descarga",
      "Adicione um caminhão",
    ]);

    const completo = adicionarCaminhao(
      {
        ...rascunhoPuxadaVazio(),
        dataPuxada: "2026-09-02",
        centroCustoId: "cc-1",
        coletaLatitude: -22.9,
        coletaLongitude: -43.2,
        descargaLatitude: -22.8,
        descargaLongitude: -43.1,
      },
      { caminhaoEquipamentoId: "cam-1", rotulo: "LOC-019" },
    );
    expect(pendenciasPuxada(completo)).toEqual(["Caminhão LOC-019 sem motorista"]);
  });
});
