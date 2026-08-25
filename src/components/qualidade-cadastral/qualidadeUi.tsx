import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  SEVERIDADE_LABEL,
  TIPO_LABEL,
  type QcSeveridade,
  type QcTipo,
} from "@/lib/qualidade-cadastral/regras";

export function scoreClass(score: number): string {
  if (score >= 90) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 75) return "text-yellow-600 dark:text-yellow-400";
  if (score >= 60) return "text-orange-600 dark:text-orange-400";
  return "text-destructive";
}

export function scoreBarClass(score: number): string {
  if (score >= 90) return "bg-emerald-500";
  if (score >= 75) return "bg-yellow-500";
  if (score >= 60) return "bg-orange-500";
  return "bg-destructive";
}

export function SeveridadeBadge({ severidade }: { severidade: QcSeveridade }) {
  const map: Record<QcSeveridade, string> = {
    CRITICA: "bg-destructive/15 text-destructive border-destructive/30",
    ALTA: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30",
    MEDIA: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
    BAIXA: "bg-muted text-muted-foreground border-border",
  };
  return (
    <Badge variant="outline" className={cn("text-xs font-medium", map[severidade])}>
      {SEVERIDADE_LABEL[severidade]}
    </Badge>
  );
}

export function TipoBadge({ tipo }: { tipo: QcTipo }) {
  return (
    <Badge variant="secondary" className="text-xs font-normal">
      {TIPO_LABEL[tipo]}
    </Badge>
  );
}

export function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-full max-w-[120px] rounded-full bg-muted">
        <div
          className={cn("h-2 rounded-full transition-all", scoreBarClass(score))}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
      <span className={cn("text-xs font-semibold tabular-nums", scoreClass(score))}>{score}%</span>
    </div>
  );
}
