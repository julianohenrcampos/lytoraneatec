
import React, { useState, useEffect } from "react";
import { UseFormReturn } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ListaProgramacaoEntrega } from "@/types/programacaoEntrega";
import { RegistroCarga } from "@/types/registroCargas";
import { Camera, Upload } from "lucide-react";
import { useCentrosCusto } from "@/hooks/useCentrosCusto";
import { fetchCentroCustoForProgramacao } from "@/services/centroCustoRegistroService";

interface RegistroCargaFormProps {
  isOpen: boolean;
  onClose: () => void;
  form: UseFormReturn<any>;
  isLoading: boolean;
  onSubmit: () => void;
  ticketSaidaPreview: string | null;
  ticketRetornoPreview: string | null;
  handleTicketSaidaChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleTicketRetornoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  currentEntrega: ListaProgramacaoEntrega | null;
  existingRegistro: RegistroCarga | null;
}

const RegistroCargaForm: React.FC<RegistroCargaFormProps> = ({
  isOpen,
  onClose,
  form,
  isLoading,
  onSubmit,
  ticketSaidaPreview,
  ticketRetornoPreview,
  handleTicketSaidaChange,
  handleTicketRetornoChange,
  currentEntrega,
  existingRegistro,
}) => {
  const [centroCustoInfo, setCentroCustoInfo] = useState<string>("Carregando...");

  useEffect(() => {
    const loadCentroCusto = async () => {
      if (currentEntrega?.programacao_entrega_id) {
        const centroCusto = await fetchCentroCustoForProgramacao(currentEntrega.programacao_entrega_id);
        if (centroCusto) {
          setCentroCustoInfo(`${centroCusto.codigo_centro_custo}`);
        } else {
          setCentroCustoInfo("Centro de custo não encontrado");
        }
      } else {
        setCentroCustoInfo("Não associado");
      }
    };

    loadCentroCusto();
  }, [currentEntrega]);

  if (!currentEntrega) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {existingRegistro ? 'Atualizar Registro de Carga' : 'Novo Registro de Carga'}
          </DialogTitle>
          <DialogDescription>
            Preencha os dados para registrar a carga
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-6">
            {/* Cabeçalho da Programação */}
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

            <Separator />

            {/* Campos de Pesagem */}
            <div>
              <h3 className="text-lg font-medium mb-4">Dados da Pesagem</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="tonelada_saida"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tonelada (Saída)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01"
                            onChange={(e) => field.onChange(parseFloat(e.target.value))}
                            value={field.value}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="imagem_ticket_saida"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Imagem do Ticket (Saída)</FormLabel>
                        <div className="flex flex-col space-y-2">
                          <div className="flex items-center space-x-2">
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full"
                              onClick={() => document.getElementById('ticketSaida')?.click()}
                            >
                              <Camera className="mr-2 h-4 w-4" />
                              Anexar Imagem
                            </Button>
                            <Input
                              id="ticketSaida"
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleTicketSaidaChange}
                            />
                          </div>
                          {ticketSaidaPreview && (
                            <div className="relative w-full h-40 border rounded-md overflow-hidden">
                              <img
                                src={ticketSaidaPreview}
                                alt="Ticket de Saída"
                                className="w-full h-full object-contain"
                              />
                            </div>
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="tonelada_retorno"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tonelada (Retorno)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01"
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                            value={field.value === null ? '' : field.value}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="imagem_ticket_retorno"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Imagem do Ticket (Retorno)</FormLabel>
                        <div className="flex flex-col space-y-2">
                          <div className="flex items-center space-x-2">
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full"
                              onClick={() => document.getElementById('ticketRetorno')?.click()}
                            >
                              <Upload className="mr-2 h-4 w-4" />
                              Anexar Imagem
                            </Button>
                            <Input
                              id="ticketRetorno"
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleTicketRetornoChange}
                            />
                          </div>
                          {ticketRetornoPreview && (
                            <div className="relative w-full h-40 border rounded-md overflow-hidden">
                              <img
                                src={ticketRetornoPreview}
                                alt="Ticket de Retorno"
                                className="w-full h-full object-contain"
                              />
                            </div>
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-muted rounded-md">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-medium">Tonelada Real (Aplicada)</h4>
                  <div className="text-xl font-bold">
                    {form.watch("tonelada_saida") - (form.watch("tonelada_retorno") || 0)} t
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Calculado automaticamente (Tonelada de Saída - Tonelada de Retorno)
                </p>
              </div>
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancelar</Button>
              </DialogClose>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <div className="animate-spin h-4 w-4 mr-2 border-2 border-current border-t-transparent rounded-full" />
                    Salvando...
                  </>
                ) : existingRegistro ? "Atualizar" : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default RegistroCargaForm;
