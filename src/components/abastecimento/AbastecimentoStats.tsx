import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, Droplet, Truck, Users } from 'lucide-react';
import type { Abastecimento } from '@/types/abastecimento';

interface AbastecimentoStatsProps {
  abastecimentos: Abastecimento[];
}

export const AbastecimentoStats = ({ abastecimentos }: AbastecimentoStatsProps) => {
  const stats = {
    totalRegistros: abastecimentos.length,
    totalLitros: abastecimentos.reduce((sum, a) => sum + (a.litragem || 0), 0),
    totalVeiculos: new Set(abastecimentos.map(a => a.frota).filter(Boolean)).size,
    totalComboistas: new Set(abastecimentos.map(a => a.comboista).filter(Boolean)).size,
    mediaPorAbastecimento: abastecimentos.length > 0 
      ? abastecimentos.reduce((sum, a) => sum + (a.litragem || 0), 0) / abastecimentos.length
      : 0
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(num);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total de Abastecimentos</CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatNumber(stats.totalRegistros)}</div>
          <p className="text-xs text-muted-foreground">registros encontrados</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total de Litros</CardTitle>
          <Droplet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatNumber(stats.totalLitros)} L</div>
          <p className="text-xs text-muted-foreground">
            Média: {formatNumber(stats.mediaPorAbastecimento)} L/abast.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Veículos</CardTitle>
          <Truck className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalVeiculos}</div>
          <p className="text-xs text-muted-foreground">veículos diferentes</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Comboistas</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalComboistas}</div>
          <p className="text-xs text-muted-foreground">operadores únicos</p>
        </CardContent>
      </Card>
    </div>
  );
};
