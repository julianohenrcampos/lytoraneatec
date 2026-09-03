import { Button } from '@/components/ui/button';
import { RefreshCw, X } from 'lucide-react';

interface Props {
  onRefresh: () => void;
  onClearFilters?: () => void;
  hasFilters: boolean;
  isRefreshing?: boolean;
}

export default function CentralHeader({ onRefresh, onClearFilters, hasFilters, isRefreshing }: Props) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Central de Aprovações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Acompanhe e aprove solicitações de todos os módulos em um só lugar.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="gap-2" onClick={onRefresh} disabled={isRefreshing}>
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
        {hasFilters && onClearFilters && (
          <Button variant="outline" size="sm" className="gap-2" onClick={onClearFilters}>
            <X className="h-4 w-4" />
            Limpar filtros
          </Button>
        )}
      </div>
    </div>
  );
}
