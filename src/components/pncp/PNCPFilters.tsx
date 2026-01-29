import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X, Filter, Calendar, Clock, DollarSign } from "lucide-react";
import { PNCPFilters as PNCPFiltersType, TODAS_UFS } from "@/types/pncp";
import { getOrgaosUnicos, fetchPerfisBusca } from "@/services/pncpService";
import { useQuery } from "@tanstack/react-query";
import { Combobox } from "@/components/ui/combobox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { 
  normalizeDateToBrazilianNoon, 
  formatBrazilianDateToString,
  parseBrazilianDate 
} from "@/utils/timezoneUtils";
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
  const [date, setDate] = useState<Date | undefined>(filters.dataFim ? parseBrazilianDate(filters.dataFim) : undefined);
  const {
    data: orgaos = []
  } = useQuery({
    queryKey: ["pncp-orgaos"],
    queryFn: getOrgaosUnicos,
    staleTime: 5 * 60 * 1000 // 5 minutos
  });

  const {
    data: perfis = []
  } = useQuery({
    queryKey: ["pncp-perfis"],
    queryFn: fetchPerfisBusca,
    staleTime: 5 * 60 * 1000
  });
  useEffect(() => {
    setLocalFilters(filters);
    setDate(filters.dataFim ? parseBrazilianDate(filters.dataFim) : undefined);
  }, [filters]);
  const handleSearch = () => {
    console.log("🔍 PNCP Filters - Aplicando:", localFilters);
    console.log("🔍 PNCP Filters - UF selecionada:", localFilters.uf);
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
    if (selectedDate) {
      const normalizedDate = normalizeDateToBrazilianNoon(selectedDate);
      setDate(normalizedDate);
      setLocalFilters({
        ...localFilters,
        dataFim: formatBrazilianDateToString(normalizedDate)
      });
    } else {
      setDate(undefined);
      setLocalFilters({
        ...localFilters,
        dataFim: undefined
      });
    }
  };
  const hasFilters = Object.values(localFilters).some(v => v !== undefined && v !== "" && (Array.isArray(v) ? v.length > 0 : true));
  return <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Filtros</span>
        </div>
        
        {/* Linha superior: Categoria de Valor (esquerda) + Ordenação/Encerradas (direita) */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-4">
          {/* Categoria de Valor - ESQUERDA */}
          <div>
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
          
          {/* Ordenação + Encerradas - DIREITA */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Ordenar por */}
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground whitespace-nowrap">Ordenar por</Label>
              <Select
                value={localFilters.ordenacao || 'prazo'}
                onValueChange={(value) => {
                  const isHoje = value === 'hoje';
                  setLocalFilters({
                    ...localFilters,
                    ordenacao: value as 'recentes' | 'prazo' | 'valor' | 'hoje',
                    sincronizadasHoje: isHoje
                  });
                }}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prazo">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Prazo
                    </div>
                  </SelectItem>
                  <SelectItem value="recentes">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Mais Recentes
                    </div>
                  </SelectItem>
                  <SelectItem value="valor">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Maior Valor
                    </div>
                  </SelectItem>
                  <SelectItem value="hoje">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      🆕 Apenas de Hoje
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Mostrar Encerradas */}
            <div className="flex items-center gap-2">
              <Switch 
                id="mostrar-encerradas-filter"
                checked={!localFilters.ocultarEncerradas}
                onCheckedChange={(checked) => setLocalFilters({
                  ...localFilters,
                  ocultarEncerradas: !checked
                })}
              />
              <Label htmlFor="mostrar-encerradas-filter" className="cursor-pointer text-sm">
                Mostrar encerradas
              </Label>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
              onChange={(value) => {
                console.log("📍 UF selecionada:", value);
                setLocalFilters(prev => ({
                  ...prev,
                  uf: value === "_all" ? undefined : value
                }));
              }}
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

          {/* Perfil de Busca */}
          <div>
            <Label htmlFor="perfil">Perfil de Busca</Label>
            <Combobox
              options={[
                { value: "_all", label: "Todos os perfis" },
                ...perfis.map(perfil => ({ 
                  value: perfil.id, 
                  label: perfil.nome 
                }))
              ]}
              value={localFilters.perfilBuscaId || "_all"}
              onChange={(value) => setLocalFilters({
                ...localFilters,
                perfilBuscaId: value === "_all" ? undefined : value
              })}
              placeholder="Selecione o perfil..."
              searchPlaceholder="Buscar perfil..."
              emptyText="Nenhum perfil encontrado"
            />
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