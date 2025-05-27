
import React, { useEffect } from "react";
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
import { UseFormReturn } from "react-hook-form";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { addDays, format, isValid } from "date-fns";

interface ContratualTabProps {
  form: UseFormReturn<any>;
  onClose: () => void;
  setActiveTab: (tab: string) => void;
}

const ContratualTab: React.FC<ContratualTabProps> = ({
  form,
  onClose,
  setActiveTab
}) => {
  // Watch for changes to the admission date
  const admissionDate = form.watch("data_admissao");

  // Calculate vacation date when admission date changes
  useEffect(() => {
    if (admissionDate) {
      try {
        const admissionDateObj = new Date(admissionDate);
        
        // Only calculate if the date is valid
        if (isValid(admissionDateObj)) {
          const vacationDateObj = addDays(admissionDateObj, 365);
          const vacationDateFormatted = format(vacationDateObj, "yyyy-MM-dd");
          form.setValue("data_ferias", vacationDateFormatted);
        }
      } catch (error) {
        console.error("Error calculating vacation date:", error);
      }
    }
  }, [admissionDate, form]);

  return (
    <TabsContent value="contratual" className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="data_admissao"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Data de Admissão</FormLabel>
              <FormControl>
                <Input 
                  type="date" 
                  {...field} 
                  value={field.value || ""}
                  onChange={(e) => {
                    field.onChange(e.target.value || null);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="data_ferias"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Data de Férias</FormLabel>
              <FormControl>
                <Input 
                  type="date" 
                  {...field} 
                  value={field.value || ""}
                  readOnly 
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
          name="data_demissao"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Data de Demissão</FormLabel>
              <FormControl>
                <Input 
                  type="date" 
                  {...field} 
                  value={field.value || ""}
                  onChange={(e) => {
                    field.onChange(e.target.value || null);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <FormControl>
                <Select 
                  onValueChange={field.onChange}
                  value={field.value || "Ativo"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ativo">Ativo</SelectItem>
                    <SelectItem value="Aviso Prévio">Aviso Prévio</SelectItem>
                    <SelectItem value="Inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      
      <div className="flex justify-between gap-2 pt-4">
        <Button 
          type="button" 
          variant="outline" 
          onClick={() => setActiveTab("profissional")}
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
            onClick={() => setActiveTab("financeiro")}
          >
            Próximo
          </Button>
        </div>
      </div>
    </TabsContent>
  );
};

export default ContratualTab;
