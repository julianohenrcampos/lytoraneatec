/**
 * CT-3B / CT-3C — Stepper das etapas da solicitação.
 *
 * A partir da Fase I do CT-3C nenhuma etapa é bloqueada: Mobilização e Revisão
 * são navegáveis e cada etapa aplica suas próprias regras fail-closed.
 */
import React from "react";
import { Lock, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { CT3B_ETAPA_BLOQUEADA_MSG, ETAPAS_BLOQUEADAS, type CtEtapa } from "./CentralTransporteSolicitacaoProvider";

const ETAPAS: { id: CtEtapa; label: string }[] = [
  { id: "ITENS", label: "Itens solicitados" },
  { id: "SELECAO", label: "Seleção dos ativos" },
  { id: "MOBILIZACAO", label: "Mobilização" },
  { id: "REVISAO", label: "Revisão" },
];


interface Props {
  atual: CtEtapa;
  onSelect: (etapa: CtEtapa) => void;
}

export const CtSolicitacaoStepper: React.FC<Props> = ({ atual, onSelect }) => {
  const indexAtual = ETAPAS.findIndex((e) => e.id === atual);

  return (
    <nav
      aria-label="Etapas da solicitação"
      className="flex gap-2 overflow-x-auto pb-1"
      data-testid="ct3b-stepper"
    >
      {ETAPAS.map((etapa, idx) => {
        const bloqueada = ETAPAS_BLOQUEADAS.includes(etapa.id);
        const ativa = etapa.id === atual;
        const concluida = !bloqueada && idx < indexAtual;

        return (
          <button
            key={etapa.id}
            type="button"
            data-testid={`ct3b-etapa-${etapa.id.toLowerCase()}`}
            data-state={bloqueada ? "bloqueada" : ativa ? "atual" : concluida ? "concluida" : "disponivel"}
            disabled={bloqueada}
            aria-current={ativa ? "step" : undefined}
            title={bloqueada ? CT3B_ETAPA_BLOQUEADA_MSG : undefined}
            onClick={() => !bloqueada && onSelect(etapa.id)}
            className={cn(
              "flex items-center gap-2 shrink-0 rounded-md border px-3 py-2 text-xs transition-colors",
              ativa && "border-primary bg-primary/10 text-foreground font-medium",
              !ativa && !bloqueada && "hover:bg-muted",
              bloqueada && "opacity-60 cursor-not-allowed",
            )}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full border text-[10px]">
              {concluida ? <Check className="h-3 w-3" /> : bloqueada ? <Lock className="h-3 w-3" /> : idx + 1}
            </span>
            <span className="whitespace-nowrap">{etapa.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default CtSolicitacaoStepper;
