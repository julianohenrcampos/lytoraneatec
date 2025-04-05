
import React from "react";
import { TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { 
  FormField, 
  FormItem, 
  FormLabel, 
  FormControl, 
  FormMessage 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { UseFormReturn } from "react-hook-form";

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
  isLoadingEmpresas
}) => {
  return (
    <TabsContent value="profissional" className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="funcao_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Função</FormLabel>
              <Select 
                onValueChange={(value) => field.onChange(value || null)}
                value={field.value || undefined}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a função" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {isLoadingFuncoes ? (
                    <div className="flex items-center justify-center p-2">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      <span>Carregando...</span>
                    </div>
                  ) : (
                    funcoes.map((funcao) => (
                      <SelectItem key={funcao.id} value={funcao.id}>
                        {funcao.nome_funcao}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="departamento_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Departamento</FormLabel>
              <Select 
                onValueChange={(value) => field.onChange(value || null)}
                value={field.value || undefined}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o departamento" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {isLoadingDepartamentos ? (
                    <div className="flex items-center justify-center p-2">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      <span>Carregando...</span>
                    </div>
                  ) : (
                    departamentos.map((departamento) => (
                      <SelectItem key={departamento.id} value={departamento.id}>
                        {departamento.nome_departamento}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="centro_custo_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Centro de Custo</FormLabel>
              <Select 
                onValueChange={(value) => field.onChange(value || null)}
                value={field.value || undefined}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o centro de custo" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {isLoadingCentrosCusto ? (
                    <div className="flex items-center justify-center p-2">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      <span>Carregando...</span>
                    </div>
                  ) : (
                    centrosCusto.map((centroCusto) => (
                      <SelectItem key={centroCusto.id} value={centroCusto.id}>
                        {centroCusto.codigo_centro_custo} - {centroCusto.nome_centro_custo}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="empresa_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Empresa</FormLabel>
              <Select 
                onValueChange={(value) => field.onChange(value || null)}
                value={field.value || undefined}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {isLoadingEmpresas ? (
                    <div className="flex items-center justify-center p-2">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      <span>Carregando...</span>
                    </div>
                  ) : (
                    empresas.map((empresa) => (
                      <SelectItem key={empresa.id} value={empresa.id}>
                        {empresa.nome_empresa}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      
      <FormField
        control={form.control}
        name="equipe_id"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Equipe Vinculada</FormLabel>
            <FormControl>
              <Input placeholder="Equipe vinculada (preenchida automaticamente)" {...field} value={field.value || ""} readOnly />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      
      <div className="flex justify-between gap-2 pt-4">
        <Button 
          type="button" 
          variant="outline" 
          onClick={() => setActiveTab("pessoal")}
        >
          Anterior
        </Button>
        <div className="flex gap-2">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button 
            type="button" 
            onClick={() => setActiveTab("contratual")}
          >
            Próximo
          </Button>
        </div>
      </div>
    </TabsContent>
  );
};

export default ProfissionalTab;
