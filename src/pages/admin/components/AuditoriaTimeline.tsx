import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { traduzirEvento, categoriaLabel } from "../utils/traduzirEvento";

type NivelRisco = "baixo" | "medio" | "alto";

interface TimelineRow {
  id: string;
  categoria: string;
  tipo_evento: string;
  nivel_risco: NivelRisco;
  is_suspeito: boolean;
  usuario_email: string | null;
  usuario_nome: string | null;
  funcionario_nome: string | null;
  created_at: string;
}

interface Props {
  rows: TimelineRow[];
  loading: boolean;
  onSelect: (id: string) => void;
}

const DOT: Record<NivelRisco, string> = {
  baixo: "bg-emerald-500 ring-emerald-500/30",
  medio: "bg-amber-500 ring-amber-500/30",
  alto: "bg-destructive ring-destructive/30",
};

const RISCO_PILL: Record<NivelRisco, string> = {
  baixo: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  medio: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  alto: "bg-destructive/10 text-destructive border-destructive/30",
};

export function AuditoriaTimeline({ rows, loading, onSelect }: Props) {
  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Nenhum evento no período selecionado.
      </div>
    );
  }

  // Agrupar por dia
  const grupos = rows.reduce<Record<string, TimelineRow[]>>((acc, r) => {
    const key = format(new Date(r.created_at), "yyyy-MM-dd");
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  const dias = Object.keys(grupos).sort((a, b) => b.localeCompare(a));

  return (
    <div className="p-4">
      {dias.map((dia) => (
        <div key={dia} className="mb-6 last:mb-0">
          <div className="sticky top-0 z-10 mb-3 -mx-4 border-b bg-background/95 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">
            {format(new Date(dia + "T12:00:00"), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </div>

          <ol className="relative ml-3 border-l border-border">
            {grupos[dia].map((r) => (
              <li key={`${r.categoria}-${r.id}`} className="mb-3 ml-5 last:mb-0">
                <span
                  className={`absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full ring-4 ${DOT[r.nivel_risco]}`}
                  aria-hidden
                />
                <button
                  type="button"
                  onClick={() => onSelect(r.id)}
                  className="block w-full rounded-md border border-border bg-card p-3 text-left transition-colors hover:bg-accent"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {format(new Date(r.created_at), "HH:mm:ss", { locale: ptBR })}
                      </span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">{categoriaLabel(r.categoria)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.is_suspeito && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                      <Badge variant="outline" className={`${RISCO_PILL[r.nivel_risco]} text-[10px] uppercase`}>
                        {r.nivel_risco}
                      </Badge>
                    </div>
                  </div>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {traduzirEvento(r.tipo_evento)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.funcionario_nome ? `Funcionário: ${r.funcionario_nome} · ` : ""}
                    {r.usuario_nome || r.usuario_email || "usuário não identificado"}
                  </p>
                </button>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
