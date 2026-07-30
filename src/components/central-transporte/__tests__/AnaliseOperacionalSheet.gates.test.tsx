/**
 * CT-2 / M4 — Gates de UI da análise operacional.
 * RBAC por action, contadores vindos da RPC e trava de quantidade pendente.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { CentralTransporteCapabilities } from "@/hooks/central-transporte/useCentralTransporteCapabilities";
import type { CtOperationApi } from "@/hooks/central-transporte/useCtOperation";
import type { CtContadores } from "@/types/centralTransporteCT2";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({}), in: () => ({}), order: () => ({}) }) }) },
}));

const ativoDisponivel = {
  equipamento_id: "eq-1",
  frota: "FR",
  numero_frota: "001",
  placa: "ABC1D23",
  compatibilidade: "EXATA",
  status_operacional: "DISPONIVEL",
  previsao_liberacao: null,
  // G0 — fail-closed: sem esta confirmação o atendimento fica bloqueado.
  possui_registro_disponibilidade: true,
  centro_custo_codigo: "CC01",
  centro_custo_nome: "Obra A",
  propriedade: "PROPRIA",
};


vi.mock("@/services/centralTransporteService", () => ({
  filtrarAtivosPorBusca: (ativos: any[], termo: string) =>
    termo ? ativos.filter((a) => String(a.texto_busca ?? "").includes(termo.toUpperCase())) : ativos,
  fetchAnaliseOperacional: vi.fn(async () => ({
    status: "ok",
    matchingUsed: "tipo_equipamento",
    disponibilidadePropria: [ativoDisponivel],
    disponibilidadeGrupo: [],
    equipamentosComPrevisao: [],
    externoLocado: [],
    portfolioExterno: [],
    totalCandidatos: 1,
    resumo: {
      quantidade_solicitada: 1, propria_disponivel: 1, grupo_disponivel: 0,
      locado_cadastrado: 0, com_previsao: 0, fornecedores_compativeis: 0,
      compatibilidade: "EXATA",
    },
  })),
}));

const contadoresMock = vi.fn();
const refetchMock = vi.fn();

vi.mock("@/hooks/central-transporte/useAtendimentosSolicitacao", () => ({
  default: () => ({
    isLoading: false,
    atendimentos: [],
    contadores: contadoresMock(),
    refetch: refetchMock,
  }),
}));

import AnaliseOperacionalSheet from "@/components/central-transporte/AnaliseOperacionalSheet";
import type { SelectedContext } from "@/components/central-transporte/CentralTransportePage";

const contadores = (pendentes: number): CtContadores => ({
  reservado: 0,
  em_transporte: 0,
  entregue: 0,
  cancelado: 0,
  liberado: 0,
  comprometidos: 0,
  historico: 0,
  pendentes,
});

const caps = (over: Partial<CentralTransporteCapabilities> = {}): CentralTransporteCapabilities => ({
  canVisualizar: true,
  canCriar: true,
  canEditar: true,
  canAprovar: false,
  isLoading: false,
  ...over,
});

const ctOperationStub = {
  attempts: new Map(),
  getAttempt: () => null,
  isBlocked: () => false,
  cancelAttempt: () => {},
  run: vi.fn(async () => ({ status: "ok" as const, data: {}, replay: false })),
  isRunning: false,
} as unknown as CtOperationApi & { run: ReturnType<typeof vi.fn> };

const contexto: SelectedContext = {
  solicitacao: {
    id: "sol-1",
    centro_custo_id: "cc",
    tipo_equipamento_id: "tp",
    quantidade: 1,
    prioridade: "MEDIA",
    status_fluxo: "APROVADO",
    resultado_matching: null,
    quantidade_disponivel_encontrada: null,
    data_inicio: "2026-07-15",
    justificativa: "teste",
    com_operador: null,
    created_at: "2026-07-15T00:00:00Z",
    nome_centro_custo: "CC A",
    departamento_nome: "Dep",
    engenheiro_nome: "Eng",
    apontador_nome: "Ap",
    descricao_tipo_equipamento: "Caminhão",
    itens: [],
  } as SelectedContext["solicitacao"],
  item: {
    id: "item-1",
    solicitacao_id: "sol-1",
    quantidade: 1,
    tipo_item: "EQUIPAMENTO",
    status_item: "PLANEJADO",
    com_operador: false,
  } as SelectedContext["item"],
};

const renderSheet = (capabilities: CentralTransporteCapabilities) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AnaliseOperacionalSheet
        context={contexto}
        open
        onClose={() => {}}
        onDecisaoSaved={() => {}}
        ctOperation={ctOperationStub}
        capabilities={capabilities}
      />
    </QueryClientProvider>,
  );
};

const selecionarAtivo = async () => {
  const linha = await screen.findByText("ABC1D23");
  fireEvent.click(linha.closest("tr")!);
};

beforeEach(() => {
  contadoresMock.mockReturnValue(contadores(1));
  refetchMock.mockReset();
  ctOperationStub.run.mockClear();
});

describe("AnaliseOperacionalSheet — gates CT-2", () => {
  it("sem capabilities explícitas o comportamento é fail-closed", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <AnaliseOperacionalSheet
          context={contexto}
          open
          onClose={() => {}}
          onDecisaoSaved={() => {}}
        />
      </QueryClientProvider>,
    );
    expect(await screen.findByTestId("ct2-btn-interno")).toBeDisabled();
    expect(screen.getByTestId("ct2-btn-reserva")).toBeDisabled();
  });

  it("sem canCriar/canEditar exibe bloqueio RBAC", async () => {
    renderSheet(caps({ canCriar: false, canEditar: false }));
    expect(
      await screen.findByText(/não tem permissão para executar operações/i),
    ).toBeInTheDocument();
  });

  it("enquanto o RBAC carrega mantém as ações travadas", async () => {
    renderSheet(caps({ isLoading: true }));
    expect(await screen.findByText(/verificando permissões/i)).toBeInTheDocument();
    expect(screen.getByTestId("ct2-btn-interno")).toBeDisabled();
  });

  it("com canCriar e pendentes>0 habilita Atender Interno após selecionar ativo disponível", async () => {
    renderSheet(caps());
    await selecionarAtivo();
    expect(screen.getByTestId("ct2-btn-interno")).not.toBeDisabled();
  });

  it("reserva futura permanece travada para ativo disponível sem previsão", async () => {
    renderSheet(caps());
    await selecionarAtivo();
    expect(screen.getByTestId("ct2-btn-reserva")).toBeDisabled();
  });

  it("pendentes = 0 trava as operações mesmo com ativo selecionado", async () => {
    contadoresMock.mockReturnValue(contadores(0));
    renderSheet(caps());
    await selecionarAtivo();
    expect(screen.getByTestId("ct2-btn-interno")).toBeDisabled();
    expect(screen.getByTestId("ct2-btn-reserva")).toBeDisabled();
    expect(screen.getByText(/sem quantidade pendente/i)).toBeInTheDocument();
  });

  it("sem ativo selecionado as operações ficam travadas", async () => {
    renderSheet(caps());
    expect(await screen.findByTestId("ct2-btn-interno")).toBeDisabled();
    expect(screen.getByText(/selecione um ativo/i)).toBeInTheDocument();
  });

  it("cotação externa e indisponível seguem desabilitadas nesta fase", async () => {
    renderSheet(caps());
    await selecionarAtivo();
    expect(screen.getByTestId("ct2-btn-externo")).toBeDisabled();
    expect(screen.getByTestId("ct2-btn-indisponivel")).toBeDisabled();
  });
});
