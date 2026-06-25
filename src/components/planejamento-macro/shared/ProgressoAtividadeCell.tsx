import React from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  formatarPercentualBR,
  resolverProgresso,
  type ProgressoInput,
} from "@/lib/planejamentoMacro/progresso/resolverProgresso";

interface Props extends ProgressoInput {
  observacao?: string | null;
  atualizadoEm?: string | null;
  className?: string;
}

function corChipPorFonte(fonte: string): string {
  switch (fonte) {
    case "manual":
      return "bg-primary/10 text-primary border-primary/30";
    case "importado":
      return "bg-muted text-muted-foreground border-border";
    case "concluida":
      return "bg-green-500/15 text-green-700 border-green-500/30 dark:text-green-400";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function corBarraPorStatus(status: string): string {
  switch (status) {
    case "concluida":
      return "[&>div]:bg-green-500";
    case "atrasada":
      return "[&>div]:bg-destructive";
    case "em_andamento":
      return "[&>div]:bg-primary";
    case "cancelada":
      return "[&>div]:bg-muted-foreground/40";
    default:
      return "";
  }
}

const ProgressoAtividadeCell: React.FC<Props> = ({
  observacao,
  atualizadoEm,
  className,
  ...progressoInput
}) => {
  const r = resolverProgresso(progressoInput);

  const content = (
    <div className={cn("flex flex-col gap-1", className)}>
      {r.pct != null ? (
        <div className="flex items-center gap-2">
          <Progress value={r.pct} className={cn("h-2.5 flex-1", corBarraPorStatus(r.status))} />
          <span className="text-xs font-medium tabular-nums w-12 text-right">
            {formatarPercentualBR(r.pct)}
          </span>
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">
          {r.fonte === "concluida" ? "Concluída — sem percentual" : "Sem apontamento físico"}
        </span>
      )}
      <div className="flex items-center gap-1">
        <Badge variant="outline" className={cn("text-[10px] py-0", corChipPorFonte(r.fonte))}>
          {r.chipLabel}
        </Badge>
        {r.fonte === "manual" && observacao && (
          <span className="text-[10px] text-muted-foreground truncate max-w-[180px]" title={observacao}>
            {observacao}
          </span>
        )}
      </div>
    </div>
  );

  if (!r.longLabel && !observacao && !atualizadoEm) return content;

  const tooltipBody = (
    <div className="text-xs space-y-1 max-w-xs">
      <div>{r.longLabel}</div>
      {r.fonte === "manual" && observacao && (
        <div>
          <span className="font-medium">Observação: </span>
          {observacao}
        </div>
      )}
      {r.fonte === "manual" && atualizadoEm && (
        <div className="text-muted-foreground">
          Atualizado em {new Date(atualizadoEm).toLocaleString("pt-BR")}
        </div>
      )}
    </div>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="top">{tooltipBody}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default ProgressoAtividadeCell;
