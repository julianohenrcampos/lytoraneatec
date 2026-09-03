/**
 * KPIs do Dashboard de Chamados Internos (apenas apresentação).
 */
import React from "react";
import {
  AlarmClock,
  AlertTriangle,
  CheckCircle2,
  Gauge,
  Hourglass,
  Inbox,
  Star,
  Timer,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ChamadosDashKpis as Kpis } from "@/types/chamadosInternosDashboard";

function formatarDuracao(min?: number | null): string {
  if (min == null) return "—";
  if (min < 60) return `${Math.round(min)} min`;
  const h = min / 60;
  if (h < 48) return `${h.toFixed(1)} h`;
  return `${(h / 24).toFixed(1)} d`;
}

function variacao(atual?: number | null, anterior?: number | null): number | null {
  if (atual == null || anterior == null || anterior === 0) return null;
  return ((atual - anterior) / anterior) * 100;
}

const Delta: React.FC<{ pct: number | null; menorEhMelhor?: boolean }> = ({
  pct,
  menorEhMelhor,
}) => {
  if (pct == null) return <span className="text-xs text-muted-foreground">sem base anterior</span>;
  const positivo = pct >= 0;
  const bom = menorEhMelhor ? !positivo : positivo;
  const Icon = positivo ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        bom ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {positivo ? "+" : ""}
      {pct.toFixed(1)}% vs. período anterior
    </span>
  );
};

interface ItemProps {
  titulo: string;
  dica?: string;
  valor: React.ReactNode;
  icon: React.ElementType;
  rodape?: React.ReactNode;
  destaque?: "normal" | "alerta" | "critico";
}

const KpiCard: React.FC<ItemProps> = ({ titulo, dica, valor, icon: Icon, rodape, destaque = "normal" }) => (
  <Card className="h-full">
    <CardHeader className="pb-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <CardTitle className="flex cursor-help items-center gap-2 text-sm font-medium text-muted-foreground">
            <Icon
              className={cn(
                "h-4 w-4",
                destaque === "critico"
                  ? "text-destructive"
                  : destaque === "alerta"
                    ? "text-amber-500"
                    : "text-primary",
              )}
            />
            {titulo}
          </CardTitle>
        </TooltipTrigger>
        {dica ? (
          <TooltipContent side="top" className="max-w-[260px]">
            <p className="leading-snug">{dica}</p>
          </TooltipContent>
        ) : null}
      </Tooltip>
    </CardHeader>
    <CardContent className="space-y-1">
      <div className="text-2xl font-bold tracking-tight">{valor}</div>
      {rodape ? <div>{rodape}</div> : null}
    </CardContent>
  </Card>
);

export const ChamadosDashKpisGrid: React.FC<{
  kpis?: Kpis;
  isLoading?: boolean;
}> = ({ kpis, isLoading }) => {
  if (isLoading || !kpis) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-[110px] w-full" />
        ))}
      </div>
    );
  }

  const conformidade =
    kpis.sla_avaliados > 0
      ? Math.round((kpis.sla_no_prazo / kpis.sla_avaliados) * 100)
      : null;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
        <KpiCard
          titulo="Abertos no período"
          dica="Total de chamados criados no período selecionado, independentemente do status atual."
          icon={Inbox}
          valor={kpis.abertos}
          rodape={<Delta pct={variacao(kpis.abertos, kpis.abertos_anterior)} />}
        />
        <KpiCard
          titulo="Em andamento"
          dica="Chamados que ainda não foram resolvidos, encerrados ou cancelados."
          icon={Hourglass}
          destaque={kpis.em_andamento > 0 ? "alerta" : "normal"}
          valor={kpis.em_andamento}
          rodape={
            <Delta pct={variacao(kpis.em_andamento, kpis.em_andamento_anterior)} menorEhMelhor />
          }
        />
        <KpiCard
          titulo="Encerrados"
          dica="Chamados com status resolvido ou encerrado no período."
          icon={CheckCircle2}
          valor={kpis.encerrados}
          rodape={<Delta pct={variacao(kpis.encerrados, kpis.encerrados_anterior)} />}
        />
        <KpiCard
          titulo="Críticos / alta prioridade"
          dica="Chamados com prioridade alta ou crítica ainda em aberto."
          icon={AlertTriangle}
          destaque={kpis.criticos > 0 ? "critico" : "normal"}
          valor={kpis.criticos}
          rodape={
            <span className="text-xs text-muted-foreground">
              {kpis.total} chamados no período
            </span>
          }
        />
        <KpiCard
          titulo="Dentro do Prazo"
          dica="Percentual de chamados resolvidos dentro do prazo acordado (SLA). Quanto maior, melhor."
          icon={Gauge}
          destaque={conformidade != null && conformidade < 80 ? "alerta" : "normal"}
          valor={conformidade == null ? "—" : `${conformidade}%`}
          rodape={
            <span className="text-xs text-muted-foreground">
              {kpis.sla_estourado} com prazo estourado
            </span>
          }
        />

        <KpiCard
          titulo={"1ª resposta\u00a0"}
          dica="First Response Time: tempo médio entre a abertura do chamado e a primeira resposta do atendente."
          icon={Timer}
          valor={formatarDuracao(kpis.frt_minutos)}
          rodape={
            <Delta pct={variacao(kpis.frt_minutos, kpis.frt_minutos_anterior)} menorEhMelhor />
          }
        />
        <KpiCard
          titulo={"Resolução\u00a0"}
          dica="Mean Time To Resolution: tempo médio entre a abertura e a resolução/encerramento do chamado."
          icon={AlarmClock}
          valor={formatarDuracao(kpis.mttr_minutos)}
          rodape={
            <Delta pct={variacao(kpis.mttr_minutos, kpis.mttr_minutos_anterior)} menorEhMelhor />
          }
        />
        <KpiCard
          titulo={"Satisfação\u00a0"}
          dica="Customer Satisfaction Score: média das notas 1 a 5 dadas pelos solicitantes ao encerrar o chamado."
          icon={Star}
          valor={kpis.csat_media == null ? "—" : `${kpis.csat_media.toFixed(2)} / 5`}
          rodape={
            <span className="text-xs text-muted-foreground">
              {kpis.csat_respostas} avaliação(ões)
            </span>
          }
        />
      </div>
    </TooltipProvider>
  );
};

export default ChamadosDashKpisGrid;
