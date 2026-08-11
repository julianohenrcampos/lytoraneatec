/**
 * CT-3D.2 — Trilha visual do stepper: verde por dado material (etapas
 * concluídas), laranja na etapa atual, cinza nas pendentes.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import CtSolicitacaoStepper from "../CtSolicitacaoStepper";

describe("CtSolicitacaoStepper — CT-3D.2", () => {
  it("marca como concluídas apenas as etapas informadas", () => {
    render(
      <CtSolicitacaoStepper
        atual="MOBILIZACAO"
        onSelect={vi.fn()}
        concluidas={["ITENS", "SELECAO"]}
      />,
    );

    expect(screen.getByTestId("ct3b-etapa-itens")).toHaveAttribute("data-state", "concluida");
    expect(screen.getByTestId("ct3b-etapa-selecao")).toHaveAttribute("data-state", "concluida");
    expect(screen.getByTestId("ct3b-etapa-mobilizacao")).toHaveAttribute("data-state", "atual");
    expect(screen.getByTestId("ct3b-etapa-revisao")).toHaveAttribute("data-state", "disponivel");
  });

  it("bloqueia a navegação enquanto o rascunho está salvando", () => {
    const onSelect = vi.fn();
    render(<CtSolicitacaoStepper atual="MOBILIZACAO" onSelect={onSelect} salvando />);

    const revisao = screen.getByTestId("ct3b-etapa-revisao") as HTMLButtonElement;
    expect(revisao.disabled).toBe(true);
    revisao.click();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("mantém Mobilização verde quando persistida mesmo sendo a etapa atual", () => {
    render(
      <CtSolicitacaoStepper
        atual="MOBILIZACAO"
        onSelect={vi.fn()}
        concluidas={["ITENS", "SELECAO", "MOBILIZACAO"]}
      />,
    );
    expect(screen.getByTestId("ct3b-etapa-mobilizacao")).toHaveAttribute("data-state", "atual");
    expect(screen.getByTestId("ct3b-etapa-mobilizacao").querySelector("svg")).not.toBeNull();
  });
});
