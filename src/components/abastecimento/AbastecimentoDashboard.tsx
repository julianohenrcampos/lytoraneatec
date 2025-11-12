import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { AbastecimentoFilters } from './AbastecimentoFilters';
import { AbastecimentoStats } from './AbastecimentoStats';
import { AbastecimentoTable } from './AbastecimentoTable';
import type { AbastecimentoFiltros } from '@/types/abastecimento';

interface AbastecimentoDashboardProps {
  auth: {
    logout: () => void;
  };
  abastecimentos: {
    abastecimentos: any[];
    isLoading: boolean;
    buscarAbastecimentos: (filtros: AbastecimentoFiltros, saveToCache: boolean) => Promise<any>;
    buscarDoCache: (filtros: AbastecimentoFiltros) => Promise<any>;
  };
}

export const AbastecimentoDashboard = ({ auth, abastecimentos }: AbastecimentoDashboardProps) => {
  const handleSearch = async (filtros: AbastecimentoFiltros, fromCache: boolean) => {
    if (fromCache) {
      await abastecimentos.buscarDoCache(filtros);
    } else {
      await abastecimentos.buscarAbastecimentos(filtros, true);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gestão de Abastecimento</h1>
          <p className="text-muted-foreground mt-1">
            Sistema integrado com GuardianWeb
          </p>
        </div>
        <Button variant="outline" onClick={auth.logout}>
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </Button>
      </div>

      <AbastecimentoFilters
        onSearch={handleSearch}
        isLoading={abastecimentos.isLoading}
      />

      <AbastecimentoStats abastecimentos={abastecimentos.abastecimentos} />

      <AbastecimentoTable abastecimentos={abastecimentos.abastecimentos} />
    </div>
  );
};
