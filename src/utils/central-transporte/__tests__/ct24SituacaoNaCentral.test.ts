/**
 * CT-2.4 — Testes da correção semântica do compromisso apresentado.
 *
 * Garante os 6 casos exigidos e a NÃO regressão de `estado_exibicao` /
 * condição operacional / elegibilidade.
 */
import { describe, it, expect } from "vitest";
import type { CtEstadoEfetivoAtivo } from "@/types/centralTransporteEstadoEfetivo";
import {
  frasesAgendaNaCentral,
  situacaoMobilizacaoDerivada,
  situacaoNaCentral,
  SITUACAO_NAO_CONSULTADA,
} from "@/utils/central-transporte/situacaoNaCentral";
import { badgeDoEstadoEfetivo } from "@/utils/central-transporte/estadoEfetivoBadges";

const base = (over: Partial<CtEstadoEfetivoAtivo> = {}): CtEstadoEfetivoAtivo =>
  ({
    equipamentoId: "eq-1",
    centroCustoId: null,
    condicaoOperacional: "DISPONIVEL",
    possuiRegistroOperacional: true,
    previsaoLiberacao: null,
    dataInicioDisponibilidade: null,
    agenda: null,
    compromissoAtivo: "LIVRE",
    compromissoAtual: null,
    proximoCompromisso: null,
    quantidadeCompromissosFuturos: 0,
    compromissosNaJanela: [],
    quantidadeCompromissosNaJanela: 0,
    periodoComprometidoInicio: null,
    periodoComprometidoFim: null,
    estadoExibicao: "DISPONIVEL",
    possuiAnomaliaSobreposicao: false,
    possuiCompromissoVencidoAtivo: false,
    possuiCompromissoAtualOuFuturo: false,
    compromissoPrincipal: null,
    compromissoPrincipalStatus: null,
    compromissoPrincipalInicio: null,
    compromissoPrincipalFim: null,
    compromissoPrincipalVigencia: "SEM_COMPROMISSO",
    reservadoPelaCentral: false,
    ...over,
  }) as unknown as CtEstadoEfetivoAtivo;

describe("CT-2.4 — situação na Central", () => {
  it("caso 1: compromisso vigente hoje ⇒ RESERVADO com período vigente", () => {
    const s = situacaoNaCentral(
      base({
        possuiCompromissoAtualOuFuturo: true,
        compromissoPrincipalStatus: "RESERVADO",
        compromissoPrincipalVigencia: "ATUAL",
        compromissoPrincipalInicio: "2026-08-01",
        compromissoPrincipalFim: "2026-08-20",
        reservadoPelaCentral: true,
      }),
    );
    expect(s.label).toBe("RESERVADO");
    expect(s.vigencia).toBe("ATUAL");
    expect(s.complemento).toContain("Vigente de 01/08/2026");
  });

  it("caso 2: reserva futura ⇒ RESERVADO com 'Inicia em', nunca LIVRE", () => {
    const s = situacaoNaCentral(
      base({
        possuiCompromissoAtualOuFuturo: true,
        compromissoPrincipalStatus: "RESERVADO",
        compromissoPrincipalVigencia: "FUTURO",
        compromissoPrincipalInicio: "2026-08-05",
        compromissoPrincipalFim: "2026-08-25",
        reservadoPelaCentral: true,
      }),
    );
    expect(s.label).toBe("RESERVADO");
    expect(s.label).not.toBe("LIVRE");
    expect(s.complemento).toBe("Inicia em 05/08/2026");
  });

  it("caso 3: sem compromisso algum ⇒ LIVRE", () => {
    const s = situacaoNaCentral(base());
    expect(s.label).toBe("LIVRE");
    expect(s.vigencia).toBe("SEM_COMPROMISSO");
    expect(s.complemento).toBeNull();
  });

  it("caso 4: conflito real tem precedência sobre reserva", () => {
    const s = situacaoNaCentral(
      base({
        possuiCompromissoAtualOuFuturo: true,
        compromissoPrincipalStatus: "RESERVADO",
        compromissoPrincipalVigencia: "CONFLITO",
        possuiAnomaliaSobreposicao: true,
      }),
    );
    expect(s.label).toBe("CONFLITO OPERACIONAL");
    expect(s.tom).toBe("conflito");
  });

  it("caso 5: estado não consultado é fail-closed (nunca livre)", () => {
    expect(situacaoNaCentral(null)).toEqual(SITUACAO_NAO_CONSULTADA);
    expect(situacaoNaCentral(null).label).not.toBe("LIVRE");
  });

  it("caso 6: agenda enuncia disponibilidade, bloco reservado e retorno", () => {
    const frases = frasesAgendaNaCentral(
      base({
        reservadoPelaCentral: true,
        agenda: {
          disponivelAte: "2026-08-04",
          blocoComprometidoInicio: "2026-08-05",
          blocoComprometidoFim: "2026-08-25",
          proximaDisponibilidade: "2026-08-26",
        },
      } as Partial<CtEstadoEfetivoAtivo>),
    );
    expect(frases).toEqual([
      "Disponível até 04/08/2026.",
      "Reservado de 05/08/2026 a 25/08/2026.",
      "Novamente disponível em 26/08/2026.",
    ]);
  });

  it("mobilização derivada só existe para RESERVADO e nunca é persistida", () => {
    expect(
      situacaoMobilizacaoDerivada(
        base({ compromissoPrincipalStatus: "RESERVADO", possuiCompromissoAtualOuFuturo: true }),
      ),
    ).toBe("AGUARDANDO_MOBILIZACAO");
    expect(
      situacaoMobilizacaoDerivada(base({ compromissoPrincipalStatus: "ENTREGUE" })),
    ).toBeNull();
    expect(situacaoMobilizacaoDerivada(base())).toBeNull();
  });

  it("não regressão: reserva futura não altera estado_exibicao nem bloqueia operação", () => {
    const estado = base({
      possuiCompromissoAtualOuFuturo: true,
      compromissoPrincipalStatus: "RESERVADO",
      compromissoPrincipalVigencia: "FUTURO",
      compromissoPrincipalInicio: "2026-08-05",
      reservadoPelaCentral: true,
      estadoExibicao: "DISPONIVEL",
      condicaoOperacional: "DISPONIVEL",
    });
    expect(estado.estadoExibicao).toBe("DISPONIVEL");
    expect(estado.condicaoOperacional).toBe("DISPONIVEL");
    expect(badgeDoEstadoEfetivo(estado).bloqueiaOperacao).toBe(false);
  });
});
