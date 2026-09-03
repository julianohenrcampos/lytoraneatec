/**
 * CT-5 — Matriz P01–P11 do Puxada Builder (camada pura).
 */
import { describe, expect, it } from "vitest";
import {
  adicionarCaminhao,
  definirMotorista,
  frotaCompleta,
  motoristaEmUso,
  parsePuxDragId,
  parsePuxDropId,
  pendenciasFrota,
  puxDragId,
  puxDropAceita,
  puxDropId,
  removerCaminhao,
  vereditoCaminhao,
} from "@/lib/central-transporte/puxadaBuilder";
import {
  hidratarPuxada,
  montarPayloadPuxada,
  rascunhoPuxadaVazio,
} from "@/lib/central-transporte/puxadaRascunho";
import type { CtPuxada } from "@/types/centralTransportePuxada";

const base = () => {
  const r = rascunhoPuxadaVazio();
  r.dataPuxada = "2026-09-02";
  r.centroCustoId = "cc-1";
  return r;
};

describe("puxadaBuilder", () => {
  it("P01 caminhão pode ser adicionado ao canvas", () => {
    const r = adicionarCaminhao(base(), {
      caminhaoEquipamentoId: "cam-1",
      rotulo: "LOK-313",
      placa: "ABC1D23",
    });
    expect(r.caminhoes).toHaveLength(1);
    expect(r.caminhoes[0].rotulo).toBe("LOK-313");
  });

  it("P02 caminhão duplicado não entra", () => {
    let r = adicionarCaminhao(base(), { caminhaoEquipamentoId: "cam-1", rotulo: "LOK-313" });
    r = adicionarCaminhao(r, { caminhaoEquipamentoId: "cam-1", rotulo: "LOK-313" });
    expect(r.caminhoes).toHaveLength(1);
  });

  it("P03 motorista pode ser atribuído ao caminhão", () => {
    let r = adicionarCaminhao(base(), { caminhaoEquipamentoId: "cam-1", rotulo: "LOK-313" });
    r = definirMotorista(r, r.caminhoes[0].chaveLocal, { id: "f-1", nome: "João" });
    expect(r.caminhoes[0].motoristaFuncionarioId).toBe("f-1");
    expect(vereditoCaminhao(r.caminhoes[0])).toBe("PRONTO");
  });

  it("P04 motorista pode ser removido e substituído", () => {
    let r = adicionarCaminhao(base(), { caminhaoEquipamentoId: "cam-1", rotulo: "LOK-313" });
    const chave = r.caminhoes[0].chaveLocal;
    r = definirMotorista(r, chave, { id: "f-1", nome: "João" });
    r = definirMotorista(r, chave, { id: "f-2", nome: "Carlos" });
    expect(r.caminhoes[0].motoristaNome).toBe("Carlos");
    r = definirMotorista(r, chave, null);
    expect(r.caminhoes[0].motoristaFuncionarioId).toBeNull();
    expect(vereditoCaminhao(r.caminhoes[0])).toBe("INCOMPLETO");
  });

  it("P05 matriz de drop rejeita combinações inválidas", () => {
    expect(puxDropAceita("PUX_CAMINHAO", { tipo: "PUX_CANVAS" })).toBe(true);
    expect(
      puxDropAceita("PUX_CAMINHAO", { tipo: "PUX_MOTORISTA_SLOT", chaveLocal: "c" }),
    ).toBe(false);
    expect(puxDropAceita("PUX_MOTORISTA", { tipo: "PUX_CANVAS" })).toBe(false);
    expect(parsePuxDragId(puxDragId("PUX_MOTORISTA", "f-1"))).toEqual({
      tipo: "PUX_MOTORISTA",
      id: "f-1",
    });
    expect(parsePuxDropId(puxDropId({ tipo: "PUX_MOTORISTA_SLOT", chaveLocal: "k1" }))).toEqual({
      tipo: "PUX_MOTORISTA_SLOT",
      chaveLocal: "k1",
    });
    expect(parsePuxDragId("QUALQUER:x")).toBeNull();
    expect(parsePuxDropId("DROP:CANVAS")).toBeNull();
  });

  it("P06 data e centro de custo continuam preservados no payload", () => {
    let r = adicionarCaminhao(base(), { caminhaoEquipamentoId: "cam-1", rotulo: "LOK-313" });
    r = definirMotorista(r, r.caminhoes[0].chaveLocal, { id: "f-1", nome: "João" });
    const payload = montarPayloadPuxada(r);
    expect(payload.data_puxada).toBe("2026-09-02");
    expect(payload.centro_custo_id).toBe("cc-1");
    expect(payload.caminhoes).toEqual([
      { caminhao_equipamento_id: "cam-1", motorista_funcionario_id: "f-1" },
    ]);
  });

  it("P07 trajeto e rota permanecem intocados pelo builder", () => {
    const r = base();
    r.coletaEndereco = "Usina";
    r.coletaLatitude = -22.8;
    r.coletaLongitude = -43.7;
    const depois = adicionarCaminhao(r, { caminhaoEquipamentoId: "cam-1", rotulo: "LOK-313" });
    expect(depois.coletaEndereco).toBe("Usina");
    expect(depois.coletaLatitude).toBe(-22.8);
    expect(depois.coletaLongitude).toBe(-43.7);
  });

  it("P04b remover caminhão não afeta os demais", () => {
    let r = adicionarCaminhao(base(), { caminhaoEquipamentoId: "cam-1", rotulo: "LOK-313" });
    r = adicionarCaminhao(r, { caminhaoEquipamentoId: "cam-2", rotulo: "LYC-145" });
    r = removerCaminhao(r, r.caminhoes[0].chaveLocal);
    expect(r.caminhoes.map((c) => c.caminhaoEquipamentoId)).toEqual(["cam-2"]);
  });

  it("P10 reload hidrata o rascunho a partir do estado autoritativo", () => {
    const servidor = {
      id: "pux-1",
      codigo: "PUX-2026-000001",
      status: "RASCUNHO",
      dataPuxada: "2026-09-02",
      centroCustoId: "cc-1",
      ccCodigo: "L448",
      ccNome: "Obra",
      planejadorNome: "Planejador",
      coleta: { endereco: "Usina", latitude: -22.8, longitude: -43.7 },
      descarga: { endereco: "Obra", latitude: -22.85, longitude: -43.75 },
      distanciaRotaKm: 42,
      duracaoRotaMin: 55,
      rotaResumo: "BR-101",
      rotaGeometria: null,
      observacoes: null,
      programadaEm: null,
      canceladoEm: null,
      motivoCancelamento: null,
      caminhoes: [
        {
          id: "pc-1",
          caminhaoEquipamentoId: "cam-1",
          frota: "LOK-313",
          placa: "ABC1D23",
          motoristaFuncionarioId: "f-1",
          motoristaNome: "João",
        },
      ],
      totalCaminhoes: 1,
    } as CtPuxada;
    const r = hidratarPuxada(servidor);
    expect(r.caminhoes).toHaveLength(1);
    expect(r.caminhoes[0].motoristaFuncionarioId).toBe("f-1");
    expect(frotaCompleta(r)).toBe(true);
  });

  it("P11 caminhão sem motorista gera pendência de salvamento", () => {
    const r = adicionarCaminhao(base(), {
      caminhaoEquipamentoId: "cam-1",
      rotulo: "LOK-313",
    });
    expect(pendenciasFrota(r)).toEqual(["Caminhão LOK-313 sem motorista."]);
    expect(frotaCompleta(r)).toBe(false);
  });

  it("motorista repetido na mesma puxada é sinalizado", () => {
    let r = adicionarCaminhao(base(), { caminhaoEquipamentoId: "cam-1", rotulo: "A" });
    r = adicionarCaminhao(r, { caminhaoEquipamentoId: "cam-2", rotulo: "B" });
    r = definirMotorista(r, r.caminhoes[0].chaveLocal, { id: "f-1", nome: "João" });
    expect(motoristaEmUso(r, "f-1")).toBe(true);
    expect(motoristaEmUso(r, "f-1", r.caminhoes[0].chaveLocal)).toBe(false);
  });
});
