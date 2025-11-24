import { Card } from '@/components/ui/card';
import { ClipboardCheck, TrendingUp, Building2, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SSOKPICardsProps {
  totalChecklists: number;
  notaMedia: number;
  obrasAvaliadas: number;
  obrasTotal: number;
  conformidadeGeral: number;
}

export const SSOKPICards = ({
  totalChecklists,
  notaMedia,
  obrasAvaliadas,
  obrasTotal,
  conformidadeGeral
}: SSOKPICardsProps) => {
  const getNotaBadge = (nota: number) => {
    if (nota >= 91) return <Badge className="bg-green-100 text-green-800 border-green-200">Excelente</Badge>;
    if (nota >= 76) return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Satisfatório</Badge>;
    if (nota >= 50) return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Em Atenção</Badge>;
    return <Badge className="bg-red-100 text-red-800 border-red-200">Crítico</Badge>;
  };

  const percentualAvaliado = obrasTotal > 0 ? (obrasAvaliadas / obrasTotal) * 100 : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Total de Checklists</p>
            <p className="text-3xl font-bold">{totalChecklists}</p>
            <p className="text-xs text-muted-foreground mt-2">Avaliações realizadas</p>
          </div>
          <ClipboardCheck className="h-8 w-8 text-primary opacity-80" />
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Nota Média Geral</p>
            <div className="flex items-center gap-2">
              <p className="text-3xl font-bold">{notaMedia.toFixed(1)}</p>
              {getNotaBadge(notaMedia)}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Pontuação média</p>
          </div>
          <TrendingUp className="h-8 w-8 text-primary opacity-80" />
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Obras Avaliadas</p>
            <p className="text-3xl font-bold">{obrasAvaliadas}/{obrasTotal}</p>
            <p className="text-xs text-muted-foreground mt-2">
              {percentualAvaliado.toFixed(0)}% das obras
            </p>
          </div>
          <Building2 className="h-8 w-8 text-primary opacity-80" />
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Conformidade Geral</p>
            <p className="text-3xl font-bold">{conformidadeGeral.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground mt-2">Média de conformidade</p>
          </div>
          <CheckCircle2 className="h-8 w-8 text-primary opacity-80" />
        </div>
      </Card>
    </div>
  );
};
