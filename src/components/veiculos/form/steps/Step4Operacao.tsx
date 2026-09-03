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
  mode: 'create' | 'edit';
  centrosCustoAtivos?: { id: string; nome_centro_custo: string; codigo_centro_custo: string }[];
  centroCustoAtual?: {
    nome: string | null;
    codigo: string | null;
    origem:
      | 'CADASTRO'
      | 'IMPORTACAO'
      | 'APONTAMENTO_CE'
      | 'DISPONIBILIDADE'
      | 'CENTRAL_TRANSPORTE'
      | 'SEM_ALOCACAO'
      | null;
    atualizadoEm: string | null;
  } | null;
}

const ORIGEM_LABEL: Record<string, string> = {
  CADASTRO: 'Cadastro',
  IMPORTACAO: 'Importação',
  APONTAMENTO_CE: 'Apontamento C&E',
  DISPONIBILIDADE: 'Disponibilidade',
  CENTRAL_TRANSPORTE: 'Central do Transporte',
  SEM_ALOCACAO: 'Sem alocação',
};

const Step4Operacao: React.FC<Props & { canEditCentroCusto?: boolean }> = ({ form, departamentos, empresas, mode, centrosCustoAtivos, centroCustoAtual, canEditCentroCusto = false }) => {
  const departamentoOptions = useMemo(() => [
    { value: "_none", label: "Nenhum" },
    ...departamentos.map((d) => ({ value: d.id, label: d.nome_departamento })),
  ], [departamentos]);

  const centroCustoOptions = useMemo(() => [
    { value: "_none", label: "Nenhum (definir depois via apontamento/disponibilidade)" },
    ...(centrosCustoAtivos ?? []).map((c) => ({
      value: c.id,
      label: `${c.codigo_centro_custo} — ${c.nome_centro_custo}`,
    })),
  ], [centrosCustoAtivos]);

  const mostrarSelecaoCC = mode === 'create' || (mode === 'edit' && canEditCentroCusto);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4 space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
          📊 Operação
        </h3>

        {mostrarSelecaoCC && (
          <FormField control={form.control} name="centro_custo_atual_id" render={({ field }) => (
            <FormItem>
              <FormLabel>
                {mode === 'create' ? 'Centro de Custo inicial (opcional)' : 'Centro de Custo atual'}
              </FormLabel>
              <FormControl>
                <Combobox
                  options={centroCustoOptions}
                  value={field.value || "_none"}
                  onChange={field.onChange}
                  placeholder="Selecione um Centro de Custo"
                  searchPlaceholder="Buscar por código ou nome..."
                  emptyText="Nenhum Centro de Custo encontrado"
                />
              </FormControl>
              {mode === 'edit' && centroCustoAtual?.origem && centroCustoAtual.origem !== 'SEM_ALOCACAO' && centroCustoAtual.origem !== 'CADASTRO' && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  Alocação atual veio de {ORIGEM_LABEL[centroCustoAtual.origem]}. A alteração manual só é aplicada
                  se a origem operacional atual tiver prioridade menor.
                </p>
              )}
              <p className="text-[11px] text-muted-foreground">
                Após apontamentos C&amp;E ou movimentações da Central do Transporte, esta alocação
                é atualizada automaticamente.
              </p>
              <FormMessage />
            </FormItem>
          )} />
        )}

        {mode === 'edit' && !canEditCentroCusto && centroCustoAtual !== undefined && (
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
                  {ORIGEM_LABEL[centroCustoAtual.origem] ?? centroCustoAtual.origem}
                </span>
              )}
            </div>
            {centroCustoAtual?.atualizadoEm && (
              <div className="mt-1 text-[11px] text-muted-foreground">
                Atualizado em {new Date(centroCustoAtual.atualizadoEm).toLocaleString('pt-BR')}
              </div>
            )}
            <div className="mt-1 text-[11px] text-muted-foreground italic">
              Você não tem permissão para editar. Origem: Apontamento C&amp;E &gt; Central do Transporte &gt; Disponibilidade &gt; Cadastro.
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
                    <SelectItem value="Ativo">Ativo</SelectItem>
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
              <FormLabel>Capacidade</FormLabel>
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
              <FormLabel>Valor (locação)</FormLabel>
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
