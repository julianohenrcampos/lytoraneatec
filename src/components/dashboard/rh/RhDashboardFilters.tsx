import React from "react";
import type { DateRange } from "react-day-picker";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Combobox, ComboboxOption } from "@/components/ui/combobox";
import { MultiCombobox, MultiComboboxOption } from "@/components/ui/multi-combobox";
import { Button } from "@/components/ui/button";
import { FilterX } from "lucide-react";
import { PeriodoRangePicker } from "./PeriodoRangePicker";

interface Option {
  label: string;
  value: string;
}

interface RhDashboardFiltersProps {
  dateRange: DateRange | undefined;
  setDateRange: (val: DateRange) => void;

  empresa: string;
  setEmpresa: (val: string) => void;

  gerenciaIds: string[];
  setGerenciaIds: (val: string[]) => void;

  departamento: string;
  setDepartamento: (val: string) => void;

  centroCustoIds: string[];
  setCentroCustoIds: (val: string[]) => void;

  status: string;
  setStatus: (val: string) => void;
  funcao: string;
  setFuncao: (val: string) => void;
  equipe: string;
  setEquipe: (val: string) => void;
  nomeFuncionario: string;
  setNomeFuncionario: (val: string) => void;

  empresasOptions: Option[];
  gerenciasOptions: Option[];
  departamentosOptions: Option[];
  centrosCustoOptions: Option[];
  funcoesOptions: Option[];
  equipesOptions: Option[];

  onResetFilters?: () => void;
  filtrosAtivos?: number;
}

export const statusOptions: Option[] = [
  { label: "Todos", value: "_all" },
  { label: "Ativo", value: "Ativo" },
  { label: "Ativo sem Registro", value: "Ativo sem Registro" },
  { label: "Aviso Prévio", value: "Aviso Prévio" },
  { label: "Inativo", value: "Inativo" },
  { label: "INSS", value: "INSS" },
];

const ALL_OPT: ComboboxOption = { value: "_all", label: "Todos" };

const RhDashboardFilters: React.FC<RhDashboardFiltersProps> = ({
  dateRange, setDateRange,
  empresa, setEmpresa,
  gerenciaIds, setGerenciaIds,
  departamento, setDepartamento,
  centroCustoIds, setCentroCustoIds,
  status, setStatus,
  funcao, setFuncao,
  equipe, setEquipe,
  nomeFuncionario, setNomeFuncionario,
  empresasOptions, gerenciasOptions, departamentosOptions,
  centrosCustoOptions, funcoesOptions, equipesOptions,
  onResetFilters, filtrosAtivos,
}) => {
  const withAll = (opts: Option[]): ComboboxOption[] => [ALL_OPT, ...opts];
  const asMulti = (opts: Option[]): MultiComboboxOption[] =>
    opts.map((o) => ({ value: o.value, label: o.label }));

  return (
    <Card className="p-4 mb-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Período</label>
          <PeriodoRangePicker value={dateRange} onChange={setDateRange} />
        </div>

        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Empresa</label>
          <Combobox
            options={withAll(empresasOptions)}
            value={empresa}
            onChange={setEmpresa}
            placeholder="Todas"
            searchPlaceholder="Buscar empresa..."
            className="h-9 text-xs"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Gerência</label>
          <MultiCombobox
            options={asMulti(gerenciasOptions)}
            value={gerenciaIds}
            onChange={setGerenciaIds}
            placeholder="Todas"
            searchPlaceholder="Buscar gerência..."
            className="text-xs"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Departamento</label>
          <Combobox
            options={withAll(departamentosOptions)}
            value={departamento}
            onChange={setDepartamento}
            placeholder="Todos"
            searchPlaceholder="Buscar departamento..."
            className="h-9 text-xs"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Centro de Custo</label>
          <MultiCombobox
            options={asMulti(centrosCustoOptions)}
            value={centroCustoIds}
            onChange={setCentroCustoIds}
            placeholder="Todos"
            searchPlaceholder="Buscar centro de custo..."
            className="text-xs"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Função / Cargo</label>
          <Combobox
            options={withAll(funcoesOptions)}
            value={funcao}
            onChange={setFuncao}
            placeholder="Todas"
            searchPlaceholder="Buscar função..."
            className="h-9 text-xs"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Equipe</label>
          <Combobox
            options={withAll(equipesOptions)}
            value={equipe}
            onChange={setEquipe}
            placeholder="Todas"
            searchPlaceholder="Buscar equipe..."
            className="h-9 text-xs"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Status</label>
          <Combobox
            options={statusOptions as ComboboxOption[]}
            value={status}
            onChange={setStatus}
            placeholder="Todos"
            searchPlaceholder="Buscar status..."
            className="h-9 text-xs"
          />
        </div>

        <div className="sm:col-span-2 md:col-span-3 lg:col-span-3">
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Buscar Funcionário</label>
          <Input
            placeholder="Nome do funcionário"
            value={nomeFuncionario}
            className="h-9 text-xs"
            onChange={e => setNomeFuncionario(e.target.value)}
          />
        </div>

        <div className="flex items-end">
          {onResetFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={onResetFilters}
              className="h-9 w-full text-xs gap-2"
            >
              <FilterX className="w-4 h-4" />
              Limpar Filtros
              {filtrosAtivos !== undefined && filtrosAtivos > 0 && (
                <span className="ml-1 bg-primary/10 text-primary px-2 rounded-full">{filtrosAtivos}</span>
              )}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};

export default RhDashboardFilters;
