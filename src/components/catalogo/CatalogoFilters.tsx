import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { CatalogoFilters } from "@/services/catalogoEquipamentoService";
import { useQuery } from "@tanstack/react-query";
import { getTiposEquipamentoDropdown, getFabricantesRelacionalDropdown } from "@/services/veiculo/dropdownsRelacional";
import { getCategoriasDropdown } from "@/services/catalogoEquipamentoService";

interface Props {
  filters: CatalogoFilters;
  onFiltersChange: (f: CatalogoFilters) => void;
}

const CatalogoFiltersBar: React.FC<Props> = ({ filters, onFiltersChange }) => {
  const { data: tipos = [] } = useQuery({ queryKey: ["tipos-equip-dd"], queryFn: getTiposEquipamentoDropdown });
  const { data: categorias = [] } = useQuery({ queryKey: ["categorias-dd"], queryFn: getCategoriasDropdown });
  const { data: fabricantes = [] } = useQuery({ queryKey: ["fabricantes-dd"], queryFn: getFabricantesRelacionalDropdown });

  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select value={filters.tipo_equipamento_id || "_all"} onValueChange={(v) => onFiltersChange({ ...filters, tipo_equipamento_id: v === "_all" ? undefined : v })}>
        <SelectTrigger className="w-[200px]"><SelectValue placeholder="Tipo Equipamento" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">Todos os Tipos</SelectItem>
          {tipos.map((t) => <SelectItem key={t.id} value={t.id}>{t.descricao_padronizada}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.categoria_id || "_all"} onValueChange={(v) => onFiltersChange({ ...filters, categoria_id: v === "_all" ? undefined : v })}>
        <SelectTrigger className="w-[180px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">Todas as Categorias</SelectItem>
          {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome_categoria}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.fabricante_id || "_all"} onValueChange={(v) => onFiltersChange({ ...filters, fabricante_id: v === "_all" ? undefined : v })}>
        <SelectTrigger className="w-[180px]"><SelectValue placeholder="Fabricante" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">Todos os Fabricantes</SelectItem>
          {fabricantes.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.ativo || "_all"} onValueChange={(v) => onFiltersChange({ ...filters, ativo: v === "_all" ? undefined : v })}>
        <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
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

export default CatalogoFiltersBar;
