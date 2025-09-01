
import React from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FuncaoFilter } from "@/types/funcao";
import { useIsSmallScreen, useIsMobile } from "@/hooks/use-mobile";

interface FuncaoFiltersProps {
  filters: FuncaoFilter;
  onFilterChange: (field: keyof FuncaoFilter, value: string) => void;
  onResetFilters: () => void;
}

const FuncaoFilters: React.FC<FuncaoFiltersProps> = ({ 
  filters, 
  onFilterChange, 
  onResetFilters 
}) => {
  const isSmallScreen = useIsSmallScreen();
  const isMobile = useIsMobile();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Nome da Função"
            value={filters.nome_funcao || ""}
            onChange={(e) => onFilterChange("nome_funcao", e.target.value)}
            className="pl-8"
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
          <X className={`${isSmallScreen ? 'h-3 w-3' : 'h-4 w-4'}`} />
          Limpar Filtros
        </Button>
      </div>
    </div>
  );
};

export default FuncaoFilters;
