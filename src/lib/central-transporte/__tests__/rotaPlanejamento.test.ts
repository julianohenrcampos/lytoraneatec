import { describe, expect, it } from "vitest";
import {
  assinaturaRota,
  coordenadasRotaRascunho,
  podeCalcularRota,
  rascunhoComRotaDirections,
  rotaEstaStale,
} from "../rotaPlanejamento";
import { paradaVazia, rascunhoVazio } from "../movDiretaRascunho";
import { rotaFeature } from "../movimentacoesWorkspace";
import type { CtOrdemMotorista } from "@/types/centralTransporteMobilizacao";
import type { CtMovDiretaRascunho } from "@/types/centralTransporteMovDireta";

const comTrajeto = (): CtMovDiretaRascunho => ({
  ...rascunhoVazio(),
  origemLatitude: -22.857036,
  origemLongitude: -43.767851,
  paradas: [{ ...paradaVazia(), latitude: -22.845221, longitude: -43.748005 }],
});

describe("rotaPlanejamento", () => {
  it("ordena origem e paradas e usa [lng, lat] na assinatura", () => {
    const r = comTrajeto();
    expect(coordenadasRotaRascunho(r)).toEqual([
      { latitude: -22.857036, longitude: -43.767851 },
      { latitude: -22.845221, longitude: -43.748005 },
    ]);
    expect(assinaturaRota(r)).toBe("-43.767851,-22.857036;-43.748005,-22.845221");
    expect(podeCalcularRota(r)).toBe(true);
  });

  it("parada sem coordenada bloqueia o cálculo (trajeto incompleto)", () => {
    const r = { ...comTrajeto(), paradas: [paradaVazia()] };
    expect(podeCalcularRota(r)).toBe(false);
    expect(rotaEstaStale(r, null)).toBe(false);
  });

  it("origem sem coordenada ou sem paradas não é calculável", () => {
    expect(
      podeCalcularRota({ ...comTrajeto(), origemLatitude: null, origemLongitude: null }),
    ).toBe(false);
    expect(podeCalcularRota({ ...comTrajeto(), paradas: [] })).toBe(false);
  });

  it("uma parada geolocalizada entre várias não basta", () => {
    const r = comTrajeto();
    expect(
      podeCalcularRota({ ...r, paradas: [...r.paradas, paradaVazia()] }),
    ).toBe(false);
  });

  it("snapshot ausente é stale e snapshot da mesma assinatura não é", () => {
    const r = comTrajeto();
    expect(rotaEstaStale(r, null)).toBe(true);
    const comSnapshot: CtMovDiretaRascunho = {
      ...r,
      rotaPlanejada: {
        distanciaKm: 5,
        duracaoMin: 10,
        resumo: "BR-101",
        geometria: {
          type: "LineString",
          coordinates: [
            [-43.767851, -22.857036],
            [-43.76, -22.85],
            [-43.748005, -22.845221],
          ],
        },
      },
    };
    expect(rotaEstaStale(comSnapshot, assinaturaRota(r))).toBe(false);
    /* Mudou o trajeto → precisa recalcular. */
    const mudou = {
      ...comSnapshot,
      paradas: [{ ...comSnapshot.paradas[0], latitude: -22.9, longitude: -43.7 }],
    };
    expect(rotaEstaStale(mudou, assinaturaRota(r))).toBe(true);
  });

  it("compõe um novo rascunho com a rota Directions sem depender de setState", () => {
    const atual = comTrajeto();
    const composto = rascunhoComRotaDirections(atual, {
      indice: 0,
      distanciaKm: 3.8,
      duracaoMin: 9,
      resumo: "Estrada do Facao, Rua Sílvio Germiniano",
      geometria: {
        type: "LineString",
        coordinates: [
          [-43.767851, -22.857036],
          [-43.76, -22.85],
          [-43.748005, -22.845221],
        ],
      },
    });
    expect(composto).not.toBe(atual);
    expect(atual.rotaPlanejada).toBeNull();
    expect(composto?.rotaPlanejada?.geometria?.coordinates).toHaveLength(3);
  });

  it("rejeita resposta Directions sem distância, duração ou LineString real", () => {
    expect(
      rascunhoComRotaDirections(comTrajeto(), {
        indice: 0,
        distanciaKm: 0,
        duracaoMin: null,
        resumo: "",
        geometria: {
          type: "LineString",
          coordinates: [
            [-43.76, -22.85],
            [-43.74, -22.84],
          ],
        },
      }),
    ).toBeNull();
  });
});

describe("rotaFeature", () => {
  const base = {
    id: "v1",
    codigo: "MOV2026-001",
    status: "PROGRAMADA",
  } as unknown as CtOrdemMotorista;

  it("geometria nula não produz feature", () => {
    expect(rotaFeature({ ...base, rotaGeometria: null }, true)).toBeNull();
  });

  it("LineString válida vira Feature da FeatureCollection", () => {
    const f = rotaFeature(
      {
        ...base,
        rotaGeometria: {
          type: "LineString",
          coordinates: [
            [-43.76, -22.85],
            [-43.74, -22.84],
          ],
        },
      },
      true,
    );
    expect(f?.type).toBe("Feature");
    expect(f?.geometry.type).toBe("LineString");
    expect(f?.geometry.coordinates[0][0]).toBeLessThan(0);
    expect(Math.abs(f?.geometry.coordinates[0][1] as number)).toBeLessThan(90);
    expect(f?.properties.selecionado).toBe(true);
  });
});
