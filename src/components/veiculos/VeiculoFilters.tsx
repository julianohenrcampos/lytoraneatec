import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VeiculoFilterParams } from "@/types/veiculo";
import { FilterX, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface VeiculoFiltersProps {
  filters: VeiculoFilterParams;
  onFilterChange: (name: keyof VeiculoFilterParams, value: string) => void;
  onResetFilters: () => void;
  isLoading?: boolean;
  totalVeiculos?: number;
}

const VeiculoFilters: React.FC<VeiculoFiltersProps> = ({
  filters,
  onFilterChange,
  onResetFilters,
  isLoading = false,
  totalVeiculos = 0,
}) => {
  const [placas, setPlacas] = useState<string[]>([]);

  // Busca as placas no Supabase
  useEffect(() => {
    const fetchPlacas = async () => {
      const { data, error } = await supabase
        .from("bd_caminhoes_equipamentos")
        .select("placa")
        .not("placa", "is", null)
        .order("placa");

      if (error) {
        console.error("Erro ao buscar placas:", error.message);
      } else {
        const unicos = [...new Set(data.map((item) => item.placa))];
        setPlacas(unicos);
      }
    };

    fetchPlacas();
  }, []);

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Campo Placa com Datalist */}
          <div className="space-y-2">
            <Label className="text-sm font-medium" htmlFor="placa-filter">
              Placa
            </Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                list="placasList"
                id="placa-filter"
                placeholder="Buscar por placa"
                value={filters.placa || ""}
                onChange={(e) => onFilterChange("placa", e.target.value)}
                className="pl-8"
              />
              <datalist id="placasList">
                {placas.map((placa, index) => (
                  <option key={index} value={placa} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Campo Frota/Número */}
          <div className="space-y-2">
            <Label className="text-sm font-medium" htmlFor="frota-filter">
              Frota/Número
            </Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="frota-filter"
                placeholder="Buscar por frota ou número"
                value={filters.frota || ""}
                onChange={(e) => onFilterChange("frota", e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {/* Campo Situação */}
          <div className="space-y-2">
            <Label className="text-sm font-medium" htmlFor="situacao-filter">
              Situação
            </Label>
            <Select
              value={filters.situacao || ""}
              onValueChange={(value) =>
                onFilterChange("situacao", value === "_all" ? "" : value)
              }
            >
              <SelectTrigger id="situacao-filter" className="pl-2">
                <SelectValue placeholder="Todas as situações" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Todas as situações</SelectItem>
                <SelectItem value="Operando">Operando</SelectItem>
                <SelectItem value="Em Manutenção">Em Manutenção</SelectItem>
                <SelectItem value="Inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Botão de Limpar */}
        <div className="flex justify-end mt-6">
          <div className="w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={onResetFilters}
              className="w-full sm:w-auto"
            >
              <FilterX className="h-4 w-4 mr-2" />
              Limpar filtros
            </Button>
          </div>

          {totalVeiculos > 0 && (
            <div className="hidden ml-4 text-sm text-muted-foreground">
              {isLoading ? (
                "Carregando..."
              ) : (
                <>
                  {totalVeiculos} veículo
                  {totalVeiculos !== 1 ? "s" : ""} encontrado
                  {totalVeiculos !== 1 ? "s" : ""}
                </>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default VeiculoFilters;
