/**
 * T14/T15/T19/T20 — Autopreenchimento e assinaturas da viagem de mobilização.
 * Testes de contrato puro: nenhuma rede, nenhuma dependência de RLS.
 */
import { describe, expect, it } from "vitest";
import type { CtViagemRascunho } from "@/types/centralTransporteMobilizacao";
import {
  assinaturaCcViagem,
  assinaturaRota,
  ladosSemGeolocalizacao,
  patchAutoEnderecoCoordenadas,
  rotuloCc,
  temRotaAplicada,
  type CcGeoMap,
} from "../autoPreencherViagem";

const viagem = (over: Partial<CtViagemRascunho> = {}): CtViagemRascunho =>
  ({
    chaveLocal: "v1",
    atendimentoIds: [],
    modalidade: null,
    tipoTransporte: null,
    motoristaId: null,
    motoristaNome: "",
    motoristaCpf: "",
    veiculoTransportadorId: null,
    empresaTransportadoraId: null,
    placaTransportador: "",
    origemCentroCustoId: null,
    destinoCentroCustoId: null,
    origemPontoExato: "",
    destinoPontoExato: "",
    origemColetaLatitude: null,
    origemColetaLongitude: null,
    destinoDescargaLatitude: null,
    destinoDescargaLongitude: null,
    distanciaRotaKm: null,
    duracaoRotaMin: null,
    rotaResumo: null,
    distanciaKm: "",
    recebedorPrevistoFuncionarioId: null,
    recebedorPrevistoNome: "",
    recebedorPrevistoTelefone: "",
    dataPrevistaSaida: "",
    dataPrevistaEntrega: "",
    observacoes: "",
    ...over,
  }) as CtViagemRascunho;

const cadastro: CcGeoMap = {
  "cc-origem": {
    id: "cc-origem",
    codigo: "L123",
    nome: "Obra X",
    endereco: "Rua A, 100 - Centro - Cidade",
    latitude: -22.9,
    longitude: -43.2,
  },
  "cc-destino": {
    id: "cc-destino",
    codigo: "L448",
    nome: "Obra Y",
    endereco: "Rua B, 200",
    latitude: -23.1,
    longitude: -43.5,
  },
  "cc-sem-geo": {
    id: "cc-sem-geo",
    codigo: "L900",
    nome: "Obra Sem GPS",
    endereco: null,
    latitude: null,
    longitude: null,
  },
};

describe("T14/T15 — autopreenchimento de origem e destino", () => {
  it("T14 — preenche coordenadas e ponto da ORIGEM a partir do CC atual do ativo", () => {
    const patch = patchAutoEnderecoCoordenadas(
      viagem({ origemCentroCustoId: "cc-origem" }),
      cadastro,
    );
    expect(patch?.origemColetaLatitude).toBe(-22.9);
    expect(patch?.origemColetaLongitude).toBe(-43.2);
    expect(patch?.origemPontoExato).toBe("Rua A, 100 - Centro - Cidade");
  });

  it("T15 — preenche coordenadas do DESTINO (CC da solicitação)", () => {
    const patch = patchAutoEnderecoCoordenadas(
      viagem({ destinoCentroCustoId: "cc-destino" }),
      cadastro,
    );
    expect(patch?.destinoDescargaLatitude).toBe(-23.1);
    expect(patch?.destinoDescargaLongitude).toBe(-43.5);
  });

  it("nunca sobrescreve ajuste manual do usuário", () => {
    const patch = patchAutoEnderecoCoordenadas(
      viagem({
        origemCentroCustoId: "cc-origem",
        origemColetaLatitude: -1,
        origemColetaLongitude: -2,
        origemPontoExato: "Portão 3 do pátio",
      }),
      cadastro,
    );
    expect(patch).toBeNull();
  });

  it("rótulo do CC vem do cadastro (código — nome)", () => {
    expect(rotuloCc(cadastro["cc-origem"])).toBe("L123 — Obra X");
    expect(rotuloCc(null)).toBe("—");
  });

  it("assinatura de CC é estável — não gera loop de patch", () => {
    const v = viagem({ origemCentroCustoId: "a", destinoCentroCustoId: "b" });
    expect(assinaturaCcViagem(v)).toBe("a|b");
    expect(assinaturaCcViagem({ ...v })).toBe(assinaturaCcViagem(v));
  });
});

describe("T19/T20 — assinatura de rota e ausência de geolocalização", () => {
  const comCoords = viagem({
    origemColetaLatitude: -22.9,
    origemColetaLongitude: -43.2,
    destinoDescargaLatitude: -23.1,
    destinoDescargaLongitude: -43.5,
  });

  it("T19 — assinatura estável com as quatro coordenadas", () => {
    expect(assinaturaRota(comCoords)).toBe("-22.9,-43.2|-23.1,-43.5");
    expect(assinaturaRota({ ...comCoords })).toBe(assinaturaRota(comCoords));
  });

  it("T19-B — mudar coordenada muda a assinatura (recalcula uma vez)", () => {
    const antes = assinaturaRota(comCoords);
    const depois = assinaturaRota({ ...comCoords, destinoDescargaLatitude: -24 });
    expect(depois).not.toBe(antes);
  });

  it("T20 — sem coordenadas não há assinatura: Mapbox não é chamado", () => {
    expect(assinaturaRota(viagem())).toBeNull();
    expect(
      assinaturaRota({ ...comCoords, origemColetaLatitude: null }),
    ).toBeNull();
  });

  it("T20 — lados sem geolocalização são identificados sem inventar 0,0", () => {
    expect(ladosSemGeolocalizacao(viagem())).toEqual(["origem", "destino"]);
    expect(
      ladosSemGeolocalizacao({ ...comCoords, destinoDescargaLatitude: null }),
    ).toEqual(["destino"]);
    expect(ladosSemGeolocalizacao(comCoords)).toEqual([]);

    // CC cadastrado sem coordenada não produz patch de coordenada.
    const patch = patchAutoEnderecoCoordenadas(
      viagem({ origemCentroCustoId: "cc-sem-geo" }),
      cadastro,
    );
    expect(patch).toBeNull();
  });

  it("rota já aplicada é reconhecida (não recalcula)", () => {
    expect(temRotaAplicada(comCoords)).toBe(false);
    expect(temRotaAplicada({ ...comCoords, distanciaRotaKm: 42.8 })).toBe(true);
  });
});
