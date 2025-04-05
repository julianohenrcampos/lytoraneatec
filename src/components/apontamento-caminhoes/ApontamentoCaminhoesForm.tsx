import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { CalendarIcon, AlertCircle, Check, Truck } from "lucide-react";
import { ImageUpload } from "@/components/ui/image-upload";
import { formatNumber } from "@/lib/utils";
import { VehicleCombobox } from "@/components/combobox/VehicleCombobox";

const checklistSchema = z.object({
  nivel_combustivel: z.string().min(1, "Campo obrigatório"),
  nivel_oleo: z.string().min(1, "Campo obrigatório"),
  nivel_agua: z.string().min(1, "Campo obrigatório"),
  drenagem_tanque_ar: z.string().min(1, "Campo obrigatório"),
  tacografo: z.string().min(1, "Campo obrigatório"),
  sistema_eletrico: z.string().min(1, "Campo obrigatório"),
  material_rodante: z.string().min(1, "Campo obrigatório"),
  material_desgaste: z.string().min(1, "Campo obrigatório"),
  material_amarracao: z.string().min(1, "Campo obrigatório"),
  inspecao_veicular: z.string().min(1, "Campo obrigatório"),
  cinto_seguranca: z.string().min(1, "Campo obrigatório"),
  documentacao: z.string().min(1, "Campo obrigatório"),
  limpeza_interna: z.string().min(1, "Campo obrigatório"),
  estado_equipamentos: z.string().min(1, "Campo obrigatório"),
  estado_implementos: z.string().min(1, "Campo obrigatório"),
  engate_reboque: z.string().min(1, "Campo obrigatório"),
});

const apontamentoSchema = z.object({
  data: z.date(),
  caminhao_equipamento_id: z.string().min(1, "Selecione um caminhão/equipamento"),
  centro_custo_id: z.string().min(1, "Selecione um centro de custo"),
  horimetro_inicial: z.coerce.number().min(0, "Horímetro deve ser maior ou igual a zero"),
  horimetro_final: z.coerce.number().optional(),
  hora_inicial: z.string().optional(),
  hora_final: z.string().optional(),
  abastecimento: z.coerce.number().optional(),
  situacao: z.string().min(1, "Selecione a situação"),
});

const formSchema = apontamentoSchema.merge(checklistSchema.partial());

const optionItems = ["Conforme", "Não conforme", "Não se aplica"];

const editableFields = [
  "horimetro_final",
  "hora_final",
  "abastecimento",
  "situacao",
];

interface ApontamentoCaminhoesFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any, photoFiles?: File[]) => Promise<void>;
  currentApontamento: {
    apontamento: any | null;
    inspecao: any | null;
  };
  veiculosOptions: { id: string; label: string; situacao?: string }[];
  operadoresOptions: { id: string; label: string }[];
  centrosCustoOptions: { id: string; label: string }[];
  isLoading: boolean;
  currentUser: any;
  getUltimoHorimetro: (caminhaoId: string) => Promise<number | null>;
  uploadFoto: (file: File) => Promise<string>;
}

const ApontamentoCaminhoesForm: React.FC<ApontamentoCaminhoesFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  currentApontamento,
  veiculosOptions,
  operadoresOptions,
  centrosCustoOptions,
  isLoading,
  currentUser,
  getUltimoHorimetro,
  uploadFoto
}) => {
  const [activeTab, setActiveTab] = useState("operacional");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
  const [selectedVeiculo, setSelectedVeiculo] = useState<string | null>(null);
  const [equipamentoOperacional, setEquipamentoOperacional] = useState(true);
  const [ultimoHorimetroLoaded, setUltimoHorimetroLoaded] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const isEditMode = !!currentApontamento.apontamento?.id;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      data: new Date(),
      caminhao_equipamento_id: "",
      centro_custo_id: "",
      horimetro_inicial: 0,
      horimetro_final: undefined,
      hora_inicial: format(new Date(), "HH:mm"),
      hora_final: undefined,
      abastecimento: undefined,
      situacao: "Operando",
      nivel_combustivel: "Conforme",
      nivel_oleo: "Conforme",
      nivel_agua: "Conforme",
      drenagem_tanque_ar: "Conforme",
      tacografo: "Conforme",
      sistema_eletrico: "Conforme",
      material_rodante: "Conforme",
      material_desgaste: "Conforme",
      material_amarracao: "Conforme",
      inspecao_veicular: "Conforme",
      cinto_seguranca: "Conforme",
      documentacao: "Conforme",
      limpeza_interna: "Conforme",
      estado_equipamentos: "Conforme",
      estado_implementos: "Conforme",
      engate_reboque: "Conforme",
    }
  });

  useEffect(() => {
    if (currentApontamento.apontamento) {
      const apontamento = currentApontamento.apontamento;
      const inspecao = currentApontamento.inspecao;
      
      const formData: any = {
        data: apontamento.data ? new Date(apontamento.data) : new Date(),
        caminhao_equipamento_id: apontamento.caminhao_equipamento_id || "",
        centro_custo_id: apontamento.centro_custo_id || "",
        horimetro_inicial: apontamento.horimetro_inicial || 0,
        horimetro_final: apontamento.horimetro_final,
        hora_inicial: apontamento.hora_inicial || format(new Date(), "HH:mm"),
        hora_final: apontamento.hora_final,
        abastecimento: apontamento.abastecimento,
        situacao: apontamento.situacao || "Operando",
      };
      
      if (inspecao) {
        Object.keys(inspecao).forEach(key => {
          if (checklistSchema.shape[key as keyof typeof checklistSchema.shape]) {
            formData[key] = inspecao[key] || "";
          }
        });
        
        if (inspecao.fotos_avarias) {
          setPhotoPreviewUrls(inspecao.fotos_avarias);
        }
      }
      
      form.reset(formData);
      
      if (apontamento.caminhao_equipamento_id) {
        setSelectedVeiculo(apontamento.caminhao_equipamento_id);
      }
    }
  }, [currentApontamento, form]);

  useEffect(() => {
    const subscription = form.watch((values, { name }) => {
      if (name === "caminhao_equipamento_id") {
        const caminhaoId = values.caminhao_equipamento_id;
        
        if (!caminhaoId) {
          setSelectedVeiculo(null);
          return;
        }
        
        setSelectedVeiculo(caminhaoId);
        
        const veiculo = veiculosOptions.find(v => v.id === caminhaoId);
        
        const isOperational = veiculo?.situacao !== "Manutenção";
        setEquipamentoOperacional(isOperational);
        
        if (!isEditMode && !ultimoHorimetroLoaded) {
          getUltimoHorimetro(caminhaoId).then((horimetro) => {
            if (horimetro !== null) {
              form.setValue("horimetro_inicial", horimetro);
            }
            setUltimoHorimetroLoaded(true);
          });
        }
      }
    });
    
    return () => subscription.unsubscribe();
  }, [form, veiculosOptions, isEditMode, ultimoHorimetroLoaded, getUltimoHorimetro]);

  const handlePhotoUpload = (files: File[]) => {
    setPhotoFiles(files);
    const newPreviewUrls = files.map(file => URL.createObjectURL(file));
    setPhotoPreviewUrls(newPreviewUrls);
  };

  const handleFormSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!isEditMode && !checklistIsComplete() && activeTab !== "checklist") {
      setActiveTab("checklist");
      return;
    }
    
    setIsUploading(true);
    
    try {
      const formData = { ...values };
      
      let uploadedPhotoUrls: string[] = [];
      
      if (photoFiles.length > 0) {
        for (const file of photoFiles) {
          const url = await uploadFoto(file);
          uploadedPhotoUrls.push(url);
        }
      }
      
      if (currentApontamento.inspecao?.fotos_avarias && !photoFiles.length) {
        uploadedPhotoUrls = [...currentApontamento.inspecao.fotos_avarias];
      }
      
      await onSubmit({
        apontamento: {
          data: format(values.data, "yyyy-MM-dd"),
          caminhao_equipamento_id: values.caminhao_equipamento_id,
          centro_custo_id: values.centro_custo_id,
          horimetro_inicial: values.horimetro_inicial,
          horimetro_final: values.horimetro_final,
          hora_inicial: values.hora_inicial,
          hora_final: values.hora_final,
          abastecimento: values.abastecimento,
          situacao: values.situacao,
        },
        inspecao: {
          nivel_combustivel: values.nivel_combustivel,
          nivel_oleo: values.nivel_oleo,
          nivel_agua: values.nivel_agua,
          drenagem_tanque_ar: values.drenagem_tanque_ar,
          tacografo: values.tacografo,
          sistema_eletrico: values.sistema_eletrico,
          material_rodante: values.material_rodante,
          material_desgaste: values.material_desgaste,
          material_amarracao: values.material_amarracao,
          inspecao_veicular: values.inspecao_veicular,
          cinto_seguranca: values.cinto_seguranca,
          documentacao: values.documentacao,
          limpeza_interna: values.limpeza_interna,
          estado_equipamentos: values.estado_equipamentos,
          estado_implementos: values.estado_implementos,
          engate_reboque: values.engate_reboque,
          fotos_avarias: uploadedPhotoUrls
        }
      });
      
      setPhotoFiles([]);
      setPhotoPreviewUrls([]);
    } catch (error) {
      console.error("Error submitting form:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const isFieldDisabled = (fieldName: string) => {
    if (!isEditMode) return false;
    return !editableFields.includes(fieldName);
  };

  const canProceedToChecklist = () => {
    const formValues = form.getValues();
    return !!(
      formValues.caminhao_equipamento_id && 
      selectedVeiculo &&
      formValues.centro_custo_id &&
      formValues.horimetro_inicial !== undefined
    );
  };

  const checklistIsComplete = () => {
    if (isEditMode) return true;
    
    const values = form.getValues();
    const requiredFields = [
      'nivel_combustivel',
      'nivel_oleo', 
      'nivel_agua',
      'drenagem_tanque_ar',
      'tacografo',
      'sistema_eletrico',
      'material_rodante',
      'material_desgaste',
      'material_amarracao',
      'inspecao_veicular',
      'cinto_seguranca',
      'documentacao',
      'limpeza_interna',
      'estado_equipamentos',
      'estado_implementos',
      'engate_reboque'
    ];
    
    return requiredFields.every(field => !!values[field as keyof typeof values]);
  };

  const canSubmitForm = () => {
    if (isEditMode) return true;
    return canProceedToChecklist() && checklistIsComplete();
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-xl">
            {isEditMode ? "Editar Apontamento" : "Novo Apontamento"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode ? "Edite os dados do apontamento" : "Registre um novo apontamento de caminhões e equipamentos"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full grid grid-cols-2 h-auto">
                <TabsTrigger 
                  value="operacional"
                  className="py-3 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:shadow-none data-[state=active]:text-blue-700 font-medium"
                >
                  Dados Operacionais
                </TabsTrigger>
                <TabsTrigger 
                  value="checklist" 
                  disabled={isEditMode || !canProceedToChecklist() || !equipamentoOperacional}
                  className="py-3 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:shadow-none data-[state=active]:text-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Checklist
                </TabsTrigger>
              </TabsList>

              <TabsContent value="operacional" className="p-6 pt-8">
                {selectedVeiculo && !equipamentoOperacional && (
                  <Alert variant="destructive" className="mb-6">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Este equipamento está em manutenção. Verifique a situação antes de prosseguir.
                    </AlertDescription>
                  </Alert>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="data"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Data</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                                disabled={isFieldDisabled("data")}
                              >
                                {field.value ? (
                                  format(field.value, "dd/MM/yyyy", { locale: ptBR })
                                ) : (
                                  <span>Selecione a data</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={(date) => date && field.onChange(date)}
                              disabled={(date) => {
                                const now = new Date();
                                const sevenDaysAgo = new Date();
                                sevenDaysAgo.setDate(now.getDate() - 7);
                                return date > now || date < sevenDaysAgo;
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex flex-col space-y-2">
                    <FormLabel>Operador</FormLabel>
                    <Input 
                      value={currentUser?.email || "Usuário atual"} 
                      disabled 
                      className="bg-muted/50"
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="caminhao_equipamento_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Caminhão/Equipamento</FormLabel>
                        <FormControl>
                          <VehicleCombobox
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Selecione o veículo"
                            disabled={isFieldDisabled("caminhao_equipamento_id")}
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
                        <FormLabel>Centro de Custo</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={isFieldDisabled("centro_custo_id")}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o centro de custo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {centrosCustoOptions.map((centro) => (
                              <SelectItem key={centro.id} value={centro.id}>
                                {centro.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="horimetro_inicial"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Horímetro Inicial</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            placeholder="0.00" 
                            {...field} 
                            disabled={isFieldDisabled("horimetro_inicial")}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value);
                              field.onChange(isNaN(value) ? 0 : value);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="horimetro_final"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Horímetro Final</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            placeholder="0.00" 
                            value={field.value === undefined ? "" : field.value}
                            onChange={(e) => {
                              const value = e.target.value ? parseFloat(e.target.value) : undefined;
                              field.onChange(value);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="hora_inicial"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hora Inicial</FormLabel>
                        <FormControl>
                          <Input 
                            type="time"
                            {...field}
                            disabled={isFieldDisabled("hora_inicial")}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="hora_final"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hora Final</FormLabel>
                        <FormControl>
                          <Input 
                            type="time"
                            value={field.value || ""}
                            onChange={(e) => field.onChange(e.target.value)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="situacao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Situação *</FormLabel>
                        <FormControl>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                            value={field.value}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a situação" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Operando">Operando</SelectItem>
                              <SelectItem value="Em Manutenção">Em Manutenção</SelectItem>
                              <SelectItem value="Disponível">Disponível</SelectItem>
                              <SelectItem value="Intempérie">Intempérie</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="abastecimento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Abastecimento (litros)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            placeholder="0.00" 
                            value={field.value === undefined ? "" : field.value}
                            onChange={(e) => {
                              const value = e.target.value ? parseFloat(e.target.value) : undefined;
                              field.onChange(value);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="flex justify-end space-x-2 mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    disabled={isLoading || isUploading}
                  >
                    Cancelar
                  </Button>
                  
                  {isEditMode ? (
                    <Button
                      type="submit"
                      disabled={isLoading || isUploading}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {isLoading || isUploading ? (
                        <>
                          <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          Salvando...
                        </>
                      ) : (
                        "Salvar"
                      )}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => {
                        if (canProceedToChecklist()) {
                          setActiveTab("checklist");
                        }
                      }}
                      disabled={!canProceedToChecklist() || isLoading || isUploading}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Próximo
                    </Button>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="checklist" className="p-6 pt-4">
                <div className="flex items-center mb-4">
                  <div className="flex items-center space-x-2">
                    <Truck className="w-5 h-5 text-muted-foreground" />
                    <h2 className="text-lg font-medium">
                      Checklist de Inspeção - {veiculosOptions.find(v => v.id === selectedVeiculo)?.label}
                    </h2>
                  </div>
                </div>
                
                <Separator className="mb-6" />
                
                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardContent className="p-4 pt-6">
                        <h3 className="font-medium mb-4">Níveis</h3>
                        <div className="space-y-4">
                          {["nivel_combustivel", "nivel_oleo", "nivel_agua", "drenagem_tanque_ar"].map((item) => (
                            <FormField
                              key={item}
                              control={form.control}
                              name={item as any}
                              render={({ field }) => (
                                <FormItem>
                                  <div className="flex justify-between items-center">
                                    <FormLabel className="text-sm flex-1">
                                      {item === "nivel_combustivel" && "Nível de Combustível"}
                                      {item === "nivel_oleo" && "Nível de Óleo"}
                                      {item === "nivel_agua" && "Nível de Água"}
                                      {item === "drenagem_tanque_ar" && "Drenagem de Tanque de Ar"}
                                    </FormLabel>
                                    <Select
                                      onValueChange={field.onChange}
                                      value={field.value}
                                      defaultValue={field.value}
                                    >
                                      <FormControl>
                                        <SelectTrigger className="w-[150px]">
                                          <SelectValue placeholder="Selecione..." />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        {optionItems.map((option) => (
                                          <SelectItem key={option} value={option}>
                                            {option === "Conforme" && <Check className="h-4 w-4 mr-1 inline text-green-500" />}
                                            {option}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-4 pt-6">
                        <h3 className="font-medium mb-4">Equipamentos</h3>
                        <div className="space-y-4">
                          {["tacografo", "sistema_eletrico", "material_rodante", "material_desgaste"].map((item) => (
                            <FormField
                              key={item}
                              control={form.control}
                              name={item as any}
                              render={({ field }) => (
                                <FormItem>
                                  <div className="flex justify-between items-center">
                                    <FormLabel className="text-sm flex-1">
                                      {item === "tacografo" && "Tacógrafo"}
                                      {item === "sistema_eletrico" && "Sistema Elétrico"}
                                      {item === "material_rodante" && "Material Rodante"}
                                      {item === "material_desgaste" && "Material de Desgaste"}
                                    </FormLabel>
                                    <Select
                                      onValueChange={field.onChange}
                                      value={field.value}
                                      defaultValue={field.value}
                                    >
                                      <FormControl>
                                        <SelectTrigger className="w-[150px]">
                                          <SelectValue placeholder="Selecione..." />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        {optionItems.map((option) => (
                                          <SelectItem key={option} value={option}>
                                            {option === "Conforme" && <Check className="h-4 w-4 mr-1 inline text-green-500" />}
                                            {option}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-4 pt-6">
                        <h3 className="font-medium mb-4">Segurança</h3>
                        <div className="space-y-4">
                          {["material_amarracao", "inspecao_veicular", "cinto_seguranca", "documentacao"].map((item) => (
                            <FormField
                              key={item}
                              control={form.control}
                              name={item as any}
                              render={({ field }) => (
                                <FormItem>
                                  <div className="flex justify-between items-center">
                                    <FormLabel className="text-sm flex-1">
                                      {item === "material_amarracao" && "Material de Amarração"}
                                      {item === "inspecao_veicular" && "Inspeção Veicular"}
                                      {item === "cinto_seguranca" && "Cinto de Segurança"}
                                      {item === "documentacao" && "Documentação"}
                                    </FormLabel>
                                    <Select
                                      onValueChange={field.onChange}
                                      value={field.value}
                                      defaultValue={field.value}
                                    >
                                      <FormControl>
                                        <SelectTrigger className="w-[150px]">
                                          <SelectValue placeholder="Selecione..." />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        {optionItems.map((option) => (
                                          <SelectItem key={option} value={option}>
                                            {option === "Conforme" && <Check className="h-4 w-4 mr-1 inline text-green-500" />}
                                            {option}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-4 pt-6">
                        <h3 className="font-medium mb-4">Estado Geral</h3>
                        <div className="space-y-4">
                          {["limpeza_interna", "estado_equipamentos", "estado_implementos", "engate_reboque"].map((item) => (
                            <FormField
                              key={item}
                              control={form.control}
                              name={item as any}
                              render={({ field }) => (
                                <FormItem>
                                  <div className="flex justify-between items-center">
                                    <FormLabel className="text-sm flex-1">
                                      {item === "limpeza_interna" && "Limpeza Interna"}
                                      {item === "estado_equipamentos" && "Estado dos Equipamentos"}
                                      {item === "estado_implementos" && "Estado dos Implementos"}
                                      {item === "engate_reboque" && "Engate de Reboque"}
                                    </FormLabel>
                                    <Select
                                      onValueChange={field.onChange}
                                      value={field.value}
                                      defaultValue={field.value}
                                    >
                                      <FormControl>
                                        <SelectTrigger className="w-[150px]">
                                          <SelectValue placeholder="Selecione..." />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        {optionItems.map((option) => (
                                          <SelectItem key={option} value={option}>
                                            {option === "Conforme" && <Check className="h-4 w-4 mr-1 inline text-green-500" />}
                                            {option}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  
                  <Card>
                    <CardContent className="p-4 pt-6">
                      <div className="space-y-2">
                        <h3 className="font-medium">Fotos de Avarias (opcional)</h3>
                        <p className="text-sm text-muted-foreground">
                          Se houver avarias, anexe fotos para documentação.
                        </p>
                        <ImageUpload 
                          onFilesSelected={handlePhotoUpload}
                          maxFiles={4}
                          existingImages={photoPreviewUrls}
                          isLoading={isUploading}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>
                
                <DialogFooter className="flex justify-between mt-6 pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setActiveTab("operacional")}
                    disabled={isLoading || isUploading}
                  >
                    Voltar
                  </Button>
                  
                  <div className="flex space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onClose}
                      disabled={isLoading || isUploading}
                    >
                      Cancelar
                    </Button>
                    
                    <Button
                      type="submit"
                      disabled={isLoading || isUploading || !checklistIsComplete()}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {isLoading || isUploading ? (
                        <>
                          <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          Salvando...
                        </>
                      ) : (
                        "Salvar"
                      )}
                    </Button>
                  </div>
                </DialogFooter>
              </TabsContent>
            </Tabs>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default ApontamentoCaminhoesForm;
