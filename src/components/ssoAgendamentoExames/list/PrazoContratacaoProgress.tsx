import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { calcularPrazoContratacao, PRAZO_CONTRATACAO_DIAS } from '@/types/ssoAgendamentoExames';

interface PrazoContratacaoProgressProps {
  dataResultado: string | null;
  statusExame: string;
  statusCarteira: string;
}

export const PrazoContratacaoProgress: React.FC<PrazoContratacaoProgressProps> = ({
  dataResultado,
  statusExame,
  statusCarteira
}) => {
  // Se carteira já registrada ou revisada, mostrar badge de sucesso
  if (statusCarteira === 'Registrado' || statusCarteira === 'Revisado') {
    return (
      <Badge variant="success" className="whitespace-nowrap">
        ✓ Concluído
      </Badge>
    );
  }

  // Se status não é Apto, não mostrar contador
  const statusAptoList = ['Apto', 'Apto com Restrição'];
  if (!statusAptoList.includes(statusExame) || !dataResultado) {
    return <span className="text-muted-foreground text-xs">-</span>;
  }

  const { diasRestantes, progresso } = calcularPrazoContratacao(dataResultado);
  const vencido = diasRestantes <= 0;

  return (
    <div className="w-24 space-y-1">
      <Progress 
        value={vencido ? 100 : progresso} 
        className={`h-2 ${vencido ? '[&>div]:bg-destructive' : diasRestantes <= 5 ? '[&>div]:bg-warning' : ''}`}
      />
      <p className="text-[10px] text-muted-foreground text-center">
        {vencido ? (
          <span className="text-destructive font-medium">Atrasada</span>
        ) : diasRestantes === 1 ? (
          <span className="text-warning font-medium">1 dia</span>
        ) : diasRestantes <= 5 ? (
          <span className="text-warning">{diasRestantes} dias</span>
        ) : (
          <span>{diasRestantes} dias</span>
        )}
      </p>
    </div>
  );
};
