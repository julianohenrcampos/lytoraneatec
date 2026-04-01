
import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Empresa, EmpresaFormData } from "@/types/empresa";
import { createEmpresa, updateEmpresa, checkCnpjExists } from "@/services/empresaService";
import { uploadImage } from "@/services/storageService";
import { useToast } from "@/hooks/use-toast";
import { Upload, X } from "lucide-react";
import AddressAutocomplete, { AddressResult } from "@/components/centrosCusto/AddressAutocomplete";
import { formatCPF } from "@/utils/textTransform";
import { Separator } from "@/components/ui/separator";

interface EmpresaFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  empresa?: Empresa;
}

const formSchema = z.object({
  nome_empresa: z.string().min(1, { message: "Nome da empresa é obrigatório" }),
  cnpj: z.string().min(1, { message: "CPF/CNPJ é obrigatório" }),
  telefone: z.string().optional().nullable(),
  situacao: z.enum(["Ativa", "Inativa"]),
  tipo_empresa: z.string().optional().nullable(),
  pertence_ao_grupo: z.boolean().optional(),
  fornece_equipamento: z.boolean().optional(),
  status_homologacao: z.string().optional().nullable(),
  endereco_completo: z.string().optional().nullable(),
  endereco_cep: z.string().optional().nullable(),
  endereco_cidade: z.string().optional().nullable(),
  endereco_estado: z.string().optional().nullable(),
  endereco_latitude: z.number().optional().nullable(),
  endereco_longitude: z.number().optional().nullable(),
  pessoa_tipo: z.string().default("PJ"),
  inscricao_estadual: z.string().optional().nullable(),
  inscricao_municipal: z.string().optional().nullable(),
  nome_contato: z.string().optional().nullable(),
  banco: z.string().optional().nullable(),
  agencia: z.string().optional().nullable(),
  conta: z.string().optional().nullable(),
  tipo_conta: z.string().optional().nullable(),
  pix: z.string().optional().nullable(),
});

const EmpresaFormModal: React.FC<EmpresaFormModalProps> = ({ isOpen, onClose, onSuccess, empresa }) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(null);
  const [addressValidated, setAddressValidated] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome_empresa: "",
      cnpj: "",
      telefone: "",
      situacao: "Ativa" as const,
      tipo_empresa: "PROPRIA",
      pertence_ao_grupo: false,
      fornece_equipamento: false,
      status_homologacao: "PENDENTE",
      endereco_completo: "",
      endereco_cep: "",
      endereco_cidade: "",
      endereco_estado: "",
      endereco_latitude: null,
      endereco_longitude: null,
      pessoa_tipo: "PJ",
      inscricao_estadual: "",
      inscricao_municipal: "",
      nome_contato: "",
      banco: "",
      agencia: "",
      conta: "",
      tipo_conta: "",
      pix: "",
    }
  });

  const pessoaTipo = form.watch("pessoa_tipo");
  const isPJ = pessoaTipo === "PJ";

  useEffect(() => {
    if (empresa) {
      form.reset({
        nome_empresa: empresa.nome_empresa,
        cnpj: empresa.cnpj,
        telefone: empresa.telefone || "",
        situacao: empresa.situacao,
        tipo_empresa: empresa.tipo_empresa || "PROPRIA",
        pertence_ao_grupo: empresa.pertence_ao_grupo ?? false,
        fornece_equipamento: empresa.fornece_equipamento ?? false,
        status_homologacao: empresa.status_homologacao || "PENDENTE",
        endereco_completo: empresa.endereco_completo || "",
        endereco_cep: empresa.endereco_cep || "",
        endereco_cidade: empresa.endereco_cidade || "",
        endereco_estado: empresa.endereco_estado || "",
        endereco_latitude: empresa.endereco_latitude ?? null,
        endereco_longitude: empresa.endereco_longitude ?? null,
        pessoa_tipo: empresa.pessoa_tipo || "PJ",
        inscricao_estadual: empresa.inscricao_estadual || "",
        inscricao_municipal: empresa.inscricao_municipal || "",
        nome_contato: empresa.nome_contato || "",
        banco: empresa.banco || "",
        agencia: empresa.agencia || "",
        conta: empresa.conta || "",
        tipo_conta: empresa.tipo_conta || "",
        pix: empresa.pix || "",
      });
      setCurrentLogoUrl(empresa.logo_url || null);
      setAddressValidated(!!empresa.endereco_completo);
    } else {
      form.reset({
        nome_empresa: "",
        cnpj: "",
        telefone: "",
        situacao: "Ativa",
        tipo_empresa: "PROPRIA",
        pertence_ao_grupo: false,
        fornece_equipamento: false,
        status_homologacao: "PENDENTE",
        endereco_completo: "",
        endereco_cep: "",
        endereco_cidade: "",
        endereco_estado: "",
        endereco_latitude: null,
        endereco_longitude: null,
        pessoa_tipo: "PJ",
        inscricao_estadual: "",
        inscricao_municipal: "",
        nome_contato: "",
        banco: "",
        agencia: "",
        conta: "",
        tipo_conta: "",
        pix: "",
      });
      setCurrentLogoUrl(null);
      setAddressValidated(false);
    }
    setLogoFile(null);
    setLogoPreview(null);
  }, [empresa, form, isOpen]);

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: "Arquivo inválido", description: "Selecione uma imagem PNG ou JPG.", variant: "destructive" });
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const removeLogo = () => {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoFile(null);
    setLogoPreview(null);
    setCurrentLogoUrl(null);
  };

  const formatCnpj = (value: string) => {
    const numericValue = value.replace(/\D/g, '');
    const truncated = numericValue.slice(0, 14);
    if (truncated.length <= 2) return truncated;
    else if (truncated.length <= 5) return `${truncated.slice(0, 2)}.${truncated.slice(2)}`;
    else if (truncated.length <= 8) return `${truncated.slice(0, 2)}.${truncated.slice(2, 5)}.${truncated.slice(5)}`;
    else if (truncated.length <= 12) return `${truncated.slice(0, 2)}.${truncated.slice(2, 5)}.${truncated.slice(5, 8)}/${truncated.slice(8)}`;
    else return `${truncated.slice(0, 2)}.${truncated.slice(2, 5)}.${truncated.slice(5, 8)}/${truncated.slice(8, 12)}-${truncated.slice(12, 14)}`;
  };

  const formatTelefone = (value: string) => {
    const numericValue = value.replace(/\D/g, '');
    const truncated = numericValue.slice(0, 11);
    if (truncated.length <= 2) return truncated.length ? `(${truncated}` : truncated;
    else if (truncated.length <= 6) return `(${truncated.slice(0, 2)}) ${truncated.slice(2)}`;
    else if (truncated.length <= 10) return `(${truncated.slice(0, 2)}) ${truncated.slice(2, 6)}-${truncated.slice(6)}`;
    else return `(${truncated.slice(0, 2)}) ${truncated.slice(2, 7)}-${truncated.slice(7)}`;
  };

  const handleDocumentoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = isPJ ? formatCnpj(e.target.value) : formatCPF(e.target.value);
    form.setValue("cnpj", formatted);
  };

  const handleTelefoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatTelefone(e.target.value);
    form.setValue("telefone", formatted);
  };

  const handleAddressSelected = (result: AddressResult) => {
    form.setValue("endereco_completo", result.endereco_completo);
    form.setValue("endereco_cep", result.endereco_cep || "");
    form.setValue("endereco_cidade", result.endereco_cidade || "");
    form.setValue("endereco_estado", result.endereco_estado || "");
    form.setValue("endereco_latitude", result.latitude);
    form.setValue("endereco_longitude", result.longitude);
    setAddressValidated(true);
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setIsSubmitting(true);
      
      const cnpjExists = await checkCnpjExists(values.cnpj, empresa?.id);
      if (cnpjExists) {
        form.setError("cnpj", { type: "manual", message: isPJ ? "Este CNPJ já está cadastrado" : "Este CPF já está cadastrado" });
        return;
      }

      let logoUrl = currentLogoUrl;
      if (logoFile) {
        try {
          logoUrl = await uploadImage(logoFile, 'empresas-logos');
        } catch (uploadError) {
          console.error("Erro ao fazer upload da logo:", uploadError);
          toast({ title: "Erro no upload", description: "Não foi possível enviar a logo. Os demais dados serão salvos.", variant: "destructive" });
        }
      }

      const empresaData: EmpresaFormData = {
        nome_empresa: values.nome_empresa,
        cnpj: values.cnpj,
        telefone: values.telefone || null,
        situacao: values.situacao,
        tipo_empresa: values.tipo_empresa || null,
        pertence_ao_grupo: values.tipo_empresa === "GRUPO",
        fornece_equipamento: values.tipo_empresa === "FORNECEDOR",
        status_homologacao: values.tipo_empresa === "FORNECEDOR" ? (values.status_homologacao || null) : null,
        endereco_completo: values.endereco_completo || null,
        endereco_cep: values.endereco_cep || null,
        endereco_cidade: values.endereco_cidade || null,
        endereco_estado: values.endereco_estado || null,
        endereco_latitude: values.endereco_latitude ?? null,
        endereco_longitude: values.endereco_longitude ?? null,
        logo_url: logoUrl,
        pessoa_tipo: values.pessoa_tipo,
        inscricao_estadual: isPJ ? (values.inscricao_estadual || null) : null,
        inscricao_municipal: isPJ ? (values.inscricao_municipal || null) : null,
        nome_contato: values.nome_contato || null,
        banco: values.banco || null,
        agencia: values.agencia || null,
        conta: values.conta || null,
        tipo_conta: values.tipo_conta || null,
        pix: values.pix || null,
      };

      if (empresa) {
        await updateEmpresa(empresa.id, empresaData);
        toast({ title: "Empresa atualizada", description: "Os dados da empresa foram atualizados com sucesso." });
      } else {
        await createEmpresa(empresaData);
        toast({ title: "Empresa cadastrada", description: "A empresa foi cadastrada com sucesso." });
      }
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Erro ao salvar empresa:", error);
      toast({ title: "Erro", description: "Ocorreu um erro ao salvar os dados da empresa.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayLogo = logoPreview || currentLogoUrl;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{empresa ? "Editar Empresa" : "Cadastrar Nova Empresa"}</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Logo Upload */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Logo da Empresa</label>
              <div className="flex items-center gap-4">
                {displayLogo ? (
                  <div className="relative w-[120px] h-[50px] border rounded-md overflow-hidden bg-muted flex items-center justify-center">
                    <img src={displayLogo} alt="Logo" className="max-w-full max-h-full object-contain" />
                    <button
                      type="button"
                      onClick={removeLogo}
                      className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                      disabled={isSubmitting}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-[120px] h-[50px] border border-dashed rounded-md flex items-center justify-center bg-muted/50 hover:bg-muted/80 transition-colors"
                    disabled={isSubmitting}
                  >
                    <div className="flex flex-col items-center text-muted-foreground">
                      <Upload className="h-4 w-4" />
                      <span className="text-[10px]">Upload logo</span>
                    </div>
                  </button>
                )}
                <p className="text-xs text-muted-foreground">PNG ou JPG. Será usada nos cabeçalhos dos relatórios PDF.</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={handleLogoSelect}
                disabled={isSubmitting}
              />
            </div>

            {/* Toggle PF/PJ */}
            <FormField
              control={form.control}
              name="pessoa_tipo"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <FormLabel className="mb-0 text-sm font-medium">
                    {isPJ ? "Pessoa Jurídica (PJ)" : "Pessoa Física (PF)"}
                  </FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value === "PJ"}
                      onCheckedChange={(checked) => {
                        const newType = checked ? "PJ" : "PF";
                        field.onChange(newType);
                        form.setValue("cnpj", "");
                      }}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="nome_empresa"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{isPJ ? "Nome da Empresa *" : "Nome Completo *"}</FormLabel>
                  <FormControl>
                    <Input placeholder={isPJ ? "Nome da empresa" : "Nome completo"} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="cnpj"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{isPJ ? "CNPJ *" : "CPF *"}</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder={isPJ ? "00.000.000/0001-00" : "000.000.000-00"}
                      value={field.value} 
                      onChange={(e) => {
                        field.onChange(e);
                        handleDocumentoChange(e);
                      }} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isPJ && (
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="inscricao_estadual"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Inscrição Estadual</FormLabel>
                      <FormControl>
                        <Input placeholder="Inscrição Estadual" {...field} value={field.value || ""} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="inscricao_municipal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Inscrição Municipal</FormLabel>
                      <FormControl>
                        <Input placeholder="Inscrição Municipal" {...field} value={field.value || ""} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="telefone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="(00) 00000-0000" 
                        value={field.value || ""} 
                        onChange={(e) => {
                          field.onChange(e);
                          handleTelefoneChange(e);
                        }} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nome_contato"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome para Contato</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome do contato" {...field} value={field.value || ""} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="situacao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Situação *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a situação" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Ativa">Ativa</SelectItem>
                      <SelectItem value="Inativa">Inativa</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tipo_empresa"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Empresa</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || "PROPRIA"}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="PROPRIA">Própria</SelectItem>
                      <SelectItem value="GRUPO">Grupo</SelectItem>
                      <SelectItem value="FORNECEDOR">Fornecedor</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.watch("tipo_empresa") === "FORNECEDOR" && (
              <FormField
                control={form.control}
                name="status_homologacao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status Homologação</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "PENDENTE"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="HOMOLOGADO">Homologado</SelectItem>
                        <SelectItem value="PENDENTE">Pendente</SelectItem>
                        <SelectItem value="BLOQUEADO">Bloqueado</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Endereço com geocodificação */}
            <Separator />
            <h3 className="text-sm font-semibold text-muted-foreground">Endereço</h3>

            <div className="space-y-2">
              <label className="text-sm font-medium">Buscar Endereço</label>
              <AddressAutocomplete
                value={form.getValues("endereco_completo") || ""}
                isValidated={addressValidated}
                onAddressSelected={handleAddressSelected}
                disabled={isSubmitting}
              />
            </div>


            {/* Dados Bancários */}
            <Separator />
            <h3 className="text-sm font-semibold text-muted-foreground">Dados Bancários</h3>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="banco"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Banco</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome do banco" {...field} value={field.value || ""} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="agencia"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Agência</FormLabel>
                    <FormControl>
                      <Input placeholder="Agência" {...field} value={field.value || ""} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="conta"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conta</FormLabel>
                    <FormControl>
                      <Input placeholder="Número da conta" {...field} value={field.value || ""} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tipo_conta"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Conta</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="CORRENTE">Corrente</SelectItem>
                        <SelectItem value="POUPANCA">Poupança</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="pix"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Chave PIX</FormLabel>
                  <FormControl>
                    <Input placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória" {...field} value={field.value || ""} />
                  </FormControl>
                </FormItem>
              )}
            />
            
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default EmpresaFormModal;
