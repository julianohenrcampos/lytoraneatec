import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery } from "@tanstack/react-query";
import { Veiculo, VeiculoFormData } from "@/types/veiculo";
import { useToast } from "@/hooks/use-toast";
import { uploadFile } from "@/services/storageService";
import VeiculoFormStepper from "./form/VeiculoFormStepper";
import { supabase } from "@/integrations/supabase/client";
import { getCentrosCustoAtivosDropdown } from "@/services/veiculo/dropdownsRelacional";
import { usePermission } from "@/hooks/usePermission";

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

// Rodada 2A.3 — Validação aceita QUALQUER identificador válido:
// (frota_id + numero_frota) OU placa OU chassi OU numero_serie.
const formSchema = z.object({
  frota: z.string().optional().nullable(),
  frota_id: z.string().optional().nullable(),
  fabricante_id: z.string().optional().nullable(),
  modelo_id: z.string().optional().nullable(),
  modelo: z.string().trim().max(120).optional().nullable(),
  numero_frota: z.string().optional().nullable(),
  departamento_id: z.string().optional().nullable(),
  empresa_id: z.string().optional().nullable(),
  empresa_locadora_id: z.string().optional().nullable(),
  proprietario_key: z.string().min(1, { message: "Selecione o proprietário" }),
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
  capacidade_valor: z.coerce.number().optional().nullable(),
  capacidade_unidade: z.string().optional().nullable(),
  aluguel: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
  imagem_url: z.string().optional().nullable(),
  numero_serie: z.string().optional().nullable(),
  chassi: z.string().optional().nullable(),
  informacoes_complementares: z.string().optional().nullable(),
  linha_operacional_id: z.string().optional().nullable(),
  centro_custo_atual_id: z.string().optional().nullable(),
}).superRefine((data, ctx) => {
  const hasFrotaPar =
    !!(data.frota_id && data.frota_id !== "_none" && data.frota_id.trim()) &&
    !!(data.numero_frota && data.numero_frota.trim());
  const hasPlaca = !!(data.placa && data.placa.trim());
  const hasChassi = !!(data.chassi && data.chassi.trim());
  const hasSerie = !!(data.numero_serie && data.numero_serie.trim());
  if (!hasFrotaPar && !hasPlaca && !hasChassi && !hasSerie) {
    const msg = "Informe Frota + Número da Frota, Placa, Chassi ou Nº de Série.";
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["frota_id"], message: msg });
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["numero_frota"], message: msg });
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["placa"], message: msg });
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["chassi"], message: msg });
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["numero_serie"], message: msg });
  }
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

  const mode: 'create' | 'edit' = veiculo ? 'edit' : 'create';

  const { hasActionPermission } = usePermission();
  const canEditCentroCusto = hasActionPermission('gestao_maquinas_caminhoes_view', 'editar');

  const { data: centrosCustoAtivos } = useQuery({
    queryKey: ["centros-custo-ativos-dropdown"],
    queryFn: getCentrosCustoAtivosDropdown,
    enabled: isOpen && (mode === 'create' || canEditCentroCusto),
    staleTime: 5 * 60 * 1000,
  });
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      frota: "",
      frota_id: "",
      fabricante_id: "_none",
      modelo_id: "_none",
      modelo: "",
      numero_frota: "",
      departamento_id: "_none",
      empresa_id: "",
      empresa_locadora_id: "",
      proprietario_key: "",
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
      capacidade_valor: undefined,
      capacidade_unidade: "",
      aluguel: "",
      observacoes: "",
      imagem_url: null,
      numero_serie: "",
      chassi: "",
      informacoes_complementares: "",
      linha_operacional_id: "_none",
    }
  });

  useEffect(() => {
    if (veiculo) {
      form.reset({
        frota: veiculo.frota_codigo || veiculo.frota || "",
        frota_id: (veiculo as any).frota_id || "",
        fabricante_id: (veiculo as any).fabricante_id || "_none",
        modelo_id: (veiculo as any).modelo_id || "_none",
        modelo: (veiculo as any).modelo ?? (veiculo as any).modelo_nome ?? "",
        numero_frota: veiculo.numero_frota || "",
        departamento_id: veiculo.departamento_id || "_none",
        empresa_id: veiculo.empresa_id || "",
        empresa_locadora_id: (veiculo as any).empresa_locadora_id || "",
        proprietario_key: (veiculo as any).empresa_locadora_id
          ? `locadora:${(veiculo as any).empresa_locadora_id}`
          : veiculo.empresa_id
          ? `empresa:${veiculo.empresa_id}`
          : "",
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
        capacidade_valor: (veiculo as any).capacidade_valor ?? undefined,
        capacidade_unidade: (veiculo as any).capacidade_unidade || "",
        aluguel: veiculo.aluguel || "",
        observacoes: veiculo.observacoes || "",
        imagem_url: veiculo.imagem_url || null,
        numero_serie: veiculo.numero_serie || "",
        chassi: veiculo.chassi || "",
        informacoes_complementares: veiculo.informacoes_complementares || "",
        linha_operacional_id: (veiculo as any).linha_operacional_id || "_none",
        centro_custo_atual_id: (veiculo as any).centro_custo_atual_id || "_none",
      });
    } else {
      form.reset({
        frota: "",
        frota_id: "",
        fabricante_id: "_none",
        modelo_id: "_none",
        modelo: "",
        numero_frota: "",
        departamento_id: "_none",
        empresa_id: "",
        empresa_locadora_id: "",
        proprietario_key: "",
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
        capacidade_valor: undefined,
        capacidade_unidade: "",
        aluguel: "",
        observacoes: "",
        imagem_url: null,
        numero_serie: "",
        chassi: "",
        informacoes_complementares: "",
        linha_operacional_id: "_none",
        centro_custo_atual_id: "_none",
      });
    }
    setSelectedImage(null);
  }, [veiculo, form, isOpen]);

  const handleSelectedImage = (file: File) => setSelectedImage(file);
  const handleImageRemove = () => {
    setSelectedImage(null);
    form.setValue("imagem_url", null, { shouldDirty: true });
  };

  const onInvalid = (errors: FieldErrors) => {
    const firstKey = Object.keys(errors)[0];
    const firstMsg = (errors[firstKey] as any)?.message || "Verifique os campos destacados.";
    toast({
      title: "Não foi possível salvar",
      description: String(firstMsg),
      variant: "destructive",
    });
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setIsSubmitting(true);

      let imageUrl = values.imagem_url;
      if (selectedImage) {
        try {
          imageUrl = await uploadFile(selectedImage, "veiculos");
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
      const fabricanteRelId = values.fabricante_id === "_none" ? null : values.fabricante_id;
      const modeloRelId = values.modelo_id === "_none" ? null : (values.modelo_id || null);
      const linhaId = values.linha_operacional_id === "_none" ? null : values.linha_operacional_id;
      const propKey = (values as any).proprietario_key as string | undefined;
      const [propOrigem, propId] = (propKey || "").split(":");
      const empresaId = propOrigem === "empresa" && propId ? propId : null;
      const empresaLocadoraId = propOrigem === "locadora" && propId ? propId : null;
      const frotaIdVal = values.frota_id === "_none" ? null : (values.frota_id || null);
      const frotaSigla = values.frota?.toUpperCase() || null;
      
      let tipoFrota: string | null = null;
      if (frotaIdVal) {
        const { data: frotaRecord } = await supabase
          .from("bd_frotas")
          .select("tipo_propriedade_padrao")
          .eq("id", frotaIdVal)
          .single();
        tipoFrota = frotaRecord?.tipo_propriedade_padrao || null;
      }
      
      const proprietarioTipo = tipoFrota === "PROPRIO" ? "proprio" 
        : tipoFrota === "GRUPO" ? "grupo" 
        : tipoFrota === "LOCADO" ? "locado" : "proprio";
      
      const formData: VeiculoFormData = {
        frota: frotaSigla,
        numero_frota: values.numero_frota,
        departamento_id: departamentoId,
        empresa_id: empresaId,
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
        capacidade: values.capacidade_valor 
          ? `${values.capacidade_valor}${values.capacidade_unidade ? ` ${values.capacidade_unidade}` : ""}` 
          : (values.capacidade || null),
        capacidade_valor: values.capacidade_valor || null,
        capacidade_unidade: values.capacidade_unidade || null,
        aluguel: values.aluguel,
        observacoes: values.observacoes,
        imagem_url: imageUrl,
        numero_serie: values.numero_serie || null,
        chassi: values.chassi || null,
        informacoes_complementares: values.informacoes_complementares || null,
        proprietario_tipo: proprietarioTipo,
        tipo_ativo: proprietarioTipo,
        empresa_locadora_id: empresaLocadoraId,
        frota_id: frotaIdVal,
        fabricante_id: fabricanteRelId,
        modelo_id: modeloRelId,
        modelo: (values.modelo ?? "").trim() || null,
        linha_operacional_id: linhaId,
        tipo_equipamento_id: null,
      } as any;

      if (mode === 'create') {
        const ccInicial = values.centro_custo_atual_id === "_none"
          ? null
          : (values.centro_custo_atual_id || null);
        (formData as any).centro_custo_atual_id = ccInicial;
      }

      await onSave(veiculo?.id, formData);

      // Edição manual de Centro de Custo — só executada quando o valor mudou e
      // o usuário tem permissão. A RPC valida escopo + prioridade de origem.
      if (mode === 'edit' && veiculo?.id && canEditCentroCusto) {
        const ccAtual = (veiculo as any).centro_custo_atual_id ?? null;
        const ccNovoRaw = values.centro_custo_atual_id === "_none" ? null : (values.centro_custo_atual_id || null);
        if ((ccAtual ?? null) !== (ccNovoRaw ?? null)) {
          const { data: rpcResp, error: rpcErr } = await (supabase.rpc as any)('fn_equipamento_definir_cc_manual', {
            p_equipamento_id: veiculo.id,
            p_centro_custo_id: ccNovoRaw,
          });
          if (rpcErr) {
            toast({
              title: 'Centro de Custo não alterado',
              description: rpcErr.message || 'Falha ao alterar o Centro de Custo.',
              variant: 'destructive',
            });
          } else if (rpcResp && rpcResp.aplicado === false) {
            toast({
              title: 'Centro de Custo não aplicado',
              description: rpcResp.mensagem || 'A operação foi rejeitada pela regra de prioridade de origem.',
              variant: 'destructive',
            });
          }
        }
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Erro ao salvar veículo:", error);
      toast({
        title: "Erro ao salvar",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao salvar os dados do veículo.",
        variant: "destructive",
      });
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
            Informe pelo menos um identificador: Frota + Número, Placa, Chassi ou Nº de Série.
          </DialogDescription>
        </DialogHeader>
        
        <VeiculoFormStepper
          form={form}
          onSubmit={onSubmit}
          onInvalid={onInvalid}
          isSubmitting={isSubmitting}
          onClose={onClose}
          currentImage={veiculo?.imagem_url || null}
          onImageChange={handleSelectedImage}
          onImageRemove={handleImageRemove}
          departamentos={departamentos || []}
          empresas={empresas || []}
          categorias={categorias || []}
          mode={mode}
          centrosCustoAtivos={centrosCustoAtivos ?? []}
          canEditCentroCusto={canEditCentroCusto}
          centroCustoAtual={veiculo ? {
            nome: veiculo.centro_custo_atual_nome ?? veiculo.nome_centro_custo ?? null,
            codigo: veiculo.centro_custo_atual_codigo ?? null,
            origem: (veiculo.centro_custo_origem ?? 'SEM_ALOCACAO') as any,
            atualizadoEm: veiculo.centro_custo_atualizado_em ?? null,
          } : null}
        />
      </DialogContent>
    </Dialog>
  );
};

export default VeiculoFormModal;
