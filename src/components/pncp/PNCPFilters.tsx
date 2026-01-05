import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, X, Filter, Calendar } from "lucide-react";
import { PNCPFilters as PNCPFiltersType, TODAS_UFS } from "@/types/pncp";
import { getOrgaosUnicos } from "@/services/pncpService";
import { useQuery } from "@tanstack/react-query";
import { Combobox } from "@/components/ui/combobox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
interface PNCPFiltersProps {
  filters: PNCPFiltersType;
  onFilterChange: (filters: PNCPFiltersType) => void;
  onClearFilters: () => void;
}
const CATEGORIAS_VALOR = [{
  id: "mega",
  label: "Mega",
  desc: "≥ R$ 10M",
  className: "bg-red-500 text-white"
}, {
  id: "alto",
  label: "Alto",
  desc: "≥ R$ 5M",
  className: "bg-amber-500 text-white"
}, {
  id: "padrao",
  label: "Padrão",
  desc: "< R$ 5M",
  className: "bg-muted text-muted-foreground"
}];
export function PNCPFilters({
  filters,
  onFilterChange,
  onClearFilters
}: PNCPFiltersProps) {
  const [localFilters, setLocalFilters] = useState<PNCPFiltersType>(filters);
  const [date, setDate] = useState<Date | undefined>(filters.dataFim ? new Date(filters.dataFim) : undefined);
  const {
    data: orgaos = []
  } = useQuery({
    queryKey: ["pncp-orgaos"],
    queryFn: getOrgaosUnicos,
    staleTime: 5 * 60 * 1000 // 5 minutos
  });
  useEffect(() => {
    setLocalFilters(filters);
    setDate(filters.dataFim ? new Date(filters.dataFim) : undefined);
  }, [filters]);
  const handleSearch = () => {
    onFilterChange(localFilters);
  };
  const handleClear = () => {
    setLocalFilters({});
    setDate(undefined);
    onClearFilters();
  };
  const toggleCategoria = (categoriaId: string) => {
    const current = localFilters.categoriaValor || [];
    const newCategorias = current.includes(categoriaId) ? current.filter(c => c !== categoriaId) : [...current, categoriaId];
    setLocalFilters({
      ...localFilters,
      categoriaValor: newCategorias.length > 0 ? newCategorias : undefined
    });
  };
  const handleDateChange = (selectedDate: Date | undefined) => {
    setDate(selectedDate);
    setLocalFilters({
      ...localFilters,
      dataFim: selectedDate ? format(selectedDate, "yyyy-MM-dd") : undefined
    });
  };
  const hasFilters = Object.values(localFilters).some(v => v !== undefined && v !== "" && (Array.isArray(v) ? v.length > 0 : true));
  return <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Filtros</span>
        </div>
        
        {/* Categoria de Valor */}
        <div className="mb-4">
          <Label className="mb-2 block text-sm text-muted-foreground">Categoria de Valor</Label>
          <div className="flex flex-wrap gap-3">
            {CATEGORIAS_VALOR.map(cat => <label key={cat.id} className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={localFilters.categoriaValor?.includes(cat.id) || false} onCheckedChange={() => toggleCategoria(cat.id)} />
                <span className={cn("px-2 py-0.5 rounded text-xs font-medium", cat.className)}>
                  {cat.label}
                </span>
                
              </label>)}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Órgão */}
          <div>
            <Label htmlFor="orgao">Órgão / Unidade</Label>
            <Combobox
              options={[
                { value: "_all", label: "Todos" },
                ...orgaos.map(orgao => ({ 
                  value: orgao, 
                  label: orgao.length > 50 ? `${orgao.substring(0, 50)}...` : orgao 
                }))
              ]}
              value={localFilters.orgao || "_all"}
              onChange={(value) => setLocalFilters({
                ...localFilters,
                orgao: value === "_all" ? undefined : value
              })}
              placeholder="Selecione o órgão..."
              searchPlaceholder="Buscar órgão..."
              emptyText="Nenhum órgão encontrado"
            />
          </div>

          {/* UF */}
          <div>
            <Label htmlFor="uf">Local (UF)</Label>
            <Combobox
              options={[
                { value: "_all", label: "Todos" },
                ...TODAS_UFS.map(uf => ({ 
                  value: uf.sigla, 
                  label: `${uf.sigla} - ${uf.nome}` 
                }))
              ]}
              value={localFilters.uf || "_all"}
              onChange={(value) => setLocalFilters({
                ...localFilters,
                uf: value === "_all" ? undefined : value
              })}
              placeholder="Selecione o estado..."
              searchPlaceholder="Buscar estado..."
              emptyText="Nenhum estado encontrado"
            />
          </div>

          {/* Prazo Propostas */}
          <div>
            <Label>Prazo Até</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
                  <Calendar className="mr-2 h-4 w-4" />
                  {date ? format(date, "dd/MM/yyyy", {
                  locale: ptBR
                }) : "Selecione a data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent mode="single" selected={date} onSelect={handleDateChange} locale={ptBR} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Botões */}
        <div className="flex flex-wrap gap-2 mt-4">
          <Button onClick={handleSearch} className="gap-2">
            <Search className="h-4 w-4" />
            Buscar
          </Button>
          {hasFilters && <Button variant="outline" onClick={handleClear} className="gap-2">
              <X className="h-4 w-4" />
              Limpar Filtros
            </Button>}
        </div>
      </CardContent>
    </Card>;
}