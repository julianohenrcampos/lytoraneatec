import { AlertTriangle, ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { traduzirEvento, categoriaLabel } from "../utils/traduzirEvento";

export interface AlertasPorTipo {
  categoria: string;
  tipo_evento: string;
  qtd: number;
}

export interface AuditoriaAlertas24h {
  total_alto: number;
  total_suspeitos: number;
  por_tipo: AlertasPorTipo[];
  gerado_em: string;
}

interface Props {
  data: AuditoriaAlertas24h | null;
  loading: boolean;
  onInvestigar: () => void;
}

export function AuditoriaAlertasBanner({ data, loading, onInvestigar }: Props) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const critico = data.total_alto > 0;

  if (!critico) {
    return (
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="rounded-full bg-emerald-500/10 p-2">
            <ShieldAlert className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="font-medium text-foreground">Nenhum evento crítico nas últimas 24h</p>
            <p className="text-xs text-muted-foreground">
              Sistema operando dentro dos padrões de segurança esperados.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-destructive/40 bg-destructive/5">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-destructive/10 p-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="font-semibold text-destructive">
                {data.total_alto} evento{data.total_alto !== 1 ? "s" : ""} crítico{data.total_alto !== 1 ? "s" : ""} nas últimas 24h
              </p>
              <p className="text-xs text-muted-foreground">
                {data.total_suspeitos} marcado{data.total_suspeitos !== 1 ? "s" : ""} como suspeito{data.total_suspeitos !== 1 ? "s" : ""}. Recomenda-se investigação imediata.
              </p>
            </div>
          </div>
          <Button variant="destructive" size="sm" onClick={onInvestigar}>
            Investigar agora
          </Button>
        </div>

        {data.por_tipo.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {data.por_tipo.map((p) => (
              <Badge
                key={`${p.categoria}-${p.tipo_evento}`}
                variant="outline"
                className="border-destructive/30 bg-background text-foreground"
              >
                <span className="mr-1 text-muted-foreground">{categoriaLabel(p.categoria)}:</span>
                {traduzirEvento(p.tipo_evento)}
                <span className="ml-1.5 rounded bg-destructive/10 px-1.5 font-semibold text-destructive">
                  {p.qtd}
                </span>
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
