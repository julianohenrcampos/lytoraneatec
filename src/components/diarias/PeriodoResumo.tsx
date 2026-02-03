import { Calendar, CalendarDays, PartyPopper, Briefcase, Calculator } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { PeriodoAnalise } from '@/utils/diariasPeriodoUtils';
import { formatBrazilianDateForDisplay } from '@/utils/timezoneUtils';

interface PeriodoResumoProps {
  dataInicio: string;
  dataFim: string;
  analise: PeriodoAnalise;
  consideraFdsFeriado: boolean;
}

export function PeriodoResumo({ 
  dataInicio, 
  dataFim, 
  analise, 
  consideraFdsFeriado 
}: PeriodoResumoProps) {
  if (!dataInicio || !dataFim) {
    return null;
  }

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Calculator className="h-4 w-4 text-primary" />
          Resumo do Período
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Período */}
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Período:</span>
          <span>
            {formatBrazilianDateForDisplay(dataInicio)} → {formatBrazilianDateForDisplay(dataFim)}
          </span>
          <Badge variant="secondary" className="ml-1">
            {analise.totalDias} dia{analise.totalDias !== 1 ? 's' : ''}
          </Badge>
        </div>

        {/* Grid de contagem */}
        <div className="grid grid-cols-3 gap-2">
          <div className="flex items-center gap-1.5 text-sm">
            <Briefcase className="h-3.5 w-3.5 text-green-600" />
            <span className="text-muted-foreground">Dias úteis:</span>
            <span className="font-medium">{analise.diasUteis}</span>
          </div>
          
          <div className="flex items-center gap-1.5 text-sm">
            <CalendarDays className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-muted-foreground">FDS:</span>
            <span className="font-medium">{analise.finaisDeSemana}</span>
          </div>
          
          <div className="flex items-center gap-1.5 text-sm">
            <PartyPopper className="h-3.5 w-3.5 text-amber-600" />
            <span className="text-muted-foreground">Feriados:</span>
            <span className="font-medium">{analise.feriados}</span>
          </div>
        </div>

        {/* Toggle status */}
        <div className="flex items-center justify-between pt-2 border-t text-sm">
          <span className="text-muted-foreground">
            Considerar FDS/Feriados:
          </span>
          <Badge variant={consideraFdsFeriado ? 'default' : 'outline'}>
            {consideraFdsFeriado ? 'Sim' : 'Não'}
          </Badge>
        </div>

        {/* Dias para cálculo */}
        <div className="flex items-center justify-between text-sm bg-muted/50 rounded-md p-2">
          <span className="font-medium">Dias considerados para cálculo:</span>
          <span className="font-bold text-primary">
            {analise.diasParaCalculo}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
