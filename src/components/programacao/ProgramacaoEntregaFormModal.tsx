
"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { VehicleCombobox } from "@/components/combobox/VehicleCombobox";
import { useProgramacaoEntregaForm } from "@/hooks/useProgramacaoEntregaForm";
import { ProgramacaoEntregaWithItems } from "@/types/programacaoEntrega";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarIcon, Plus, Trash2, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";

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
    cancelItem,
    requisicoes,
    logradouros,
    equipes,
    usinas,
    caminhoes,
    selectedRequisicaoId,
    selectedEquipeId,
    requisicaoDetails,
    calculateProgrammedQuantity,
    watchItens
  } = useProgramacaoEntregaForm(programacao, onSuccess);

  const requisicaoOptions = requisicoes.map(req => {
    const centroCustoCode = req.centro_custo?.codigo_centro_custo || '';
    return {
      value: req.id,
      label: `Requisição #${req.numero} - ${centroCustoCode}`
    };
  });
  
  const logradouroOptions = logradouros.map(log => ({
    value: log.logradouro,
    label: `${log.logradouro} - ${log.bairro || 'Sem bairro'} (${log.area || 0}m²)`
  }));
  
  const equipeOptions = equipes.map(eq => ({
    value: eq.id,
    label: eq.nome_equipe
  }));
  
  const usinaOptions = usinas.map(us => ({
    value: us.id,
    label: us.nome_usina
  }));
  
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

  const apontadorNome = selectedEquipe && selectedEquipe.apontador ? selectedEquipe.apontador.nome_completo : "Apontador da equipe";

  const handleItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    itemForm.handleSubmit(values => {
      console.log("Submitting item values:", values);
      addItem(values);
    })();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto my-0 py-0 px-0 mx-0">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold p-6 pt-6">
            {programacao ? "Editar Programação de Entrega" : "Nova Programação de Entrega"}
          </DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 px-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="requisicao_id" render={({
              field
            }) => <FormItem>
                    <FormLabel className="text-sm font-medium">Requisição *</FormLabel>
                    <FormControl>
                      <Combobox options={requisicaoOptions} value={field.value} onChange={field.onChange} placeholder="Selecione uma requisição" emptyText="Nenhuma requisição encontrada" className="w-full" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>} />

              <FormField control={form.control} name="data_entrega" render={({
              field
            }) => <FormItem className="flex flex-col">
                    <FormLabel className="text-sm font-medium">Data de Entrega *</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                            {field.value ? format(new Date(field.value), "dd/MM/yyyy", {
                        locale: ptBR
                      }) : <span>Selecione uma data</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value ? new Date(field.value) : undefined} onSelect={date => field.onChange(date ? format(date, "yyyy-MM-dd") : "")} initialFocus className="pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>} />
            </div>

            {selectedRequisicaoId && <Card className="bg-blue-50 border border-blue-100 shadow-sm">
                <CardContent className="pt-4 pb-4">
                  <div className="flex flex-wrap gap-3 justify-between">
                    <Badge variant="outline" className="bg-blue-100 text-blue-700 px-3 py-1">
                      Total de Ruas: {requisicaoDetails.totalRuas}
                    </Badge>
                    <Badge variant="outline" className="bg-blue-100 text-blue-700 px-3 py-1">
                      Área Total: {requisicaoDetails.areaTotal.toFixed(2)}m²
                    </Badge>
                    <Badge variant="outline" className="bg-blue-100 text-blue-700 px-3 py-1">
                      Peso Total: {Math.round(requisicaoDetails.pesoTotal)}t
                    </Badge>
                    <Badge variant="outline" className="bg-blue-100 text-blue-700 px-3 py-1">
                      Programado: {Math.round(calculateProgrammedQuantity())}t
                    </Badge>
                  </div>
                </CardContent>
              </Card>}

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Entregas Programadas</h3>
                <Button type="button" onClick={() => setIsAddingItem(true)} disabled={!selectedRequisicaoId || isAddingItem} className="bg-blue-500 hover:bg-blue-600">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Entrega
                </Button>
              </div>
              
              <Separator />
              
              {watchItens.length === 0 ? <div className="text-center py-8 text-muted-foreground bg-gray-50 rounded-md border">
                  Nenhuma entrega programada. Adicione pelo menos uma entrega.
                </div> : <div className="rounded-md border">
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
                      {watchItens.map((item, index) => <TableRow key={index} className={item.cancelled ? "bg-red-50" : ""}>
                          <TableCell className="font-medium">{item.logradouro}</TableCell>
                          <TableCell>{item.quantidade_massa} t</TableCell>
                          <TableCell>
                            {caminhoes.find(c => c.id === item.caminhao_id)?.placa || 'N/A'}
                          </TableCell>
                          <TableCell>
                            {equipes.find(e => e.id === item.equipe_id)?.nome_equipe || 'N/A'}
                          </TableCell>
                          <TableCell>{item.tipo_lancamento}</TableCell>
                          <TableCell>
                            {usinas.find(u => u.id === item.usina_id)?.nome_usina || 'N/A'}
                          </TableCell>
                          <TableCell>
                            {item.data_entrega ? format(new Date(item.data_entrega), "dd/MM/yyyy", {
                        locale: ptBR
                      }) : 'N/A'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end space-x-2">
                              {!item.cancelled && <>
                                  <Button type="button" variant="outline" size="sm" onClick={() => cancelItem(index)}>
                                    <X className="h-4 w-4" />
                                  </Button>
                                </>}
                              <Button type="button" variant="destructive" size="sm" onClick={() => removeItem(index)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>)}
                    </TableBody>
                  </Table>
                </div>}
            </div>
            
            {isAddingItem && <Card className="bg-blue-50 border border-blue-100 shadow-sm">
                <CardContent className="pt-4 pb-4">
                  <h3 className="text-lg font-medium mb-4">Adicionar Nova Entrega</h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={itemForm.control} name="logradouro" render={({
                    field
                  }) => <FormItem>
                            <FormLabel className="text-sm font-medium">Logradouro *</FormLabel>
                            <FormControl>
                              <Combobox 
                                options={logradouroOptions} 
                                value={field.value} 
                                onChange={(value) => {
                                  console.log("Logradouro selected:", value);
                                  field.onChange(value);
                                }} 
                                placeholder="Selecione o logradouro" 
                                emptyText="Nenhum logradouro disponível" 
                                className="bg-white" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>} />
                      
                      <FormField control={itemForm.control} name="quantidade_massa" render={({
                    field
                  }) => <FormItem>
                            <FormLabel className="text-sm font-medium">Quantidade (t) *</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} placeholder="Informe a quantidade" className="bg-white" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>} />
                      
                      <FormField control={itemForm.control} name="caminhao_id" render={({
                    field
                  }) => <FormItem>
                            <FormLabel className="text-sm font-medium">Caminhão *</FormLabel>
                            <FormControl>
                              <VehicleCombobox value={field.value} onChange={field.onChange} placeholder="Selecione o caminhão" searchPlaceholder="Buscar caminhão..." emptyText="Nenhum caminhão disponível" onlyTrucks={true} situationFilter={["Disponível", "Operando"]} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>} />
                      
                      <FormField control={itemForm.control} name="tipo_lancamento" render={({
                    field
                  }) => <FormItem>
                            <FormLabel className="text-sm font-medium">Tipo de Lançamento *</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="bg-white">
                                  <SelectValue placeholder="Selecione o tipo de lançamento" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {tipoLancamentoOptions.map(option => <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>)}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>} />
                      
                      <FormField control={itemForm.control} name="equipe_id" render={({
                    field
                  }) => <FormItem>
                            <FormLabel className="text-sm font-medium">Equipe *</FormLabel>
                            <FormControl>
                              <Combobox options={equipeOptions} value={field.value} onChange={field.onChange} placeholder="Selecione uma equipe" emptyText="Nenhuma equipe encontrada" className="bg-white" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>} />
                      
                      <FormField control={itemForm.control} name="apontador_id" render={({
                    field
                  }) => <FormItem>
                            <FormLabel className="text-sm font-medium">Apontador *</FormLabel>
                            <FormControl>
                              <Input {...field} disabled placeholder="Apontador da equipe" value={apontadorNome} className="bg-gray-100" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>} />
                      
                      <FormField control={itemForm.control} name="usina_id" render={({
                    field
                  }) => <FormItem>
                            <FormLabel className="text-sm font-medium">Usina *</FormLabel>
                            <FormControl>
                              <Combobox options={usinaOptions} value={field.value} onChange={field.onChange} placeholder="Selecione uma usina" emptyText="Nenhuma usina encontrada" className="bg-white" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>} />
                      
                      <FormField control={itemForm.control} name="data_entrega" render={({
                    field
                  }) => <FormItem className="flex flex-col">
                            <FormLabel className="text-sm font-medium">Data de Entrega *</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal bg-white", !field.value && "text-muted-foreground")}>
                                    {field.value ? format(new Date(field.value), "dd/MM/yyyy", {
                              locale: ptBR
                            }) : <span>Selecione uma data</span>}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar 
                                  mode="single" 
                                  selected={field.value ? new Date(field.value) : undefined} 
                                  onSelect={date => field.onChange(date ? format(date, "yyyy-MM-dd") : "")} 
                                  initialFocus 
                                  className="pointer-events-auto"
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>} />
                    </div>
                    
                    <div className="flex justify-end gap-2 pt-2">
                      <Button type="button" variant="outline" onClick={() => setIsAddingItem(false)}>
                        Cancelar
                      </Button>
                      <Button type="button" className="bg-blue-500 hover:bg-blue-600" onClick={handleItemSubmit}>
                        Adicionar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>}
            
            <DialogFooter className="flex justify-end gap-2 pt-4 pb-6">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting || watchItens.length === 0} className="bg-blue-500 hover:bg-blue-600">
                {isSubmitting ? <>
                    <div className="animate-spin h-4 w-4 mr-2 border-2 border-current border-t-transparent rounded-full" />
                    Salvando...
                  </> : programacao ? "Atualizar" : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default ProgramacaoEntregaFormModal;
