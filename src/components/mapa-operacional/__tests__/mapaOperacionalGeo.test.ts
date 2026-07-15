import { describe, it, expect } from "vitest";
import {
  buildFeatureCollection,
  buildMapaOperacionalPopupDom,
  traduzirSituacaoUI,
} from "../mapaOperacionalGeo";
import type { MapaOperacionalAtivo } from "@/services/mapa-operacional/mapaOperacionalService";

function ativo(overrides: Partial<MapaOperacionalAtivo> = {}): MapaOperacionalAtivo {
  return {
    localizacao_id: "loc-1",
    apontamento_id: "ap-1",
    equipamento_id: "eq-1",
    latitude: -22.9068,
    longitude: -43.1729,
    precisao_gps: 120,
    data_registro: new Date().toISOString(),
    origem: "APONTAMENTO_CE",
    frota: "LYE",
    numero_frota: "137",
    placa: "ABC1D23",
    imagem_url: null,
    categoria_id: null,
    categoria_nome: "Rolinho",
    subcategoria_id: null,
    subcategoria_nome: "Tapa-buraco",
    centro_custo_id: null,
    centro_custo_nome: "Consórcio AP5",
    centro_custo_codigo: "L528",
    operador_id: null,
    operador_nome: "Juliano",
    data_apontamento: null,
    hora_apontamento: null,
    horimetro_final: 100,
    situacao_veiculo: "Operando",
    checklist_codigo: null,
    total_checklist: 0,
    qtd_nao_ok: 0,
    status_mapa: "OPERACIONAL",
    status_label: "Operacional",
    status_prioridade: 4,
    coordenada_precisa: true,
    ...overrides,
  };
}

describe("buildFeatureCollection", () => {
  it("usa [longitude, latitude] e id = equipamento_id", () => {
    const { featureCollection, descartados } = buildFeatureCollection([ativo()]);
    expect(descartados).toHaveLength(0);
    expect(featureCollection.features).toHaveLength(1);
    const f = featureCollection.features[0];
    expect(f.id).toBe("eq-1");
    expect(f.geometry.coordinates).toEqual([-43.1729, -22.9068]);
  });

  it("descarta NaN", () => {
    const r = buildFeatureCollection([ativo({ latitude: Number.NaN })]);
    expect(r.featureCollection.features).toHaveLength(0);
    expect(r.descartados[0].motivo).toMatch(/latitude/);
  });

  it("descarta (0,0)", () => {
    const r = buildFeatureCollection([ativo({ latitude: 0, longitude: 0 })]);
    expect(r.descartados[0].motivo).toMatch(/0,0/);
  });

  it("descarta latitude fora de faixa", () => {
    const r = buildFeatureCollection([ativo({ latitude: 91 })]);
    expect(r.descartados[0].motivo).toMatch(/latitude/);
  });

  it("descarta longitude fora de faixa", () => {
    const r = buildFeatureCollection([ativo({ longitude: -181 })]);
    expect(r.descartados[0].motivo).toMatch(/longitude/);
  });

  it("propriedades são primitivas", () => {
    const { featureCollection } = buildFeatureCollection([ativo()]);
    const p = featureCollection.features[0].properties;
    for (const v of Object.values(p)) {
      const t = typeof v;
      expect(["string", "number", "boolean", "object"]).toContain(t);
      if (t === "object") expect(v).toBeNull();
    }
  });

  it("aplica cor conforme status_mapa", () => {
    const r = buildFeatureCollection([ativo({ status_mapa: "NAO_CONFORME" })]);
    expect(r.featureCollection.features[0].properties.status_color).toBe("#DC2626");
  });
});

describe("traduzirSituacaoUI", () => {
  it("Disponível vira À disposição", () => {
    expect(traduzirSituacaoUI("Disponível")).toBe("À disposição");
    expect(traduzirSituacaoUI("disponivel")).toBe("À disposição");
  });
  it("não classifica Disponível como PARADO", () => {
    const r = buildFeatureCollection([ativo({ situacao_veiculo: "Disponível", status_mapa: "OPERACIONAL" })]);
    const p = r.featureCollection.features[0].properties;
    expect(p.situacao_ui).toBe("À disposição");
    expect(p.status_mapa).toBe("OPERACIONAL");
  });
  it("mantém outros valores", () => {
    expect(traduzirSituacaoUI("Em Manutenção")).toBe("Em Manutenção");
  });
});

describe("buildMapaOperacionalPopupDom", () => {
  it("usa textContent (sem innerHTML bruto) e mostra frota", () => {
    const { featureCollection } = buildFeatureCollection([ativo({ situacao_veiculo: "Disponível" })]);
    const dom = buildMapaOperacionalPopupDom(featureCollection.features[0].properties);
    expect(dom.textContent).toContain("LYE 137");
    expect(dom.textContent).toContain("À disposição");
    // nenhum script tag injetado
    expect(dom.querySelector("script")).toBeNull();
  });
});
