import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { calcularProgressoPrazo, isPrazoVencido } from '@/types/ssoAgendamentoExames';
import { differenceInDays } from 'date-fns';

interface PrazoContratacaoProgressProps {
  dataInicio: string | null;
  dataLimite: string | null;
  carteiraAssinada: boolean;
}

export const PrazoContratacaoProgress: React.FC<PrazoContratacaoProgressProps> = ({
  dataInicio,
  dataLimite,
  carteiraAssinada
}) => {
  // Se carteira já assinada, mostrar badge de sucesso
  if (carteiraAssinada) {
    return (
      <Badge variant="success" className="whitespace-nowrap">
        ✓ Concluído
      </Badge>
    );
  }

  // Se não tem datas, não mostrar nada
  if (!dataInicio || !dataLimite) {
    return <span className="text-muted-foreground text-xs">-</span>;
  }

  const progresso = calcularProgressoPrazo(dataInicio, dataLimite);
  const vencido = isPrazoVencido(dataLimite, carteiraAssinada);
  
  // Calcular dias restantes
  const hoje = new Date();
  const limite = new Date(dataLimite);
  const diasRestantes = differenceInDays(limite, hoje);

  // Determinar cor com base no progresso
  const getProgressColor = () => {
    if (vencido) return 'bg-destructive';
    if (progresso >= 80) return 'bg-orange-500';
    if (progresso >= 50) return 'bg-yellow-500';
    return 'bg-primary';
  };

  return (
    <div className="w-24 space-y-1">
      <Progress 
        value={vencido ? 100 : progresso} 
        className={`h-2 ${vencido ? '[&>div]:bg-destructive' : progresso >= 80 ? '[&>div]:bg-warning' : progresso >= 50 ? '[&>div]:bg-warning' : ''}`}
      />
      <p className="text-[10px] text-muted-foreground text-center">
        {vencido ? (
          <span className="text-destructive font-medium">Vencido</span>
        ) : diasRestantes === 0 ? (
          <span className="text-warning font-medium">Hoje</span>
        ) : diasRestantes === 1 ? (
          <span className="text-warning">1 dia</span>
        ) : (
          <span>{diasRestantes} dias</span>
        )}
      </p>
    </div>
  );
};
