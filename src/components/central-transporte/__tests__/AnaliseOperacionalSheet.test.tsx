import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({}), in: () => ({}), order: () => ({}) }) }) },
}));

vi.mock("@/services/centralTransporteService", async () => {
  return {
    filtrarAtivosPorBusca: (ativos: any[], termo: string) =>
      termo ? ativos.filter((a) => String(a.texto_busca ?? "").includes(termo.toUpperCase())) : ativos,
    fetchAnaliseOperacional: vi.fn(async () => ({
      status: "ok",
      matchingUsed: "tipo_equipamento",
      disponibilidadePropria: [],
      disponibilidadeGrupo: [],
      equipamentosComPrevisao: [],
      externoLocado: [],
      portfolioExterno: [],
      totalCandidatos: 0,
      resumo: {
        quantidade_solicitada: 1, propria_disponivel: 0, grupo_disponivel: 0,
        locado_cadastrado: 0, com_previsao: 0, fornecedores_compativeis: 0,
        compatibilidade: "PARCIAL",
      },
    })),
  };
});

import AnaliseOperacionalSheet from "@/components/central-transporte/AnaliseOperacionalSheet";
import type { SelectedContext } from "@/components/central-transporte/CentralTransportePage";

const renderWithClient = (ui: React.ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

const makeContext = (item: SelectedContext["item"]): SelectedContext => ({
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
  item,
});

describe("AnaliseOperacionalSheet", () => {
  it("não renderiza quando context = null", () => {
    const { container } = renderWithClient(
      <AnaliseOperacionalSheet context={null} open={false} onClose={() => {}} onDecisaoSaved={() => {}} />,
    );
    expect(container.textContent).toBe("");
  });

  it("exibe alerta de modelo legado quando item = null", async () => {
    renderWithClient(
      <AnaliseOperacionalSheet
        context={makeContext(null)}
        open={true}
        onClose={() => {}}
        onDecisaoSaved={() => {}}
      />,
    );
    expect(
      await screen.findByText(/modelo legado \(sem item selecionado\)/i),
    ).toBeInTheDocument();
  });

  it("mantém os 4 botões de decisão desabilitados", async () => {
    renderWithClient(
      <AnaliseOperacionalSheet
        context={makeContext(null)}
        open={true}
        onClose={() => {}}
        onDecisaoSaved={() => {}}
      />,
    );
    const labels = [/Atender Interno/i, /Reservar Futuro/i, /Cotação Externa/i, /Indisponível/i];
    for (const l of labels) {
      const btn = await screen.findByRole("button", { name: l });
      expect(btn).toBeDisabled();
    }
  });
});
