/**
 * CT-3C R2 — Testes das regras puras da mobilização (rodante x transportado,
 * agrupamento, mobilização parcial, hidratação e idempotência).
 */
import { describe, it, expect } from "vitest";
import {
  atribuirAtivoAViagem,
  chaveMaterialRascunho,
  criarViagemVazia,
  hidratarRascunho,
  indiceAtendimentos,
  rotuloAtivo,
  sugerirModalidade,
  validarProgramacao,
  validarRascunho,
} from "@/lib/central-transporte/mobilizacaoRascunho";
import type {
  CtAtivoMobilizavel,
  CtMobilizacaoEstado,
  CtPlanejamento,
  CtViagem,
  CtViagemRascunho,
} from "@/types/centralTransporteMobilizacao";

const ativo = (id: string, over: Partial<CtAtivoMobilizavel> = {}): CtAtivoMobilizavel => ({
  atendimentoId: id,
  solicitacaoItemId: "item-1",
  equipamentoId: `eq-${id}`,
  frota: "CA",
  numeroFrota: id.toUpperCase(),
  placa: null,
  statusAtendimento: "RESERVADO",
  periodoInicio: "2026-08-05",
  periodoFim: "2026-08-10",
  centroCustoAtualId: "cc-origem",
  centroCustoAtualNome: "OBRA A",
  movimentacaoId: null,
  movimentacaoStatus: null,
  viagemId: null,
  ...over,
});

const viagemTransportadoPropria = (over: Partial<CtViagemRascunho> = {}): CtViagemRascunho => ({
  ...criarViagemVazia(),
  modalidade: "TRANSPORTADO",
  tipoTransporte: "PROPRIO",
  motoristaId: "func-1",
  veiculoTransportadorId: "veic-1",
  origemCentroCustoId: "cc-1",
  destinoCentroCustoId: "cc-2",
  dataPrevistaSaida: "2026-08-04",
  dataProgramada: "2026-08-05",
  ...over,
});

const viagemServidor = (over: Partial<CtViagem> = {}): CtViagem => ({
  id: "vg-1",
  codigo: "VG-000001",
  status: "RASCUNHO",
  modalidade: "RODANTE",
  tipoTransporte: null,
  motoristaId: "func-1",
  motoristaNomeSnapshot: "RAMON",
  motoristaCpfSnapshot: "11122233344",
  veiculoTransportadorId: null,
  placaTransportadorSnapshot: null,
  empresaTransportadoraId: null,
  empresaTransportadoraNomeSnapshot: null,
  origemCentroCustoId: "cc-1",
  origemCcCodigoSnapshot: "0001",
  origemCcNomeSnapshot: "OBRA A",
  origemCcEnderecoSnapshot: null,
  destinoCentroCustoId: "cc-2",
  destinoCcCodigoSnapshot: "0002",
  destinoCcNomeSnapshot: "OBRA B",
  destinoCcEnderecoSnapshot: null,
  dataPrevistaSaida: "2026-08-04",
  dataPrevistaEntrega: "2026-08-05",
  distanciaKm: 120,
  observacoes: null,
  atendimentoIds: ["at-1"],
  ...over,
});

const planejamento = (viagens: CtViagem[]): CtPlanejamento => ({
  id: "plan-1",
  versao: 2,
  status: "RASCUNHO",
  vigente: false,
  lockVersion: 3,
  contentHash: "abc",
  dataPrevistaEntrega: null,
  observacoes: null,
  programadoEm: null,
  revisaoDePlanejamentoId: null,
  viagens,
});

const estadoCom = (viagens: CtViagem[], ativos: CtAtivoMobilizavel[]): CtMobilizacaoEstado => ({
  ok: true,
  solicitacaoId: "sol-1",
  planejamentoVigente: null,
  rascunhoEmEdicao: planejamento(viagens),
  ativos,
  viagens,
});

describe("CT-3C R2 — rascunho de mobilização", () => {
  it("atribui o ativo a uma viagem e o remove das demais", () => {
    const v1 = criarViagemVazia();
    const v2 = criarViagemVazia();
    let viagens = [v1, v2];

    viagens = atribuirAtivoAViagem(viagens, "at-1", v1.chaveLocal);
    expect(viagens[0].atendimentoIds).toEqual(["at-1"]);

    viagens = atribuirAtivoAViagem(viagens, "at-1", v2.chaveLocal);
    expect(viagens[0].atendimentoIds).toEqual([]);
    expect(viagens[1].atendimentoIds).toEqual(["at-1"]);

    viagens = atribuirAtivoAViagem(viagens, "at-1", null);
    expect(indiceAtendimentos(viagens).size).toBe(0);
  });

  it("exige modalidade e acusa data de saída posterior à mobilização", () => {
    const v = { ...criarViagemVazia(), dataPrevistaSaida: "2026-08-10", dataProgramada: "2026-08-05" };
    const problemas = validarRascunho([v]);
    expect(problemas.some((p) => p.mensagem.includes("modalidade"))).toBe(true);
    expect(problemas.some((p) => p.mensagem.includes("posterior"))).toBe(true);
  });

  it("limita a viagem rodante a um único ativo", () => {
    const v = { ...criarViagemVazia(), modalidade: "RODANTE" as const, atendimentoIds: ["at-1", "at-2"] };
    expect(validarRascunho([v]).some((p) => p.mensagem.includes("exatamente um ativo"))).toBe(true);
  });

  it("exige tipo de transporte quando a viagem é transportada", () => {
    const v = { ...criarViagemVazia(), modalidade: "TRANSPORTADO" as const };
    expect(validarRascunho([v]).some((p) => p.mensagem.includes("próprio ou de terceiro"))).toBe(
      true,
    );
  });

  it("permite mobilização parcial: ativo fora de viagem não bloqueia", () => {
    const v = viagemTransportadoPropria({ atendimentoIds: ["at-1"] });
    const problemas = validarProgramacao([v], [ativo("at-1"), ativo("at-2")]);
    expect(problemas).toEqual([]);
  });

  it("exige motorista na viagem rodante", () => {
    const v = {
      ...criarViagemVazia(),
      modalidade: "RODANTE" as const,
      origemCentroCustoId: "cc-1",
      destinoCentroCustoId: "cc-2",
      dataProgramada: "2026-08-05",
      atendimentoIds: ["at-1"],
    };
    expect(
      validarProgramacao([v], [ativo("at-1")]).some((p) => p.mensagem.includes("motorista")),
    ).toBe(true);
  });

  it("exige transportadora, placa e motorista no transporte de terceiro", () => {
    const v = viagemTransportadoPropria({
      tipoTransporte: "TERCEIRO",
      motoristaId: null,
      veiculoTransportadorId: null,
      atendimentoIds: ["at-1"],
    });
    expect(
      validarProgramacao([v], [ativo("at-1")]).some((p) => p.mensagem.includes("terceiro")),
    ).toBe(true);
  });

  it("bloqueia origem/destino ausentes e data de mobilização posterior à reserva", () => {
    const v = viagemTransportadoPropria({
      origemCentroCustoId: null,
      destinoCentroCustoId: null,
      dataProgramada: "2026-08-09",
      atendimentoIds: ["at-1"],
    });
    const problemas = validarProgramacao([v], [ativo("at-1")]);
    expect(problemas.some((p) => p.mensagem.includes("origem"))).toBe(true);
    expect(problemas.some((p) => p.mensagem.includes("início do período"))).toBe(true);
  });

  it("impede que o transportador seja carga da própria viagem", () => {
    const v = viagemTransportadoPropria({
      veiculoTransportadorId: "eq-at-1",
      atendimentoIds: ["at-1"],
    });
    expect(
      validarProgramacao([v], [ativo("at-1")]).some((p) => p.mensagem.includes("carga")),
    ).toBe(true);
  });

  it("exige ao menos uma viagem com ativos", () => {
    const problemas = validarProgramacao([criarViagemVazia()], []);
    expect(problemas.some((p) => p.mensagem.includes("ao menos uma viagem"))).toBe(true);
  });

  it("hidrata o rascunho do servidor preservando ids e snapshots resolvidos", () => {
    const estado = estadoCom([viagemServidor()], [ativo("at-1")]);
    const rascunho = hidratarRascunho(estado);

    expect(rascunho).toHaveLength(1);
    expect(rascunho[0].id).toBe("vg-1");
    expect(rascunho[0].modalidade).toBe("RODANTE");
    expect(rascunho[0].motoristaId).toBe("func-1");
    // motorista canônico: nome/CPF não são reeditados no cliente
    expect(rascunho[0].motoristaNome).toBe("");
    expect(rascunho[0].dataProgramada).toBe("2026-08-05");
    expect(rascunho[0].distanciaKm).toBe("120");
    expect(validarProgramacao(rascunho, estado.ativos)).toEqual([]);
  });

  it("mantém a chave material estável para o mesmo agrupamento (idempotência)", () => {
    const base = viagemTransportadoPropria({ atendimentoIds: ["at-2", "at-1"] });
    const igual = { ...base, chaveLocal: "outra-chave", atendimentoIds: ["at-1", "at-2"] };
    expect(chaveMaterialRascunho("sol-1", [base])).toBe(chaveMaterialRascunho("sol-1", [igual]));

    const diferente = { ...base, motoristaId: "func-2" };
    expect(chaveMaterialRascunho("sol-1", [base])).not.toBe(
      chaveMaterialRascunho("sol-1", [diferente]),
    );
  });

  it("sugere modalidade rodante para ativo com placa", () => {
    expect(sugerirModalidade(ativo("at-1", { placa: "ABC1D23" }))).toBe("RODANTE");
    expect(sugerirModalidade(ativo("at-1"))).toBe("TRANSPORTADO");
  });

  it("rotula o ativo por frota e número, com fallback para placa", () => {
    expect(rotuloAtivo(ativo("at-1"))).toBe("CA-AT-1");
    expect(rotuloAtivo(ativo("at-1", { frota: null, numeroFrota: null, placa: "ABC1D23" }))).toBe(
      "ABC1D23",
    );
  });
});
