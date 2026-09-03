import React from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  MapPin,
  PackageCheck,
  Truck,
} from "lucide-react";
import { useCtSolicitacaoTimeline } from "@/hooks/central-transporte/useCtOperacao";
import {
  CT_SITUACAO_LOGISTICA_LABEL,
  type CtSituacaoLogistica,
  type CtTimelineEvento,
} from "@/types/centralTransporteOperacao";

/** Data e hora no fuso operacional (America/Sao_Paulo). */
const dataHora = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const ICONES: Record<CtTimelineEvento["tipo"], React.ElementType> = {
  MOBILIZACAO_PROGRAMADA: Truck,
  CHECKLIST_SAIDA: ClipboardCheck,
  TRANSPORTE_INICIADO: Truck,
  CHEGADA: MapPin,
  RECEBIMENTO: PackageCheck,
};

const ROTULOS: Record<CtTimelineEvento["tipo"], string> = {
  MOBILIZACAO_PROGRAMADA: "Mobilização programada",
  CHECKLIST_SAIDA: "Checklist de saída concluído",
  TRANSPORTE_INICIADO: "Transporte iniciado",
  CHEGADA: "Chegada ao destino",
  RECEBIMENTO: "Recebimento conferido",
};

export const varianteSituacao = (
  s: CtSituacaoLogistica,
): "default" | "secondary" | "outline" | "destructive" => {
  if (s === "PENDENTE_TRATATIVA") return "destructive";
  if (s === "ENTREGUE" || s === "ENTREGUE_COM_RESSALVA") return "default";
  if (s === "A_CAMINHO" || s === "AGUARDANDO_RECEBIMENTO") return "secondary";
  return "outline";
};

interface Props {
  solicitacaoId: string | null;
  compacto?: boolean;
}

/** CT-3F — Linha do tempo logística exibida ao solicitante. */
const CtSolicitacaoTimeline: React.FC<Props> = ({ solicitacaoId, compacto }) => {
  const { isLoading, error, timeline } = useCtSolicitacaoTimeline(solicitacaoId);

  if (isLoading) return <Skeleton className="h-24 w-full" />;
  if (error || !timeline)
    return (
      <p className="text-xs text-muted-foreground">
        Não foi possível carregar a situação logística desta solicitação.
      </p>
    );

  return (
    <div className="space-y-3" data-testid="ct3f-timeline">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Situação logística:</span>
        <Badge variant={varianteSituacao(timeline.situacaoLogistica)} className="text-[11px]">
          {CT_SITUACAO_LOGISTICA_LABEL[timeline.situacaoLogistica]}
        </Badge>
      </div>

      {timeline.eventos.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nenhum evento logístico registrado até o momento.
        </p>
      ) : (
        <ol className={cn("space-y-2", compacto && "space-y-1.5")}>
          {timeline.eventos.map((e, idx) => {
            const Icone =
              e.estado === "RECUSA"
                ? AlertTriangle
                : e.estado === "RESSALVA"
                  ? AlertTriangle
                  : (ICONES[e.tipo] ?? CheckCircle2);
            return (
              <li key={`${e.tipo}-${idx}`} className="flex gap-2 text-xs">
                <Icone
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0",
                    e.estado === "RECUSA"
                      ? "text-destructive"
                      : e.estado === "RESSALVA"
                        ? "text-orange-500"
                        : "text-primary",
                  )}
                />
                <div className="min-w-0">
                  <p className="font-medium">
                    {ROTULOS[e.tipo]}
                    {e.equipamento ? ` · ${e.equipamento}` : ""}
                  </p>
                  <p className="text-muted-foreground">
                    {[
                      e.em ? dataHora(e.em) : null,
                      e.viagem,
                      e.responsavel,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {e.observacao && <p className="text-muted-foreground">{e.observacao}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};

export default CtSolicitacaoTimeline;
