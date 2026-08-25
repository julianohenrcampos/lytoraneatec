import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { QcFiltros } from "@/services/qualidadeCadastralService";
import { DOMINIO_LABEL, SEVERIDADE_LABEL, TIPO_LABEL } from "@/lib/qualidade-cadastral/regras";
import { Eraser, Search } from "lucide-react";

const TODOS = "__todos__";

interface Props {
  filtros: QcFiltros;
  onChange: (f: QcFiltros) => void;
  responsaveis: string[];
}

const QualidadeFilters: React.FC<Props> = ({ filtros, onChange, responsaveis }) => {
  const { data: empresas = [] } = useQuery({
    queryKey: ["qc-filtro-empresas"],
    queryFn: async () => {
      const { data } = await supabase.from("bd_empresas").select("id, nome_empresa").order("nome_empresa");
      return data ?? [];
    },
    staleTime: 300_000,
  });
  const { data: diretorias = [] } = useQuery({
    queryKey: ["qc-filtro-diretorias"],
    queryFn: async () => {
      const { data } = await supabase.from("bd_diretorias").select("id, nome").order("nome");
      return data ?? [];
    },
    staleTime: 300_000,
  });
  const { data: departamentos = [] } = useQuery({
    queryKey: ["qc-filtro-departamentos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("bd_departamentos")
        .select("id, nome_departamento")
        .order("nome_departamento");
      return data ?? [];
    },
    staleTime: 300_000,
  });
  const { data: centrosCusto = [] } = useQuery({
    queryKey: ["qc-filtro-cc"],
    queryFn: async () => {
      const { data } = await supabase
        .from("bd_centros_custo")
        .select("id, codigo_centro_custo, nome_centro_custo")
        .order("codigo_centro_custo");
      return data ?? [];
    },
    staleTime: 300_000,
  });

  const set = (patch: Partial<QcFiltros>) => onChange({ ...filtros, ...patch });
  const val = (v?: string) => v ?? TODOS;
  const pick = (v: string) => (v === TODOS ? undefined : v);

  const chips: { label: string; ativo: boolean; aplicar: () => void }[] = [
    { label: "Críticos", ativo: filtros.severidade === "CRITICA", aplicar: () => set({ severidade: filtros.severidade === "CRITICA" ? undefined : "CRITICA" }) },
    { label: "Sem responsável", ativo: !!filtros.sem_responsavel, aplicar: () => set({ sem_responsavel: !filtros.sem_responsavel }) },
    { label: "Possíveis duplicidades", ativo: filtros.tipo === "POSSIVEL_DUPLICIDADE", aplicar: () => set({ tipo: filtros.tipo === "POSSIVEL_DUPLICIDADE" ? undefined : "POSSIVEL_DUPLICIDADE" }) },
    { label: "+30 dias", ativo: filtros.dias_min === 30, aplicar: () => set({ dias_min: filtros.dias_min === 30 ? undefined : 30 }) },
    { label: "+60 dias", ativo: filtros.dias_min === 60, aplicar: () => set({ dias_min: filtros.dias_min === 60 ? undefined : 60 }) },
    { label: "+90 dias", ativo: filtros.dias_min === 90, aplicar: () => set({ dias_min: filtros.dias_min === 90 ? undefined : 90 }) },
    {
      label: "Frota a atualizar",
      ativo: filtros.dominio === "VEICULO_EQUIPAMENTO" && filtros.dias_min === 90,
      aplicar: () => set({ dominio: "VEICULO_EQUIPAMENTO", dias_min: 90 }),
    },
    { label: "Score < 70%", ativo: filtros.score_max === 69, aplicar: () => set({ score_max: filtros.score_max === 69 ? undefined : 69 }) },
  ];

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs">Empresa</Label>
            <Select value={val(filtros.empresa_id)} onValueChange={(v) => set({ empresa_id: pick(v) })}>
              <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todas</SelectItem>
                {empresas.map((e: any) => (
                  <SelectItem key={e.id} value={e.id}>{e.nome_empresa}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Diretoria</Label>
            <Select value={val(filtros.diretoria_id)} onValueChange={(v) => set({ diretoria_id: pick(v) })}>
              <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todas</SelectItem>
                {diretorias.map((d: any) => (
                  <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Departamento</Label>
            <Select value={val(filtros.departamento_id)} onValueChange={(v) => set({ departamento_id: pick(v) })}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos</SelectItem>
                {departamentos.map((d: any) => (
                  <SelectItem key={d.id} value={d.id}>{d.nome_departamento}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Centro de Custo</Label>
            <Combobox
              options={[
                { value: TODOS, label: "Todos" },
                ...centrosCusto.map((c: any) => ({
                  value: c.id,
                  label: `${c.codigo_centro_custo} — ${c.nome_centro_custo}`,
                })),
              ]}
              value={val(filtros.centro_custo_id)}
              onChange={(v) => set({ centro_custo_id: pick(String(v)) })}
              placeholder="Todos"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Domínio</Label>
            <Select value={val(filtros.dominio)} onValueChange={(v) => set({ dominio: pick(v) as QcFiltros["dominio"] })}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos</SelectItem>
                {Object.entries(DOMINIO_LABEL).map(([k, label]) => (
                  <SelectItem key={k} value={k}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Tipo de problema</Label>
            <Select value={val(filtros.tipo)} onValueChange={(v) => set({ tipo: pick(v) as QcFiltros["tipo"] })}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos</SelectItem>
                {Object.entries(TIPO_LABEL).map(([k, label]) => (
                  <SelectItem key={k} value={k}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Severidade</Label>
            <Select value={val(filtros.severidade)} onValueChange={(v) => set({ severidade: pick(v) as QcFiltros["severidade"] })}>
              <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todas</SelectItem>
                {Object.entries(SEVERIDADE_LABEL).map(([k, label]) => (
                  <SelectItem key={k} value={k}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Responsável</Label>
            <Combobox
              options={[
                { value: TODOS, label: "Todos" },
                ...responsaveis.map((r) => ({ value: r, label: r })),
              ]}
              value={val(filtros.responsavel)}
              onChange={(v) => set({ responsavel: pick(String(v)) })}
              placeholder="Todos"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Tipo de ativo</Label>
            <Select value={val(filtros.tipo_ativo)} onValueChange={(v) => set({ tipo_ativo: pick(v) })}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos</SelectItem>
                <SelectItem value="proprio">Próprio</SelectItem>
                <SelectItem value="locado">Locado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Situação do registro</Label>
            <Select
              value={filtros.somente_ativos ? "ativos" : TODOS}
              onValueChange={(v) => set({ somente_ativos: v === "ativos" })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos</SelectItem>
                <SelectItem value="ativos">Somente ativos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Score máximo (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={filtros.score_max ?? ""}
              onChange={(e) => set({ score_max: e.target.value === "" ? undefined : Number(e.target.value) })}
              placeholder="Ex.: 70"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Última atualização (dias mín.)</Label>
            <Input
              type="number"
              min={0}
              value={filtros.dias_min ?? ""}
              onChange={(e) => set({ dias_min: e.target.value === "" ? undefined : Number(e.target.value) })}
              placeholder="Ex.: 90"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              value={filtros.busca ?? ""}
              onChange={(e) => set({ busca: e.target.value || undefined })}
              placeholder="Buscar por identificação, nome ou código do CC"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => onChange({})} className="self-start">
            <Eraser className="h-4 w-4 mr-2" /> Limpar filtros
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <Badge
              key={c.label}
              variant={c.ativo ? "default" : "outline"}
              onClick={c.aplicar}
              className="cursor-pointer select-none"
            >
              {c.label}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default QualidadeFilters;
