import { describe, it, expect } from "vitest";
import { formatChamadoEvento } from "@/utils/chamadoEventoOperacional";
import {
  derivarFaseOperacional,
  podeAssumirPorFase,
} from "@/utils/chamadoFaseOperacional";
import type { ProcessoOperacionalChamado } from "@/services/chamadoOperacionalService";

const evAprovacaoSolicitada = {
  tipo: "evento_operacional",
  payload: {
    acao: "APROVACAO_SOLICITADA",
    status: {
      status: "AGUARDANDO",
      total_etapas: 2,
      etapas_concluidas: 0,
      fluxo: { id: "f", nome: "Equipamentos — Dupla Aprovação", versao: 1 },
      etapa_atual: {
        ordem: 1,
        aprovador_nome: "Carlos Silva",
        aprovador_origem: "engenheiro_solicitante",
        status: "pendente",
      },
    },
  },
};

describe("formatChamadoEvento — aprovação", () => {
  it("T01 não mostra 'Processo operacional' para APROVACAO_SOLICITADA", () => {
    const a = formatChamadoEvento(evAprovacaoSolicitada);
    expect(a.titulo).toBe("Enviado para aprovação");
    expect(a.titulo).not.toBe("Processo operacional");
  });

  it("T02/T03 mostra aprovador, etapa N de T e fluxo", () => {
    const a = formatChamadoEvento(evAprovacaoSolicitada);
    expect(a.metadata).toContain("Aguardando aprovação de: Carlos Silva");
    expect(a.metadata).toContain("Etapa 1 de 2");
    expect(a.metadata).toContain("Fluxo: Equipamentos — Dupla Aprovação");
    expect(a.metadata).toContain("Origem do aprovador: Engenheiro da Solicitação");
  });

  it("T04 ETAPA_APROVADA mostra 'Aprovado por'", () => {
    const a = formatChamadoEvento({
      tipo: "evento_operacional",
      payload: { acao: "ETAPA_APROVADA", aprovador_nome: "Carlos Silva", etapa: 1, total_etapas: 2 },
    });
    expect(a.descricao).toBe("Aprovado por Carlos Silva");
    expect(a.metadata).toContain("Etapa 1 de 2");
    expect(a.variante).toBe("sucesso");
  });

  it("T06 APROVACAO_CONCLUIDA é explícita", () => {
    const a = formatChamadoEvento({
      tipo: "evento_operacional",
      payload: { acao: "APROVACAO_CONCLUIDA", total_etapas: 2 },
    });
    expect(a.titulo).toBe("Aprovação concluída");
    expect(a.metadata).toContain("Todas as 2 etapa(s) foram aprovadas.");
  });

  it("T07 rejeição mostra aprovador e motivo", () => {
    const a = formatChamadoEvento({
      tipo: "evento_operacional",
      payload: { acao: "ETAPA_REJEITADA", aprovador_nome: "Carlos Silva", etapa: 1, total_etapas: 2, motivo: "Sem verba" },
    });
    expect(a.descricao).toBe("Rejeitado por Carlos Silva");
    expect(a.metadata).toContain("Motivo: Sem verba");
    expect(a.variante).toBe("erro");
  });

  it("T12 programação mostra código real da viagem", () => {
    const a = formatChamadoEvento({
      tipo: "evento_operacional",
      payload: { acao: "PLANEJAMENTO_PROGRAMADO", viagem_codigo: "VG-2026-000321", total_ativos: 2 },
    });
    expect(a.metadata).toContain("Viagem: VG-2026-000321");
    expect(a.metadata).toContain("Ativos: 2");
  });

  it("T16 ação desconhecida tem fallback seguro sem JSON cru", () => {
    const a = formatChamadoEvento({
      tipo: "evento_operacional",
      payload: { acao: "ACAO_FUTURA_XPTO", segredo: "abc" },
    });
    expect(a.titulo).toBe("Evento operacional");
    expect(a.metadata).toEqual([]);
    expect(JSON.stringify(a)).not.toContain("abc");
  });

  it("T18 eventos comuns preservam labels existentes", () => {
    expect(formatChamadoEvento({ tipo: "abertura", payload: {} }).titulo).toBe("Abertura");
    expect(formatChamadoEvento({ tipo: "roteamento", payload: {} }).titulo).toBe("Roteamento");
    expect(formatChamadoEvento({ tipo: "atribuicao", payload: {} }).titulo).toBe("Atribuição");
  });
});

const processo = (over: Partial<ProcessoOperacionalChamado> = {}): ProcessoOperacionalChamado => ({
  tem_processo: true,
  status_fluxo: "PENDENTE_APROVACAO",
  aprovacao: {
    status: "AGUARDANDO",
    total_etapas: 1,
    etapa_atual: {
      ordem: 1,
      nome: "Etapa",
      status: "pendente",
      aprovador_id: "x",
      aprovador_nome: "Carlos Silva",
      aprovador_origem: "engenheiro_solicitante",
    },
  },
  ...over,
});

describe("derivarFaseOperacional", () => {
  it("T08 aprovação pendente não libera Assumir", () => {
    const f = derivarFaseOperacional(processo(), []);
    expect(f?.fase).toBe("AGUARDANDO_APROVACAO");
    expect(f?.aguardando).toBe("Carlos Silva");
    expect(podeAssumirPorFase(f)).toBe(false);
  });

  it("T09 aprovado libera Assumir e fase disponível", () => {
    const f = derivarFaseOperacional(
      processo({ status_fluxo: "APROVADO", aprovacao: { status: "APROVADO" } }),
      [],
    );
    expect(f?.fase).toBe("DISPONIVEL_ATENDIMENTO");
    expect(podeAssumirPorFase(f)).toBe(true);
  });

  it("rejeitado não libera Assumir", () => {
    const f = derivarFaseOperacional(processo({ aprovacao: { status: "REJEITADO" } }), []);
    expect(f?.fase).toBe("REJEITADO");
    expect(podeAssumirPorFase(f)).toBe(false);
  });

  it("T11/T12/T13 marcos materiais avançam a fase", () => {
    const base = processo({ status_fluxo: "APROVADO", aprovacao: { status: "APROVADO" } });
    const ev = (acao: string) => ({ tipo: "evento_operacional", payload: { acao } });
    expect(derivarFaseOperacional(base, [ev("ATIVO_SELECIONADO")])?.fase).toBe("EM_PLANEJAMENTO");
    expect(derivarFaseOperacional(base, [ev("PLANEJAMENTO_PROGRAMADO")])?.fase).toBe("PLANEJAMENTO_PROGRAMADO");
    expect(derivarFaseOperacional(base, [ev("TRANSPORTE_INICIADO")])?.fase).toBe("EM_TRANSPORTE");
    expect(derivarFaseOperacional(base, [ev("RECEBIMENTO_CONFIRMADO")])?.fase).toBe("RECEBIMENTO_CONFIRMADO");
    expect(derivarFaseOperacional(base, [ev("SOLICITACAO_ATENDIDA")])?.fase).toBe("CONCLUIDO");
  });

  it("T18 chamado comum sem processo não tem fase e mantém Assumir", () => {
    const f = derivarFaseOperacional({ tem_processo: false }, []);
    expect(f).toBeNull();
    expect(podeAssumirPorFase(f)).toBe(true);
  });

  it("T19 SOL legada aprovada continua liberada", () => {
    const f = derivarFaseOperacional(
      { tem_processo: true, status_fluxo: "APROVADO", aprovacao_origem: "LEGADO_EQUIPAMENTOS", aprovacao: { status: "APROVADO" } },
      [],
    );
    expect(podeAssumirPorFase(f)).toBe(true);
  });

  it("cancelamento é terminal", () => {
    const f = derivarFaseOperacional(
      processo({ status_fluxo: "APROVADO", aprovacao: { status: "APROVADO" } }),
      [{ tipo: "evento_operacional", payload: { acao: "SOLICITACAO_CANCELADA" } }],
    );
    expect(f?.fase).toBe("CANCELADO");
  });
});

describe("marcos emitidos pela Central do Transporte (payload real)", () => {
  const ev = (acao: string, payload: Record<string, unknown>) =>
    formatChamadoEvento({ tipo: "evento_operacional", payload: { acao, ...payload } });

  it("PLANEJAMENTO_PROGRAMADO usa código real da viagem, origem, destino e data", () => {
    const r = ev("PLANEJAMENTO_PROGRAMADO", {
      codigo_viagem: "VG-2026-000321",
      quantidade_ativos: 2,
      origem_nome: "L123 — Obra X",
      destino_nome: "OBRA TESTE GEO",
      data_programada: "2026-08-30",
    });
    expect(r.titulo).toBe("Planejamento programado");
    expect(r.metadata).toContain("Viagem: VG-2026-000321");
    expect(r.metadata).toContain("Ativos: 2");
    expect(r.metadata).toContain("Origem: L123 — Obra X");
    expect(r.metadata).toContain("Destino: OBRA TESTE GEO");
  });

  it("TRANSPORTE_INICIADO mostra motorista e viagem", () => {
    const r = ev("TRANSPORTE_INICIADO", {
      codigo_viagem: "VG-1",
      motorista_nome: "José Silva",
      data_hora_saida: "2026-08-30T10:15:00Z",
    });
    expect(r.titulo).toBe("Transporte iniciado");
    expect(r.metadata).toContain("Motorista: José Silva");
    expect(r.metadata).toContain("Viagem: VG-1");
  });

  it("ATIVO_SELECIONADO mostra frota e departamento", () => {
    const r = ev("ATIVO_SELECIONADO", {
      frota: "LYT",
      numero_frota: "042",
      departamento_nome: "Transporte",
    });
    expect(r.metadata).toContain("Ativo: LYT-042");
    expect(r.metadata).toContain("Departamento: Transporte");
  });

  it("RECEBIMENTO_CONFIRMADO mostra recebedor real", () => {
    const r = ev("RECEBIMENTO_CONFIRMADO", { recebedor_nome: "Carlos Souza", codigo_viagem: "VG-1" });
    expect(r.titulo).toBe("Recebimento confirmado");
    expect(r.metadata).toContain("Recebido por: Carlos Souza");
  });

  it("SOLICITACAO_ATENDIDA mostra itens e ativos", () => {
    const r = ev("SOLICITACAO_ATENDIDA", { quantidade_itens: 2, quantidade_ativos: 2 });
    expect(r.titulo).toBe("Solicitação de equipamento atendida");
    expect(r.metadata).toContain("Itens atendidos: 2");
    expect(r.metadata).toContain("Ativos entregues: 2");
  });
});
