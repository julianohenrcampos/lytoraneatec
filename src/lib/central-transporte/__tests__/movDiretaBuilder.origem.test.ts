/**
 * CT-4 — Matriz M01–M20 do Movimentação Builder unificado (origem no canvas).
 *
 * Camada PURA: nenhum backend novo. Os invariantes continuam sendo cobrados
 * server-side por fn_ct_mov_direta_salvar_rascunho / _programar.
 */
import { describe, expect, it } from "vitest";
import {
  criarParadaComLocal,
  definirDestinoParada,
  definirMotoristaViagem,
  definirOrigemPorLocal,
  definirRecebedorParada,
  definirTransportador,
  movDropAceita,
  movDropId,
  moverAtivoParaParada,
  parseMovDropId,
  pendenciasMovimentacao,
  type MovLocal,
} from "@/lib/central-transporte/movDiretaBuilder";
import {
  montarPayloadRascunho,
  paradaVazia,
  rascunhoVazio,
} from "@/lib/central-transporte/movDiretaRascunho";
import {
  ETAPAS,
  errosDaEtapa,
} from "@/lib/central-transporte/movDiretaWizardSteps";

const local: MovLocal = {
  id: "cc-1",
  rotulo: "L503 — INEA",
  endereco: "Avenida Joaquim da Costa Lima, 100",
  latitude: -22.9,
  longitude: -43.2,
};

describe("CT-4 — Movimentação Builder unificado", () => {
  it("M01 — CC é arrastável para a origem e para o destino da parada", () => {
    expect(movDropAceita("MOV_LOCAL", { tipo: "MOV_ORIGEM" })).toBe(true);
    expect(
      movDropAceita("MOV_LOCAL", { tipo: "MOV_PARADA_DESTINO", chaveLocal: "p1" }),
    ).toBe(true);
    expect(movDropAceita("MOV_LOCAL", { tipo: "MOV_MOTORISTA_SLOT" })).toBe(false);
    expect(parseMovDropId(movDropId({ tipo: "MOV_ORIGEM" }))).toEqual({ tipo: "MOV_ORIGEM" });
    expect(
      parseMovDropId(movDropId({ tipo: "MOV_PARADA_DESTINO", chaveLocal: "p1" })),
    ).toEqual({ tipo: "MOV_PARADA_DESTINO", chaveLocal: "p1" });
  });

  it("M02 — origem herda endereço e GPS canônicos do cadastro", () => {
    const r = definirOrigemPorLocal(rascunhoVazio(), local);
    expect(r.origemCentroCustoId).toBe("cc-1");
    expect(r.origemEndereco).toBe(local.endereco);
    expect(r.origemLatitude).toBe(-22.9);
    expect(r.origemLongitude).toBe(-43.2);
  });

  it("M03 — ponto ajustado manualmente não é sobrescrito pelo local", () => {
    const base = { ...rascunhoVazio(), origemPontoExato: "Portão 3", origemLatitude: -1, origemLongitude: -2 };
    const r = definirOrigemPorLocal(base, local);
    expect(r.origemCentroCustoId).toBe("cc-1");
    expect(r.origemLatitude).toBe(-1);
    expect(r.origemLongitude).toBe(-2);
    expect(r.origemPontoExato).toBe("Portão 3");
  });

  it("M06/M07/M08 — motorista e transportador atribuídos e removidos", () => {
    let r = definirMotoristaViagem(rascunhoVazio(), { id: "m1", nome: "Adilson" });
    expect(r.motoristaId).toBe("m1");
    r = definirMotoristaViagem(r, { id: "m2", nome: "Carlos" });
    expect(r.motoristaNome).toBe("Carlos");
    r = definirMotoristaViagem(r, null);
    expect(r.motoristaId).toBeNull();
    r = definirTransportador(r, { id: "v1", placa: "ABC1D23" });
    expect(r.veiculoTransportadorId).toBe("v1");
    r = definirTransportador(r, null);
    expect(r.placaTransportador).toBe("");
  });

  it("M09/M14 — parada recebe CC preservando endereço/GPS canônicos", () => {
    const base = rascunhoVazio();
    const r = definirDestinoParada(base, base.paradas[0].chaveLocal, local);
    expect(r.paradas[0].centroCustoId).toBe("cc-1");
    expect(r.paradas[0].endereco).toBe(local.endereco);
    expect(r.paradas[0].latitude).toBe(-22.9);
  });

  it("M11/M12 — ativo nunca fica em duas paradas e pode ser movido", () => {
    let r = rascunhoVazio();
    const p2 = paradaVazia();
    r = { ...r, paradas: [...r.paradas, p2] };
    r = moverAtivoParaParada(r, "eq-1", r.paradas[0].chaveLocal);
    r = moverAtivoParaParada(r, "eq-1", p2.chaveLocal);
    expect(r.paradas[0].equipamentos).toEqual([]);
    expect(r.paradas[1].equipamentos).toEqual(["eq-1"]);
  });

  it("M13 — recebedor é atribuído e limpo na parada", () => {
    const base = rascunhoVazio();
    const chave = base.paradas[0].chaveLocal;
    let r = definirRecebedorParada(base, chave, { id: "f1", nome: "Carlos Silva" });
    expect(r.paradas[0].recebedorPrevistoFuncionarioId).toBe("f1");
    r = definirRecebedorParada(r, chave, null);
    expect(r.paradas[0].recebedorPrevistoFuncionarioId).toBeNull();
  });

  it("M15/M16 — nova parada por drop de local herda a data padrão", () => {
    const base = { ...rascunhoVazio(), dataPrevistaSaida: "2026-09-01" };
    const r = criarParadaComLocal(base, local, paradaVazia());
    expect(r.paradas).toHaveLength(2);
    expect(r.paradas[1].centroCustoId).toBe("cc-1");
    expect(r.paradas[1].dataPrevista).toBe("");
  });

  it("M17 — payload da RPC continua idêntico ao contrato atual", () => {
    let r = definirOrigemPorLocal({ ...rascunhoVazio(), dataPrevistaSaida: "2026-09-01" }, local);
    r = definirDestinoParada(r, r.paradas[0].chaveLocal, local);
    const payload = montarPayloadRascunho(r) as Record<string, unknown>;
    expect(payload.origem_centro_custo_id).toBe("cc-1");
    expect(payload.data_prevista_saida).toBe("2026-09-01");
    expect(Object.keys(payload).sort()).toEqual(
      [
        "ativos_planejados",
        "data_prevista_saida",
        "empresa_transportadora_id",
        "modalidade",
        "motorista_id",
        "motorista_nome",
        "observacoes",
        "origem_centro_custo_id",
        "origem_endereco",
        "origem_latitude",
        "origem_longitude",
        "origem_ponto_exato",
        "paradas",
        "placa_transportador",
        "rota",
        "tipo_transporte",
        "veiculo_transportador_id",
      ].sort(),
    );
  });

  it("M19 — wizard visual tem apenas montagem e revisão", () => {
    expect(ETAPAS.map((e) => e.id)).toEqual(["MONTAGEM", "REVISAO"]);
    const vazio = rascunhoVazio();
    const erros = errosDaEtapa(vazio, "MONTAGEM");
    expect(erros.some((e) => e.includes("origem"))).toBe(true);
    expect(erros.some((e) => e.includes("modalidade"))).toBe(true);
    expect(errosDaEtapa(vazio, "REVISAO")).toEqual([]);
  });

  it("M18/M20 — pendências visuais espelham os invariantes do servidor", () => {
    const pendencias = pendenciasMovimentacao(rascunhoVazio());
    expect(pendencias).toContain("Origem não definida");
    expect(pendencias).toContain("Motorista não definido");
    expect(pendencias).toContain("Parada 1 sem destino");
    expect(pendencias).toContain("Parada 1 sem recebedor");

    let pronto = definirOrigemPorLocal(
      { ...rascunhoVazio(), dataPrevistaSaida: "2026-09-01", modalidade: "RODANTE" },
      local,
    );
    pronto = definirMotoristaViagem(pronto, { id: "m1", nome: "Adilson" });
    pronto = definirDestinoParada(pronto, pronto.paradas[0].chaveLocal, local);
    pronto = definirRecebedorParada(pronto, pronto.paradas[0].chaveLocal, {
      id: "f1",
      nome: "Carlos",
    });
    pronto = moverAtivoParaParada(pronto, "eq-1", pronto.paradas[0].chaveLocal);
    expect(pendenciasMovimentacao(pronto)).toEqual([]);
  });
});
