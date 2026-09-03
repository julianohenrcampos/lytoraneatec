/**
 * CT-4 — Matriz M01–M15 do Movimentação Builder (camada pura).
 */
import { describe, expect, it } from "vitest";
import {
  dataEspecifica,
  dataExibidaParada,
  definirMotoristaViagem,
  definirTransportador,
  movDragId,
  movDropAceita,
  movDropId,
  moverAtivoParaParada,
  paradaDoAtivo,
  parseMovDragId,
  parseMovDropId,
  retirarAtivo,
  vereditoParada,
} from "@/lib/central-transporte/movDiretaBuilder";
import {
  montarPayloadRascunho,
  paradaVazia,
  rascunhoVazio,
  validarRascunho,
} from "@/lib/central-transporte/movDiretaRascunho";
import { hidratarRascunho } from "@/hooks/central-transporte/useCtMovDireta";
import type { CtOrdemMotorista } from "@/types/centralTransporteMobilizacao";

const comDuasParadas = () => {
  const r = rascunhoVazio();
  r.dataPrevistaSaida = "2026-09-02";
  r.origemCentroCustoId = "cc-0";
  r.modalidade = "TRANSPORTADO";
  r.tipoTransporte = "PROPRIO";
  r.paradas[0].centroCustoId = "cc-1";
  const p2 = paradaVazia();
  p2.centroCustoId = "cc-2";
  r.paradas.push(p2);
  return r;
};

describe("movDiretaBuilder", () => {
  it("M01 ativo pode ser vinculado a uma parada", () => {
    const r = moverAtivoParaParada(comDuasParadas(), "eq-1", "");
    expect(r.paradas[0].equipamentos).toEqual([]);

    const base = comDuasParadas();
    const ok = moverAtivoParaParada(base, "eq-1", base.paradas[0].chaveLocal);
    expect(ok.paradas[0].equipamentos).toEqual(["eq-1"]);
    expect(ok.ativosPlanejados).toContain("eq-1");
  });

  it("M02 matriz de drop impede recurso na carga e ativo em slot de pessoa", () => {
    expect(movDropAceita("MOV_ATIVO", { tipo: "MOV_PARADA_CARGA", chaveLocal: "k" })).toBe(true);
    expect(movDropAceita("MOV_ATIVO", { tipo: "MOV_MOTORISTA_SLOT" })).toBe(false);
    expect(movDropAceita("MOV_MOTORISTA", { tipo: "MOV_PARADA_CARGA", chaveLocal: "k" })).toBe(
      false,
    );
    expect(movDropAceita("MOV_TRANSPORTADOR", { tipo: "MOV_TRANSPORTADOR_SLOT" })).toBe(true);
    expect(parseMovDragId(movDragId("MOV_ATIVO", "eq-1"))).toEqual({
      tipo: "MOV_ATIVO",
      id: "eq-1",
    });
    expect(parseMovDropId(movDropId({ tipo: "MOV_PARADA_CARGA", chaveLocal: "k1" }))).toEqual({
      tipo: "MOV_PARADA_CARGA",
      chaveLocal: "k1",
    });
    expect(parseMovDropId("PUXDROP:CANVAS")).toBeNull();
  });

  it("M03/M04 ativo nunca fica em duas paradas e a troca é atômica", () => {
    const base = comDuasParadas();
    const um = moverAtivoParaParada(base, "eq-1", base.paradas[0].chaveLocal);
    const dois = moverAtivoParaParada(um, "eq-1", base.paradas[1].chaveLocal);
    expect(dois.paradas[0].equipamentos).toEqual([]);
    expect(dois.paradas[1].equipamentos).toEqual(["eq-1"]);
    expect(validarRascunho(dois, "RASCUNHO")).toEqual([]);
    expect(paradaDoAtivo(dois, "eq-1")?.indice).toBe(1);
    expect(retirarAtivo(dois, "eq-1").ativosPlanejados).toEqual([]);
  });

  it("M05/M06/M07 recursos globais são definidos, substituídos e removidos", () => {
    let r = definirMotoristaViagem(comDuasParadas(), { id: "f-1", nome: "João" });
    expect(r.motoristaId).toBe("f-1");
    r = definirMotoristaViagem(r, { id: "f-2", nome: "Carlos" });
    expect(r.motoristaNome).toBe("Carlos");
    r = definirMotoristaViagem(r, null);
    expect(r.motoristaId).toBeNull();

    r = definirTransportador(r, { id: "v-1", placa: "ABC1D23" });
    expect(r.veiculoTransportadorId).toBe("v-1");
    r = definirTransportador(r, null);
    expect(r.veiculoTransportadorId).toBeNull();
    expect(r.placaTransportador).toBe("");
  });

  it("M08/M09/M10 recebedor, endereço/GPS e data/hora da parada são preservados", () => {
    const base = comDuasParadas();
    base.paradas[0].recebedorPrevistoNome = "Carlos";
    base.paradas[0].endereco = "Estrada do Guandu, 100";
    base.paradas[0].latitude = -22.85;
    base.paradas[0].longitude = -43.75;
    base.paradas[0].dataPrevista = "2026-09-03";
    base.paradas[0].horaPrevista = "08:30";

    const depois = moverAtivoParaParada(base, "eq-1", base.paradas[1].chaveLocal);
    const p = depois.paradas[0];
    expect(p.recebedorPrevistoNome).toBe("Carlos");
    expect(p.endereco).toBe("Estrada do Guandu, 100");
    expect(p.latitude).toBe(-22.85);
    expect(p.horaPrevista).toBe("08:30");
    expect(dataEspecifica(depois, p)).toBe(true);
    expect(dataExibidaParada(depois, p)).toBe("2026-09-03");
    expect(dataExibidaParada(depois, depois.paradas[1])).toBe("2026-09-02");
    expect(dataEspecifica(depois, depois.paradas[1])).toBe(false);
  });

  it("M11/M12 rota e payload da RPC permanecem idênticos ao contrato atual", () => {
    const base = comDuasParadas();
    base.rotaPlanejada = {
      distanciaKm: 12.5,
      duracaoMin: 30,
      resumo: "BR-101",
      geometria: {
        type: "LineString",
        coordinates: [
          [-43.7, -22.8],
          [-43.75, -22.85],
        ],
      },
    };
    const r = moverAtivoParaParada(base, "eq-1", base.paradas[0].chaveLocal);
    const payload = montarPayloadRascunho(r);
    expect(payload.rota).toEqual({
      distancia_km: 12.5,
      duracao_min: 30,
      resumo: "BR-101",
      geometria: base.rotaPlanejada.geometria,
    });
    expect(payload.ativos_planejados).toEqual(["eq-1"]);
    expect(payload.data_prevista_saida).toBe("2026-09-02");
    expect((payload.paradas as { equipamentos: string[] }[])[0].equipamentos).toEqual(["eq-1"]);
  });

  it("M13 pendências de programação continuam vindo das regras existentes", () => {
    const base = comDuasParadas();
    const r = moverAtivoParaParada(base, "eq-1", base.paradas[0].chaveLocal);
    /* A parada 2 continua vazia — programar exige ativos em toda parada. */
    expect(validarRascunho(r, "PROGRAMAR")).toContain(
      "Parada 2: selecione os ativos entregues nesta parada.",
    );
    expect(vereditoParada(r.paradas[0])).toBe("PRONTA");
    expect(vereditoParada(r.paradas[1])).toBe("INCOMPLETA");
  });

  it("M14 F5 hidrata a mesma estrutura de paradas e cargas", () => {
    const viagem = {
      id: "vg-1",
      codigo: "MOV-2026-000001",
      status: "RASCUNHO",
      dataOrdem: null,
      dataPrevistaSaida: "2026-09-02",
      dataPrevistaEntrega: null,
      modalidade: "TRANSPORTADO",
      tipoTransporte: "PROPRIO",
      motoristaNome: "João",
      motoristaId: "f-1",
      veiculoTransportadorId: "v-1",
      empresaTransportadoraId: null,
      origemCentroCustoId: "cc-0",
      placaTransportador: "ABC1D23",
      empresaTransportadora: null,
      origemCentroCusto: null,
      origemEndereco: "Origem",
      origemPontoExato: null,
      origemLatitude: null,
      origemLongitude: null,
      destinoCentroCusto: null,
      destinoEndereco: null,
      destinoPontoExato: null,
      destinoLatitude: null,
      destinoLongitude: null,
      distanciaKm: null,
      distanciaRotaKm: null,
      duracaoRotaMin: null,
      rotaResumo: null,
      rotaGeometria: null,
      recebedorPrevistoNome: null,
      recebedorPrevistoTelefone: null,
      observacoes: null,
      cargas: [],
      origemFluxo: "MOVIMENTACAO_DIRETA",
      solicitacaoId: null,
      paradas: [
        {
          id: "p-1",
          ordem: 1,
          status: "PENDENTE",
          centroCustoId: "cc-1",
          ccCodigo: null,
          ccNome: null,
          endereco: "Obra",
          pontoExato: null,
          latitude: -22.85,
          longitude: -43.75,
          dataPrevista: null,
          horaPrevista: null,
          observacao: null,
          recebedorPrevistoFuncionarioId: "f-9",
          recebedorPrevistoNome: null,
          chegadaRegistradaEm: null,
          concluidaEm: null,
          cargas: [
            {
              movimentacaoId: "m-1",
              statusMovimentacao: "RASCUNHO",
              equipamentoId: "eq-1",
              frota: "LYC",
              numeroFrota: "003",
              placa: null,
              tipoAtivo: "Caminhão",
              modelo: null,
            },
          ],
        },
      ],
    } as unknown as CtOrdemMotorista;

    const r = hidratarRascunho(viagem);
    expect(r.paradas).toHaveLength(1);
    expect(r.paradas[0].equipamentos).toEqual(["eq-1"]);
    expect(paradaDoAtivo(r, "eq-1")?.indice).toBe(0);
    expect(r.motoristaId).toBe("f-1");
  });

  it("M15 somente leitura: as funções puras não mutam o rascunho original", () => {
    const base = comDuasParadas();
    const copia = JSON.parse(JSON.stringify(base));
    moverAtivoParaParada(base, "eq-1", base.paradas[0].chaveLocal);
    definirMotoristaViagem(base, { id: "f-1", nome: "João" });
    retirarAtivo(base, "eq-1");
    expect(JSON.parse(JSON.stringify(base))).toEqual(copia);
  });
});
