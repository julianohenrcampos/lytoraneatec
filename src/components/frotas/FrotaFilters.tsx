import React from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

interface FrotaFiltersProps {
  filters: { codigo?: string; tipo?: string; ativo?: string };
  onFilterChange: (key: string, value: string) => void;
  onReset: () => void;
}

const FrotaFilters: React.FC<FrotaFiltersProps> = ({ filters, onFilterChange, onReset }) => {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Input
          placeholder="Buscar por código..."
          value={filters.codigo || ''}
          onChange={(e) => onFilterChange('codigo', e.target.value)}
        />
      </div>
      <Select value={filters.tipo || 'all'} onValueChange={(v) => onFilterChange('tipo', v)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Tipo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os tipos</SelectItem>
          <SelectItem value="PROPRIO">Próprio</SelectItem>
          <SelectItem value="LOCADO">Locado</SelectItem>
          <SelectItem value="TERCEIRO">Terceiro</SelectItem>
        </SelectContent>
      </Select>
      <Select value={filters.ativo || 'all'} onValueChange={(v) => onFilterChange('ativo', v)}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="true">Ativo</SelectItem>
          <SelectItem value="false">Inativo</SelectItem>
        </SelectContent>
      </Select>
      <Button variant="outline" size="icon" onClick={onReset} title="Limpar filtros">
        <RotateCcw className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default FrotaFilters;
