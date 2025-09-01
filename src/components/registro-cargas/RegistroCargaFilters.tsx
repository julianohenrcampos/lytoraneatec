
import React from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns"; // Importação adicionada
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FilterX, MapPin, Truck, Calendar } from "lucide-react";
import type { RegistroCargaFilters as RegistroCargaFiltersType } from "@/types/registroCargas";

const filterSchema = z.object({
  logradouro: z.string().optional(),
  caminhao_id: z.string().optional(),
  data_inicio: z.string().optional(),
});

type FilterValues = z.infer<typeof filterSchema>;

interface RegistroCargaFiltersProps {
  onFilter: (filters: RegistroCargaFiltersType) => void;
  caminhoesList: { id: string; placa: string; modelo: string }[];
}

const RegistroCargaFilters: React.FC<RegistroCargaFiltersProps> = ({
  onFilter,
  caminhoesList,
}) => {
  const form = useForm<FilterValues>({
    resolver: zodResolver(filterSchema),
    defaultValues: {
      logradouro: "",
      caminhao_id: "",
      data_inicio: format(new Date(), "yyyy-MM-dd"),
    },
  });

  const handleSubmit = (data: FilterValues) => {
    console.log("[RegistroCargaFilters] Form submitted:", data);
    
    // Garante que a data é tratada corretamente sem deslocamento de timezone
    let dataInicio = undefined;
    
    if (data.data_inicio) {
      const [ano, mes, dia] = data.data_inicio.split('-').map(Number);
      // Cria uma data com hora meio-dia para evitar problemas de timezone
      dataInicio = new Date(ano, mes - 1, dia, 12, 0, 0);
      console.log("[RegistroCargaFilters] Data normalizada:", dataInicio);
    }
    
    onFilter({
      logradouro: data.logradouro || undefined,
      caminhao_id: data.caminhao_id || undefined,
      data_inicio: dataInicio,
    });
  };

  const handleReset = () => {
    console.log("[RegistroCargaFilters] Resetting filters");
    // Ao resetar, usamos a data atual com hora meio-dia para evitar problemas de timezone
    const today = new Date();
    const normalizedToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0);
    
    form.reset({
      logradouro: "",
      caminhao_id: "",
      data_inicio: format(normalizedToday, "yyyy-MM-dd"),
    });
    onFilter({});
  };

  // Auto-submit the form whenever a field changes
  React.useEffect(() => {
    const subscription = form.watch((value) => {
      handleSubmit(value as FilterValues);
    });
    
    return () => subscription.unsubscribe();
  }, [form, form.watch]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-medium">Filtros</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Form {...form}>
          <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit(handleSubmit)(e); }} className="space-y-4">
            <div className="space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <FormLabel htmlFor="logradouro">Logradouro</FormLabel>
                  <div className="relative">
                    <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="logradouro"
                      placeholder="Buscar por endereço..."
                      className="pl-8"
                      {...form.register("logradouro")}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <FormLabel htmlFor="caminhao_id">Caminhão</FormLabel>
                  <div className="relative">
                    <Truck className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <FormField
                      control={form.control}
                      name="caminhao_id"
                      render={({ field }) => (
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <SelectTrigger id="caminhao_id" className="pl-8">
                            <SelectValue placeholder="Selecione um caminhão" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos os caminhões</SelectItem>
                            {caminhoesList.map((caminhao) => (
                              <SelectItem key={caminhao.id} value={caminhao.id}>
                                {`${caminhao.placa} - ${caminhao.modelo}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <FormLabel htmlFor="data_inicio">Data da Saída</FormLabel>
                  <div className="relative">
                    <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="data_inicio"
                      type="date"
                      className="pl-8"
                      {...form.register("data_inicio")}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleReset}
                size="sm"
                className="gap-2"
              >
                <FilterX className="h-4 w-4" />
                Limpar Filtros
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default RegistroCargaFilters;
