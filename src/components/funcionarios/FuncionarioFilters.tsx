
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox, ComboboxOption } from "@/components/ui/combobox";
import { FuncionarioFilter } from "@/types/funcionario";
import React, { useMemo } from "react";
import { FilterX, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useIsSmallScreen, useIsMobile } from "@/hooks/use-mobile";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDynamicPermissions } from "@/hooks/useDynamicPermissions";
import { RESTRICTED_CC_CODE } from "@/utils/centroCustoRestrictions";

interface FuncionarioFiltersProps {
  filters: FuncionarioFilter;
  onFilterChange: (field: keyof FuncionarioFilter, value: any) => void;
  onReset: () => void;
}

const FuncionarioFilters: React.FC<FuncionarioFiltersProps> = ({
  filters,
  onFilterChange,
  onReset,
}) => {
  const isSmallScreen = useIsSmallScreen();
  const isMobile = useIsMobile();
  const { isSuperAdmin } = useDynamicPermissions();

  // Fetch funções
  const { data: funcoes = [] } = useQuery({
    queryKey: ['filter-funcoes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bd_funcoes')
        .select('id, nome_funcao')
        .eq('situacao', 'Ativo')
        .order('nome_funcao');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch centros de custo
  const { data: centrosCusto = [] } = useQuery({
    queryKey: ['filter-centros-custo', isSuperAdmin],
    queryFn: async () => {
      let query = supabase
        .from('bd_centros_custo')
        .select('id, codigo_centro_custo, nome_centro_custo')
        .eq('situacao', 'Ativo');
      if (!isSuperAdmin) {
        query = query.neq('codigo_centro_custo', RESTRICTED_CC_CODE);
      }
      const { data, error } = await query.order('nome_centro_custo');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch departamentos
  const { data: departamentos = [] } = useQuery({
    queryKey: ['filter-departamentos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bd_departamentos')
        .select('id, nome_departamento')
        .order('nome_departamento');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch empresas
  const { data: empresas = [] } = useQuery({
    queryKey: ['filter-empresas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bd_empresas')
        .select('id, nome_empresa')
        .eq('situacao', 'Ativo')
        .order('nome_empresa');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch equipes
  const { data: equipes = [] } = useQuery({
    queryKey: ['filter-equipes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bd_equipes')
        .select('id, nome_equipe')
        .order('nome_equipe');
      if (error) throw error;
      return data || [];
    },
  });

  // Build combobox options
  const funcaoOptions: ComboboxOption[] = useMemo(() => [
    { value: "", label: "Todas" },
    { value: "sem_funcao", label: "Sem Função" },
    ...funcoes.map(f => ({ value: f.id, label: f.nome_funcao })),
  ], [funcoes]);

  const centroCustoOptions: ComboboxOption[] = useMemo(() => [
    { value: "", label: "Todos" },
    { value: "sem_valor", label: "Sem Centro de Custo" },
    ...centrosCusto.map(c => ({ value: c.id, label: `${c.codigo_centro_custo} - ${c.nome_centro_custo}` })),
  ], [centrosCusto]);

  const departamentoOptions: ComboboxOption[] = useMemo(() => [
    { value: "", label: "Todos" },
    { value: "sem_valor", label: "Sem Departamento" },
    ...departamentos.map(d => ({ value: d.id, label: d.nome_departamento || "Sem nome" })),
  ], [departamentos]);

  const empresaOptions: ComboboxOption[] = useMemo(() => [
    { value: "", label: "Todas" },
    { value: "sem_valor", label: "Sem Empresa" },
    ...empresas.map(e => ({ value: e.id, label: e.nome_empresa })),
  ], [empresas]);

  const equipeOptions: ComboboxOption[] = useMemo(() => [
    { value: "", label: "Todas" },
    { value: "sem_valor", label: "Sem Equipe" },
    ...equipes.map(eq => ({ value: eq.id, label: eq.nome_equipe })),
  ], [equipes]);

  const handleComboboxChange = (field: keyof FuncionarioFilter, value: string) => {
    onFilterChange(field, value === "" ? undefined : value);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-medium">Filtros</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Row 1: Text inputs + Status */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="nome_completo">Nome do Funcionário</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="nome_completo"
                placeholder="Buscar por nome"
                className="pl-8"
                value={filters.nome_completo || ""}
                onChange={(e) => onFilterChange("nome_completo", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cpf">CPF</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="cpf"
                placeholder="Buscar por CPF"
                className="pl-8"
                value={filters.cpf || ""}
                onChange={(e) => onFilterChange("cpf", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="matricula">Matrícula</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="matricula"
                placeholder="Buscar por matrícula"
                className="pl-8"
                value={filters.matricula || ""}
                onChange={(e) => onFilterChange("matricula", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={filters.status || "todos"}
              onValueChange={(value) => onFilterChange("status", value === "todos" ? undefined : value)}
            >
              <SelectTrigger id="status">
                <SelectValue placeholder="Selecione um status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="Ativo">Ativo</SelectItem>
                <SelectItem value="Ativo sem Registro">Ativo sem Registro</SelectItem>
                <SelectItem value="Aviso Prévio">Aviso Prévio</SelectItem>
                <SelectItem value="Inativo">Inativo</SelectItem>
                <SelectItem value="INSS">INSS</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Row 2: Combobox dropdowns */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          <div className="space-y-2">
            <Label>Função</Label>
            <Combobox
              options={funcaoOptions}
              value={filters.funcao_id || ""}
              onChange={(value) => handleComboboxChange("funcao_id", value)}
              placeholder="Todas"
              searchPlaceholder="Buscar função..."
              emptyText="Nenhuma função encontrada"
            />
          </div>

          <div className="space-y-2">
            <Label>Centro de Custo</Label>
            <Combobox
              options={centroCustoOptions}
              value={filters.centro_custo_id || ""}
              onChange={(value) => handleComboboxChange("centro_custo_id", value)}
              placeholder="Todos"
              searchPlaceholder="Buscar centro de custo..."
              emptyText="Nenhum centro de custo encontrado"
            />
          </div>

          <div className="space-y-2">
            <Label>Departamento</Label>
            <Combobox
              options={departamentoOptions}
              value={filters.departamento_id || ""}
              onChange={(value) => handleComboboxChange("departamento_id", value)}
              placeholder="Todos"
              searchPlaceholder="Buscar departamento..."
              emptyText="Nenhum departamento encontrado"
            />
          </div>

          <div className="space-y-2">
            <Label>Empresa</Label>
            <Combobox
              options={empresaOptions}
              value={filters.empresa_id || ""}
              onChange={(value) => handleComboboxChange("empresa_id", value)}
              placeholder="Todas"
              searchPlaceholder="Buscar empresa..."
              emptyText="Nenhuma empresa encontrada"
            />
          </div>

          <div className="space-y-2">
            <Label>Equipe</Label>
            <Combobox
              options={equipeOptions}
              value={filters.equipe_id || ""}
              onChange={(value) => handleComboboxChange("equipe_id", value)}
              placeholder="Todas"
              searchPlaceholder="Buscar equipe..."
              emptyText="Nenhuma equipe encontrada"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button 
            variant="outline" 
            onClick={onReset} 
            className="gap-2"
            size={isSmallScreen ? "xs" : isMobile ? "mobile-sm" : "default"}
          >
            <FilterX className={`${isSmallScreen ? 'h-3 w-3' : 'h-4 w-4'}`} />
            Limpar Filtros
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default FuncionarioFilters;
