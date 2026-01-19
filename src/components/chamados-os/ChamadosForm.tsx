import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft, Loader2 } from "lucide-react";
import { ChamadoOS } from "@/types/chamadoOS";
import { User } from "@supabase/supabase-js";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Label } from "@/components/ui/label";
import { ImageUpload } from "@/components/ui/image-upload";
import { Combobox } from "@/components/ui/combobox";

interface ChamadosFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: any, photoFiles?: File[]) => Promise<void>;
  currentChamado: ChamadoOS | null;
  veiculosOptions: { id: string; label: string }[];
  centrosCustoOptions: { id: string; label: string; codigo_centro_custo?: string }[];
  isLoading: boolean;
  currentUser: User | null;
}

const chamadoFormSchema = z.object({
  caminhao_equipamento_id: z.string().min(1, { message: "Selecione um caminhão/equipamento" }),
  centro_custo_id: z.string().min(1, { message: "Selecione um centro de custo" }),
  prioridade: z.string().min(1, { message: "Selecione a prioridade" }),
  tipo_falha: z.string().min(1, { message: "Selecione o tipo de falha" }),
  descricao_problema: z.string().min(10, { message: "Descreva o problema com pelo menos 10 caracteres" }),
  status: z.string().default("Aberto"),
});

const ChamadosForm: React.FC<ChamadosFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  currentChamado,
  veiculosOptions,
  centrosCustoOptions,
  isLoading,
  currentUser
}) => {
  const [activeTab, setActiveTab] = useState("header");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [existingPhotoUrls, setExistingPhotoUrls] = useState<string[]>([]);
  
  const form = useForm<z.infer<typeof chamadoFormSchema>>({
    resolver: zodResolver(chamadoFormSchema),
    defaultValues: {
      caminhao_equipamento_id: "",
      centro_custo_id: "",
      prioridade: "Média",
      tipo_falha: "",
      descricao_problema: "",
      status: "Aberto",
    },
  });
  
  useEffect(() => {
    if (currentChamado) {
      form.reset({
        caminhao_equipamento_id: currentChamado.caminhao_equipamento_id || "",
        centro_custo_id: currentChamado.centro_custo_id || "",
        prioridade: currentChamado.prioridade || "Média",
        tipo_falha: currentChamado.tipo_falha || "",
        descricao_problema: currentChamado.descricao_problema || "",
        status: currentChamado.status || "Aberto",
      });
      
      if (currentChamado.fotos_avarias && currentChamado.fotos_avarias.length > 0) {
        setExistingPhotoUrls(currentChamado.fotos_avarias);
      } else {
        setExistingPhotoUrls([]);
      }
    } else {
      form.reset({
        caminhao_equipamento_id: "",
        centro_custo_id: "",
        prioridade: "Média",
        tipo_falha: "",
        descricao_problema: "",
        status: "Aberto",
      });
      setExistingPhotoUrls([]);
    }
    setPhotoFiles([]);
    setActiveTab("header");
  }, [currentChamado, form, isOpen]);

  const handleNextTab = () => {
    form.trigger(["caminhao_equipamento_id", "centro_custo_id", "prioridade"]);
    const hasErrors = !!form.formState.errors.caminhao_equipamento_id || 
                      !!form.formState.errors.centro_custo_id || 
                      !!form.formState.errors.prioridade;
    
    if (!hasErrors) {
      setActiveTab("details");
    }
  };

  const handlePreviousTab = () => {
    setActiveTab("header");
  };
  
  const handleFormSubmit = async (values: z.infer<typeof chamadoFormSchema>) => {
    await onSubmit(values, photoFiles.length > 0 ? photoFiles : undefined);
  };
  
  const handlePhotoUpload = (files: File[]) => {
    setPhotoFiles(files);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>{currentChamado ? "Editar Chamado" : "Novo Chamado"}</DialogTitle>
          <DialogDescription>
            Preencha os dados do chamado. Campos marcados com * são obrigatórios.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="header">Cabeçalho</TabsTrigger>
                <TabsTrigger value="details">Detalhamento</TabsTrigger>
              </TabsList>
              
              <TabsContent value="header" className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Número do Chamado</label>
                    <p className="mt-1 text-sm">
                      {currentChamado?.numero_chamado || "Gerado automaticamente"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Data de Abertura</label>
                    <p className="mt-1 text-sm">
                      {currentChamado 
                        ? format(new Date(currentChamado.data_solicitacao), "dd/MM/yyyy", { locale: ptBR })
                        : format(new Date(), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Solicitante</label>
                    <p className="mt-1 text-sm">
                      {currentUser?.email || "Usuário atual"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Hora da Solicitação</label>
                    <p className="mt-1 text-sm">
                      {currentChamado 
                        ? currentChamado.hora_solicitacao 
                        : format(new Date(), "HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Status</label>
                    <p className="mt-1 text-sm">
                      {currentChamado?.status || "Aberto"}
                    </p>
                  </div>
                </div>
                
                <FormField
                  control={form.control}
                  name="caminhao_equipamento_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Caminhão/Equipamento <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Combobox
                          options={veiculosOptions.map(v => ({ value: v.id, label: v.label }))}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Selecione o caminhão/equipamento"
                          searchPlaceholder="Buscar por placa, marca ou modelo..."
                          emptyText="Nenhum caminhão/equipamento encontrado"
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="centro_custo_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Centro de Custo <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Combobox
                          options={centrosCustoOptions.map(c => ({ value: c.id, label: c.label }))}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Selecione o centro de custo"
                          searchPlaceholder="Buscar por código ou nome..."
                          emptyText="Nenhum centro de custo encontrado"
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />


                
                <FormField
                  control={form.control}
                  name="prioridade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prioridade <span className="text-destructive">*</span></FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={isLoading}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Selecione a prioridade" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Baixa">🟢 Baixa</SelectItem>
                          <SelectItem value="Média">🟡 Média</SelectItem>
                          <SelectItem value="Alta">🟠 Alta</SelectItem>
                          <SelectItem value="Emergencial">🔴 Emergencial</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="flex justify-end pt-4">
                  <Button type="button" onClick={handleNextTab} className="gap-2">
                    Seguir
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="details" className="space-y-4 pt-4">
                <FormField
                  control={form.control}
                  name="tipo_falha"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Falha <span className="text-destructive">*</span></FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={isLoading}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Selecione o tipo de falha" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Mecânica">Mecânica</SelectItem>
                          <SelectItem value="Elétrica">Elétrica</SelectItem>
                          <SelectItem value="Hidráulica">Hidráulica</SelectItem>
                          <SelectItem value="Pneus">Pneus</SelectItem>
                          <SelectItem value="Manutenção">Manutenção</SelectItem>
                          <SelectItem value="Outras">Outras</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="descricao_problema"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição do Problema <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Descreva detalhadamente o problema encontrado"
                          className="min-h-[120px] bg-white"
                          {...field}
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="space-y-2">
                  <Label>Fotos das Avarias (opcional)</Label>
                  <ImageUpload
                    onFilesSelected={handlePhotoUpload}
                    maxFiles={4}
                    existingImages={existingPhotoUrls}
                    isLoading={isLoading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Você pode enviar até 4 imagens. Formatos aceitos: JPG, PNG. Tamanho máximo: 5MB por imagem.
                  </p>
                </div>
                
                <div className="flex justify-between pt-4">
                  <Button type="button" variant="outline" onClick={handlePreviousTab} className="gap-2">
                    <ChevronLeft className="h-4 w-4" />
                    Voltar
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      "Salvar"
                    )}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default ChamadosForm;
