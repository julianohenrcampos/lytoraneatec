/**
 * CT-5 — card compacto de uma puxada.
 *
 * Apresentação densa: código PUX, status, trajeto coleta → descarga e
 * quantidade de caminhões. Todo o detalhamento fica no modal do wizard.
 * Navegável por teclado (o mapa nunca é o único caminho de acesso).
 */
import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  CT_PUXADA_STATUS_LABELS,
  type CtPuxada,
  type CtPuxadaStatus,
} from "@/types/centralTransportePuxada";
import {
  resumoRotaPuxada,
  resumoTrajetoPuxada,
} from "@/lib/central-transporte/puxadasWorkspace";
import { formatBrazilianDateForDisplay } from "@/utils/timezoneUtils";

const CLASSE_STATUS: Record<CtPuxadaStatus, string> = {
  RASCUNHO: "border-muted-foreground/40 bg-muted text-muted-foreground",
  PROGRAMADA: "border-primary/50 bg-primary/10 text-primary",
  EM_EXECUCAO: "border-primary bg-primary text-primary-foreground",
  CONCLUIDA: "border-emerald-600/50 bg-emerald-600/10 text-emerald-700",
  CANCELADA: "border-destructive/40 bg-destructive/5 text-destructive",
};

interface Props {
  puxada: CtPuxada;
  selecionado: boolean;
  onAbrir: () => void;
}

const PuxadaCard = React.forwardRef<HTMLDivElement, Props>(
  ({ puxada, selecionado, onAbrir }, ref) => {
    const trajeto = resumoTrajetoPuxada(puxada);
    const rota = resumoRotaPuxada(puxada);
    const data = puxada.dataPuxada
      ? formatBrazilianDateForDisplay(puxada.dataPuxada.slice(0, 10))
      : "—";
    return (
      <div
        ref={ref}
        role="button"
        tabIndex={0}
        aria-pressed={selecionado}
        aria-label={`Puxada ${puxada.codigo || "rascunho"} — ${
          CT_PUXADA_STATUS_LABELS[puxada.status] ?? puxada.status
        } — ${trajeto}`}
        className={`cursor-pointer rounded-md border bg-card px-3 py-2 transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          selecionado ? "border-primary ring-1 ring-primary/40" : ""
        } ${puxada.status === "EM_EXECUCAO" ? "border-l-2 border-l-primary" : ""}`}
        onClick={onAbrir}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onAbrir();
          }
        }}
        data-testid={`ct5-puxada-${puxada.id}`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs font-semibold">
            {puxada.codigo || "Rascunho"}
          </span>
          <Badge
            variant="outline"
            className={`shrink-0 text-[10px] ${CLASSE_STATUS[puxada.status]}`}
          >
            {CT_PUXADA_STATUS_LABELS[puxada.status] ?? puxada.status}
          </Badge>
        </div>
        <p className="truncate text-[11px] text-muted-foreground" title={trajeto}>
          {trajeto}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">
          {[
            data,
            `${puxada.totalCaminhoes} caminhão(ões)`,
            puxada.ccCodigo,
            rota,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    );
  },
);

PuxadaCard.displayName = "PuxadaCard";

export default PuxadaCard;
