import React, { useMemo } from "react";
import { UseFormReturn } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { UNIDADES_CAPACIDADE } from "@/services/catalogoVariacoesService";

interface Props {
  form: UseFormReturn<any>;
  departamentos: { id: string; nome_departamento: string }[];
  empresas: { id: string; nome_empresa: string }[];
  centroCustoAtual?: {
    nome: string | null;
    codigo: string | null;
    origem: 'APONTAMENTO_CE' | 'DISPONIBILIDADE' | 'SEM_ALOCACAO' | null;
    atualizadoEm: string | null;
  } | null;
}

const Step4Operacao: React.FC<Props> = ({ form, departamentos, empresas, centroCustoAtual }) => {
  const departamentoOptions = useMemo(() => [
    { value: "_none", label: "Nenhum" },
    ...departamentos.map((d) => ({ value: d.id, label: d.nome_departamento })),
  ], [departamentos]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4 space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
          📊 Operação
        </h3>

        {centroCustoAtual !== undefined && (
          <div className="rounded-md border bg-muted/40 p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Centro de Custo Atual (somente leitura)
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="font-medium">
                {centroCustoAtual?.nome
                  ? (centroCustoAtual.codigo
                      ? `${centroCustoAtual.codigo} — ${centroCustoAtual.nome}`
                      : centroCustoAtual.nome)
                  : 'Sem alocação'}
              </span>
              {centroCustoAtual?.origem && centroCustoAtual.origem !== 'SEM_ALOCACAO' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded border bg-background uppercase tracking-wide">
                  {centroCustoAtual.origem === 'APONTAMENTO_CE' ? 'Apontamento C&E' : 'Disponibilidade'}
                </span>
              )}
            </div>
            {centroCustoAtual?.atualizadoEm && (
              <div className="mt-1 text-[11px] text-muted-foreground">
                Atualizado em {new Date(centroCustoAtual.atualizadoEm).toLocaleString('pt-BR')}
              </div>
            )}
            <div className="mt-1 text-[11px] text-muted-foreground italic">
              Origem: último apontamento C&amp;E → última disponibilidade. Ajustado automaticamente.
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Situação */}
          <FormField control={form.control} name="situacao" render={({ field }) => (
            <FormItem>
              <FormLabel>Situação *</FormLabel>
              <FormControl>
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a situação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Operando">Operando</SelectItem>
                    <SelectItem value="Em Manutenção">Em Manutenção</SelectItem>
                    <SelectItem value="Disponível">Disponível</SelectItem>
                    <SelectItem value="Intempérie">Intempérie</SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          {/* Status IPVA */}
          <FormField control={form.control} name="status_ipva" render={({ field }) => (
            <FormItem>
              <FormLabel>Status IPVA</FormLabel>
              <FormControl>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Selecione</SelectItem>
                    <SelectItem value="Pago">Pago</SelectItem>
                    <SelectItem value="Pendente">Pendente</SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />


          {/* Departamento */}
          <FormField control={form.control} name="departamento_id" render={({ field }) => (
            <FormItem>
              <FormLabel>Departamento</FormLabel>
              <FormControl>
                <Combobox
                  options={departamentoOptions}
                  value={field.value || "_none"}
                  onChange={field.onChange}
                  placeholder="Selecione um departamento"
                  searchPlaceholder="Buscar departamento..."
                  emptyText="Nenhum departamento encontrado"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          {/* Capacidade Valor */}
          <FormField control={form.control} name="capacidade_valor" render={({ field }) => (
            <FormItem>
              <FormLabel>Capacidade (valor)</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" min={0} placeholder="Ex: 14" {...field} value={field.value || ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          {/* Capacidade Unidade */}
          <FormField control={form.control} name="capacidade_unidade" render={({ field }) => (
            <FormItem>
              <FormLabel>Unidade</FormLabel>
              <FormControl>
                <Select value={field.value || ""} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {UNIDADES_CAPACIDADE.map((u) => (
                      <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          {/* Aluguel */}
          <FormField control={form.control} name="aluguel" render={({ field }) => (
            <FormItem>
              <FormLabel>Aluguel (se aplicável)</FormLabel>
              <FormControl>
                <Input placeholder="Valor do aluguel" {...field} value={field.value || ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {/* Observações */}
        <FormField control={form.control} name="observacoes" render={({ field }) => (
          <FormItem>
            <FormLabel>Observações</FormLabel>
            <FormControl>
              <Textarea placeholder="Observações adicionais" className="resize-none min-h-[80px]" {...field} value={field.value || ""} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
      </div>
    </div>
  );
};

export default Step4Operacao;
