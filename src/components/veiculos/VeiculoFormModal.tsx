import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Veiculo, VeiculoFormData } from "@/types/veiculo";
import { useToast } from "@/hooks/use-toast";
import { uploadFile } from "@/services/storageService";
import VeiculoFormTabs from "./form/VeiculoFormTabs";

interface VeiculoFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  veiculo?: Veiculo | null;
  onSave: (id: string | undefined, data: VeiculoFormData) => Promise<void>;
  departamentos: { id: string, nome_departamento: string }[] | undefined;
  empresas: { id: string, nome_empresa: string }[] | undefined;
  categorias?: { id: string, nome_categoria: string }[] | undefined;
}

const formSchema = z.object({
  frota: z.string().min(1, { message: "Frota é obrigatória" }),
  numero_frota: z.string().optional().nullable(),
  departamento_id: z.string().optional().nullable(),
  empresa_id: z.string().optional().nullable(),
  placa: z.string().optional().nullable(),
  categoria_ativo_id: z.string().optional().nullable(),
  subcategoria_ativo_id: z.string().optional().nullable(),
  fabricante: z.string().optional().nullable(),
  cor: z.string().optional().nullable(),
  motor: z.string().optional().nullable(),
  ano_fabricacao: z.string().optional().nullable(),
  tipo_combustivel: z.string().optional().nullable(),
  status_ipva: z.string().optional().nullable(),
  situacao: z.string().min(1, { message: "Situação é obrigatória" }),
  capacidade: z.string().optional().nullable(),
  aluguel: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
  imagem_url: z.string().optional().nullable(),
  numero_serie: z.string().optional().nullable(),
  chassi: z.string().optional().nullable(),
  informacoes_complementares: z.string().optional().nullable(),
}).refine((data) => {
  const hasPlaca = data.placa && data.placa.trim().length > 0;
  const hasSerie = data.numero_serie && data.numero_serie.trim().length > 0;
  const hasChassi = data.chassi && data.chassi.trim().length > 0;
  return hasPlaca || hasSerie || hasChassi;
}, {
  message: "Preencha pelo menos um identificador: Placa, Número de Série ou Chassi",
  path: ["placa"],
});

const VeiculoFormModal: React.FC<VeiculoFormModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  veiculo, 
  onSave,
  departamentos = [],
  empresas = [],
  categorias = []
}) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      frota: "",
      numero_frota: "",
      departamento_id: "_none",
      empresa_id: "",
      placa: "",
      categoria_ativo_id: "_none",
      subcategoria_ativo_id: "_none",
      fabricante: "",
      cor: "",
      motor: "",
      ano_fabricacao: "",
      tipo_combustivel: "",
      status_ipva: "Pendente",
      situacao: "Operando",
      capacidade: "",
      aluguel: "",
      observacoes: "",
      imagem_url: null,
      numero_serie: "",
      chassi: "",
      informacoes_complementares: "",
    }
  });

  useEffect(() => {
    if (veiculo) {
      form.reset({
        frota: veiculo.frota || "",
        numero_frota: veiculo.numero_frota || "",
        departamento_id: veiculo.departamento_id || "_none",
        empresa_id: veiculo.empresa_id || "",
        placa: veiculo.placa || "",
        categoria_ativo_id: veiculo.categoria_ativo_id || "_none",
        subcategoria_ativo_id: veiculo.subcategoria_ativo_id || "_none",
        fabricante: veiculo.fabricante || "",
        cor: veiculo.cor || "",
        motor: veiculo.motor || "",
        ano_fabricacao: veiculo.ano_fabricacao || "",
        tipo_combustivel: veiculo.tipo_combustivel || "",
        status_ipva: veiculo.status_ipva || "Pendente",
        situacao: veiculo.situacao || "Operando",
        capacidade: veiculo.capacidade || "",
        aluguel: veiculo.aluguel || "",
        observacoes: veiculo.observacoes || "",
        imagem_url: veiculo.imagem_url || null,
        numero_serie: veiculo.numero_serie || "",
        chassi: veiculo.chassi || "",
        informacoes_complementares: veiculo.informacoes_complementares || "",
      });
    } else {
      form.reset({
        frota: "",
        numero_frota: "",
        departamento_id: "_none",
        empresa_id: "",
        placa: "",
        categoria_ativo_id: "_none",
        subcategoria_ativo_id: "_none",
        fabricante: "",
        cor: "",
        motor: "",
        ano_fabricacao: "",
        tipo_combustivel: "",
        status_ipva: "Pendente",
        situacao: "Operando",
        capacidade: "",
        aluguel: "",
        observacoes: "",
        imagem_url: null,
        numero_serie: "",
        chassi: "",
        informacoes_complementares: "",
      });
      setSelectedImage(null);
    }
  }, [veiculo, form, isOpen]);

  const handleSelectedImage = (file: File) => {
    console.log("Selected image file:", file.name);
    setSelectedImage(file);
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setIsSubmitting(true);
      console.log("Form submission started, values:", values);

      let imageUrl = values.imagem_url;
      if (selectedImage) {
        console.log("Uploading vehicle image to 'veiculos' bucket...");
        try {
          imageUrl = await uploadFile(selectedImage, "veiculos");
          console.log("Image upload successful, URL:", imageUrl);
        } catch (uploadError) {
          console.error("Error uploading image:", uploadError);
          toast({
            title: "Erro no upload da imagem",
            description: "Não foi possível fazer o upload da imagem. O veículo será salvo sem a imagem.",
            variant: "destructive"
          });
        }
      }
      
      const departamentoId = values.departamento_id === "_none" ? null : values.departamento_id;
      const categoriaId = values.categoria_ativo_id === "_none" ? null : values.categoria_ativo_id;
      const subcategoriaId = values.subcategoria_ativo_id === "_none" ? null : values.subcategoria_ativo_id;
      
      const formData: VeiculoFormData = {
        frota: values.frota,
        numero_frota: values.numero_frota,
        departamento_id: departamentoId,
        empresa_id: values.empresa_id || null,
        placa: values.placa,
        categoria_ativo_id: categoriaId,
        subcategoria_ativo_id: subcategoriaId,
        fabricante: values.fabricante,
        cor: values.cor,
        motor: values.motor,
        ano_fabricacao: values.ano_fabricacao,
        tipo_combustivel: values.tipo_combustivel,
        status_ipva: values.status_ipva,
        situacao: values.situacao,
        capacidade: values.capacidade,
        aluguel: values.aluguel,
        observacoes: values.observacoes,
        imagem_url: imageUrl,
        numero_serie: values.numero_serie || null,
        chassi: values.chassi || null,
        informacoes_complementares: values.informacoes_complementares || null,
        status_cadastro: 'ativo',
        status_disponibilidade: 'disponivel',
        proprietario_tipo: 'proprio',
        tipo_ativo: (values as any).tipo_ativo || 'proprio',
        empresa_locadora_id: (values as any).empresa_locadora_id || null,
      };

      console.log("Saving vehicle with data:", formData);
      await onSave(veiculo?.id, formData);
      
      toast({
        title: veiculo ? "Veículo atualizado" : "Veículo cadastrado",
        description: `O veículo foi ${veiculo ? "atualizado" : "cadastrado"} com sucesso.`
      });
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Erro ao salvar veículo:", error);
      
      if (error instanceof Error) {
        toast({
          title: "Erro",
          description: `Ocorreu um erro ao salvar os dados: ${error.message}`,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Erro",
          description: "Ocorreu um erro ao salvar os dados do veículo.",
          variant: "destructive"
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{veiculo ? "Editar Veículo" : "Cadastrar Novo Veículo/Equipamento"}</DialogTitle>
          <DialogDescription>
            Preencha os dados do veículo ou equipamento. Campos marcados com * são obrigatórios.
            É necessário informar pelo menos um identificador: Placa, Nº de Série ou Chassi.
          </DialogDescription>
        </DialogHeader>
        
        <VeiculoFormTabs
          form={form}
          onSubmit={onSubmit}
          isSubmitting={isSubmitting}
          onClose={onClose}
          currentImage={veiculo?.imagem_url || null}
          onImageChange={handleSelectedImage}
          departamentos={departamentos || []}
          empresas={empresas || []}
          categorias={categorias || []}
        />
      </DialogContent>
    </Dialog>
  );
};

export default VeiculoFormModal;
