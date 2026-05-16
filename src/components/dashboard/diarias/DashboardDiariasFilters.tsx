import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Filter, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Combobox } from "@/components/ui/combobox";
import { MultiCombobox } from "@/components/ui/multi-combobox";
import { PeriodoRangePicker } from "@/components/dashboard/rh/PeriodoRangePicker";
import { usePermission } from "@/hooks/usePermission";
import type { DiariasFilters } from "./_dashboardHelpers";

// Re-exporta para manter o caminho de import histórico funcionando
export type { DiariasFilters } from "./_dashboardHelpers";

interface DashboardDiariasFiltersProps {
  filters: DiariasFilters;
  onFilterChange: (filters: Partial<DiariasFilters>) => void;
  onClearFilters: () => void;
}

export default function DashboardDiariasFilters({
  filters,
  onFilterChange,
  onClearFilters,
}: DashboardDiariasFiltersProps) {
  const { isSuperAdmin } = usePermission();

  // Centros de custo
  const { data: centrosCusto = [] } = useQuery({
    queryKey: ["centros-custo-diarias-dashboard", isSuperAdmin],
    queryFn: async () => {
      let query = supabase
        .from("bd_centros_custo")
        .select("id, codigo_centro_custo, nome_centro_custo")
        .eq("situacao", "Ativo");
      if (!isSuperAdmin) query = query.neq("codigo_centro_custo", "DIR001");
      const { data, error } = await query.order("codigo_centro_custo");
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Nº Solicitações
  const { data: solicitacoes = [] } = useQuery({
    queryKey: ["solicitacoes-diarias-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bd_diaria_solicitacoes")
        .select("id, numero_solicitacao")
        .order("numero_solicitacao", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Gerentes Regionais (aprovadores de centros de custo)
  const { data: gerentesRegionais = [] } = useQuery({
    queryKey: ["gerentes-regionais-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bd_centros_custo")
        .select(
          "aprovador_diarias_id, bd_funcionarios!bd_centros_custo_aprovador_diarias_id_fkey(id, nome_completo)"
        )
        .not("aprovador_diarias_id", "is", null)
        .eq("situacao", "Ativo");
      if (error) throw error;

      const uniqueMap = new Map<string, string>();
      (data || []).forEach((cc: any) => {
        const func = cc.bd_funcionarios;
        if (func?.id && func?.nome_completo) {
          uniqueMap.set(func.id, func.nome_completo);
        }
      });
      return Array.from(uniqueMap.entries())
        .map(([id, nome]) => ({ id, nome_completo: nome }))
        .sort((a, b) => a.nome_completo.localeCompare(b.nome_completo));
    },
    staleTime: 5 * 60 * 1000,
  });

  // Engenheiros Solicitantes
  const { data: engenheiros = [] } = useQuery({
    queryKey: ["engenheiros-solicitantes-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bd_diaria_solicitacoes")
        .select(
          "engenheiro_solicitante_id, bd_funcionarios!bd_diaria_solicitacoes_engenheiro_solicitante_id_fkey(id, nome_completo)"
        )
        .not("engenheiro_solicitante_id", "is", null);
      if (error) throw error;

      const uniqueMap = new Map<string, string>();
      (data || []).forEach((sol: any) => {
        const func = sol.bd_funcionarios;
        if (func?.id && func?.nome_completo) {
          uniqueMap.set(func.id, func.nome_completo);
        }
      });
      return Array.from(uniqueMap.entries()).map(([id, nome]) => ({
        id,
        nome_completo: nome,
      }));
    },
    staleTime: 5 * 60 * 1000,
  });

  // Funcionários presentes nos apontamentos — restritos ao período do filtro
  // (evita o cap de 1000 linhas do PostgREST e popula corretamente o combobox).
  const dataInicioStr = filters.dataInicio
    ? filters.dataInicio.toISOString().slice(0, 10)
    : null;
  const dataFimStr = filters.dataFim
    ? filters.dataFim.toISOString().slice(0, 10)
    : null;

  const { data: funcionarios = [] } = useQuery({
    queryKey: ["funcionarios-presentes-dashboard", dataInicioStr, dataFimStr],
    enabled: !!dataInicioStr && !!dataFimStr,
    queryFn: async () => {
      let q = supabase
        .from("bd_diaria_presencas")
        .select(
          "funcionario_id, bd_funcionarios!bd_diaria_presencas_funcionario_id_fkey(id, nome_completo)"
        )
        .eq("presente", true)
        .not("funcionario_id", "is", null);
      if (dataInicioStr) q = q.gte("data", dataInicioStr);
      if (dataFimStr) q = q.lte("data", dataFimStr);
      const { data, error } = await q.limit(5000);
      if (error) throw error;

      const uniqueMap = new Map<string, string>();
      (data || []).forEach((p: any) => {
        const f = p.bd_funcionarios;
        if (f?.id && f?.nome_completo) {
          uniqueMap.set(f.id, f.nome_completo);
        }
      });
      return Array.from(uniqueMap.entries())
        .map(([id, nome]) => ({ id, nome_completo: nome }))
        .sort((a, b) => a.nome_completo.localeCompare(b.nome_completo, "pt-BR"));
    },
    staleTime: 5 * 60 * 1000,
  });

  const ccOptions = centrosCusto.map((cc) => ({
    value: cc.id,
    label: `${cc.codigo_centro_custo} - ${cc.nome_centro_custo}`,
  }));

  const solicitacaoOptions = solicitacoes.map((s) => ({
    value: s.id,
    label: s.numero_solicitacao,
  }));

  const gerenteOptions = gerentesRegionais.map((g) => ({
    value: g.id,
    label: g.nome_completo,
  }));

  const engenheiroOptions = engenheiros.map((e) => ({
    value: e.id,
    label: e.nome_completo,
  }));

  const funcionarioOptions = funcionarios.map((f) => ({
    value: f.id,
    label: f.nome_completo,
  }));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">Filtros</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Linha 1 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Período */}
          <div className="space-y-1.5">
            <Label className="text-xs">Período</Label>
            <PeriodoRangePicker
              value={
                filters.dataInicio || filters.dataFim
                  ? { from: filters.dataInicio, to: filters.dataFim }
                  : undefined
              }
              onChange={(range) =>
                onFilterChange({ dataInicio: range.from, dataFim: range.to })
              }
            />
          </div>

          {/* Centro de Custo (multi) */}
          <div className="space-y-1.5">
            <Label className="text-xs">Centro de Custo</Label>
            <MultiCombobox
              options={ccOptions}
              value={filters.centroCustoIds || []}
              onChange={(values) => onFilterChange({ centroCustoIds: values })}
              placeholder="Todos"
              searchPlaceholder="Buscar centro de custo..."
              emptyText="Nenhum centro de custo encontrado"
            />
          </div>

          {/* Gerente Regional (multi) */}
          <div className="space-y-1.5">
            <Label className="text-xs">Gerente Regional</Label>
            <MultiCombobox
              options={gerenteOptions}
              value={filters.gerenteRegionalIds || []}
              onChange={(values) => onFilterChange({ gerenteRegionalIds: values })}
              placeholder="Todos"
              searchPlaceholder="Buscar gerente..."
              emptyText="Nenhum gerente encontrado"
            />
          </div>

          {/* Funcionário */}
          <div className="space-y-1.5">
            <Label className="text-xs">Funcionário</Label>
            <Combobox
              options={funcionarioOptions}
              value={filters.funcionarioId || ""}
              onChange={(value) => onFilterChange({ funcionarioId: value || undefined })}
              placeholder="Todos"
              searchPlaceholder="Buscar funcionário..."
              emptyText="Nenhum funcionário encontrado"
            />
          </div>
        </div>

        {/* Linha 2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Engenheiro Solicitante */}
          <div className="space-y-1.5">
            <Label className="text-xs">Engenheiro Solicitante</Label>
            <Combobox
              options={engenheiroOptions}
              value={filters.engenheiroSolicitanteId || ""}
              onChange={(value) =>
                onFilterChange({ engenheiroSolicitanteId: value || undefined })
              }
              placeholder="Todos"
              searchPlaceholder="Buscar engenheiro..."
              emptyText="Nenhum engenheiro encontrado"
            />
          </div>

          {/* Nº Solicitação */}
          <div className="space-y-1.5">
            <Label className="text-xs">Nº Solicitação</Label>
            <Combobox
              options={solicitacaoOptions}
              value={filters.solicitacaoId || ""}
              onChange={(value) => onFilterChange({ solicitacaoId: value || undefined })}
              placeholder="Todas"
              searchPlaceholder="Buscar solicitação..."
              emptyText="Nenhuma solicitação encontrada"
            />
          </div>

          {/* Limpar */}
          <div className="space-y-1.5 lg:col-span-2 flex items-end justify-end">
            <Button variant="outline" size="sm" onClick={onClearFilters}>
              <X className="h-4 w-4 mr-1" />
              Limpar Filtros
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
