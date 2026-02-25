import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { 
  AgendamentoExame, 
  calcularEstadoBeneficio, 
  calcularEstadoGeralBeneficios, 
  EstadoBeneficio 
} from '@/types/ssoAgendamentoExames';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface BeneficiosVtVrCellProps {
  agendamento: AgendamentoExame;
  onBeneficioUpdate: (id: string, field: string, value: string | null) => void;
  canEdit: boolean;
}

const getBarColor = (estado: EstadoBeneficio) => {
  switch (estado) {
    case 'entregue': return 'bg-green-500';
    case 'em_andamento': return 'bg-blue-500';
    case 'atrasado': return 'bg-destructive';
    default: return 'bg-orange-400';
  }
};

const getTexto = (estado: EstadoBeneficio, diasDecorridos: number) => {
  switch (estado) {
    case 'entregue': return 'Entregue';
    case 'em_andamento': return `${diasDecorridos}/10 dias`;
    case 'atrasado': return `Atrasado`;
    default: return 'A solicitar';
  }
};

const getTextoColor = (estado: EstadoBeneficio) => {
  switch (estado) {
    case 'entregue': return 'text-green-600';
    case 'atrasado': return 'text-destructive';
    case 'pendente': return 'text-orange-500';
    default: return 'text-muted-foreground';
  }
};

export const BeneficiosVtVrCell: React.FC<BeneficiosVtVrCellProps> = ({
  agendamento,
  onBeneficioUpdate,
  canEdit
}) => {
  const vtEstado = calcularEstadoBeneficio(agendamento.vt_solicitado_em, agendamento.vt_entregue_em, agendamento.data_agendamento);
  const vrEstado = calcularEstadoBeneficio(agendamento.vr_solicitado_em, agendamento.vr_entregue_em, agendamento.data_agendamento);
  const estadoGeral = calcularEstadoGeralBeneficios(agendamento);

  const today = format(new Date(), 'yyyy-MM-dd');

  const handleCheck = (field: string, checked: boolean) => {
    onBeneficioUpdate(agendamento.id, field, checked ? today : null);
  };

  const badgeVariant = estadoGeral === 'concluido' ? 'success' : estadoGeral === 'a_solicitar' ? 'warning' : 'info';
  const badgeText = estadoGeral === 'concluido' ? 'Entregue' : estadoGeral === 'a_solicitar' ? 'A solicitar' : 'Em andamento';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="w-full text-left cursor-pointer hover:bg-muted/50 rounded p-1 min-w-[140px]">
          <Badge variant={badgeVariant} className="text-[10px] mb-1">
            {badgeText}
          </Badge>
          
          {/* VT bar */}
          <div className="flex items-center gap-1 mb-0.5">
            <span className="text-[10px] font-medium w-5 shrink-0">VT</span>
            <div className="relative flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div 
                className={cn("h-full rounded-full transition-all", getBarColor(vtEstado.estado))}
                style={{ width: `${vtEstado.percentual}%` }}
              />
            </div>
            <span className={cn("text-[9px] w-[52px] text-right shrink-0", getTextoColor(vtEstado.estado))}>
              {getTexto(vtEstado.estado, vtEstado.diasDecorridos)}
            </span>
          </div>
          
          {/* VR bar */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-medium w-5 shrink-0">VR</span>
            <div className="relative flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div 
                className={cn("h-full rounded-full transition-all", getBarColor(vrEstado.estado))}
                style={{ width: `${vrEstado.percentual}%` }}
              />
            </div>
            <span className={cn("text-[9px] w-[52px] text-right shrink-0", getTextoColor(vrEstado.estado))}>
              {getTexto(vrEstado.estado, vrEstado.diasDecorridos)}
            </span>
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="start">
        <p className="text-sm font-medium mb-2">Benefícios (VT/VR)</p>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox 
              checked={!!agendamento.vt_solicitado_em}
              onCheckedChange={(c) => handleCheck('vt_solicitado_em', !!c)}
              disabled={!canEdit || !!agendamento.vt_entregue_em}
            />
            VT solicitado
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox 
              checked={!!agendamento.vt_entregue_em}
              onCheckedChange={(c) => handleCheck('vt_entregue_em', !!c)}
              disabled={!canEdit}
            />
            VT entregue
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox 
              checked={!!agendamento.vr_solicitado_em}
              onCheckedChange={(c) => handleCheck('vr_solicitado_em', !!c)}
              disabled={!canEdit || !!agendamento.vr_entregue_em}
            />
            VR solicitado
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox 
              checked={!!agendamento.vr_entregue_em}
              onCheckedChange={(c) => handleCheck('vr_entregue_em', !!c)}
              disabled={!canEdit}
            />
            VR entregue
          </label>
        </div>
      </PopoverContent>
    </Popover>
  );
};
