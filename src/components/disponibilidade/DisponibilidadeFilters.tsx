import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { DisponibilidadeFilters } from "@/services/disponibilidadeEquipamentoService";
import { useQuery } from "@tanstack/react-query";
import { getTiposEquipamentoDropdown, getCentrosCustoDropdown } from "@/services/veiculo/dropdownsRelacional";
import { getEmpresas } from "@/services/empresaService";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  filters: DisponibilidadeFilters;
  onFiltersChange: (f: DisponibilidadeFilters) => void;
}

const statusOptions = [
  { value: "DISPONIVEL", label: "Disponível" },
  { value: "ALOCADO", label: "Alocado" },
  { value: "MANUTENCAO", label: "Manutenção" },
  { value: "INDISPONIVEL", label: "Indisponível" },
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
    }
  });

  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select value={filters.status_operacional || "_all"} onValueChange={(v) => onFiltersChange({ ...filters, status_operacional: v === "_all" ? undefined : v })}>
        <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">Todos os Status</SelectItem>
          {statusOptions.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.tipo_equipamento_id || "_all"} onValueChange={(v) => onFiltersChange({ ...filters, tipo_equipamento_id: v === "_all" ? undefined : v })}>
        <SelectTrigger className="w-[220px]"><SelectValue placeholder="Tipo Equipamento" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">Todos os Tipos</SelectItem>
          {tipos.map((t) => <SelectItem key={t.id} value={t.id}>{t.descricao_padronizada}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.centro_custo_id || "_all"} onValueChange={(v) => onFiltersChange({ ...filters, centro_custo_id: v === "_all" ? undefined : v })}>
        <SelectTrigger className="w-[220px]"><SelectValue placeholder="Centro de Custo" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">Todos os CCs</SelectItem>
          {ccs.map((c) => <SelectItem key={c.id} value={c.id}>{c.codigo_centro_custo} - {c.nome_centro_custo}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.departamento_id || "_all"} onValueChange={(v) => onFiltersChange({ ...filters, departamento_id: v === "_all" ? undefined : v })}>
        <SelectTrigger className="w-[200px]"><SelectValue placeholder="Departamento" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">Todos os Departamentos</SelectItem>
          {departamentos.map((d) => <SelectItem key={d.id} value={d.id}>{d.nome_departamento}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.empresa_id || "_all"} onValueChange={(v) => onFiltersChange({ ...filters, empresa_id: v === "_all" ? undefined : v })}>
        <SelectTrigger className="w-[200px]"><SelectValue placeholder="Empresa" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">Todas as Empresas</SelectItem>
          {empresas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome_empresa}</SelectItem>)}
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

export default DisponibilidadeFiltersBar;
