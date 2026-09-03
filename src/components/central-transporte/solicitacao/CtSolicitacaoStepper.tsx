/**
 * CT-3B / CT-3C / CT-3D.2 — Stepper das etapas da solicitação.
 *
 * A partir da Fase I do CT-3C nenhuma etapa é bloqueada. No CT-3D.2 a trilha
 * visual passa a refletir dado material (etapas concluídas informadas pelo
 * provider) e não apenas a posição do índice:
 *   verde   = concluída
 *   laranja = etapa atual
 *   cinza   = pendente
 */
import React from "react";
import { Lock, Check, Loader2 } from "lucide-react";
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
  /** Etapas concluídas por dado material (verde). */
  concluidas?: CtEtapa[];
  /** Indica salvamento em curso antes da transição de etapa. */
  salvando?: boolean;
}

export const CtSolicitacaoStepper: React.FC<Props> = ({
  atual,
  onSelect,
  concluidas = [],
  salvando = false,
}) => {
  return (
    <nav
      aria-label="Etapas da solicitação"
      className="flex gap-2 overflow-x-auto pb-1"
      data-testid="ct3b-stepper"
    >
      {ETAPAS.map((etapa, idx) => {
        const bloqueada = ETAPAS_BLOQUEADAS.includes(etapa.id);
        const ativa = etapa.id === atual;
        const concluida = !bloqueada && concluidas.includes(etapa.id);
        const mostrandoSpinner = salvando && ativa;

        return (
          <button
            key={etapa.id}
            type="button"
            data-testid={`ct3b-etapa-${etapa.id.toLowerCase()}`}
            data-state={bloqueada ? "bloqueada" : ativa ? "atual" : concluida ? "concluida" : "disponivel"}
            disabled={bloqueada || salvando}
            aria-current={ativa ? "step" : undefined}
            title={bloqueada ? CT3B_ETAPA_BLOQUEADA_MSG : undefined}
            onClick={() => !bloqueada && !salvando && onSelect(etapa.id)}
            className={cn(
              "flex items-center gap-2 shrink-0 rounded-md border px-3 py-2 text-xs transition-colors",
              ativa && "border-primary bg-primary/10 text-foreground font-medium",
              concluida && "border-emerald-600/50 bg-emerald-600/10 text-foreground",
              !ativa && !concluida && !bloqueada && "text-muted-foreground hover:bg-muted",
              bloqueada && "opacity-60 cursor-not-allowed",
              salvando && !ativa && "opacity-70 cursor-progress",
            )}
          >
            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full border text-[10px]",
                concluida && "border-emerald-600/60 text-emerald-600",
                ativa && "border-primary text-primary",
              )}
            >
              {mostrandoSpinner ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : concluida ? (
                <Check className="h-3 w-3" />
              ) : bloqueada ? (
                <Lock className="h-3 w-3" />
              ) : (
                idx + 1
              )}
            </span>
            <span className="whitespace-nowrap">{etapa.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default CtSolicitacaoStepper;
