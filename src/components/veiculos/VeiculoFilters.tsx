import React, { useEffect, useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VeiculoFilterParams } from "@/types/veiculo";
import { FilterX, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface VeiculoFiltersProps {
  filters: VeiculoFilterParams;
  onFilterChange: (name: keyof VeiculoFilterParams, value: string) => void;
  onResetFilters: () => void;
  isLoading?: boolean;
  totalVeiculos?: number;
  categorias?: { id: string; nome_categoria: string }[];
}

interface DropdownOption {
  label: string;
  value: string;
}

const SearchDropdown: React.FC<{
  label: string;
  placeholder: string;
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
}> = ({ label, placeholder, options, value, onChange }) => {
  const [input, setInput] = useState(value || "");
  const [showDropdown, setShowDropdown] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInput(value || "");
  }, [value]);

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(input.toLowerCase())
  );

  return (
    <div className="space-y-2 relative" ref={ref}>
      <Label className="text-sm font-medium">{label}</Label>
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          className="pl-8"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            onChange(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
        />
        {showDropdown && filtered.length > 0 && (
          <ul className="absolute z-10 w-full bg-background border border-border rounded-md mt-1 max-h-48 overflow-y-auto shadow">
            {filtered.slice(0, 50).map((opt, i) => (
              <li
                key={i}
                className="px-3 py-2 hover:bg-muted cursor-pointer text-sm"
                onMouseDown={() => {
                  setInput(opt.label);
                  onChange(opt.value);
                  setShowDropdown(false);
                }}
              >
                {opt.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

const VeiculoFilters: React.FC<VeiculoFiltersProps> = ({
  filters,
  onFilterChange,
  onResetFilters,
  isLoading = false,
  totalVeiculos = 0,
}) => {
  const [subcategorias, setSubcategorias] = useState<DropdownOption[]>([]);
  const [frotas, setFrotas] = useState<DropdownOption[]>([]);
  const [placas, setPlacas] = useState<DropdownOption[]>([]);
  const [capacidades, setCapacidades] = useState<DropdownOption[]>([]);
  const [empresas, setEmpresas] = useState<DropdownOption[]>([]);
  const situacoes: DropdownOption[] = [
    { label: "Operando", value: "Operando" },
    { label: "Em Manutenção", value: "Em Manutenção" },
    { label: "Inativo", value: "Inativo" },
    { label: "Disponível", value: "Disponível" },
  ];

  useEffect(() => {
    const fetchAll = async () => {
      const [subRes, frotaRes, placaRes, capRes, empRes] = await Promise.all([
        supabase.from("bd_subcategorias_ativos").select("id, nome_subcategoria").eq("ativo", true).order("nome_subcategoria"),
        supabase.from("bd_caminhoes_equipamentos").select("frota, numero_frota").order("frota"),
        supabase.from("bd_caminhoes_equipamentos").select("placa").not("placa", "is", null).order("placa"),
        supabase.from("bd_caminhoes_equipamentos").select("capacidade").not("capacidade", "is", null).order("capacidade"),
        supabase.from("bd_empresas").select("id, nome_empresa").eq("situacao", "Ativa").order("nome_empresa"),
      ]);

      if (subRes.data) {
        setSubcategorias(subRes.data.map((s) => ({ label: s.nome_subcategoria, value: s.id })));
      }

      if (frotaRes.data) {
        const unique = new Map<string, string>();
        frotaRes.data.forEach((item) => {
          const label = [item.frota, item.numero_frota].filter(Boolean).join(" - ");
          if (label && !unique.has(label)) {
            unique.set(label, label);
          }
        });
        setFrotas(Array.from(unique.keys()).map((l) => ({ label: l, value: l })));
      }

      if (placaRes.data) {
        const unique = [...new Set(placaRes.data.map((p) => p.placa).filter(Boolean))];
        setPlacas(unique.map((p) => ({ label: p!, value: p! })));
      }

      if (capRes.data) {
        const unique = [...new Set(capRes.data.map((c) => c.capacidade).filter(Boolean))];
        setCapacidades(unique.map((c) => ({ label: c!, value: c! })));
      }

      if (empRes.data) {
        setEmpresas(empRes.data.map((e) => ({ label: e.nome_empresa, value: e.id })));
      }
    };

    fetchAll();
  }, []);

  // Resolve display values for ID-based filters
  const getSubcategoriaDisplay = () => {
    if (!filters.subcategoria_ativo_id) return "";
    const found = subcategorias.find((s) => s.value === filters.subcategoria_ativo_id);
    return found?.label || "";
  };

  const getEmpresaDisplay = () => {
    if (!filters.empresa_id) return "";
    const found = empresas.find((e) => e.value === filters.empresa_id);
    return found?.label || "";
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <SearchDropdown
            label="Subcategoria"
            placeholder="Buscar subcategoria..."
            options={subcategorias}
            value={getSubcategoriaDisplay()}
            onChange={(val) => {
              const match = subcategorias.find((s) => s.value === val || s.label === val);
              onFilterChange("subcategoria_ativo_id", match ? match.value : "");
            }}
          />

          <SearchDropdown
            label="Frota"
            placeholder="Buscar frota..."
            options={frotas}
            value={filters.frota || ""}
            onChange={(val) => onFilterChange("frota", val)}
          />

          <SearchDropdown
            label="Placa"
            placeholder="Buscar placa..."
            options={placas}
            value={filters.placa || ""}
            onChange={(val) => onFilterChange("placa", val)}
          />

          <SearchDropdown
            label="Capacidade"
            placeholder="Buscar capacidade..."
            options={capacidades}
            value={filters.capacidade || ""}
            onChange={(val) => onFilterChange("capacidade", val)}
          />

          <SearchDropdown
            label="Empresa"
            placeholder="Buscar empresa..."
            options={empresas}
            value={getEmpresaDisplay()}
            onChange={(val) => {
              const match = empresas.find((e) => e.value === val || e.label === val);
              onFilterChange("empresa_id", match ? match.value : "");
            }}
          />

          <SearchDropdown
            label="Situação"
            placeholder="Buscar situação..."
            options={situacoes}
            value={filters.situacao || ""}
            onChange={(val) => onFilterChange("situacao", val)}
          />
        </div>

        <div className="flex justify-between items-center mt-6">
          <span className="text-sm text-muted-foreground">
            {isLoading ? "Carregando..." : `${totalVeiculos} registro(s) encontrado(s)`}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onResetFilters}>
              <FilterX className="h-4 w-4 mr-2" />
              Limpar filtros
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default VeiculoFilters;
