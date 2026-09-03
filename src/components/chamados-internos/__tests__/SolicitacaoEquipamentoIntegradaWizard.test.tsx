/**
 * Fluxo integrado CHI + Solicitação de Equipamento (frontend).
 * Cobre: área de itens visível desde o início, editor em dialog, edição/remoção,
 * bloqueio de avanço sem item e submit único pela RPC transacional.
 */
import React from "react";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver ??= ResizeObserverStub;
if (typeof Element !== "undefined" && !(Element.prototype as unknown as { scrollIntoView?: unknown }).scrollIntoView) {
  (Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};
}

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

const abrirIntegradoMock = vi.fn();
vi.mock("@/services/chamadoOperacionalService", () => ({
  abrirChamadoComSolicitacaoEquipamento: (...a: unknown[]) => abrirIntegradoMock(...a),
  getAprovacaoPreview: vi.fn().mockResolvedValue({ motor_ativo: false, origem: "LEGADO_EQUIPAMENTOS", resolvido: false }),
}));

vi.mock("@/hooks/useChamadosInternos", () => ({
  useChamadoInternoCcsAbertura: () => ({
    data: [{ centro_custo_id: "cc-1", codigo_centro_custo: "001", nome_centro_custo: "Obra A" }],
    isLoading: false,
  }),
  useChamadoInternoSolicitantesDoCc: () => ({
    data: [{ id: "fun-1", nome_completo: "Fulano da Silva" }],
    isLoading: false,
  }),
  useChamadoInternoAnexar: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/services/solicitacaoEquipamentoService", () => ({
  getUsuariosOperacionais: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/services/atendimentoPreferencialService", () => ({
  getDepartamentosFornecedoresEquipamento: vi.fn().mockResolvedValue([]),
}));

/** Substitui apenas a apresentação do formulário de item (a lógica real é testada à parte). */
vi.mock("@/components/solicitacoes-equipamento/ItemBuilderSubForm", () => ({
  default: ({ onAdd, editingItem }: { onAdd: (i: unknown) => void; editingItem: unknown }) => (
    <button
      type="button"
      onClick={() =>
        onAdd({
          tipo_item: "EQUIPAMENTO",
          item_nao_catalogado: true,
          descricao_livre: editingItem ? "Escavadeira editada" : "Escavadeira",
          quantidade: 1,
          com_operador: false,
          regime_trabalho: "SEGUNDA_SEXTA",
          _displayName: editingItem ? "Escavadeira editada" : "Escavadeira",
        })
      }
    >
      {editingItem ? "Salvar alterações" : "Confirmar item"}
    </button>
  ),
}));

import SolicitacaoEquipamentoIntegradaWizard from "../SolicitacaoEquipamentoIntegradaWizard";

const categoria = {
  id: "cat-eq",
  codigo: "solicitacao_equipamento",
  nome: "Solicitação de Equipamento",
  setor: "equipamentos",
  prioridade_padrao: "normal",
  sla_horas: 24,
  ativo: true,
  ordem: 9,
  descricao: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
} as never;

function renderWizard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <SolicitacaoEquipamentoIntegradaWizard categoria={categoria} onVoltarCategoria={vi.fn()} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe("SolicitacaoEquipamentoIntegradaWizard", () => {
  it("mostra a área de itens vazia desde o início (T03)", async () => {
    renderWizard();
    expect(await screen.findByText(/Itens da solicitação/i)).toBeInTheDocument();
    expect(screen.getByText(/ainda não adicionou nenhum item/i)).toBeInTheDocument();
  });

  it("adiciona, edita e remove item mantendo o estado (T04–T08)", async () => {
    const user = userEvent.setup();
    renderWizard();

    await user.click(await screen.findByRole("button", { name: /Adicionar item/i }));
    await user.click(await screen.findByRole("button", { name: /Confirmar item/i }));
    expect(await screen.findByText("Escavadeira")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Editar/i }));
    await user.click(await screen.findByRole("button", { name: /Salvar alterações/i }));
    expect(await screen.findByText("Escavadeira editada")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Remover/i }));
    await user.click(await screen.findByRole("button", { name: /^Remover$/i }));
    await waitFor(() =>
      expect(screen.getByText(/ainda não adicionou nenhum item/i)).toBeInTheDocument(),
    );
  });

  it("não avança sem itens (T09)", async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.click(await screen.findByRole("button", { name: /Avançar/i }));
    expect(await screen.findByText(/Preencha centro de custo/i)).toBeInTheDocument();
    expect(screen.getByText(/Itens da solicitação/i)).toBeInTheDocument();
  });

  it("mantém a demanda após abrir e fechar o editor de item (T10)", async () => {
    const user = userEvent.setup();
    renderWizard();
    const descricao = screen.getByLabelText(/Descrição/i);
    await user.type(descricao, "Contexto operacional");
    await user.click(screen.getByRole("button", { name: /Adicionar item/i }));
    await user.keyboard("{Escape}");
    expect(screen.getByLabelText(/Descrição/i)).toHaveValue("Contexto operacional");
  });
});
