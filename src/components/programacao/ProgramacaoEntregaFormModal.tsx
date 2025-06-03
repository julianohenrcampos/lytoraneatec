"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { VehicleCombobox } from "@/components/combobox/VehicleCombobox";
import { NumberInput } from "@/components/ui/number-input";
import { useProgramacaoEntregaForm } from "@/hooks/useProgramacaoEntregaForm";
import { ProgramacaoEntregaWithItems } from "@/types/programacaoEntrega";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarIcon, Plus, Trash2, X, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { 
  normalizeDateToBrazilianNoon, 
  formatBrazilianDateToString, 
  parseBrazilianDate, 
  formatBrazilianDateForDisplay 
} from "@/utils/timezoneUtils";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import CancelItemDialog from "./CancelItemDialog";

interface ProgramacaoEntregaFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  programacao: ProgramacaoEntregaWithItems | null;
}

const ProgramacaoEntregaFormModal: React.FC<ProgramacaoEntregaFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  programacao
}) => {
  const {
    form,
    itemForm,
    isSubmitting,
    isAddingItem,
    setIsAddingItem,
    onSubmit,
    addItem,
    removeItem,
    openCancelDialog,
    closeCancelDialog,
    confirmCancel,
    showCancelDialog,
    itemToCancel,
    requisicoes,
    equipes,
    usinas,
    caminhoes,
    selectedRequisicaoId,
    selectedEquipeId,
    requisicaoDetails,
    calculateProgrammedQuantity,
    watchItens,
    centroCustoNome
  } = useProgramacaoEntregaForm(programacao, onSuccess);

  const requisicaoOptions = requisicoes.map(req => {
    const centroCustoCode = req.centro_custo && 
      typeof req.centro_custo === 'object' && 
      req.centro_custo !== null && 
      'codigo_centro_custo' in req.centro_custo ? 
        String(req.centro_custo.codigo_centro_custo || '') : '';
    
    return {
      value: req.id,
      label: `Requisição #${req.numero} - ${centroCustoCode}`
    };
  });
  
  const equipeOptions = equipes.map(eq => ({
    value: eq.id,
    label: eq.nome_equipe
  }));
  
  const usinaOptions = usinas.map(us => ({
    value: us.id,
    label: us.nome_usina
  }));
  
  // Define o tipo de lançamento mantendo os valores originais
  const tipoLancamentoOptions = [{
    value: "Manual",
    label: "Manual"
  }, {
    value: "Mecânico",
    label: "Mecânico"
  }, {
    value: "Misto",
    label: "Misto"
  }];

  const selectedEquipe = selectedEquipeId ? equipes.find(eq => eq.id === selectedEquipeId) : null;

  const apontadorNome = selectedEquipe && 
    selectedEquipe.apontador && 
    typeof selectedEquipe.apontador === 'object' && 
    selectedEquipe.apontador !== null && 
    'nome_completo' in selectedEquipe.apontador ? 
      String(selectedEquipe.apontador.nome_completo || "Apontador da equipe") : "Apontador da equipe";

  const handleItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    itemForm.handleSubmit(values => {
      console.log("Submitting item values:", values);
      console.log("Centro custo nome:", values.centro_custo_nome);
      console.log("Quantidade massa (kg):", values.quantidade_massa);
      
      // Validate that centro_custo_nome is not empty
      if (!values.centro_custo_nome) {
        console.error("Centro custo nome is empty!");
        return;
      }
      
      addItem(values);
    })();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[1000px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {programacao ? "Editar Programação de Entrega" : "Nova Programação de Entrega"}
          </DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Seção de Dados Principais */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Dados da Programação</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Seção de Dados Principais */}
                <FormField control={form.control} name="requisicao_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Requisição *</FormLabel>
                    <FormControl>
                      <Combobox 
                        options={requisicaoOptions} 
                        value={field.value} 
                        onChange={field.onChange} 
                        placeholder="Selecione uma requisição" 
                        emptyText="Nenhuma requisição encontrada" 
                        className="w-full" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="data_entrega" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-sm font-medium">Data de Entrega *</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button 
                            variant={"outline"} 
                            className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                          >
                            {field.value ? formatBrazilianDateForDisplay(field.value) : <span>Selecione uma data</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar 
                          mode="single" 
                          selected={field.value ? parseBrazilianDate(field.value) : new Date()} 
                          onSelect={(date) => {
                            if (date) {
                              const normalizedDate = normalizeDateToBrazilianNoon(date);
                              const formattedDate = formatBrazilianDateToString(normalizedDate);
                              console.log("Date selected in calendar:", date, "normalized Brazilian:", normalizedDate, "formatted:", formattedDate);
                              field.onChange(formattedDate);
                            }
                          }} 
                          initialFocus 
                          className="pointer-events-auto" 
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            {/* Resumo da Requisição - Fixed to show tons correctly */}
            {selectedRequisicaoId && (
              <Card className="bg-blue-50 border-blue-200">
                <CardHeader>
                  <CardTitle className="text-base text-blue-800">Resumo da Requisição</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-700">{requisicaoDetails.totalRuas}</div>
                      <div className="text-sm text-blue-600">Total de Ruas</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-700">{requisicaoDetails.areaTotal.toFixed(2)}</div>
                      <div className="text-sm text-blue-600">Área Total (m²)</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-700">{Math.round(requisicaoDetails.pesoTotal)}</div>
                      <div className="text-sm text-blue-600">Peso Total (t)</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-700">{calculateProgrammedQuantity().toFixed(1)}</div>
                      <div className="text-sm text-green-600">Programado (t)</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Seção de Entregas - Fixed display to show values in tons */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg">Entregas Programadas</CardTitle>
                  <Button 
                    type="button" 
                    onClick={() => setIsAddingItem(true)} 
                    disabled={!selectedRequisicaoId || isAddingItem} 
                    className="bg-blue-500 hover:bg-blue-600"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Entrega
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {watchItens.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground bg-gray-50 rounded-md border-2 border-dashed">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma entrega programada.</p>
                    <p className="text-sm">Adicione pelo menos uma entrega para continuar.</p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Logradouro</TableHead>
                          <TableHead>Quantidade</TableHead>
                          <TableHead>Caminhão</TableHead>
                          <TableHead>Equipe</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Usina</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {watchItens.map((item, index) => {
                          // Convert display value: if editing existing data from DB (tons), show as tons
                          // If new data from form (kg), convert to tons for display
                          const displayQuantity = typeof item.quantidade_massa === 'number' 
                            ? (item.quantidade_massa > 100 ? item.quantidade_massa / 1000 : item.quantidade_massa)
                            : parseFloat(String(item.quantidade_massa || 0));
                          
                          return (
                            <TableRow key={index} className={item.cancelled ? "bg-red-50" : ""}>
                              <TableCell className="font-medium">
                                {item.logradouro || item.centro_custo_nome}
                                {item.cancelled && (
                                  <div className="mt-1 flex items-center text-xs text-red-600">
                                    <AlertCircle className="h-3 w-3 mr-1" />
                                    <span className="truncate">Cancelado</span>
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">{displayQuantity.toFixed(1)} t</Badge>
                              </TableCell>
                              <TableCell>
                                {caminhoes.find(c => c.id === item.caminhao_id)?.placa || 'N/A'}
                              </TableCell>
                              <TableCell>
                                {equipes.find(e => e.id === item.equipe_id)?.nome_equipe || 'N/A'}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{item.tipo_lancamento}</Badge>
                              </TableCell>
                              <TableCell>
                                {usinas.find(u => u.id === item.usina_id)?.nome_usina || 'N/A'}
                              </TableCell>
                              <TableCell>
                                {item.data_entrega ? formatBrazilianDateForDisplay(item.data_entrega) : 'N/A'}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end space-x-1">
                                  {!item.cancelled && (
                                    <Button 
                                      type="button" 
                                      variant="outline" 
                                      size="sm" 
                                      onClick={() => openCancelDialog(index)}
                                      disabled={item.status === 'Enviada' || item.status === 'Entregue'}
                                      title={item.status === 'Enviada' || item.status === 'Entregue' ? 
                                        "Não é possível cancelar uma entrega que já foi enviada ou entregue" : 
                                        "Cancelar entrega"}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  )}
                                  <Button 
                                    type="button" 
                                    variant="destructive" 
                                    size="sm" 
                                    onClick={() => removeItem(index)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Formulário de Adição de Item - keep existing code */}
            {isAddingItem && (
              <Card className="border-blue-200 bg-blue-50">
                <CardHeader>
                  <CardTitle className="text-lg text-blue-800">Adicionar Nova Entrega</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <FormField control={itemForm.control} name="centro_custo_nome" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Centro de Custo *</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            readOnly 
                            value={centroCustoNome} 
                            placeholder="Centro de custo da requisição" 
                            className="bg-gray-100" 
                          />
                        </FormControl>
                        <FormMessage />
                        {!centroCustoNome && (
                          <p className="text-xs text-red-500">
                            Centro de custo não encontrado. Selecione uma requisição válida.
                          </p>
                        )}
                      </FormItem>
                    )} />
                    
                    <FormField control={itemForm.control} name="quantidade_massa" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Quantidade (kg) *</FormLabel>
                        <FormControl>
                          <NumberInput 
                            value={field.value} 
                            onChange={field.onChange} 
                            placeholder="26750" 
                            className="bg-white" 
                          />
                        </FormControl>
                        <FormMessage />
                        <p className="text-xs text-muted-foreground">
                          Digite o peso em kg (ex: 26750). Será convertido para toneladas automaticamente.
                        </p>
                      </FormItem>
                    )} />
                    
                    <FormField control={itemForm.control} name="caminhao_id" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Caminhão *</FormLabel>
                        <FormControl>
                          <VehicleCombobox 
                            value={field.value} 
                            onChange={field.onChange} 
                            placeholder="Selecione o caminhão" 
                            searchPlaceholder="Buscar caminhão..." 
                            emptyText="Nenhum caminhão disponível" 
                            onlyTrucks={true} 
                            situationFilter={["Disponível", "Operando"]} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    
                    <FormField control={itemForm.control} name="tipo_lancamento" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Tipo de Lançamento *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-white">
                              <SelectValue placeholder="Selecione o tipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {tipoLancamentoOptions.map(option => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    
                    <FormField control={itemForm.control} name="equipe_id" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Equipe *</FormLabel>
                        <FormControl>
                          <Combobox 
                            options={equipeOptions} 
                            value={field.value} 
                            onChange={field.onChange} 
                            placeholder="Selecione uma equipe" 
                            emptyText="Nenhuma equipe encontrada" 
                            className="bg-white" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    
                    <FormField control={itemForm.control} name="apontador_id" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Apontador *</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            disabled 
                            placeholder="Apontador da equipe" 
                            value={apontadorNome} 
                            className="bg-gray-100" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    
                    <FormField control={itemForm.control} name="usina_id" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Usina *</FormLabel>
                        <FormControl>
                          <Combobox 
                            options={usinaOptions} 
                            value={field.value} 
                            onChange={field.onChange} 
                            placeholder="Selecione uma usina" 
                            emptyText="Nenhuma usina encontrada" 
                            className="bg-white" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    
                    <FormField control={itemForm.control} name="data_entrega" render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="text-sm font-medium">Data de Entrega *</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button 
                                variant={"outline"} 
                                className={cn("w-full pl-3 text-left font-normal bg-white", !field.value && "text-muted-foreground")}
                              >
                                {field.value ? formatBrazilianDateForDisplay(field.value) : <span>Selecione uma data</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar 
                              mode="single" 
                              selected={field.value ? parseBrazilianDate(field.value) : new Date()} 
                              onSelect={date => {
                                if (date) {
                                  const normalizedDate = normalizeDateToBrazilianNoon(date);
                                  const formattedDate = formatBrazilianDateToString(normalizedDate);
                                  console.log("Item date selected in calendar:", date, "normalized Brazilian:", normalizedDate, "formatted:", formattedDate);
                                  field.onChange(formattedDate);
                                }
                              }} 
                              initialFocus 
                              className="pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  
                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button type="button" variant="outline" onClick={() => setIsAddingItem(false)}>
                      Cancelar
                    </Button>
                    <Button type="button" className="bg-blue-500 hover:bg-blue-600" onClick={handleItemSubmit}>
                      Adicionar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Cancel Item Dialog */}
            <CancelItemDialog
              isOpen={showCancelDialog}
              onClose={closeCancelDialog}
              onConfirm={confirmCancel}
            />
            
            <DialogFooter className="flex justify-end gap-2 pt-6">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting || watchItens.length === 0} className="bg-blue-500 hover:bg-blue-600">
                {isSubmitting ? (
                  <>
                    <div className="animate-spin h-4 w-4 mr-2 border-2 border-current border-t-transparent rounded-full" />
                    Salvando...
                  </>
                ) : programacao ? "Atualizar" : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default ProgramacaoEntregaFormModal;
