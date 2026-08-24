/**
 * CT-4 Fase 4 — card compacto de uma movimentação direta.
 *
 * Apresentação mínima e densa: código MOV, status e resumo do trajeto
 * (CC de coleta → CC de entrega). Todo o detalhamento fica no modal.
 * Navegável por teclado (o mapa nunca é o único caminho de acesso).
 */
import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  CT_VIAGEM_STATUS_LABELS,
  type CtOrdemMotorista,
  type CtViagemStatus,
} from "@/types/centralTransporteMobilizacao";
import { resumoTrajetoCurto } from "@/lib/central-transporte/movimentacoesWorkspace";

const CLASSE_STATUS: Record<CtViagemStatus, string> = {
  RASCUNHO: "border-muted-foreground/40 bg-muted text-muted-foreground",
  PROGRAMADA: "border-primary/50 bg-primary/10 text-primary",
  EM_TRANSITO: "border-primary bg-primary text-primary-foreground",
  AGUARDANDO_RECEBIMENTO: "border-primary/40 bg-primary/5 text-primary",
  PENDENTE_TRATATIVA: "border-destructive/50 bg-destructive/10 text-destructive",
  CONCLUIDA: "border-emerald-600/50 bg-emerald-600/10 text-emerald-700",
  CANCELADA: "border-destructive/40 bg-destructive/5 text-destructive",
};

interface Props {
  viagem: CtOrdemMotorista;
  selecionado: boolean;
  /** Seleciona no mapa e abre o detalhe (modal de revisão do wizard). */
  onAbrir: () => void;
}

const MovimentacaoCard = React.forwardRef<HTMLDivElement, Props>(
  ({ viagem, selecionado, onAbrir }, ref) => (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      aria-pressed={selecionado}
      aria-label={`Movimentação ${viagem.codigo || "rascunho"} — ${
        CT_VIAGEM_STATUS_LABELS[viagem.status] ?? viagem.status
      } — ${resumoTrajetoCurto(viagem)}`}
      className={`cursor-pointer rounded-md border bg-card px-3 py-2 transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        selecionado ? "border-primary ring-1 ring-primary/40" : ""
      } ${viagem.status === "EM_TRANSITO" ? "border-l-2 border-l-primary" : ""}`}
      onClick={onAbrir}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onAbrir();
        }
      }}
      data-testid={`ct4-mov-${viagem.id}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-semibold">{viagem.codigo || "Rascunho"}</span>
        <Badge
          variant="outline"
          className={`shrink-0 text-[10px] ${CLASSE_STATUS[viagem.status]}`}
        >
          {CT_VIAGEM_STATUS_LABELS[viagem.status] ?? viagem.status}
        </Badge>
      </div>
      <p className="truncate text-[11px] text-muted-foreground" title={resumoTrajetoCurto(viagem)}>
        {resumoTrajetoCurto(viagem)}
      </p>
    </div>
  ),
);
MovimentacaoCard.displayName = "MovimentacaoCard";

export default MovimentacaoCard;
