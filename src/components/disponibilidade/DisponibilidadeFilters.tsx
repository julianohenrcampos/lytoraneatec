import React from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { FiltrosAtivosReconciliados } from "@/services/disponibilidadeEquipamentoService";
import { useQuery } from "@tanstack/react-query";
import { getTiposEquipamentoDropdown, getCentrosCustoDropdown } from "@/services/veiculo/dropdownsRelacional";
import { getEmpresas } from "@/services/empresaService";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  filters: FiltrosAtivosReconciliados;
  onFiltersChange: (f: FiltrosAtivosReconciliados) => void;
}

/** SEM_STATUS é opção legítima de filtro — nunca um recorte implícito. */
const statusOptions = [
  { value: "DISPONIVEL", label: "Disponível" },
  { value: "ALOCADO", label: "Alocado" },
  { value: "MANUTENCAO", label: "Manutenção" },
  { value: "INDISPONIVEL", label: "Indisponível" },
  { value: "SEM_STATUS", label: "Sem status operacional" },
  { value: "DESCONHECIDO", label: "Status desconhecido" },
];

const DisponibilidadeFiltersBar: React.FC<Props> = ({ filters, onFiltersChange }) => {
  const { data: tipos = [] } = useQuery({ queryKey: ["tipos-equip-dd"], queryFn: getTiposEquipamentoDropdown });
  const { data: ccs = [] } = useQuery({ queryKey: ["cc-dd"], queryFn: getCentrosCustoDropdown });
  const { data: empresas = [] } = useQuery({ queryKey: ["empresas-dd"], queryFn: () => getEmpresas() });
  const { data: departamentos = [] } = useQuery({
    queryKey: ["departamentos-dd"],
    queryFn: async () => {
      const { data } = await supabase
        .from("bd_departamentos")
        .select("id, nome_departamento")
        .order("nome_departamento");
      return (data || []) as { id: string; nome_departamento: string }[];
    },
  });

  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Buscar por frota, nº de frota, placa, empresa ou centro de custo"
              value={filters.busca || ""}
              onChange={(e) => onFiltersChange({ ...filters, busca: e.target.value })}
            />
          </div>

          <Select
            value={filters.status_operacional || "_all"}
            onValueChange={(v) =>
              onFiltersChange({
                ...filters,
                status_operacional: v === "_all" ? undefined : (v as FiltrosAtivosReconciliados["status_operacional"]),
              })
            }
          >
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todos os Status</SelectItem>
              {statusOptions.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select
            value={filters.tipo_equipamento_id || "_all"}
            onValueChange={(v) => onFiltersChange({ ...filters, tipo_equipamento_id: v === "_all" ? undefined : v })}
          >
            <SelectTrigger><SelectValue placeholder="Tipo Equipamento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todos os Tipos</SelectItem>
              {tipos.map((t) => <SelectItem key={t.id} value={t.id}>{t.descricao_padronizada}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <Select
            value={filters.centro_custo_id || "_all"}
            onValueChange={(v) => onFiltersChange({ ...filters, centro_custo_id: v === "_all" ? undefined : v })}
          >
            <SelectTrigger><SelectValue placeholder="Centro de Custo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todos os CCs</SelectItem>
              {ccs.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.codigo_centro_custo} - {c.nome_centro_custo}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.departamento_id || "_all"}
            onValueChange={(v) => onFiltersChange({ ...filters, departamento_id: v === "_all" ? undefined : v })}
          >
            <SelectTrigger><SelectValue placeholder="Departamento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todos os Departamentos</SelectItem>
              {departamentos.map((d) => <SelectItem key={d.id} value={d.id}>{d.nome_departamento}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select
            value={filters.empresa_id || "_all"}
            onValueChange={(v) => onFiltersChange({ ...filters, empresa_id: v === "_all" ? undefined : v })}
          >
            <SelectTrigger><SelectValue placeholder="Empresa" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todas as Empresas</SelectItem>
              {empresas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome_empresa}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="filtro-sem-cc"
                checked={!!filters.somenteSemCentroCusto}
                onCheckedChange={(c) => onFiltersChange({ ...filters, somenteSemCentroCusto: c === true || undefined })}
              />
              <Label htmlFor="filtro-sem-cc" className="text-xs font-normal cursor-pointer">Sem CC</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="filtro-conflito"
                checked={!!filters.somenteConflitoCadastral}
                onCheckedChange={(c) => onFiltersChange({ ...filters, somenteConflitoCadastral: c === true || undefined })}
              />
              <Label htmlFor="filtro-conflito" className="text-xs font-normal cursor-pointer">Conflito</Label>
            </div>
          </div>
        </div>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => onFiltersChange({})}>
            <X className="mr-1 h-4 w-4" /> Limpar filtros
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default DisponibilidadeFiltersBar;
