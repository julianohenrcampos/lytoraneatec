/**
 * CT-5 UX — Fachada visual do stepper da solicitação.
 *
 * O motor (Provider/RPCs/testes) continua trabalhando com as QUATRO etapas
 * técnicas ITENS / SELECAO / MOBILIZACAO / REVISAO. Esta camada é APENAS
 * apresentação: o planejador percebe somente DUAS atividades operacionais.
 *
 *   MONTAR  = ITENS + SELECAO + MOBILIZACAO
 *   REVISAR = REVISAO
 *
 * Nenhum enum, RPC ou estado técnico foi renomeado.
 */
import React from "react";
import { Lock, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CT3B_ETAPA_BLOQUEADA_MSG,
  ETAPAS_BLOQUEADAS,
  type CtEtapa,
} from "./CentralTransporteSolicitacaoProvider";

export type CtEtapaVisual = "MONTAR" | "REVISAR";

/** Estados técnicos cobertos por cada etapa visual (ordem de apresentação). */
export const ETAPAS_TECNICAS_POR_VISUAL: Record<CtEtapaVisual, CtEtapa[]> = {
  MONTAR: ["ITENS", "SELECAO", "MOBILIZACAO"],
  REVISAR: ["REVISAO"],
};

/**
 * Etapa técnica de entrada ao clicar em cada etapa visual.
 * CT-9: "Montar atendimento" entra no Atendimento Builder (MOBILIZACAO), que
 * já contém candidatos, itens-alvo, viagens e recursos na MESMA tela.
 */
export const ETAPA_TECNICA_INICIAL: Record<CtEtapaVisual, CtEtapa> = {
  MONTAR: "MOBILIZACAO",
  REVISAR: "REVISAO",
};

export function etapaTecnicaParaVisual(etapa: CtEtapa): CtEtapaVisual {
  switch (etapa) {
    case "ITENS":
    case "SELECAO":
    case "MOBILIZACAO":
      return "MONTAR";
    case "REVISAO":
    default:
      return "REVISAR";
  }
}

const ETAPAS_VISUAIS: { id: CtEtapaVisual; label: string }[] = [
  { id: "MONTAR", label: "Montar atendimento" },
  { id: "REVISAR", label: "Revisar" },
];

interface Props {
  /** Etapa técnica atual do motor. */
  atual: CtEtapa;
  /** Recebe a etapa TÉCNICA de entrada — contrato do provider preservado. */
  onSelect: (etapa: CtEtapa) => void;
  /** Etapas técnicas concluídas por dado material (verde). */
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
  const visualAtual = etapaTecnicaParaVisual(atual);

  return (
    <nav
      aria-label="Etapas da solicitação"
      className="flex gap-2 overflow-x-auto pb-1"
      data-testid="ct3b-stepper"
    >
      {ETAPAS_VISUAIS.map((etapa, idx) => {
        const tecnicas = ETAPAS_TECNICAS_POR_VISUAL[etapa.id];
        const bloqueada = tecnicas.every((t) => ETAPAS_BLOQUEADAS.includes(t));
        const ativa = etapa.id === visualAtual;
        // Verde apenas quando TODOS os estados técnicos cobertos estão concluídos.
        const concluida = !bloqueada && tecnicas.every((t) => concluidas.includes(t));
        const mostrandoSpinner = salvando && ativa;

        return (
          <button
            key={etapa.id}
            type="button"
            data-testid={`ct9-etapa-${etapa.id.toLowerCase()}`}
            data-etapas-tecnicas={tecnicas.join(",")}
            data-state={
              bloqueada ? "bloqueada" : ativa ? "atual" : concluida ? "concluida" : "disponivel"
            }
            disabled={bloqueada || salvando}
            aria-current={ativa ? "step" : undefined}
            title={bloqueada ? CT3B_ETAPA_BLOQUEADA_MSG : undefined}
            onClick={() => !bloqueada && !salvando && onSelect(ETAPA_TECNICA_INICIAL[etapa.id])}
            className={cn(
              "flex flex-1 min-w-[9rem] items-center gap-2 rounded-md border px-3 py-2 text-xs transition-colors",
              ativa && "border-primary bg-primary/10 text-foreground font-medium",
              concluida && !ativa && "border-emerald-600/50 bg-emerald-600/10 text-foreground",
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
            <span className="whitespace-nowrap">
              {idx + 1}. {etapa.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

export default CtSolicitacaoStepper;
