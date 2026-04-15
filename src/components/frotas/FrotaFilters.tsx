import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Filter } from "lucide-react";

interface FrotaFiltersProps {
  filters: { codigo?: string; tipo?: string; ativo?: string };
  onFilterChange: (key: string, value: string) => void;
  onReset: () => void;
}

const FrotaFilters: React.FC<FrotaFiltersProps> = ({ filters, onFilterChange, onReset }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Filter className="h-4 w-4" />
          Filtros
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Código</Label>
            <Input
              placeholder="Buscar por código..."
              value={filters.codigo || ''}
              onChange={(e) => onFilterChange('codigo', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={filters.tipo || 'all'} onValueChange={(v) => onFilterChange('tipo', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="PROPRIO">Próprio</SelectItem>
                <SelectItem value="LOCADO">Locado</SelectItem>
                <SelectItem value="TERCEIRO">Terceiro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={filters.ativo || 'all'} onValueChange={(v) => onFilterChange('ativo', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="true">Ativo</SelectItem>
                <SelectItem value="false">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FrotaFilters;
