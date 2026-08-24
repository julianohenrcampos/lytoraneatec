/**
 * CT-5 — testes das regras puras de Puxada (rascunho, etapas e workspace).
 */
import { describe, expect, it } from "vitest";
import {
  assinaturaRotaPuxada,
  caminhaoRascunho,
  coordenadasRotaPuxada,
  hidratarPuxada,
  montarPayloadPuxada,
  podeCalcularRotaPuxada,
  puxadaComRotaDirections,
  rascunhoPuxadaVazio,
  rotaPuxadaEstaStale,
  validarPuxada,
} from "../puxadaRascunho";
import { errosDaEtapaPuxada } from "../puxadaWizardSteps";
import {
  contarResumoPuxadas,
  filtrarPuxadas,
  filtroPuxadaVazio,
  pontosDaPuxada,
  rotaFeaturePuxada,
} from "../puxadasWorkspace";
import type { CtPuxada, CtPuxadaRascunho } from "@/types/centralTransportePuxada";

const rascunhoCompleto = (): CtPuxadaRascunho => ({
  ...rascunhoPuxadaVazio(),
  dataPuxada: "2026-09-01",
  centroCustoId: "cc-1",
  coletaEndereco: "Usina",
  coletaLatitude: -22.9,
  coletaLongitude: -43.1,
  descargaEndereco: "Obra",
  descargaLatitude: -22.8,
  descargaLongitude: -43.2,
  caminhoes: [
    {
      ...caminhaoRascunho({ caminhaoEquipamentoId: "cam-1", rotulo: "LYC-106" }),
      motoristaFuncionarioId: "mot-1",
      motoristaNome: "Eduardo",
    },
  ],
});

const puxadaServidor = (over: Partial<CtPuxada> = {}): CtPuxada => ({
  id: "p1",
  codigo: "PUX2026-001",
  status: "PROGRAMADA",
  dataPuxada: "2026-09-01",
  centroCustoId: "cc-1",
  ccCodigo: "CONM104",
  ccNome: "Obra",
  planejadorNome: "Planejador",
  coleta: { endereco: "Usina", latitude: -22.9, longitude: -43.1 },
  descarga: { endereco: "Obra", latitude: -22.8, longitude: -43.2 },
  distanciaRotaKm: 12.5,
  duracaoRotaMin: 30,
  rotaResumo: "BR-101",
  rotaGeometria: {
    type: "LineString",
    coordinates: [
      [-43.1, -22.9],
      [-43.15, -22.85],
      [-43.2, -22.8],
    ],
  },
  observacoes: null,
  programadaEm: null,
  canceladoEm: null,
  motivoCancelamento: null,
  caminhoes: [],
  totalCaminhoes: 2,
  ...over,
});

describe("CT-5 rascunho de puxada", () => {
  it("exige data e centro de custo para salvar rascunho", () => {
    const erros = validarPuxada(rascunhoPuxadaVazio(), "RASCUNHO");
    expect(erros).toContain("Informe a data da puxada.");
    expect(erros).toContain("Informe o centro de custo da puxada.");
  });

  it("não valida programação sem caminhão, motorista ou pontos", () => {
    const base = { ...rascunhoPuxadaVazio(), dataPuxada: "2026-09-01", centroCustoId: "cc-1" };
    const erros = validarPuxada(base, "PROGRAMAR");
    expect(erros).toContain("Adicione ao menos um caminhão com motorista.");
    expect(erros).toContain("Confirme o ponto de coleta no mapa.");
    expect(erros).toContain("Confirme o ponto de descarga no mapa.");
  });

  it("bloqueia caminhão duplicado na mesma puxada", () => {
    const r = rascunhoCompleto();
    const erros = validarPuxada(
      { ...r, caminhoes: [...r.caminhoes, { ...r.caminhoes[0], chaveLocal: "outra" }] },
      "RASCUNHO",
    );
    expect(erros).toContain("O mesmo caminhão não pode ser incluído duas vezes na puxada.");
  });

  it("aceita rascunho completo para programar", () => {
    expect(validarPuxada(rascunhoCompleto(), "PROGRAMAR")).toEqual([]);
  });

  it("monta payload exatamente no contrato da RPC", () => {
    const payload = montarPayloadPuxada(rascunhoCompleto()) as Record<string, unknown>;
    expect(payload.data_puxada).toBe("2026-09-01");
    expect(payload.centro_custo_id).toBe("cc-1");
    expect(payload.coleta).toEqual({ endereco: "Usina", latitude: -22.9, longitude: -43.1 });
    expect(payload.caminhoes).toEqual([
      { caminhao_equipamento_id: "cam-1", motorista_funcionario_id: "mot-1" },
    ]);
    expect(payload.rota).toBeNull();
  });

  it("hidrata o estado autoritativo do servidor", () => {
    const r = hidratarPuxada(puxadaServidor({ caminhoes: [
      {
        id: "pc1",
        caminhaoEquipamentoId: "cam-1",
        frota: "LYC-106",
        placa: "ABC1D23",
        motoristaFuncionarioId: "mot-1",
        motoristaNome: "Eduardo",
      },
    ] }));
    expect(r.puxadaId).toBe("p1");
    expect(r.caminhoes[0].rotulo).toBe("LYC-106");
    expect(r.rotaPlanejada?.distanciaKm).toBe(12.5);
  });
});

describe("CT-5 rota do rascunho", () => {
  it("só calcula rota com coleta e descarga geolocalizadas", () => {
    expect(podeCalcularRotaPuxada(rascunhoCompleto())).toBe(true);
    expect(coordenadasRotaPuxada(rascunhoCompleto())).toHaveLength(2);
    expect(
      podeCalcularRotaPuxada({ ...rascunhoCompleto(), descargaLatitude: null }),
    ).toBe(false);
  });

  it("considera snapshot stale quando o trajeto muda", () => {
    const r = rascunhoCompleto();
    expect(rotaPuxadaEstaStale(r, null)).toBe(true);
    const comRota = puxadaComRotaDirections(r, {
      indice: 0,
      distanciaKm: 10,
      duracaoMin: 25,
      resumo: "BR-101",
      geometria: {
        type: "LineString",
        coordinates: [
          [-43.1, -22.9],
          [-43.15, -22.85],
          [-43.2, -22.8],
        ],
      },
    });
    expect(comRota).not.toBeNull();
    const assinatura = assinaturaRotaPuxada(comRota as CtPuxadaRascunho);
    expect(rotaPuxadaEstaStale(comRota as CtPuxadaRascunho, assinatura)).toBe(false);
  });

  it("recusa rota inválida da Directions", () => {
    expect(
      puxadaComRotaDirections(rascunhoCompleto(), {
        indice: 0,
        distanciaKm: 0,
        duracaoMin: 0,
        resumo: "",
        geometria: null,
      }),
    ).toBeNull();
  });
});

describe("CT-5 etapas do wizard", () => {
  it("particiona os invariantes por etapa", () => {
    const vazio = rascunhoPuxadaVazio();
    expect(errosDaEtapaPuxada(vazio, "DADOS")).toHaveLength(2);
    expect(errosDaEtapaPuxada(vazio, "CAMINHOES")[0]).toMatch(/caminhão/);
    expect(errosDaEtapaPuxada(vazio, "TRAJETO")).toHaveLength(1);
    expect(errosDaEtapaPuxada(rascunhoCompleto(), "REVISAO")).toEqual([]);
  });
});

describe("CT-5 workspace", () => {
  it("esconde canceladas quando o status é TODOS", () => {
    const lista = [puxadaServidor(), puxadaServidor({ id: "p2", status: "CANCELADA" })];
    expect(filtrarPuxadas(lista, filtroPuxadaVazio())).toHaveLength(1);
    expect(
      filtrarPuxadas(lista, { ...filtroPuxadaVazio(), status: "CANCELADA" }),
    ).toHaveLength(1);
  });

  it("filtra por busca, data e centro de custo", () => {
    const lista = [puxadaServidor()];
    expect(filtrarPuxadas(lista, { ...filtroPuxadaVazio(), busca: "conm104" })).toHaveLength(1);
    expect(filtrarPuxadas(lista, { ...filtroPuxadaVazio(), data: "2026-09-02" })).toHaveLength(0);
    expect(
      filtrarPuxadas(lista, { ...filtroPuxadaVazio(), centroCustoId: "cc-9" }),
    ).toHaveLength(0);
  });

  it("conta o resumo e os caminhões do dia", () => {
    const resumo = contarResumoPuxadas(
      [puxadaServidor(), puxadaServidor({ id: "p2", status: "RASCUNHO" })],
      "2026-09-01",
    );
    expect(resumo.programadas).toBe(1);
    expect(resumo.rascunhos).toBe(1);
    expect(resumo.caminhoesHoje).toBe(2);
  });

  it("projeta pontos e rota apenas com dados reais", () => {
    expect(pontosDaPuxada(puxadaServidor()).map((p) => p.tipo)).toEqual([
      "COLETA",
      "DESCARGA",
    ]);
    expect(rotaFeaturePuxada(puxadaServidor(), true)?.properties.selecionado).toBe(true);
    expect(rotaFeaturePuxada(puxadaServidor({ rotaGeometria: null }), true)).toBeNull();
  });
});
