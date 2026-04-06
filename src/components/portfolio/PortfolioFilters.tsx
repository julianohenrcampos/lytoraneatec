import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { PortfolioFilters } from "@/services/portfolioEmpresaService";
import { useQuery } from "@tanstack/react-query";
import { getEmpresasFornecedorasDropdown } from "@/services/portfolioEmpresaService";
import { getSubcategoriasDropdown } from "@/services/catalogoVariacoesService";

interface Props {
  filters: PortfolioFilters;
  onFiltersChange: (f: PortfolioFilters) => void;
}

const PortfolioFiltersBar: React.FC<Props> = ({ filters, onFiltersChange }) => {
  const { data: subcategorias = [] } = useQuery({ queryKey: ["subcategorias-dd"], queryFn: getSubcategoriasDropdown });
  const { data: empresas = [] } = useQuery({ queryKey: ["empresas-fornecedoras-dd"], queryFn: getEmpresasFornecedorasDropdown });

  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select value={filters.empresa_id || "_all"} onValueChange={(v) => onFiltersChange({ ...filters, empresa_id: v === "_all" ? undefined : v })}>
        <SelectTrigger className="w-[220px]"><SelectValue placeholder="Empresa" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">Todas as Empresas</SelectItem>
          {empresas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome_empresa}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.subcategoria_id || "_all"} onValueChange={(v) => onFiltersChange({ ...filters, subcategoria_id: v === "_all" ? undefined : v })}>
        <SelectTrigger className="w-[220px]"><SelectValue placeholder="Subcategoria" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">Todas Subcategorias</SelectItem>
          {subcategorias.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.nome_subcategoria}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.ativo || "_all"} onValueChange={(v) => onFiltersChange({ ...filters, ativo: v === "_all" ? undefined : v })}>
        <SelectTrigger className="w-[140px]"><SelectValue placeholder="Ativo" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">Todos</SelectItem>
          <SelectItem value="true">Ativo</SelectItem>
          <SelectItem value="false">Inativo</SelectItem>
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={() => onFiltersChange({})}>
          <X className="mr-1 h-4 w-4" /> Limpar
        </Button>
      )}
    </div>
  );
};

export default PortfolioFiltersBar;
