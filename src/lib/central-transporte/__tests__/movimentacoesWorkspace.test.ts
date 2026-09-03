/**
 * CT-4 Fase 3 — regras do painel de Movimentações.
 */
import { describe, expect, it } from "vitest";
import type { CtOrdemMotorista } from "@/types/centralTransporteMobilizacao";
import {
  contarResumo,
  coordenadasParaFit,
  filtrarMovimentacoes,
  filtroVazio,
  pontosDaMovimentacao,
  resumoRota,
  resumoTrajeto,
  resumoTrajetoCurto,
  rotaFeature,
  chipRotaFeature,
} from "../movimentacoesWorkspace";

const viagem = (over: Partial<CtOrdemMotorista> = {}): CtOrdemMotorista =>
  ({
    id: over.id ?? "v1",
    codigo: "MOV2026-001",
    status: "PROGRAMADA",
    dataOrdem: null,
    dataPrevistaSaida: "2026-08-21",
    dataPrevistaEntrega: null,
    modalidade: "TRANSPORTADO",
    tipoTransporte: "PROPRIO",
    motoristaNome: "Eduardo Xavier da Silva",
    motoristaId: "m1",
    veiculoTransportadorId: null,
    empresaTransportadoraId: null,
    origemCentroCustoId: "cc1",
    placaTransportador: "KWC8796",
    empresaTransportadora: null,
    origemCentroCusto: "TESTE-001",
    origemEndereco: "Rua Quitéria",
    origemPontoExato: null,
    origemLatitude: -22.9,
    origemLongitude: -43.1,
    destinoCentroCusto: null,
    destinoEndereco: null,
    destinoPontoExato: null,
    destinoLatitude: null,
    destinoLongitude: null,
    distanciaKm: null,
    distanciaRotaKm: 33.7,
    duracaoRotaMin: 50,
    rotaResumo: "BR-101",
    rotaGeometria: {
      type: "LineString",
      coordinates: [
        [-43.1, -22.9],
        [-43.2, -22.8],
      ],
    },
    recebedorPrevistoNome: null,
    recebedorPrevistoTelefone: null,
    observacoes: null,
    cargas: [{ equipamentoId: "e1", frota: "LOC", numeroFrota: "069", placa: null }],
    origemFluxo: "MOV_DIRETA",
    solicitacaoId: null,
    paradas: [
      {
        id: "p1",
        ordem: 1,
        status: "PENDENTE",
        centroCustoId: "cc2",
        ccCodigo: "L448",
        ccNome: "APLICAÇÃO MASSA LYTO",
        endereco: "Estrada RJ-99",
        pontoExato: null,
        latitude: -22.8,
        longitude: -43.2,
        dataPrevista: "2026-08-21",
        horaPrevista: "12:18",
        observacao: null,
        recebedorPrevistoFuncionarioId: null,
        recebedorPrevistoNome: "Juliano Henrique Campos",
        chegadaRegistradaEm: null,
        concluidaEm: null,
        cargas: [{ equipamentoId: "e1" }],
      },
    ],
    ...over,
  }) as unknown as CtOrdemMotorista;

describe("filtrarMovimentacoes", () => {
  it("lista vazia devolve vazio", () => {
    expect(filtrarMovimentacoes([], filtroVazio())).toEqual([]);
  });

  it("filtra por código, ativo e obra da parada", () => {
    const vs = [viagem(), viagem({ id: "v2", codigo: "MOV2026-002" })];
    expect(filtrarMovimentacoes(vs, { ...filtroVazio(), busca: "mov2026-002" })).toHaveLength(1);
    expect(filtrarMovimentacoes(vs, { ...filtroVazio(), busca: "069" })).toHaveLength(2);
    expect(filtrarMovimentacoes(vs, { ...filtroVazio(), busca: "aplicacao massa" })).toHaveLength(2);
    expect(filtrarMovimentacoes(vs, { ...filtroVazio(), busca: "inexistente" })).toHaveLength(0);
  });

  it("filtra por status, data e motorista", () => {
    const vs = [viagem(), viagem({ id: "v2", status: "RASCUNHO", motoristaId: "m2" })];
    expect(filtrarMovimentacoes(vs, { ...filtroVazio(), status: "RASCUNHO" })).toHaveLength(1);
    expect(filtrarMovimentacoes(vs, { ...filtroVazio(), data: "2026-08-21" })).toHaveLength(2);
    expect(filtrarMovimentacoes(vs, { ...filtroVazio(), data: "2026-08-20" })).toHaveLength(0);
    expect(filtrarMovimentacoes(vs, { ...filtroVazio(), motoristaId: "m1" })).toHaveLength(1);
  });
});

describe("resumo e rótulos", () => {
  it("conta por status com concluídas do dia", () => {
    const r = contarResumo(
      [
        viagem(),
        viagem({ id: "v2", status: "RASCUNHO" }),
        viagem({ id: "v3", status: "EM_TRANSITO" }),
        viagem({ id: "v4", status: "CONCLUIDA" }),
        viagem({ id: "v5", status: "CONCLUIDA", dataPrevistaSaida: "2026-01-01" }),
      ],
      "2026-08-21",
    );
    expect(r).toEqual({ rascunhos: 1, programadas: 1, emTransito: 1, concluidasHoje: 1 });
  });

  it("trajeto e resumo de rota vêm do snapshot do servidor", () => {
    expect(resumoTrajeto(viagem())).toBe("TESTE-001 → L448");
    expect(resumoRota(viagem())).toBe("33,7 km • ~50 min");
    expect(resumoRota(viagem({ distanciaRotaKm: null, distanciaKm: null }))).toBeNull();
  });
});

describe("geometria", () => {
  it("usa a rota persistida, sem chamar Directions", () => {
    const f = rotaFeature(viagem(), true);
    expect(f?.geometry.coordinates).toHaveLength(2);
    expect(f?.properties.selecionado).toBe(true);
  });

  it("sem geometria não cria rota falsa — cai nos pontos", () => {
    const v = viagem({ rotaGeometria: null });
    expect(rotaFeature(v, true)).toBeNull();
    expect(coordenadasParaFit(v)).toEqual([
      [-43.1, -22.9],
      [-43.2, -22.8],
    ]);
  });

  it("pontos trazem origem e paradas numeradas com coordenada válida", () => {
    const pontos = pontosDaMovimentacao(viagem());
    expect(pontos.map((p) => p.tipo)).toEqual(["ORIGEM", "PARADA"]);
    expect(pontos[1].ordem).toBe(1);
    expect(pontos[1].pessoa).toBe("Juliano Henrique Campos");
  });

  it("ponto sem coordenada é descartado (nada é inventado)", () => {
    const v = viagem({ origemLatitude: null, origemLongitude: null });
    expect(pontosDaMovimentacao(v).map((p) => p.tipo)).toEqual(["PARADA"]);
  });
  it("resumo curto do card usa só CC de coleta → CC da 1ª entrega", () => {
    expect(resumoTrajetoCurto(viagem())).toBe("TESTE-001 → L448");
  });

  it("resumo curto sinaliza paradas extras sem crescer o card", () => {
    const base = viagem();
    const v = viagem({ paradas: [...base.paradas, ...base.paradas, ...base.paradas] });
    expect(resumoTrajetoCurto(v)).toBe("TESTE-001 → L448 +2");
  });

  it("chip de rota usa apenas o snapshot do servidor", () => {
    const chip = chipRotaFeature(viagem());
    expect(chip?.properties.distancia).toBe("33,7 km");
    expect(chip?.properties.duracao).toBe("50 min");
    expect(chipRotaFeature(viagem({ rotaGeometria: null }))).toBeNull();
    expect(
      chipRotaFeature(viagem({ distanciaRotaKm: null, distanciaKm: null })),
    ).toBeNull();
  });
});
