import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Database,
  Clock,
  UserX,
  Gauge,
  ListChecks,
} from "lucide-react";
import type { QcResumo } from "@/services/qualidadeCadastralService";
import { ScoreBar } from "./qualidadeUi";

interface Props {
  resumo?: QcResumo;
  isLoading: boolean;
  onSelecionar: (acao: "criticas" | "duplicidades" | "desatualizados" | "sem_responsavel" | "pendentes" | "limpar") => void;
}

const QualidadeKpis: React.FC<Props> = ({ resumo, isLoading, onSelecionar }) => {
  if (isLoading || !resumo) {
    return (
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-6 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const k = resumo.kpis;
  const pctCompletos = k.registros_monitorados > 0
    ? Math.round((k.completos / k.registros_monitorados) * 100)
    : 0;

  const cards = [
    { titulo: "Registros monitorados", valor: k.registros_monitorados.toLocaleString("pt-BR"), icon: Database, acao: "limpar" as const },
    { titulo: "Cadastros completos", valor: `${k.completos.toLocaleString("pt-BR")}`, sub: `${pctCompletos}%`, icon: CheckCircle2, acao: null },
    { titulo: "Com pendências", valor: k.com_pendencias.toLocaleString("pt-BR"), icon: ListChecks, acao: "pendentes" as const },
    { titulo: "Pendências críticas", valor: k.criticas.toLocaleString("pt-BR"), icon: AlertTriangle, destaque: true, acao: "criticas" as const },
    { titulo: "Possíveis duplicidades", valor: resumo.duplicidades.toLocaleString("pt-BR"), icon: Copy, acao: "duplicidades" as const },
    { titulo: "Dados desatualizados", valor: resumo.desatualizados.toLocaleString("pt-BR"), icon: Clock, acao: "desatualizados" as const },
    { titulo: "Sem responsável", valor: resumo.sem_responsavel.toLocaleString("pt-BR"), icon: UserX, acao: "sem_responsavel" as const },
  ];

  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
      {cards.map((c) => (
        <Card
          key={c.titulo}
          onClick={c.acao ? () => onSelecionar(c.acao!) : undefined}
          className={cn(
            "transition-colors",
            c.acao && "cursor-pointer hover:border-primary/50",
            c.destaque && Number(c.valor.replace(/\D/g, "")) > 0 && "border-destructive/40",
          )}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-muted-foreground leading-tight">{c.titulo}</p>
              <c.icon className="h-4 w-4 text-muted-foreground shrink-0" />
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{c.valor}</p>
            {c.sub && <p className="text-xs text-muted-foreground">{c.sub} do total</p>}
          </CardContent>
        </Card>
      ))}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs text-muted-foreground leading-tight">Índice de Qualidade</p>
            <Gauge className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{k.score}%</p>
          <div className="mt-1">
            <ScoreBar score={k.score} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default QualidadeKpis;
