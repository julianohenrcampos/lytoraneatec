import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { X } from "lucide-react";
import { PortfolioFilters } from "@/services/portfolioEmpresaService";
import { useQuery } from "@tanstack/react-query";
import { getEmpresasFornecedorasDropdown } from "@/services/portfolioEmpresaService";
import { getSubcategoriasDropdown, UNIDADES_CAPACIDADE } from "@/services/catalogoVariacoesService";
import { useMemo } from "react";

interface Props {
  filters: PortfolioFilters;
  onFiltersChange: (f: PortfolioFilters) => void;
}

const PortfolioFiltersBar: React.FC<Props> = ({ filters, onFiltersChange }) => {
  const { data: subcategorias = [] } = useQuery({ queryKey: ["subcategorias-dd"], queryFn: getSubcategoriasDropdown });
  const { data: empresas = [] } = useQuery({ queryKey: ["empresas-fornecedoras-dd"], queryFn: getEmpresasFornecedorasDropdown });

  const empresaOptions = useMemo(() => empresas.map((e) => ({ value: e.id, label: e.nome_empresa })), [empresas]);
  const subcategoriaOptions = useMemo(() => subcategorias.map((s: any) => ({ value: s.id, label: s.nome_subcategoria })), [subcategorias]);

  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <Label className="text-xs">Empresa</Label>
        <Combobox
          options={empresaOptions}
          value={filters.empresa_id || ""}
          onChange={(v) => onFiltersChange({ ...filters, empresa_id: v || undefined })}
          placeholder="Todas"
          searchPlaceholder="Buscar empresa..."
          emptyText="Nenhuma"
        />
      </div>

      <div>
        <Label className="text-xs">Subcategoria</Label>
        <Combobox
          options={subcategoriaOptions}
          value={filters.subcategoria_id || ""}
          onChange={(v) => onFiltersChange({ ...filters, subcategoria_id: v || undefined })}
          placeholder="Todas"
          searchPlaceholder="Buscar..."
          emptyText="Nenhuma"
        />
      </div>

      <div>
        <Label className="text-xs">Capacidade</Label>
        <Input
          type="number"
          className="w-[100px]"
          placeholder="Valor"
          value={filters.capacidade_valor || ""}
          onChange={(e) => onFiltersChange({ ...filters, capacidade_valor: e.target.value ? parseFloat(e.target.value) : undefined })}
        />
      </div>

      <div>
        <Label className="text-xs">Unidade</Label>
        <Select value={filters.capacidade_unidade || "_all"} onValueChange={(v) => onFiltersChange({ ...filters, capacidade_unidade: v === "_all" ? undefined : v })}>
          <SelectTrigger className="w-[120px]"><SelectValue placeholder="Todas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Todas</SelectItem>
            {UNIDADES_CAPACIDADE.map((u) => (
              <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={() => onFiltersChange({})}>
          <X className="mr-1 h-4 w-4" /> Limpar
        </Button>
      )}
    </div>
  );
};

export default PortfolioFiltersBar;
