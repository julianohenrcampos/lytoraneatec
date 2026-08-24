import { describe, it, expect } from "vitest";
import {
  ALERTA_CONFLITO_CADASTRAL,
  MOTIVO_UNIDADE_AUSENTE,
  SEM_CENTRO_CUSTO_LABEL,
  avaliarCapacidade,
  casaBusca,
  derivarDisponibilidadeMovimentacao,
  detectarConflitoCadastral,
  estadoAposEncerramentoOs,
  statusRegularizacaoSemRegistro,
  escolherRegistroOperacionalMaisRecente,
  indexarDisponibilidadePorEquipamento,
  montarChaveOrdenacao,
  montarTextoBusca,
  normalizarStatusOperacional,
  normalizarUnidade,
  ordenarPorChave,
  reconciliarAtivo,
  rotuloCentroCusto,
} from "../reconciliacaoOperacional";

const linha = (over: Record<string, unknown> = {}) => ({
  id: "d1",
  equipamento_id: "e1",
  status_operacional: "DISPONIVEL",
  previsao_liberacao: null,
  confiabilidade_previsao: null,
  created_at: null,
  updated_at: null,
  ...over,
});

describe("normalização", () => {
  it("ativo sem registro de disponibilidade vira SEM_STATUS (visível, não excluído)", () => {
    expect(normalizarStatusOperacional(false, null)).toBe("SEM_STATUS");
  });

  it("status desconhecido não é descartado — vira DESCONHECIDO", () => {
    expect(normalizarStatusOperacional(true, "qualquer-coisa")).toBe("DESCONHECIDO");
  });

  it("unidade é canonizada por trim + uppercase", () => {
    expect(normalizarUnidade("  ton ")).toBe("TON");
    expect(normalizarUnidade("")).toBeNull();
  });
});

describe("registro operacional mais recente", () => {
  it("desempata por updated_at > created_at > id", () => {
    const escolhido = escolherRegistroOperacionalMaisRecente([
      linha({ id: "a", updated_at: "2026-01-01T00:00:00Z" }),
      linha({ id: "b", updated_at: "2026-02-01T00:00:00Z" }),
    ]);
    expect(escolhido?.id).toBe("b");

    const porCreated = escolherRegistroOperacionalMaisRecente([
      linha({ id: "a", created_at: "2026-01-01T00:00:00Z" }),
      linha({ id: "b", created_at: "2026-03-01T00:00:00Z" }),
    ]);
    expect(porCreated?.id).toBe("b");

    const porId = escolherRegistroOperacionalMaisRecente([linha({ id: "a" }), linha({ id: "z" })]);
    expect(porId?.id).toBe("z");
  });

  it("indexa uma única linha vencedora por equipamento", () => {
    const idx = indexarDisponibilidadePorEquipamento([
      linha({ id: "a", equipamento_id: "e1", updated_at: "2026-01-01T00:00:00Z" }),
      linha({ id: "b", equipamento_id: "e1", updated_at: "2026-05-01T00:00:00Z" }),
      linha({ id: "c", equipamento_id: "e2" }),
    ]);
    expect(idx.get("e1")?.id).toBe("b");
    expect(idx.get("e2")?.id).toBe("c");
  });
});

describe("conflito cadastral", () => {
  it("sinaliza divergência entre situação cadastral e disponibilidade, sem esconder o ativo", () => {
    const r = detectarConflitoCadastral("Em Manutenção", "DISPONIVEL");
    expect(r.possuiConflitoCadastral).toBe(true);
    expect(r.conflitoCadastralMotivo).toContain(ALERTA_CONFLITO_CADASTRAL.slice(0, 10));
  });

  it("não acusa conflito quando cadastro e operação concordam", () => {
    expect(detectarConflitoCadastral("Disponível", "DISPONIVEL").possuiConflitoCadastral).toBe(false);
  });
});

describe("capacidade", () => {
  it("valor igual com unidade ausente no ativo ⇒ PARCIAL com motivo explícito", () => {
    const r = avaliarCapacidade({ capacidade_valor: 10, capacidade_unidade: null }, { valor: 10, unidade: "TON" });
    expect(r.matchTipo).toBe("PARCIAL");
    expect(r.matchMotivo).toBe(MOTIVO_UNIDADE_AUSENTE);
  });

  it("valor e unidade iguais ⇒ EXATO", () => {
    const r = avaliarCapacidade({ capacidade_valor: 10, capacidade_unidade: " ton " }, { valor: 10, unidade: "TON" });
    expect(r.matchTipo).toBe("EXATO");
    expect(r.matchMotivo).toBeNull();
  });

  it("sem capacidade solicitada mantém o fallback do matching", () => {
    const r = avaliarCapacidade({ capacidade_valor: null, capacidade_unidade: null }, { valor: null, unidade: null });
    expect(r.matchTipo).toBe("EXATO");
  });
});

describe("busca e ordenação", () => {
  it("casa por frota, placa e centro de custo, ignorando caixa e acentos", () => {
    const texto = montarTextoBusca(["LYC001", "001", "KMT6874", "Lytorânea", "CC-10", "Obra Norte"]);
    expect(casaBusca(texto, "kmt6874")).toBe(true);
    expect(casaBusca(texto, "lytoranea")).toBe(true);
    expect(casaBusca(texto, "obra norte")).toBe(true);
    expect(casaBusca(texto, "inexistente")).toBe(false);
    expect(casaBusca(texto, "")).toBe(true);
  });

  it("ordena de forma estável e determinística por chave + id", () => {
    const itens = [
      { equipamentoId: "b", chaveOrdenacao: "2|X" },
      { equipamentoId: "a", chaveOrdenacao: "2|X" },
      { equipamentoId: "c", chaveOrdenacao: "1|A" },
    ];
    expect(ordenarPorChave(itens).map((i) => i.equipamentoId)).toEqual(["c", "a", "b"]);
    expect(ordenarPorChave(itens)).not.toBe(itens);
  });

  it("chave de ordenação é uma string estável", () => {
    const chave = montarChaveOrdenacao({
      statusOperacional: "DISPONIVEL",
      possuiCentroCustoAtual: true,
      matchTipo: "EXATO",
      jaNoCentroCustoDestino: false,
      previsaoLiberacao: null,
      equipamentoId: "e1",
      frota: "LYC",
      numeroFrota: "001",
      placa: "KMT6874",
    });
    expect(typeof chave).toBe("string");
    expect(chave.length).toBeGreaterThan(0);
  });
});

describe("reconciliarAtivo", () => {
  const ativo = {
    id: "e1",
    frota: "LYC",
    numero_frota: "001",
    placa: "KMT6874",
    situacao: "Disponível",
    capacidade_valor: 10,
    capacidade_unidade: null,
  };

  it("ativo sem disponibilidade e sem CC permanece visível e devidamente rotulado", () => {
    const e = reconciliarAtivo(ativo, null, {
      centroCustoAtualId: null,
      centroCustoAtualCodigo: null,
      centroCustoAtualNome: null,
    });
    expect(e.statusOperacional).toBe("SEM_STATUS");
    expect(e.possuiRegistroDisponibilidade).toBe(false);
    expect(e.possuiCentroCustoAtual).toBe(false);
    expect(rotuloCentroCusto(e)).toBe(SEM_CENTRO_CUSTO_LABEL);
  });

  it("marca ativo que já está no centro de custo de destino", () => {
    const e = reconciliarAtivo(ativo, linha(), {
      centroCustoAtualId: "cc-1",
      centroCustoAtualCodigo: "CC-1",
      centroCustoAtualNome: "Obra Norte",
    }, { centroCustoDestinoId: "cc-1" });
    expect(e.jaNoCentroCustoDestino).toBe(true);
    expect(e.bloqueioMotivo).toBeNull();
  });

  it("ativo em manutenção fica visível porém bloqueado com motivo", () => {
    const e = reconciliarAtivo(ativo, linha({ status_operacional: "MANUTENCAO" }), {
      centroCustoAtualId: null,
      centroCustoAtualCodigo: null,
      centroCustoAtualNome: null,
    });
    expect(e.statusOperacional).toBe("MANUTENCAO");
    expect(e.bloqueioMotivo).toBeTruthy();
    expect(e.possuiConflitoCadastral).toBe(true);
  });
});

describe("disponibilidade para movimentação (regra única)", () => {
  const HOJE = "2026-08-20";

  it("OS aberta tem precedência sobre ALOCADO com previsão vencida", () => {
    const r = derivarDisponibilidadeMovimentacao(
      { statusOperacional: "ALOCADO", previsaoLiberacao: "2026-08-01", temOsAberta: true },
      HOJE,
    );
    expect(r.estado).toBe("MANUTENCAO");
    expect(r.disponivelParaMovimentacao).toBe(false);
  });

  it("ALOCADO com previsão hoje libera desmobilização", () => {
    const r = derivarDisponibilidadeMovimentacao(
      { statusOperacional: "ALOCADO", previsaoLiberacao: HOJE },
      HOJE,
    );
    expect(r.estado).toBe("DISPONIVEL_DESMOBILIZACAO");
    expect(r.disponivelParaMovimentacao).toBe(true);
  });

  it("ALOCADO com previsão anterior libera desmobilização", () => {
    const r = derivarDisponibilidadeMovimentacao(
      { statusOperacional: "ALOCADO", previsaoLiberacao: "2026-07-31" },
      HOJE,
    );
    expect(r.estado).toBe("DISPONIVEL_DESMOBILIZACAO");
    expect(r.disponivelParaMovimentacao).toBe(true);
  });

  it("ALOCADO com previsão futura ainda não está disponível", () => {
    const r = derivarDisponibilidadeMovimentacao(
      { statusOperacional: "ALOCADO", previsaoLiberacao: "2026-09-10" },
      HOJE,
    );
    expect(r.estado).toBe("ALOCADO_LIBERACAO_FUTURA");
    expect(r.label).toBe("Alocado até 10/09/2026");
    expect(r.disponivelParaMovimentacao).toBe(false);
  });

  it("ALOCADO sem previsão continua alocado", () => {
    const r = derivarDisponibilidadeMovimentacao(
      { statusOperacional: "ALOCADO", previsaoLiberacao: null },
      HOJE,
    );
    expect(r.estado).toBe("ALOCADO_SEM_PREVISAO");
    expect(r.disponivelParaMovimentacao).toBe(false);
  });

  it("DISPONIVEL sem OS está disponível", () => {
    const r = derivarDisponibilidadeMovimentacao({ statusOperacional: "DISPONIVEL" }, HOJE);
    expect(r.estado).toBe("DISPONIVEL");
    expect(r.disponivelParaMovimentacao).toBe(true);
  });

  it("SEM_STATUS nunca é tratado como disponível", () => {
    const r = derivarDisponibilidadeMovimentacao({ statusOperacional: "SEM_STATUS" }, HOJE);
    expect(r.estado).toBe("SEM_STATUS");
    expect(r.disponivelParaMovimentacao).toBe(false);
  });
});

describe("regularização de ativos sem registro", () => {
  it("sem status + Centro de Custo ⇒ ALOCADO", () => {
    expect(statusRegularizacaoSemRegistro({ centroCustoAtualId: "cc1" })).toBe("ALOCADO");
  });

  it("sem status + OS aberta ⇒ MANUTENCAO (mesmo com CC)", () => {
    expect(statusRegularizacaoSemRegistro({ centroCustoAtualId: "cc1", temOsAberta: true })).toBe(
      "MANUTENCAO",
    );
  });

  it("sem status, sem CC e sem OS permanece SEM_STATUS (nunca DISPONIVEL)", () => {
    expect(statusRegularizacaoSemRegistro({ centroCustoAtualId: null })).toBe("SEM_STATUS");
  });
});

describe("estado após encerramento da OS", () => {
  it("última OS encerrada com CC ⇒ Operando / ALOCADO", () => {
    expect(
      estadoAposEncerramentoOs({
        centroCustoAtualId: "cc1",
        statusOperacionalCorrente: "MANUTENCAO",
        situacaoCorrente: "Em Manutenção",
      }),
    ).toEqual({ statusOperacional: "ALOCADO", situacao: "Operando" });
  });

  it("última OS encerrada sem CC ⇒ Disponível / DISPONIVEL", () => {
    expect(
      estadoAposEncerramentoOs({
        centroCustoAtualId: null,
        statusOperacionalCorrente: "MANUTENCAO",
        situacaoCorrente: "Em Manutenção",
      }),
    ).toEqual({ statusOperacional: "DISPONIVEL", situacao: "Disponível" });
  });

  it("outra OS ainda aberta mantém manutenção", () => {
    expect(
      estadoAposEncerramentoOs({
        aindaTemOsAberta: true,
        centroCustoAtualId: "cc1",
        statusOperacionalCorrente: "MANUTENCAO",
        situacaoCorrente: "Em Manutenção",
      }),
    ).toEqual({ statusOperacional: "MANUTENCAO", situacao: "Em Manutenção" });
  });

  it("status corrente diferente de MANUTENCAO não é sobrescrito", () => {
    expect(
      estadoAposEncerramentoOs({
        centroCustoAtualId: null,
        statusOperacionalCorrente: "ALOCADO",
        situacaoCorrente: "Operando",
      }),
    ).toEqual({ statusOperacional: "ALOCADO", situacao: "Operando" });
  });
});
