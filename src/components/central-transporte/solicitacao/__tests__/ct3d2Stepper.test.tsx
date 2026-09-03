/**
 * CT-9 UX — Fachada visual do stepper (Montar atendimento → Revisar) sobre os
 * estados técnicos ITENS / SELECAO / MOBILIZACAO / REVISAO (inalterados).
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import CtSolicitacaoStepper, {
  ETAPAS_TECNICAS_POR_VISUAL,
  etapaTecnicaParaVisual,
} from "../CtSolicitacaoStepper";

describe("CtSolicitacaoStepper — fachada visual CT-9", () => {
  it("S01 — expõe exatamente duas etapas visuais", () => {
    render(<CtSolicitacaoStepper atual="ITENS" onSelect={vi.fn()} />);
    expect(screen.getByTestId("ct9-etapa-montar")).toBeInTheDocument();
    expect(screen.getByTestId("ct9-etapa-revisar")).toBeInTheDocument();
    expect(screen.getByTestId("ct3b-stepper").querySelectorAll("button")).toHaveLength(2);
  });

  it("S02 — mapeia todos os estados técnicos internos (nada renomeado)", () => {
    expect(etapaTecnicaParaVisual("ITENS")).toBe("MONTAR");
    expect(etapaTecnicaParaVisual("SELECAO")).toBe("MONTAR");
    expect(etapaTecnicaParaVisual("MOBILIZACAO")).toBe("MONTAR");
    expect(etapaTecnicaParaVisual("REVISAO")).toBe("REVISAR");
    expect(ETAPAS_TECNICAS_POR_VISUAL.MONTAR).toEqual(["ITENS", "SELECAO", "MOBILIZACAO"]);
    expect(ETAPAS_TECNICAS_POR_VISUAL.REVISAR).toEqual(["REVISAO"]);
  });

  it("MOBILIZACAO mantém Montar atendimento como etapa atual", () => {
    render(<CtSolicitacaoStepper atual="MOBILIZACAO" onSelect={vi.fn()} />);
    expect(screen.getByTestId("ct9-etapa-montar")).toHaveAttribute("data-state", "atual");
    expect(screen.getByTestId("ct9-etapa-revisar")).toHaveAttribute("data-state", "disponivel");
  });

  it("S18 — Montar só fica concluída quando ITENS, SELECAO e MOBILIZACAO estão concluídos", () => {
    const { unmount } = render(
      <CtSolicitacaoStepper
        atual="REVISAO"
        onSelect={vi.fn()}
        concluidas={["ITENS", "SELECAO"]}
      />,
    );
    expect(screen.getByTestId("ct9-etapa-montar")).toHaveAttribute("data-state", "disponivel");
    unmount();

    render(
      <CtSolicitacaoStepper
        atual="REVISAO"
        onSelect={vi.fn()}
        concluidas={["ITENS", "SELECAO", "MOBILIZACAO"]}
      />,
    );
    expect(screen.getByTestId("ct9-etapa-montar")).toHaveAttribute("data-state", "concluida");
    expect(screen.getByTestId("ct9-etapa-revisar")).toHaveAttribute("data-state", "atual");
  });

  it("S19 — clique devolve a etapa TÉCNICA de entrada ao provider", () => {
    const onSelect = vi.fn();
    render(<CtSolicitacaoStepper atual="REVISAO" onSelect={onSelect} />);
    (screen.getByTestId("ct9-etapa-montar") as HTMLButtonElement).click();
    expect(onSelect).toHaveBeenCalledWith("MOBILIZACAO");
    (screen.getByTestId("ct9-etapa-revisar") as HTMLButtonElement).click();
    expect(onSelect).toHaveBeenCalledWith("REVISAO");
  });

  it("bloqueia a navegação enquanto o rascunho está salvando", () => {
    const onSelect = vi.fn();
    render(<CtSolicitacaoStepper atual="MOBILIZACAO" onSelect={onSelect} salvando />);
    const revisar = screen.getByTestId("ct9-etapa-revisar") as HTMLButtonElement;
    expect(revisar.disabled).toBe(true);
    revisar.click();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
