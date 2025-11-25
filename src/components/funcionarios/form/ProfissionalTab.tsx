import React, { useMemo } from "react";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Combobox, ComboboxOption } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { UseFormReturn } from "react-hook-form";
import { useFuncionarioEquipe } from "@/hooks/funcionarios/useFuncionarioEquipe";
interface ProfissionalTabProps {
  form: UseFormReturn<any>;
  onClose: () => void;
  setActiveTab: (tab: string) => void;
  funcoes: any[];
  departamentos: any[];
  centrosCusto: any[];
  empresas: any[];
  isLoadingFuncoes: boolean;
  isLoadingDepartamentos: boolean;
  isLoadingCentrosCusto: boolean;
  isLoadingEmpresas: boolean;
  funcionarioId?: string;
}
const ProfissionalTab: React.FC<ProfissionalTabProps> = ({
  form,
  onClose,
  setActiveTab,
  funcoes,
  departamentos,
  centrosCusto,
  empresas,
  isLoadingFuncoes,
  isLoadingDepartamentos,
  isLoadingCentrosCusto,
  isLoadingEmpresas,
  funcionarioId
}) => {
  const {
    data: nomeEquipe,
    isLoading: isLoadingEquipe
  } = useFuncionarioEquipe(funcionarioId);

  // Formatar opções para os Combobox
  const funcoesOptions: ComboboxOption[] = useMemo(() => {
    return funcoes.map(f => ({ value: f.id, label: f.nome_funcao }));
  }, [funcoes]);

  const departamentosOptions: ComboboxOption[] = useMemo(() => {
    return departamentos.map(d => ({ value: d.id, label: d.nome_departamento }));
  }, [departamentos]);

  const centrosCustoOptions: ComboboxOption[] = useMemo(() => {
    return centrosCusto.map(c => ({ 
      value: c.id, 
      label: `${c.codigo_centro_custo} - ${c.nome_centro_custo}` 
    }));
  }, [centrosCusto]);

  const empresasOptions: ComboboxOption[] = useMemo(() => {
    return empresas.map(e => ({ value: e.id, label: e.nome_empresa }));
  }, [empresas]);
  return <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField control={form.control} name="funcao_id" render={({
        field
      }) => <FormItem>
              <FormLabel>Função *</FormLabel>
              <FormControl>
                <Combobox
                  options={funcoesOptions}
                  value={field.value || ""}
                  onChange={(value) => field.onChange(value || null)}
                  placeholder="Selecione a função"
                  searchPlaceholder="Buscar função..."
                  emptyText="Nenhuma função encontrada"
                  disabled={isLoadingFuncoes}
                />
              </FormControl>
              <FormMessage />
            </FormItem>} />
        
        <FormField control={form.control} name="departamento_id" render={({
        field
      }) => <FormItem>
              <FormLabel>Departamento</FormLabel>
              <FormControl>
                <Combobox
                  options={departamentosOptions}
                  value={field.value || ""}
                  onChange={(value) => field.onChange(value || null)}
                  placeholder="Selecione o departamento"
                  searchPlaceholder="Buscar departamento..."
                  emptyText="Nenhum departamento encontrado"
                  disabled={isLoadingDepartamentos}
                />
              </FormControl>
              <FormMessage />
            </FormItem>} />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField control={form.control} name="centro_custo_id" render={({
        field
      }) => <FormItem>
              <FormLabel>Centro de Custo</FormLabel>
              <FormControl>
                <Combobox
                  options={centrosCustoOptions}
                  value={field.value || ""}
                  onChange={(value) => field.onChange(value || null)}
                  placeholder="Selecione o centro de custo"
                  searchPlaceholder="Buscar centro de custo..."
                  emptyText="Nenhum centro de custo encontrado"
                  disabled={isLoadingCentrosCusto}
                />
              </FormControl>
              <FormMessage />
            </FormItem>} />
        
        <FormField control={form.control} name="empresa_id" render={({
        field
      }) => <FormItem>
              <FormLabel>Empresa</FormLabel>
              <FormControl>
                <Combobox
                  options={empresasOptions}
                  value={field.value || ""}
                  onChange={(value) => field.onChange(value || null)}
                  placeholder="Selecione a empresa"
                  searchPlaceholder="Buscar empresa..."
                  emptyText="Nenhuma empresa encontrada"
                  disabled={isLoadingEmpresas}
                />
              </FormControl>
              <FormMessage />
            </FormItem>} />
      </div>

      
      
      <FormField control={form.control} name="equipe_id" render={() => <FormItem>
            <FormLabel>Equipe Vinculada</FormLabel>
            <FormControl>
              <div className="relative">
                <Input value={isLoadingEquipe ? "Carregando..." : nomeEquipe as string || "Nenhuma equipe vinculada"} readOnly className="bg-muted/50 cursor-not-allowed" />
                {isLoadingEquipe && <Loader2 className="h-4 w-4 animate-spin absolute right-3 top-1/2 transform -translate-y-1/2" />}
              </div>
            </FormControl>
            <p className="text-xs text-muted-foreground">
              A equipe é definida automaticamente pelo sistema de gerenciamento de equipes
            </p>
            <FormMessage />
          </FormItem>} />

      {/* Observações */}
      <FormField control={form.control} name="observacoes" render={({
      field
    }) => <FormItem>
            <FormLabel>Observações</FormLabel>
            <FormControl>
              <Textarea placeholder="Observações gerais sobre o funcionário" className="min-h-[80px]" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>} />
      
      <div className="flex justify-between gap-2 pt-4">
        <Button type="button" variant="outline" onClick={() => setActiveTab("pessoal")}>
          Anterior
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => setActiveTab("contratual")}>
            Próximo
          </Button>
        </div>
      </div>
    </div>;
};
export default ProfissionalTab;