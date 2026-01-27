import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getStatusColor, STATUS_AGENDAMENTO } from '@/types/ssoAgendamentoExames';
import { ChevronDown, X, Loader2 } from 'lucide-react';

interface BulkActionBarProps {
  selectedCount: number;
  onStatusChange: (status: string) => void;
  onClearSelection: () => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedCount,
  onStatusChange,
  onClearSelection,
  isLoading = false,
  disabled = false
}) => {
  if (selectedCount === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 p-3 bg-muted rounded-lg border">
      <span className="text-sm font-medium">
        {selectedCount} agendamento{selectedCount > 1 ? 's' : ''} selecionado{selectedCount > 1 ? 's' : ''}
      </span>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={isLoading || disabled}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Atualizando...
              </>
            ) : (
              <>
                Alterar Status
                <ChevronDown className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {STATUS_AGENDAMENTO.map((status) => (
            <DropdownMenuItem
              key={status}
              onClick={() => onStatusChange(status)}
            >
              <Badge variant={getStatusColor(status)} className="mr-2">
                {status}
              </Badge>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={onClearSelection}
        disabled={isLoading}
      >
        <X className="h-4 w-4 mr-1" />
        Limpar seleção
      </Button>
    </div>
  );
};
