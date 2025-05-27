
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { UseFormReturn } from "react-hook-form";
import { ListaProgramacaoEntrega } from "@/types/programacaoEntrega";

interface RegistroCargaHeaderProps {
  form: UseFormReturn<any>;
  currentEntrega: ListaProgramacaoEntrega;
  centroCustoInfo: string;
}

const RegistroCargaHeader: React.FC<RegistroCargaHeaderProps> = ({
  form,
  currentEntrega,
  centroCustoInfo,
}) => {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-medium mb-2">Caminhão</h3>
            <p className="text-sm text-muted-foreground">
              {currentEntrega.caminhao 
                ? `${currentEntrega.caminhao.placa} - ${currentEntrega.caminhao.modelo}` 
                : "N/A"}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium mb-2">Centro de Custo</h3>
            <p className="text-sm text-muted-foreground">
              {centroCustoInfo}
            </p>
          </div>
          <FormField
            control={form.control}
            name="data_saida"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data da Saída</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="hora_saida"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hora da Saída</FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="temperatura_saida"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Temperatura da Massa na Saída (°C)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    step="0.1"
                    onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                    value={field.value === null ? '' : field.value}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default RegistroCargaHeader;
