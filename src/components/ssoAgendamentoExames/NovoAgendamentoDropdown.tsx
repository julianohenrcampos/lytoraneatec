import React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Plus, ChevronDown, UserPlus, RotateCcw, UserMinus, RefreshCw, ArrowLeftRight } from 'lucide-react';

interface NovoAgendamentoDropdownProps {
  onNovoAgendamento: () => void;
  onRetorno: () => void;
  onDemissional: () => void;
  onPeriodico: () => void;
  onMudancaRisco: () => void;
  disabled?: boolean;
  tooltipReason?: string;
}

export const NovoAgendamentoDropdown: React.FC<NovoAgendamentoDropdownProps> = ({
  onNovoAgendamento,
  onRetorno,
  onDemissional,
  onPeriodico,
  onMudancaRisco,
  disabled = false,
  tooltipReason,
}) => {
  if (disabled) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-block">
              <Button disabled className="opacity-60 cursor-not-allowed">
                <Plus className="h-4 w-4 mr-2" />
                Novo Agendamento
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </span>
          </TooltipTrigger>
          {tooltipReason && (
            <TooltipContent className="max-w-xs">
              <p className="text-sm">{tooltipReason}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Novo Agendamento
          <ChevronDown className="h-4 w-4 ml-2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={onNovoAgendamento} className="cursor-pointer">
          <UserPlus className="h-4 w-4 mr-2 text-success" />
          <div className="flex flex-col">
            <span className="font-medium">Novo Agendamento</span>
            <span className="text-xs text-muted-foreground">Admissional completo</span>
          </div>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={onRetorno} className="cursor-pointer">
          <RotateCcw className="h-4 w-4 mr-2 text-info" />
          <div className="flex flex-col">
            <span className="font-medium">Retorno ao Trabalho</span>
            <span className="text-xs text-muted-foreground">Funcionário existente</span>
          </div>
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={onDemissional} className="cursor-pointer">
          <UserMinus className="h-4 w-4 mr-2 text-destructive" />
          <div className="flex flex-col">
            <span className="font-medium">Demissional</span>
            <span className="text-xs text-muted-foreground">Funcionário existente</span>
          </div>
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={onPeriodico} className="cursor-pointer">
          <RefreshCw className="h-4 w-4 mr-2 text-warning" />
          <div className="flex flex-col">
            <span className="font-medium">Periódico</span>
            <span className="text-xs text-muted-foreground">Funcionário existente</span>
          </div>
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={onMudancaRisco} className="cursor-pointer">
          <ArrowLeftRight className="h-4 w-4 mr-2 text-purple-500" />
          <div className="flex flex-col">
            <span className="font-medium">Mudança de Risco</span>
            <span className="text-xs text-muted-foreground">Promoção ou Mudança de Setor</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
