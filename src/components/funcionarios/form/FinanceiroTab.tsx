
import React from "react";
import { Button } from "@/components/ui/button";
import { 
  FormField, 
  FormItem, 
  FormLabel, 
  FormControl, 
  FormMessage 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { UseFormReturn } from "react-hook-form";

interface FinanceiroTabProps {
  form: UseFormReturn<any>;
  onClose: () => void;
  setActiveTab: (tab: string) => void;
  isSubmitting: boolean;
}

const FinanceiroTab: React.FC<FinanceiroTabProps> = ({
  form,
  onClose,
  setActiveTab,
  isSubmitting
}) => {
  // Função para tratar valores de entrada numéricos
  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>, onChange: (value: number) => void) => {
    const value = e.target.value;
    if (value === "" || value === null) {
      onChange(0);
    } else {
      // Converte para número e garante que seja um valor válido
      const numValue = parseFloat(value);
      onChange(isNaN(numValue) ? 0 : numValue);
    }
  };

  return (
    <div className="space-y-4">
      {/* Salários e Adicionais */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="salario_base"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Salário Base</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  step="0.01" 
                  placeholder="0,00"
                  onChange={(e) => handleNumberChange(e, field.onChange)} 
                  value={field.value || 0} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="insalubridade"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Insalubridade</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  step="0.01" 
                  placeholder="0,00"
                  onChange={(e) => handleNumberChange(e, field.onChange)} 
                  value={field.value || 0} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="periculosidade"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Periculosidade</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  step="0.01" 
                  placeholder="0,00"
                  onChange={(e) => handleNumberChange(e, field.onChange)} 
                  value={field.value || 0} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="gratificacao"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Gratificação</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  step="0.01" 
                  placeholder="0,00"
                  onChange={(e) => handleNumberChange(e, field.onChange)} 
                  value={field.value || 0} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="adicional_noturno"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Adicional Noturno</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  step="0.01" 
                  placeholder="0,00"
                  onChange={(e) => handleNumberChange(e, field.onChange)} 
                  value={field.value || 0} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="custo_passagem"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Custo com Passagem</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  step="0.01" 
                  placeholder="0,00"
                  onChange={(e) => handleNumberChange(e, field.onChange)} 
                  value={field.value || 0} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="refeicao"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Refeição</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  step="0.01" 
                  placeholder="0,00"
                  onChange={(e) => handleNumberChange(e, field.onChange)} 
                  value={field.value || 0} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="diarias"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Diárias</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  step="0.01" 
                  placeholder="0,00"
                  onChange={(e) => handleNumberChange(e, field.onChange)} 
                  value={field.value || 0} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Dados Bancários */}
      <div className="border-t pt-4">
        <h3 className="text-lg font-medium mb-4">Dados Bancários</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="banco"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Banco</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: Banco do Brasil" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="agencia_banco"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Agência</FormLabel>
                <FormControl>
                  <Input placeholder="0000-0" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="conta_banco"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Conta</FormLabel>
                <FormControl>
                  <Input placeholder="00000-0" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="mt-4">
          <FormField
            control={form.control}
            name="pix"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Chave PIX</FormLabel>
                <FormControl>
                  <Input placeholder="CPF, email, telefone ou chave aleatória" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>

      {/* Benefícios e Descontos */}
      <div className="border-t pt-4">
        <h3 className="text-lg font-medium mb-4">Benefícios e Descontos</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="desconto_vr"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Desconto VR</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    step="0.01" 
                    placeholder="0,00"
                    onChange={(e) => handleNumberChange(e, field.onChange)} 
                    value={field.value || 0} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="desconto_va"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Desconto VA</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    step="0.01" 
                    placeholder="0,00"
                    onChange={(e) => handleNumberChange(e, field.onChange)} 
                    value={field.value || 0} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="mt-4">
          <FormField
            control={form.control}
            name="beneficios"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Benefícios</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Descreva os benefícios oferecidos (plano de saúde, vale transporte, etc.)" 
                    className="min-h-[80px]"
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>
      
      {/* Navegação */}
      <div className="flex justify-between gap-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => setActiveTab("contratual")}
        >
          Anterior
        </Button>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button 
            type="submit" 
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar Cadastro"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FinanceiroTab;
