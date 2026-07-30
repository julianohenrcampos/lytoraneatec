import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import VeiculoDetailsModal from "../VeiculoDetailsModal";
import type { Veiculo } from "@/types/veiculo";

const fetchEstadoMock = vi.fn();
const hasActionPermissionMock = vi.fn();
const permissoesLoading = { value: false };

vi.mock("@/services/disponibilidadeEquipamentoService", () => ({
  fetchEstadoOperacionalAtivo: (id: string) => fetchEstadoMock(id),
}));

vi.mock("@/hooks/usePermission", () => ({
  usePermission: () => ({
    hasActionPermission: hasActionPermissionMock,
    isLoading: permissoesLoading.value,
  }),
}));

vi.mock("@/components/disponibilidade/DisponibilidadeAtivoModal", () => ({
  default: () => <div data-testid="modal-disponibilidade" />,
}));

const veiculoBase: Veiculo = {
  id: "11111111-1111-1111-1111-111111111111",
  frota: "LOC",
  numero_frota: "127",
  departamento_id: null,
  placa: null,
  fabricante: "Hyundai",
  cor: "Amarelo",
  motor: null,
  ano_fabricacao: "2019",
  tipo_combustivel: "Diesel",
  status_ipva: null,
  situacao: "Operando",
  capacidade: "20 T",
  aluguel: "22000.00",
  observacoes: null,
  imagem_url: null,
  created_at: null,
  updated_at: null,
  empresa_id: null,
  categoria_ativo_id: null,
  subcategoria_ativo_id: null,
  numero_serie: null,
  chassi: null,
  informacoes_complementares: null,
  status_cadastro: null,
  status_disponibilidade: null,
  proprietario_tipo: null,
  tipo_ativo: null,
  empresa_locadora_id: null,
  linha_operacional_id: null,
  tipo_equipamento_id: null,
  nome_categoria: "EQUIPAMENTO",
  nome_subcategoria: "ESCAVADEIRA HIDRÁULICA",
  nome_departamento: "OBRAS",
  nome_empresa: "LYTORÂNEA",
  centro_custo_atual_id: "22222222-2222-2222-2222-222222222222",
  centro_custo_atual_codigo: "CC-100",
  centro_custo_atual_nome: "OBRA CENTRO",
};

const renderModal = (veiculo: Veiculo = veiculoBase, onClose = vi.fn()) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={client}>
      <VeiculoDetailsModal isOpen onClose={onClose} veiculo={veiculo} />
    </QueryClientProvider>,
  );
  return { ...utils, onClose };
};

const estadoComRegistro = {
  statusOperacional: "ALOCADO" as const,
  possuiRegistroDisponibilidade: true,
  registro: {
    statusOperacional: "ALOCADO" as const,
    centroCustoId: null,
    dataInicio: "2026-07-20",
    previsaoLiberacao: "2026-08-01",
    confiabilidadePrevisao: "ALTA" as const,
    motivoRisco: null,
    observacao: null,
  },
};

const estadoSemRegistro = {
  statusOperacional: "SEM_STATUS" as const,
  possuiRegistroDisponibilidade: false,
  registro: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  permissoesLoading.value = false;
  hasActionPermissionMock.mockReturnValue(true);
  fetchEstadoMock.mockResolvedValue(estadoComRegistro);
});

describe("VeiculoDetailsModal — redesign", () => {
  it("renderiza o título com o identificador", async () => {
    renderModal();
    expect(await screen.findByText(/Detalhes do Ativo — LOC127/)).toBeInTheDocument();
  });

  it("exibe imagem quando disponível", async () => {
    renderModal({ ...veiculoBase, imagem_url: "https://exemplo/img.png" });
    expect(await screen.findByAltText(/Imagem do ativo LOC127/)).toBeInTheDocument();
  });

  it("exibe fallback quando não há imagem", async () => {
    renderModal();
    await screen.findByText(/Detalhes do Ativo/);
    expect(screen.queryByAltText(/Imagem do ativo/)).not.toBeInTheDocument();
  });

  it("exibe as seções de consulta", async () => {
    renderModal();
    expect(await screen.findByText("Informações gerais")).toBeInTheDocument();
    expect(screen.getByText("Características")).toBeInTheDocument();
    expect(screen.getByText("Alocação atual")).toBeInTheDocument();
    expect(screen.getByText("Disponibilidade operacional")).toBeInTheDocument();
  });

  it("formata aluguel em BRL", async () => {
    renderModal();
    expect(await screen.findByText(/R\$\s?22\.000,00/)).toBeInTheDocument();
  });

  it("formata datas operacionais em dd/MM/yyyy", async () => {
    renderModal();
    expect(await screen.findByText("20/07/2026")).toBeInTheDocument();
    expect(screen.getByText("01/08/2026")).toBeInTheDocument();
    expect(screen.queryByText("2026-07-20")).not.toBeInTheDocument();
  });

  it("exibe Não informado para valores ausentes", async () => {
    renderModal();
    await screen.findByText("Características");
    expect(screen.getAllByText("Não informado").length).toBeGreaterThan(0);
  });

  it("diferencia situação cadastral de status operacional", async () => {
    renderModal();
    expect(await screen.findByText("Operando")).toBeInTheDocument();
    expect(screen.getByText("Alocado")).toBeInTheDocument();
  });

  it("registro ausente exibe Sem registro operacional e ação de regularizar", async () => {
    fetchEstadoMock.mockResolvedValue(estadoSemRegistro);
    renderModal();
    expect(await screen.findByText("Sem registro operacional")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Regularizar disponibilidade" })).toBeInTheDocument();
  });

  it("registro existente exibe Editar disponibilidade", async () => {
    renderModal();
    expect(
      await screen.findByRole("button", { name: "Editar disponibilidade" }),
    ).toBeInTheDocument();
  });

  it("usuário sem action editar não vê a ação", async () => {
    hasActionPermissionMock.mockReturnValue(false);
    renderModal();
    await screen.findByText("Disponibilidade operacional");
    expect(screen.queryByRole("button", { name: /disponibilidade$/ })).not.toBeInTheDocument();
  });

  it("loading de permission não provoca flash do botão", async () => {
    permissoesLoading.value = true;
    hasActionPermissionMock.mockReturnValue(true);
    renderModal();
    await screen.findByText("Disponibilidade operacional");
    expect(screen.queryByRole("button", { name: /disponibilidade$/ })).not.toBeInTheDocument();
  });

  it("erro operacional não usa situação cadastral como fallback", async () => {
    fetchEstadoMock.mockRejectedValue(new Error("falha"));
    renderModal();
    expect(
      await screen.findByText("Não foi possível consultar a disponibilidade operacional."),
    ).toBeInTheDocument();
  });

  it("Centro de Custo resolvido mostra código e nome", async () => {
    renderModal();
    expect((await screen.findAllByText("CC-100 — OBRA CENTRO")).length).toBeGreaterThan(0);
  });

  it("CC nulo mostra Sem Centro de Custo confirmado", async () => {
    renderModal({
      ...veiculoBase,
      centro_custo_atual_id: null,
      centro_custo_atual_codigo: null,
      centro_custo_atual_nome: null,
    });
    expect((await screen.findAllByText("Sem Centro de Custo confirmado")).length).toBeGreaterThan(0);
  });

  it("CC não resolvido mostra Centro de Custo não localizado", async () => {
    renderModal({
      ...veiculoBase,
      centro_custo_atual_codigo: null,
      centro_custo_atual_nome: null,
    });
    expect((await screen.findAllByText("Centro de Custo não localizado")).length).toBeGreaterThan(0);
  });

  it("fechar pelo botão funciona", async () => {
    const onClose = vi.fn();
    renderModal(veiculoBase, onClose);
    fireEvent.click(await screen.findByRole("button", { name: "Fechar" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("fecha pelo X e pelo Escape", async () => {
    const onClose = vi.fn();
    renderModal(veiculoBase, onClose);
    const x = await screen.findByRole("button", { name: /close/i });
    fireEvent.click(x);
    fireEvent.keyDown(document.body, { key: "Escape" });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("não perde campos quando a subcategoria é longa (layout empilhado)", async () => {
    renderModal();
    await screen.findByText("Informações gerais");
    expect(screen.getAllByText("ESCAVADEIRA HIDRÁULICA").length).toBeGreaterThan(0);
    expect(screen.getByText("Diesel")).toBeInTheDocument();
    expect(screen.getByText("20 t")).toBeInTheDocument();
  });
});
