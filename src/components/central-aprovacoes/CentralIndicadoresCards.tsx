import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, AlertTriangle, UserCheck, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CentralIndicadores } from '@/services/central-aprovacoes/types';

interface Props {
  indicadores: CentralIndicadores;
  isLoading: boolean;
}

function fmt(v: number | null): string {
  return v === null || v === undefined ? '—' : String(v);
}

export default function CentralIndicadoresCards({ indicadores, isLoading }: Props) {
  const cards = [
    { key: 'pendentes', label: 'Pendentes', value: fmt(indicadores.pendentes), Icon: Clock, border: 'border-l-amber-500', bg: 'bg-amber-50', color: 'text-amber-600' },
    { key: 'urgentes', label: 'Urgentes', value: fmt(indicadores.urgentes), Icon: AlertTriangle, border: 'border-l-red-500', bg: 'bg-red-50', color: 'text-red-600' },
    { key: 'acao', label: 'Aguardando minha ação', value: fmt(indicadores.aguardandoMinhaAcao), Icon: UserCheck, border: 'border-l-primary', bg: 'bg-primary/10', color: 'text-primary' },
    { key: 'concluidas', label: 'Concluídas hoje', value: fmt(indicadores.concluidasHoje), Icon: CheckCircle2, border: 'border-l-green-500', bg: 'bg-green-50', color: 'text-green-600' },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((c) => (
          <Card key={c.key} className="border-l-4 border-l-muted rounded-2xl">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-2"><Skeleton className="h-7 w-12" /><Skeleton className="h-3 w-24" /></div>
              <Skeleton className="h-10 w-10 rounded-xl" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map(({ key, label, value, Icon, border, bg, color }) => (
        <Card key={key} className={cn('border-l-4 rounded-2xl shadow-sm', border)}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{label}</p>
            </div>
            <div className={cn('p-2 rounded-xl', bg)}>
              <Icon className={cn('h-5 w-5', color)} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
