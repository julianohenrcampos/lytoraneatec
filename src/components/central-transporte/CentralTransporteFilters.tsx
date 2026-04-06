import React, { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  filters: {
    centro_custo_id?: string;
    departamento_id?: string;
    prioridade?: string;
    tipo_equipamento_id?: string;
    status_fluxo?: string;
  };
  onChange: (f: any) => void;
}

const CentralTransporteFilters: React.FC<Props> = ({ filters, onChange }) => {
  const [centrosCusto, setCentrosCusto] = useState<any[]>([]);
  const [departamentos, setDepartamentos] = useState<any[]>([]);
  const [tiposEquipamento, setTiposEquipamento] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const [cc, dep, te] = await Promise.all([
        supabase.from("bd_centros_custo").select("id, nome_centro_custo").order("nome_centro_custo"),
        supabase.from("bd_departamentos").select("id, nome_departamento").order("nome_departamento"),
        supabase.from("bd_tipos_equipamento").select("id, descricao_padronizada").order("descricao_padronizada"),
      ]);
      setCentrosCusto(cc.data || []);
      setDepartamentos(dep.data || []);
      setTiposEquipamento(te.data || []);
    };
    load();
  }, []);

  const set = (key: string, val: string) => onChange({ ...filters, [key]: val === "all" ? undefined : val });

  return (
    <div className="flex flex-wrap gap-2">
      <Select value={filters.centro_custo_id || "all"} onValueChange={(v) => set("centro_custo_id", v)}>
        <SelectTrigger className="w-[180px]"><SelectValue placeholder="Centro de Custo" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos CC</SelectItem>
          {centrosCusto.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome_centro_custo}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.departamento_id || "all"} onValueChange={(v) => set("departamento_id", v)}>
        <SelectTrigger className="w-[180px]"><SelectValue placeholder="Departamento" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos Dep.</SelectItem>
          {departamentos.map((d) => <SelectItem key={d.id} value={d.id}>{d.nome_departamento}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.prioridade || "all"} onValueChange={(v) => set("prioridade", v)}>
        <SelectTrigger className="w-[150px]"><SelectValue placeholder="Prioridade" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          <SelectItem value="NORMAL">Normal</SelectItem>
          <SelectItem value="ALTA">Alta</SelectItem>
          <SelectItem value="URGENTE">Urgente</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.tipo_equipamento_id || "all"} onValueChange={(v) => set("tipo_equipamento_id", v)}>
        <SelectTrigger className="w-[200px]"><SelectValue placeholder="Tipo Equipamento" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos Tipos</SelectItem>
          {tiposEquipamento.map((t) => <SelectItem key={t.id} value={t.id}>{t.descricao_padronizada}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.status_fluxo || "all"} onValueChange={(v) => set("status_fluxo", v)}>
        <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="APROVADO">Aprovado</SelectItem>
          <SelectItem value="EM_TRANSPORTE">Em Transporte</SelectItem>
        </SelectContent>
      </Select>

      <Button variant="outline" size="sm" onClick={() => onChange({})}>Limpar</Button>
    </div>
  );
};

export default CentralTransporteFilters;
