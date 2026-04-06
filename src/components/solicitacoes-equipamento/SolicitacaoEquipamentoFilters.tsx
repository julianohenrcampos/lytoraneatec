import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useTiposEquipamentoDropdown } from "@/hooks/vehicles/useRelacionalDropdowns";

interface Props {
  filters: { status?: string; prioridade?: string; tipo_equipamento_id?: string; status_fluxo?: string };
  onFilterChange: (key: string, value: string) => void;
  onResetFilters: () => void;
}

const SolicitacaoEquipamentoFilters: React.FC<Props> = ({ filters, onFilterChange, onResetFilters }) => {
  const { data: tiposEquipamento = [] } = useTiposEquipamentoDropdown();

  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="flex flex-wrap gap-3 items-end">
      <div className="w-48">
        <label className="text-sm font-medium text-muted-foreground mb-1 block">Status Fluxo</label>
        <Select value={filters.status_fluxo || ""} onValueChange={(v) => onFilterChange("status_fluxo", v === "_all" ? "" : v)}>
          <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Todos</SelectItem>
            <SelectItem value="RASCUNHO">Rascunho</SelectItem>
            <SelectItem value="PENDENTE_APROVACAO">Pendente Aprovação</SelectItem>
            <SelectItem value="APROVADO">Aprovado</SelectItem>
            <SelectItem value="EM_TRANSPORTE">Em Transporte</SelectItem>
            <SelectItem value="EM_EXECUCAO">Em Execução</SelectItem>
            <SelectItem value="CONCLUIDO">Concluído</SelectItem>
            <SelectItem value="NEGADO">Negado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="w-48">
        <label className="text-sm font-medium text-muted-foreground mb-1 block">Prioridade</label>
        <Select value={filters.prioridade || ""} onValueChange={(v) => onFilterChange("prioridade", v === "_all" ? "" : v)}>
          <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Todas</SelectItem>
            <SelectItem value="NORMAL">Normal</SelectItem>
            <SelectItem value="ALTA">Alta</SelectItem>
            <SelectItem value="URGENTE">Urgente</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="w-64">
        <label className="text-sm font-medium text-muted-foreground mb-1 block">Tipo Equipamento</label>
        <Select value={filters.tipo_equipamento_id || ""} onValueChange={(v) => onFilterChange("tipo_equipamento_id", v === "_all" ? "" : v)}>
          <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Todos</SelectItem>
            {tiposEquipamento.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.descricao_padronizada}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={onResetFilters} className="gap-1">
          <X className="h-4 w-4" /> Limpar
        </Button>
      )}
    </div>
  );
};

export default SolicitacaoEquipamentoFilters;
