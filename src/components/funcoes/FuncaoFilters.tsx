import React, { useState, useEffect, useMemo } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { FuncaoFilter } from "@/types/funcao";
import { useIsSmallScreen, useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";

interface FuncaoFiltersProps {
  filters: FuncaoFilter;
  onFilterChange: (field: keyof FuncaoFilter, value: string) => void;
  onResetFilters: () => void;
}

const FuncaoFilters: React.FC<FuncaoFiltersProps> = ({
  filters,
  onFilterChange,
  onResetFilters,
}) => {
  const isSmallScreen = useIsSmallScreen();
  const isMobile = useIsMobile();

  const [funcoes, setFuncoes] = useState<{ id: string; nome_funcao: string }[]>([]);

  useEffect(() => {
    const fetchFuncoes = async () => {
      const { data, error } = await supabase
        .from("bd_funcoes")
        .select("id, nome_funcao")
        .order("nome_funcao", { ascending: true });

      if (!error && data) {
        setFuncoes(data);
      }
    };

    fetchFuncoes();
  }, []);

  const comboboxOptions = useMemo(() => {
    return [
      { value: "", label: "Todas" },
      ...funcoes.map((f) => ({ value: f.id, label: f.nome_funcao })),
    ];
  }, [funcoes]);

  // Find selected value by matching the filter text to a label
  const selectedValue = useMemo(() => {
    if (!filters.nome_funcao) return "";
    const match = funcoes.find((f) => f.nome_funcao === filters.nome_funcao);
    return match ? match.id : "";
  }, [filters.nome_funcao, funcoes]);

  const handleSelect = (value: string) => {
    if (!value) {
      onFilterChange("nome_funcao", "");
      return;
    }
    const match = funcoes.find((f) => f.id === value);
    onFilterChange("nome_funcao", match ? match.nome_funcao : "");
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <label htmlFor="nome_funcao" className="text-sm font-medium">
            Nome da Função
          </label>
          <Combobox
            options={comboboxOptions}
            value={selectedValue}
            onChange={handleSelect}
            placeholder="Selecione uma função"
            searchPlaceholder="Buscar função..."
            emptyText="Nenhuma função encontrada"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={onResetFilters}
          disabled={!Object.values(filters).some(Boolean)}
          size={isSmallScreen ? "xs" : isMobile ? "mobile-sm" : "sm"}
          className="flex items-center gap-2"
        >
          <X className={`${isSmallScreen ? "h-3 w-3" : "h-4 w-4"}`} />
          Limpar Filtros
        </Button>
      </div>
    </div>
  );
};

export default FuncaoFilters;
