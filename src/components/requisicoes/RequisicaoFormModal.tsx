import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Plus, CalendarIcon, User, Lock, Info } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRequisicaoForm, RuaFormSchema } from "@/hooks/useRequisicaoForm";
import { RequisicaoWithRuas } from "@/types/requisicao";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  normalizeDateToBrazilianNoon, 
  formatBrazilianDateToString, 
  parseBrazilianDate,
  getCurrentBrazilianDate 
} from "@/utils/timezoneUtils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface RequisicaoFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requisicao?: RequisicaoWithRuas | null;
  onSuccess: () => void;
}

// Opções simplificadas para Pintura de Ligação
const pinturaLigacaoOptions = [
  { value: "PINTURA DE LIGAÇÃO", label: "PINTURA DE LIGAÇÃO", description: "Cabeçalho - Selecione uma opção abaixo", disabled: true },
  { value: "RR-1C", label: "RR-1C", description: "Emulsão Asfáltica de Ruptura Rápida" },
  { value: "IMPRIMA", label: "IMPRIMA", description: "Imprimação Asfáltica" }
];

// Opções simplificadas para Traço
const tracoOptions = [
  { value: "TRAÇO", label: "TRAÇO", description: "Cabeçalho - Selecione uma opção abaixo", disabled: true },
  { value: "4C", label: "4C", description: "Concreto Asfáltico Tipo 4C" },
  { value: "5A", label: "5A", description: "Concreto Asfáltico Tipo 5A" },
  { value: "BINDER", label: "BINDER", description: "Camada de Ligação (Binder)" }
];

export default function RequisicaoFormModal({
  open,
  onOpenChange,
  requisicao,
  onSuccess,
}: RequisicaoFormModalProps) {
  const {
    form,
    ruaForm,
    isSubmitting,
    isAddingRua,
    setIsAddingRua,
    onSubmit: handleFormSubmit,
    addRua,
    removeRua,
    searchStatus,
    retrySearch,
    currentUserName,
    funcionarioNotFound,
  } = useRequisicaoForm(requisicao, () => {
    onOpenChange(false);
    onSuccess();
  });

  const { data: centrosCusto } = useQuery({
    queryKey: ['centros-custo'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bd_centros_custo')
        .select('id, nome_centro_custo')
        .eq('situacao', 'Ativo')
        .order('nome_centro_custo');
      
      if (error) throw error;
      return data;
    }
  });

  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      const normalizedDate = normalizeDateToBrazilianNoon(date);
      const dateString = formatBrazilianDateToString(normalizedDate);
      form.setValue("data_requisicao", dateString);
    }
  };

  const getCurrentDateValue = () => {
    const dateString = form.watch("data_requisicao");
    if (dateString) {
      try {
        return parseBrazilianDate(dateString);
      } catch (error) {
        console.error("Erro ao fazer parse da data:", error);
        return normalizeDateToBrazilianNoon();
      }
    }
    return normalizeDateToBrazilianNoon();
  };

  return (
    <TooltipProvider>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {requisicao ? "Editar Requisição" : "Nova Requisição"}
            </DialogTitle>
          </DialogHeader>

          {funcionarioNotFound && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
              <div className="flex items-center space-x-2">
                <div className="text-red-600">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-red-800 font-medium">Usuário não encontrado no sistema</p>
                  <p className="text-red-700 text-sm">
                    Seu usuário não foi encontrado na tabela de funcionários. Entre em contato com o administrador para cadastrar seu perfil antes de criar requisições.
                  </p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Centro de Custo */}
              <div>
                <Label htmlFor="centro_custo_id">Centro de Custo *</Label>
                <Select
                  value={form.watch("centro_custo_id")}
                  onValueChange={(value) => form.setValue("centro_custo_id", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o centro de custo" />
                  </SelectTrigger>
                  <SelectContent>
                    {centrosCusto?.map((centro) => (
                      <SelectItem key={centro.id} value={centro.id}>
                        {centro.nome_centro_custo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.centro_custo_id && (
                  <p className="text-sm text-red-600 mt-1">
                    {form.formState.errors.centro_custo_id.message}
                  </p>
                )}
              </div>

              {/* Data da Requisição */}
              <div>
                <Label htmlFor="data_requisicao">Data da Requisição *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !form.watch("data_requisicao") && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.watch("data_requisicao") 
                        ? format(getCurrentDateValue(), "dd/MM/yyyy", { locale: ptBR })
                        : "Selecione a data"
                      }
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={getCurrentDateValue()}
                      onSelect={handleDateChange}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                {form.formState.errors.data_requisicao && (
                  <p className="text-sm text-red-600 mt-1">
                    {form.formState.errors.data_requisicao.message}
                  </p>
                )}
              </div>

              {/* Diretoria */}
              <div>
                <Label htmlFor="diretoria">Diretoria</Label>
                <Input
                  {...form.register("diretoria")}
                  placeholder="Digite a diretoria"
                />
              </div>

              {/* Gerência */}
              <div>
                <Label htmlFor="gerencia">Gerência</Label>
                <Input
                  {...form.register("gerencia")}
                  placeholder="Digite a gerência"
                />
              </div>

              {/* Engenheiro Responsável - Campo Automático e Readonly */}
              <div className="md:col-span-2">
                <Label htmlFor="engenheiro_responsavel" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Engenheiro Responsável *
                  <Lock className="h-3 w-3 text-gray-500" />
                </Label>
                
                <div className="space-y-2">
                  <div className="relative">
                    <Input
                      value={currentUserName || "Carregando..."}
                      readOnly
                      className="bg-gray-50 text-gray-700 cursor-not-allowed pr-10"
                      placeholder="Aguardando identificação do usuário..."
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                      {searchStatus === 'searching' && (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      )}
                      {searchStatus === 'found' && (
                        <div className="text-green-600">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                      {searchStatus === 'not_found' && (
                        <div className="text-red-600">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-600 flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      Campo preenchido automaticamente com o usuário logado
                    </p>
                    
                    {searchStatus === 'not_found' && (
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={retrySearch}
                        className="text-xs"
                      >
                        Tentar Novamente
                      </Button>
                    )}
                  </div>
                </div>
                
                {form.formState.errors.engenheiro_id && (
                  <p className="text-sm text-red-600 mt-1">
                    {form.formState.errors.engenheiro_id.message}
                  </p>
                )}
              </div>
            </div>

            {/* Ruas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  Ruas
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAddingRua(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Rua
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Lista de ruas existentes */}
                {form.watch("ruas")?.map((rua, index) => (
                  <div key={index} className="border rounded p-4 mb-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium">{rua.logradouro}</h4>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeRua(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-600">
                      <div>Bairro: {rua.bairro}</div>
                      <div>Largura: {rua.largura}m</div>
                      <div>Comprimento: {rua.comprimento}m</div>
                      <div>Área: {rua.area?.toFixed(2)}m²</div>
                      <div>Pintura: {rua.pintura_ligacao}</div>
                      <div>Traço: {rua.traco}</div>
                      <div>Espessura: {rua.espessura}cm</div>
                      <div>Volume: {rua.volume?.toFixed(2)}t</div>
                    </div>
                  </div>
                ))}

                {/* Formulário para adicionar nova rua */}
                {isAddingRua && (
                  <div className="border-2 border-dashed border-gray-300 rounded p-4">
                    <h4 className="font-medium mb-4">Adicionar Nova Rua</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="logradouro">Logradouro *</Label>
                        <Input
                          {...ruaForm.register("logradouro")}
                          placeholder="Nome da rua"
                        />
                        {ruaForm.formState.errors.logradouro && (
                          <p className="text-sm text-red-600 mt-1">
                            {ruaForm.formState.errors.logradouro.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="bairro">Bairro</Label>
                        <Input
                          {...ruaForm.register("bairro")}
                          placeholder="Nome do bairro"
                        />
                      </div>

                      <div>
                        <Label htmlFor="largura">Largura (m) *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          {...ruaForm.register("largura")}
                          placeholder="0.00"
                        />
                        {ruaForm.formState.errors.largura && (
                          <p className="text-sm text-red-600 mt-1">
                            {ruaForm.formState.errors.largura.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="comprimento">Comprimento (m) *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          {...ruaForm.register("comprimento")}
                          placeholder="0.00"
                        />
                        {ruaForm.formState.errors.comprimento && (
                          <p className="text-sm text-red-600 mt-1">
                            {ruaForm.formState.errors.comprimento.message}
                          </p>
                        )}
                      </div>

                      {/* Pintura de Ligação com opções simplificadas */}
                      <div>
                        <Label htmlFor="pintura_ligacao" className="flex items-center gap-2">
                          Pintura de Ligação *
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-4 w-4 text-gray-400" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Selecione o tipo de pintura de ligação conforme especificação técnica</p>
                            </TooltipContent>
                          </Tooltip>
                        </Label>
                        <Select
                          value={ruaForm.watch("pintura_ligacao")}
                          onValueChange={(value) => ruaForm.setValue("pintura_ligacao", value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent className="z-50">
                            {pinturaLigacaoOptions.map((option) => (
                              <SelectItem 
                                key={option.value} 
                                value={option.value}
                                disabled={option.disabled}
                                className={option.disabled ? "font-bold text-gray-900 bg-gray-100" : ""}
                              >
                                <div className="flex flex-col">
                                  <span className={option.disabled ? "font-bold" : "font-medium"}>{option.label}</span>
                                  {!option.disabled && (
                                    <span className="text-xs text-gray-500">{option.description}</span>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {ruaForm.formState.errors.pintura_ligacao && (
                          <p className="text-sm text-red-600 mt-1">
                            {ruaForm.formState.errors.pintura_ligacao.message}
                          </p>
                        )}
                        {ruaForm.watch("pintura_ligacao") && ruaForm.watch("pintura_ligacao") !== "PINTURA DE LIGAÇÃO" && (
                          <p className="text-xs text-blue-600 mt-1">
                            {pinturaLigacaoOptions.find(opt => opt.value === ruaForm.watch("pintura_ligacao"))?.description}
                          </p>
                        )}
                      </div>

                      {/* Traço com opções simplificadas */}
                      <div>
                        <Label htmlFor="traco" className="flex items-center gap-2">
                          Traço *
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-4 w-4 text-gray-400" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Selecione o tipo de traço/graduação conforme especificação técnica</p>
                            </TooltipContent>
                          </Tooltip>
                        </Label>
                        <Select
                          value={ruaForm.watch("traco")}
                          onValueChange={(value) => ruaForm.setValue("traco", value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent className="z-50">
                            {tracoOptions.map((option) => (
                              <SelectItem 
                                key={option.value} 
                                value={option.value}
                                disabled={option.disabled}
                                className={option.disabled ? "font-bold text-gray-900 bg-gray-100" : ""}
                              >
                                <div className="flex flex-col">
                                  <span className={option.disabled ? "font-bold" : "font-medium"}>{option.label}</span>
                                  {!option.disabled && (
                                    <span className="text-xs text-gray-500">{option.description}</span>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {ruaForm.formState.errors.traco && (
                          <p className="text-sm text-red-600 mt-1">
                            {ruaForm.formState.errors.traco.message}
                          </p>
                        )}
                        {ruaForm.watch("traco") && ruaForm.watch("traco") !== "TRAÇO" && (
                          <p className="text-xs text-blue-600 mt-1">
                            {tracoOptions.find(opt => opt.value === ruaForm.watch("traco"))?.description}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="espessura">Espessura (cm) *</Label>
                        <Input
                          type="number"
                          step="0.1"
                          {...ruaForm.register("espessura")}
                          placeholder="0.0"
                        />
                        {ruaForm.formState.errors.espessura && (
                          <p className="text-sm text-red-600 mt-1">
                            {ruaForm.formState.errors.espessura.message}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 mt-4">
                      <Button
                        type="button"
                        onClick={ruaForm.handleSubmit(addRua)}
                        size="sm"
                      >
                        Adicionar
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsAddingRua(false);
                          ruaForm.reset();
                        }}
                        size="sm"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}

                {form.formState.errors.ruas && (
                  <p className="text-sm text-red-600 mt-2">
                    {form.formState.errors.ruas.message}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Botões de ação */}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting || funcionarioNotFound}
                className={funcionarioNotFound ? "opacity-50 cursor-not-allowed" : ""}
              >
                {isSubmitting ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
