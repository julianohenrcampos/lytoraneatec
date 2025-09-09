import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Users, Clock, Lock } from "lucide-react";
import { OrdemServico, Material, MaoDeObra, Movimentacao } from "@/types/ordemServico";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { ptBR } from "date-fns/locale";
import { useOsHeaderData } from "@/hooks/useOsHeaderData";
import { useDynamicPermissions } from "@/hooks/useDynamicPermissions";
import { getCurrentBrazilianDate, formatBrazilianDateForDisplay } from "@/utils/timezoneUtils";
import { toZonedTime } from "date-fns-tz";
import { toDecimal } from "@/utils/number";

interface CompleteOsFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (osData: Partial<OrdemServico>, motivo: string) => Promise<OrdemServico | null>;
  currentOs: OrdemServico | null;
  isLoading: boolean;
  veiculosDropdown: Array<{id: string; nome_caminhao: string}>;
  funcionarios: Array<{id: string; nome_completo: string}>;
  materials: Material[];
  laborItems: MaoDeObra[];
  movements: Movimentacao[];
  onSaveMaterial: (material: Partial<Material>, osId?: string) => Promise<Material | null>;
  onDeleteMaterial: (materialId: string) => void;
  onSaveMaoDeObra: (maoDeObra: Partial<MaoDeObra>, osId?: string) => Promise<MaoDeObra | null>;
  onDeleteMaoDeObra: (maoDeObraId: string) => void;
  chamadoId?: string; // Para buscar dados do chamado quando não há OS
}

const CompleteOsForm: React.FC<CompleteOsFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  currentOs,
  isLoading,
  veiculosDropdown,
  funcionarios,
  materials,
  laborItems,
  movements,
  onSaveMaterial,
  onDeleteMaterial,
  onSaveMaoDeObra,
  onDeleteMaoDeObra,
  chamadoId
}) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    tipo_servico: "",
    descricao_servico: "",
    observacoes: "",
    status: "Aberta" as 'Aberta' | 'Em Andamento' | 'Concluída' | 'Cancelada',
    valor_servico: 0,
    caminhao_equipamento_id: "",
    mecanico_id: "",
    data_previsao: "",
    data_conclusao: "",
    // Campos adicionais do cabeçalho
    telefone_solicitante: "",
    obra_patio: "",
    setor_executante: "",
    terceirizada: false,
    tipo_manutencao: "Corretiva" as 'Corretiva' | 'Preventiva',
    horimetro_odometro_inicial: "",
    // Campos de balanceamento
    data_inicio_atendimento: "",
    hora_inicio_atendimento: "",
    data_encerramento_atendimento: "",
    hora_encerramento_atendimento: "",
    horimetro_odometro_final: "",
    executado_por_id: "",
    encerrado_por_id: "",
    // Campo de tratativa
    tratativa_solucao: ""
  });
  const [motivo, setMotivo] = useState("");
  const [tempMaterials, setTempMaterials] = useState<any[]>([]);
  const [tempMaoDeObra, setTempMaoDeObra] = useState<any[]>([]);
  
  const [newMaterial, setNewMaterial] = useState({
    descricao_material: "",
    quantidade: "",
    valor_unitario: ""
  });
  const [newLabor, setNewLabor] = useState({
    funcao: "",
    quantidade: "",
    valor_unitario: ""
  });
  const [activeTab, setActiveTab] = useState("general");
  const [isSaving, setIsSaving] = useState(false);

  const { header, isLoading: headerLoading, error: headerError } = useOsHeaderData(currentOs, chamadoId);
  const { isSuperAdmin } = useDynamicPermissions();

  const getCurrentBrazilianTime = (): string => {
    const now = new Date();
    const brazilianTime = toZonedTime(now, 'America/Sao_Paulo');
    return format(brazilianTime, 'HH:mm');
  };

  // Determina o estado atual da OS de forma mais refinada
  const getOsState = () => {
    if (!currentOs?.id) {
      return 'new';
    }
    
    const hasStartDateTime = formData.data_inicio_atendimento && formData.hora_inicio_atendimento;
    const hasEndDateTime = formData.data_encerramento_atendimento && formData.hora_encerramento_atendimento;
    
    if (!hasStartDateTime) {
      return 'existing-first-time';
    }
    
    if (hasStartDateTime && !hasEndDateTime) {
      return 'started';
    }
    
    return 'completed';
  };

  const osState = getOsState();
  
  const getButtonText = () => {
    if (isSaving) return "Salvando...";
    
    // Se a OS já está concluída, mostrar estado bloqueado
    if (currentOs?.status === 'Concluída') {
      return "Concluída";
    }
    
    switch (osState) {
      case 'new':
        return "Salvar";
      case 'existing-first-time':
        return "Iniciar Atendimento";
      case 'started':
        return "Salvar Entrega";
      case 'completed':
        return "Salvar";
      default:
        return "Salvar";
    }
  };

  const isDateTimeFieldEditable = (fieldType: 'start' | 'end') => {
    if (isSuperAdmin) return true;
    
    if (fieldType === 'start') {
      if (!currentOs?.id) return true;
      return !formData.data_inicio_atendimento || !formData.hora_inicio_atendimento;
    } else {
      return false;
    }
  };

  useEffect(() => {
    if (currentOs) {
      setFormData({
        tipo_servico: currentOs.tipo_servico || "",
        descricao_servico: currentOs.descricao_servico || "",
        observacoes: currentOs.observacoes || "",
        status: currentOs.status || "Aberta",
        valor_servico: currentOs.valor_servico || 0,
        caminhao_equipamento_id: currentOs.caminhao_equipamento_id || "",
        mecanico_id: currentOs.mecanico_id || "",
        data_previsao: currentOs.data_previsao || "",
        data_conclusao: currentOs.data_conclusao || "",
        // Campos adicionais
        telefone_solicitante: currentOs.telefone_solicitante || "",
        obra_patio: currentOs.obra_patio || "",
        setor_executante: currentOs.setor_executante || "",
        terceirizada: currentOs.terceirizada || false,
        tipo_manutencao: currentOs.tipo_manutencao || "Corretiva",
        horimetro_odometro_inicial: currentOs.horimetro_odometro_inicial || "",
        data_inicio_atendimento: currentOs.data_inicio_atendimento || "",
        hora_inicio_atendimento: currentOs.hora_inicio_atendimento || "",
        data_encerramento_atendimento: currentOs.data_encerramento_atendimento || "",
        hora_encerramento_atendimento: currentOs.hora_encerramento_atendimento || "",
        horimetro_odometro_final: currentOs.horimetro_odometro_final || "",
        executado_por_id: currentOs.executado_por_id || "",
        encerrado_por_id: currentOs.encerrado_por_id || "",
        tratativa_solucao: currentOs.tratativa_solucao || ""
      });
    } else {
      setFormData({
        tipo_servico: "",
        descricao_servico: "",
        observacoes: "",
        status: "Aberta",
        valor_servico: 0,
        caminhao_equipamento_id: "",
        mecanico_id: "",
        data_previsao: "",
        data_conclusao: "",
        telefone_solicitante: "",
        obra_patio: "",
        setor_executante: "",
        terceirizada: false,
        tipo_manutencao: "Corretiva",
        horimetro_odometro_inicial: "",
        data_inicio_atendimento: "",
        hora_inicio_atendimento: "",
        data_encerramento_atendimento: "",
        hora_encerramento_atendimento: "",
        horimetro_odometro_final: "",
        executado_por_id: "",
        encerrado_por_id: "",
        tratativa_solucao: ""
      });
    }
  }, [currentOs]);

  useEffect(() => {
    if (!currentOs) return;
    setFormData(prev => ({
      ...prev,
      horimetro_odometro_inicial: prev.horimetro_odometro_inicial || header.horimetroInicial || "",
      obra_patio: prev.obra_patio || header.centroCustoLabel || ""
    }));
  }, [header.horimetroInicial, header.centroCustoLabel, currentOs?.id]);

  const handleSubmit = async () => {
    console.log('🚀🚀🚀 [COMPLETE-OS-FORM] === INÍCIO DO SUBMIT ===');
    console.log('🚀 [COMPLETE-OS-FORM] FormData original:', JSON.stringify(formData, null, 2));
    console.log('🚀 [COMPLETE-OS-FORM] CurrentOs:', currentOs?.id, currentOs?.numero_os);
    console.log('🚀 [COMPLETE-OS-FORM] onSubmit function:', typeof onSubmit);
    console.log('🚀 [COMPLETE-OS-FORM] isSaving:', isSaving);
    
    if (!currentOs || !currentOs.id) {
      console.log('🚀❌ [COMPLETE-OS-FORM] ERRO: currentOs não encontrado');
      toast({
        title: "Erro",
        description: "Não foi possível identificar a OS para edição. Tente reabrir o formulário.",
        variant: "destructive"
      });
      return;
    }
    
    if (!onSubmit || isSaving) {
      console.log('🚀❌ [COMPLETE-OS-FORM] ERRO: onSubmit não encontrado ou já salvando');
      return;
    }
    
    setIsSaving(true);
    
    try {
      const updatedFormData = { ...formData };
      
      // Auto-preencher data/hora se necessário
      if (!updatedFormData.data_inicio_atendimento || !updatedFormData.hora_inicio_atendimento) {
        const currentDate = getCurrentBrazilianDate();
        const currentTime = getCurrentBrazilianTime();
        updatedFormData.data_inicio_atendimento = currentDate;
        updatedFormData.hora_inicio_atendimento = currentTime;
      }
      
      if (osState === 'started') {
        const currentDate = getCurrentBrazilianDate();
        const currentTime = getCurrentBrazilianTime();
        updatedFormData.data_encerramento_atendimento = currentDate;
        updatedFormData.hora_encerramento_atendimento = currentTime;
      }
      
      // Determinar status e encerrado_por_id
      let newStatus = updatedFormData.status;
      let encerradoPorId = updatedFormData.encerrado_por_id;
      
      if (osState === 'existing-first-time') {
        newStatus = 'Em Andamento';
      } else if (osState === 'started') {
        newStatus = 'Concluída';
        // Ao encerrar, preencher encerrado_por_id com usuário logado se não foi definido
        if (!encerradoPorId) {
          // O encerrado_por_id será preenchido no service com o usuário atual
          encerradoPorId = 'AUTO_FILL'; // Flag para indicar auto-preenchimento
        }
      }

      // Limpar dados
      const cleanedData = {
        ...updatedFormData,
        numero_os: currentOs?.numero_os,
        status: newStatus,
        mecanico_id: updatedFormData.mecanico_id?.trim() || null,
        executado_por_id: updatedFormData.executado_por_id?.trim() || null,
        encerrado_por_id: encerradoPorId === 'AUTO_FILL' ? 'AUTO_FILL' : (encerradoPorId?.trim() || null),
        caminhao_equipamento_id: updatedFormData.caminhao_equipamento_id?.trim() || null,
        valor_servico: updatedFormData.valor_servico && String(updatedFormData.valor_servico) !== '0' ? Number(updatedFormData.valor_servico) : null,
        terceirizada: Boolean(updatedFormData.terceirizada),
        tipo_servico: updatedFormData.tipo_servico?.trim() || null,
        tipo_manutencao: (updatedFormData.tipo_manutencao?.trim() || null) as 'Corretiva' | 'Preventiva' | null,
        setor_executante: updatedFormData.setor_executante?.trim() || null,
        obra_patio: updatedFormData.obra_patio?.trim() || null,
        telefone_solicitante: updatedFormData.telefone_solicitante?.trim() || null,
        horimetro_odometro_inicial: updatedFormData.horimetro_odometro_inicial?.trim() || null,
        horimetro_odometro_final: updatedFormData.horimetro_odometro_final?.trim() || null,
        tratativa_solucao: updatedFormData.tratativa_solucao?.trim() || null,
        descricao_servico: updatedFormData.descricao_servico?.trim() || null,
        observacoes: updatedFormData.observacoes?.trim() || null
      };
      
      console.log('🚀 [COMPLETE-OS-FORM] Dados limpos para envio:', JSON.stringify(cleanedData, null, 2));
      console.log('🚀 [COMPLETE-OS-FORM] Chamando onSubmit...');
      
      const result = await onSubmit(cleanedData, motivo);
      
      console.log('🚀 [COMPLETE-OS-FORM] Resultado do onSubmit:', result);
      if (result?.id) {
        if (tempMaterials.length > 0) {
          await Promise.all(
            tempMaterials.map(material => onSaveMaterial(material, result.id))
          );
          setTempMaterials([]);
        }
        
        if (tempMaoDeObra.length > 0) {
          await Promise.all(
            tempMaoDeObra.map(labor => onSaveMaoDeObra(labor, result.id))
          );
          setTempMaoDeObra([]);
        }
        
        if (!currentOs) {
          onClose();
        }
      }
    } catch (error) {
      console.error('🚀❌ [COMPLETE-OS-FORM] ERRO NO SUBMIT:', error);
      console.error('🚀❌ [COMPLETE-OS-FORM] Stack trace:', error instanceof Error ? error.stack : 'N/A');
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro desconhecido ao salvar OS",
        variant: "destructive"
      });
    } finally {
      console.log('🚀 [COMPLETE-OS-FORM] === FIM DO SUBMIT ===');
      setIsSaving(false);
    }
  };

  // Função removida - agora handleSubmit faz tudo determinísticamente

  const handleAddMaterial = () => {
    const quantidade = toDecimal(newMaterial.quantidade);
    const valorUnitario = toDecimal(newMaterial.valor_unitario);
    
    if (!newMaterial.descricao_material.trim() || quantidade <= 0 || valorUnitario <= 0) {
      return;
    }

    if (currentOs?.id) {
      // Material para OS existente
      const material = {
        descricao_material: newMaterial.descricao_material,
        quantidade,
        valor_unitario: valorUnitario,
        os_id: currentOs.id,
        valor_total: quantidade * valorUnitario
      };
      onSaveMaterial(material);
    } else {
      // Material temporário para nova OS
      const tempMaterial = {
        id: `temp-${Date.now()}`,
        descricao_material: newMaterial.descricao_material,
        quantidade,
        valor_unitario: valorUnitario,
        valor_total: quantidade * valorUnitario
      };
      setTempMaterials(prev => [...prev, tempMaterial]);
    }

    setNewMaterial({
      descricao_material: "",
      quantidade: "",
      valor_unitario: ""
    });
  };

  // Função removida - agora handleSubmit faz tudo determinísticamente

  const handleAddLabor = () => {
    const quantidade = toDecimal(newLabor.quantidade);
    const valorUnitario = toDecimal(newLabor.valor_unitario);
    
    if (!newLabor.funcao.trim() || quantidade <= 0 || valorUnitario <= 0) {
      return;
    }

    if (currentOs?.id) {
      // Labor para OS existente
      const labor = {
        funcao: newLabor.funcao,
        quantidade,
        valor_unitario: valorUnitario,
        os_id: currentOs.id,
        valor_total: quantidade * valorUnitario
      };
      onSaveMaoDeObra(labor);
    } else {
      // Labor temporário para nova OS
      const tempLabor = {
        id: `temp-${Date.now()}`,
        funcao: newLabor.funcao,
        quantidade,
        valor_unitario: valorUnitario,
        valor_total: quantidade * valorUnitario
      };
      setTempMaoDeObra(prev => [...prev, tempLabor]);
    }

    setNewLabor({
      funcao: "",
      quantidade: "",
      valor_unitario: ""
    });
  };

  const allMaterials = [...materials, ...tempMaterials];
  const allLaborItems = [...laborItems, ...tempMaoDeObra];

  const calculateTotalMaterials = () => {
    return allMaterials.reduce((total, material) => total + (material.valor_total || 0), 0);
  };

  const calculateTotalLabor = () => {
    return allLaborItems.reduce((total, labor) => total + (labor.valor_total || 0), 0);
  };

  const calculateGrandTotal = () => {
    return calculateTotalMaterials() + calculateTotalLabor() + (formData.valor_servico || 0);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {currentOs ? `Editar OS ${currentOs.numero_os}` : "Nova Ordem de Serviço"}
          </DialogTitle>
          {!currentOs && (
            <div className="text-sm text-muted-foreground">
              Todos os campos são opcionais. Preencha apenas as informações disponíveis.
            </div>
          )}
        </DialogHeader>

        {/* Cabeçalho Visual da OS - Condicional */}
        {isOpen && activeTab !== "materials" && activeTab !== "labor" && (
          <Card className="mb-6 border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
            <CardContent className="p-4">
              <div className="space-y-3">
                {/* Linha 1 - Identificação */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-bold text-foreground">
                      {currentOs || header.osNumero ? (
                        <>
                          OS Nº {header.osNumero || currentOs?.numero_os || header.chamadoNumero}
                          {header.chamadoNumero && header.chamadoNumero !== (header.osNumero || currentOs?.numero_os) && (
                            <span className="text-base text-muted-foreground ml-2">
                              / Chamado Nº {header.chamadoNumero}
                            </span>
                          )}
                        </>
                      ) : (
                        "Nova Ordem de Serviço"
                      )}
                    </h3>
                    {currentOs && (
                      <Badge variant={currentOs.status === 'Aberta' ? 'secondary' : 
                                     currentOs.status === 'Em Andamento' ? 'default' :
                                     currentOs.status === 'Concluída' ? 'outline' : 'destructive'}>
                        {currentOs.status}
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {currentOs ? (
                      header.dataSolicitacao && header.horaSolicitacao ? (
                        <span>Abertura: {formatBrazilianDateForDisplay(header.dataSolicitacao)} às {header.horaSolicitacao.slice(0, 5)}</span>
                      ) : (
                        <span>Abertura: {formatBrazilianDateForDisplay(currentOs.data_abertura)}</span>
                      )
                    ) : (
                      <span>Data: {formatBrazilianDateForDisplay(getCurrentBrazilianDate())}</span>
                    )}
                  </div>
                </div>

                {/* Linha 2 - Solicitante */}
                <div className="flex items-center gap-6">
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Nome do Solicitante:</span>
                    <span className="ml-2 text-sm text-foreground font-medium">
                      {header.solicitanteNome || "—"}
                    </span>
                  </div>
                  <div>
                    <Label htmlFor="telefone-solicitante" className="text-sm font-medium text-muted-foreground">Telefone do Solicitante:</Label>
                    <Input
                      id="telefone-solicitante"
                      name="telefone_solicitante"
                      type="text"
                      value={formData.telefone_solicitante || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, telefone_solicitante: e.target.value }))}
                      className="ml-2 inline-flex w-32 h-7 text-sm"
                      placeholder="(00) 0000-0000"
                    />
                  </div>
                </div>

                {/* Linha 3 - Equipamento */}
                <div className="grid grid-cols-3 gap-6 text-sm">
                  <div>
                    <span className="font-medium text-muted-foreground">Tipo de equipamento:</span>
                    <div className="text-foreground font-medium">
                      {header.equipamentoTipo || (currentOs ? "—" : "A selecionar")}
                    </div>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">Placa:</span>
                    <div className="text-foreground font-medium">
                      {header.equipamentoPlaca || (currentOs ? "—" : "A selecionar")}
                    </div>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">Frota:</span>
                    <div className="text-foreground font-medium">
                      {header.equipamentoFrota || (currentOs ? "—" : "A selecionar")}
                    </div>
                  </div>
                </div>

                {/* Linha 4 - Informações Operacionais */}
                <div className="grid grid-cols-3 gap-6 text-sm">
                  <div>
                    <span className="font-medium text-muted-foreground">Centro de Custo:</span>
                    <div className="text-foreground font-medium">
                      {header.centroCustoCodigo || (currentOs ? "—" : "A definir")}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="setor-executante" className="font-medium text-muted-foreground">Setor Executante:</Label>
                    <Input
                      id="setor-executante"
                      name="setor_executante"
                      type="text"
                      value={formData.setor_executante || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, setor_executante: e.target.value }))}
                      className="h-7 text-sm"
                      placeholder="Digite o setor"
                    />
                  </div>
                  <div>
                    <Label htmlFor="tipo-manutencao" className="font-medium text-muted-foreground">Tipo de Manutenção:</Label>
                    <Select 
                      value={formData.tipo_manutencao || "Corretiva"} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, tipo_manutencao: value as 'Corretiva' | 'Preventiva' }))}
                    >
                      <SelectTrigger id="tipo-manutencao" name="tipo_manutencao" className="h-7 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Corretiva">Corretiva</SelectItem>
                        <SelectItem value="Preventiva">Preventiva</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Linha 5 - Dados Técnicos */}
                <div className="grid grid-cols-2 gap-6 text-sm">
                  <div>
                    <span className="font-medium text-muted-foreground">Horímetro/Odômetro Inicial:</span>
                    <div className="text-foreground font-medium text-blue-600">
                      {header.horimetroInicial || formData.horimetro_odometro_inicial || "Automático/Opcional"}
                      {header.horimetroInicial && (
                        <span className="ml-2 text-xs text-green-600">(Auto-preenchido)</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">Data de abertura do chamado:</span>
                    <div className="text-foreground font-medium flex items-center gap-2">
                      <Lock className="h-3 w-3 text-muted-foreground" />
                      {currentOs ? (
                        header.dataSolicitacao && header.horaSolicitacao ? (
                          `${formatBrazilianDateForDisplay(header.dataSolicitacao)} às ${header.horaSolicitacao.slice(0, 5)}`
                        ) : (
                          formatBrazilianDateForDisplay(currentOs.data_abertura)
                        )
                      ) : (
                        `${formatBrazilianDateForDisplay(getCurrentBrazilianDate())} ${getCurrentBrazilianTime()}`
                      )}
                      <span className="text-xs text-muted-foreground">(Não editável)</span>
                    </div>
                  </div>
                </div>

                {/* Descrição original do problema */}
                {header.descricaoProblema && (
                  <div className="border-t pt-3">
                    <span className="font-medium text-muted-foreground text-sm">Descrição do Problema:</span>
                    <div className="text-sm text-foreground mt-1 bg-background/50 p-2 rounded border">
                      {header.descricaoProblema}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="general">Dados Gerais</TabsTrigger>
            <TabsTrigger value="tratativa">Tratativa</TabsTrigger>
            <TabsTrigger value="materials">Materiais</TabsTrigger>
            <TabsTrigger value="labor">Mão de Obra</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-auto">
            <TabsContent value="general" className="space-y-6 mt-4">

                {/* Seção Classificação */}
                <Card>
                  <CardHeader>
                    <CardTitle>Classificação do Serviço</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                         <Label htmlFor="tipo_servico">Tipo de Serviço</Label>
                         <Input
                           id="tipo_servico"
                           name="tipo_servico"
                           value={formData.tipo_servico || ""}
                           onChange={(e) => setFormData(prev => ({ ...prev, tipo_servico: e.target.value }))}
                           placeholder="Digite o tipo de serviço"
                         />
                      </div>
                      <div>
                         <Label htmlFor="mecanico_id">Mecânico Responsável</Label>
                         <Select
                           value={formData.mecanico_id || ""}
                           onValueChange={(value) => setFormData(prev => ({ ...prev, mecanico_id: value }))}
                         >
                           <SelectTrigger id="mecanico_id" name="mecanico_id">
                             <SelectValue placeholder="Selecione o mecânico" />
                           </SelectTrigger>
                          <SelectContent>
                            {funcionarios.map((funcionario) => (
                              <SelectItem key={funcionario.id} value={funcionario.id}>
                                {funcionario.nome_completo}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                         <Label htmlFor="obra_patio" className="flex items-center gap-2">
                           Oficina/Local de Serviço <span className="text-red-500">*</span>
                         </Label>
                         <Input
                           id="obra_patio"
                           name="obra_patio"
                           value={formData.obra_patio || ""}
                           onChange={(e) => setFormData(prev => ({ ...prev, obra_patio: e.target.value }))}
                           placeholder="Digite onde será realizada a manutenção"
                           required
                           className="focus:ring-2 focus:ring-blue-500"
                         />
                         <p className="text-xs text-muted-foreground mt-1">
                           Campo obrigatório: identifica onde a manutenção está sendo realizada
                         </p>
                      </div>
                      <div>
                         <Label htmlFor="terceirizada">Terceirizada</Label>
                         <Select
                           value={formData.terceirizada ? "true" : "false"}
                           onValueChange={(value) => setFormData(prev => ({ ...prev, terceirizada: value === "true" }))}
                         >
                           <SelectTrigger id="terceirizada" name="terceirizada">
                             <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="false">Não</SelectItem>
                             <SelectItem value="true">Sim</SelectItem>
                           </SelectContent>
                         </Select>
                       </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Seção Balanceamento do Serviço */}
                <Card>
                  <CardHeader>
                    <CardTitle>Balanceamento do Serviço</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Alerta informativo sobre auto-preenchimento */}
                    {osState === 'new' && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                        <div className="flex items-center gap-2 text-sm text-blue-800">
                          <Clock className="h-4 w-4" />
                          <span>A data e hora de início serão preenchidas automaticamente ao salvar se deixadas em branco.</span>
                        </div>
                      </div>
                    )}
                    
                    {osState === 'started' && (
                      <div className="p-3 bg-orange-50 border border-orange-200 rounded-md">
                        <div className="flex items-center gap-2 text-sm text-orange-800">
                          <Clock className="h-4 w-4" />
                          <span>A data e hora de encerramento serão preenchidas automaticamente ao clicar "Salvar Entrega".</span>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="data_inicio_atendimento" className="flex items-center gap-2">
                          Data Início Atendimento
                          {!isDateTimeFieldEditable('start') && !isSuperAdmin && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>Auto</span>
                            </div>
                          )}
                          {!isDateTimeFieldEditable('start') && (
                            <Lock className="h-3 w-3 text-muted-foreground" />
                          )}
                        </Label>
                           <Input
                            id="data_inicio_atendimento"
                            name="data_inicio_atendimento"
                            type="date"
                            value={formData.data_inicio_atendimento}
                            onChange={(e) => setFormData(prev => ({ ...prev, data_inicio_atendimento: e.target.value }))}
                            disabled={!isDateTimeFieldEditable('start')}
                            className={!isDateTimeFieldEditable('start') ? "bg-muted" : ""}
                          />
                      </div>
                      <div>
                        <Label htmlFor="hora_inicio_atendimento" className="flex items-center gap-2">
                          Hora Início
                          {!isDateTimeFieldEditable('start') && !isSuperAdmin && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>Auto</span>
                            </div>
                          )}
                          {!isDateTimeFieldEditable('start') && (
                            <Lock className="h-3 w-3 text-muted-foreground" />
                          )}
                        </Label>
                           <Input
                            id="hora_inicio_atendimento"
                            name="hora_inicio_atendimento"
                            type="time"
                            value={formData.hora_inicio_atendimento}
                            onChange={(e) => setFormData(prev => ({ ...prev, hora_inicio_atendimento: e.target.value }))}
                           disabled={!isDateTimeFieldEditable('start')}
                           className={!isDateTimeFieldEditable('start') ? "bg-muted" : ""}
                         />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="data_encerramento_atendimento" className="flex items-center gap-2">
                          Data Encerramento
                          {!isDateTimeFieldEditable('end') && !isSuperAdmin && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>Auto</span>
                            </div>
                          )}
                          {!isDateTimeFieldEditable('end') && (
                            <Lock className="h-3 w-3 text-muted-foreground" />
                          )}
                        </Label>
                        <Input
                          id="data_encerramento_atendimento"
                          name="data_encerramento_atendimento"
                          type="date"
                          value={formData.data_encerramento_atendimento}
                          onChange={(e) => setFormData(prev => ({ ...prev, data_encerramento_atendimento: e.target.value }))}
                          disabled={!isDateTimeFieldEditable('end')}
                          className={!isDateTimeFieldEditable('end') ? "bg-muted" : ""}
                        />
                      </div>
                      <div>
                        <Label htmlFor="hora_encerramento_atendimento" className="flex items-center gap-2">
                          Hora Encerramento
                          {!isDateTimeFieldEditable('end') && !isSuperAdmin && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>Auto</span>
                            </div>
                          )}
                          {!isDateTimeFieldEditable('end') && (
                            <Lock className="h-3 w-3 text-muted-foreground" />
                          )}
                        </Label>
                        <Input
                          id="hora_encerramento_atendimento"
                          name="hora_encerramento_atendimento"
                          type="time"
                          value={formData.hora_encerramento_atendimento}
                          onChange={(e) => setFormData(prev => ({ ...prev, hora_encerramento_atendimento: e.target.value }))}
                          disabled={!isDateTimeFieldEditable('end')}
                          className={!isDateTimeFieldEditable('end') ? "bg-muted" : ""}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="horimetro_odometro_final">Horímetro/Odômetro Final</Label>
                        <Input
                          id="horimetro_odometro_final"
                          name="horimetro_odometro_final"
                          value={formData.horimetro_odometro_final}
                          onChange={(e) => setFormData(prev => ({ ...prev, horimetro_odometro_final: e.target.value }))}
                          placeholder="0000"
                        />
                      </div>
                      <div>
                        <Label htmlFor="executado_por_id">Executado Por</Label>
                        <Select
                          value={formData.executado_por_id}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, executado_por_id: value }))}
                        >
                          <SelectTrigger id="executado_por_id" name="executado_por_id">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {funcionarios.map((funcionario) => (
                              <SelectItem key={funcionario.id} value={funcionario.id}>
                                {funcionario.nome_completo}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="encerrado_por_id">Encerrado Por</Label>
                        <Select
                          value={formData.encerrado_por_id}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, encerrado_por_id: value }))}
                        >
                          <SelectTrigger id="encerrado_por_id" name="encerrado_por_id">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {funcionarios.map((funcionario) => (
                              <SelectItem key={funcionario.id} value={funcionario.id}>
                                {funcionario.nome_completo}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Seção Financeira */}
                <Card>
                  <CardHeader>
                    <CardTitle>Informações Financeiras</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Resumo Financeiro Simplificado */}
                    <div className="bg-muted p-4 rounded-lg">
                      <h4 className="font-semibold mb-2">Resumo Financeiro</h4>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Materiais:</span>
                          <p className="font-medium">R$ {calculateTotalMaterials().toFixed(2)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Mão de Obra:</span>
                          <p className="font-medium">R$ {calculateTotalLabor().toFixed(2)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Total Geral:</span>
                          <p className="font-semibold text-lg">R$ {calculateGrandTotal().toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

              </TabsContent>

            <TabsContent value="tratativa" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Tratativa / Solução Encontrada</CardTitle>
                </CardHeader>
                <CardContent>
                  <div>
                   <Label htmlFor="tratativa_solucao">Solução Aplicada</Label>
                    <Textarea
                      id="tratativa_solucao"
                      name="tratativa_solucao"
                      value={formData.tratativa_solucao || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, tratativa_solucao: e.target.value }))}
                      placeholder="Descreva a solução aplicada, procedimentos realizados e tratativas adotadas"
                      rows={8}
                      className="min-h-[200px]"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="materials" className="space-y-4 mt-4">
               <Card>
                 <CardHeader className="flex flex-row items-center justify-between">
                   <div>
                     <CardTitle>Adicionar Material</CardTitle>
                     {!isSuperAdmin && currentOs && formData.status !== 'Aberta' && (
                       <CardDescription className="text-orange-600">
                         ⚠️ Edição de valores de materiais restrita a SuperAdmins para OS não abertas
                       </CardDescription>
                     )}
                   </div>
                     {tempMaterials.length > 0 && (
                       <p className="text-sm text-muted-foreground">
                         {tempMaterials.length} material(is) aguardando salvamento
                       </p>
                     )}
                 </CardHeader>
                 <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor="material_descricao">Nome/Descrição do Material</Label>
                   <Input
                     id="material_descricao"
                     name="material_descricao"
                     placeholder="Digite a descrição do material"
                     value={newMaterial.descricao_material || ""}
                     onChange={(e) => setNewMaterial(prev => ({ ...prev, descricao_material: e.target.value }))}
                     required
                   />
                    </div>
                     <div>
                       <Label htmlFor="material_quantidade">Quantidade</Label>
                        <Input
                          id="material_quantidade"
                          name="material_quantidade"
                          type="number"
                          min="0.01"
                          step="0.01"
                          placeholder="Ex: 1.5"
                          value={newMaterial.quantidade || ""}
                          onChange={(e) => setNewMaterial(prev => ({ ...prev, quantidade: e.target.value }))}
                          required
                        />
                     </div>
                     <div>
                       <Label htmlFor="material_valor">Valor Unitário (R$)</Label>
                        <Input
                          id="material_valor"
                          name="material_valor"
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0,00"
                          value={newMaterial.valor_unitario || ""}
                           onChange={(e) => setNewMaterial(prev => ({ ...prev, valor_unitario: e.target.value }))}
                           disabled={!isSuperAdmin && currentOs && formData.status !== 'Aberta'}
                           required
                        />
                     </div>
                     <div className="flex items-end">
                        <Button 
                          onClick={handleAddMaterial} 
                          disabled={
                            !newMaterial.descricao_material.trim() || 
                            !newMaterial.quantidade || 
                            !newMaterial.valor_unitario ||
                            (!isSuperAdmin && currentOs && formData.status !== 'Aberta')
                          }
                          className="w-full"
                        >
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar Material
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Materiais Utilizados</CardTitle>
                </CardHeader>
                 <CardContent>
                   {allMaterials.length === 0 ? (
                     <div className="text-center py-8">
                       <p className="text-muted-foreground">Nenhum material adicionado</p>
                       <p className="text-sm text-muted-foreground mt-1">Use o formulário acima para adicionar materiais</p>
                     </div>
                   ) : (
                     <div className="space-y-4">
                       <div className="rounded-md border">
                         <Table>
                           <TableHeader>
                             <TableRow>
                               <TableHead>Quantidade</TableHead>
                               <TableHead>Material</TableHead>
                               <TableHead className="text-right">Valor Unitário</TableHead>
                               <TableHead className="text-right">Valor Total</TableHead>
                               <TableHead className="w-[100px]">Ações</TableHead>
                             </TableRow>
                           </TableHeader>
                           <TableBody>
                             {allMaterials.map((material) => (
                               <TableRow key={material.id}>
                                 <TableCell className="font-medium">
                                   {material.quantidade.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                 </TableCell>
                                 <TableCell>
                                   {material.descricao_material}
                                   {material.id?.toString().startsWith('temp-') && (
                                     <Badge variant="outline" className="ml-2 text-xs">Pendente</Badge>
                                   )}
                                 </TableCell>
                                 <TableCell className="text-right">
                                   R$ {material.valor_unitario?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0,00'}
                                 </TableCell>
                                 <TableCell className="text-right font-medium">
                                   R$ {material.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0,00'}
                                 </TableCell>
                                 <TableCell>
                                   <Button
                                     variant="outline"
                                     size="sm"
                                     onClick={() => {
                                       if (material.id?.toString().startsWith('temp-')) {
                                         setTempMaterials(prev => prev.filter(m => m.id !== material.id));
                                       } else {
                                         onDeleteMaterial(material.id);
                                       }
                                     }}
                                     className="h-8 w-8 p-0"
                                     title="Remover material"
                                   >
                                     <Trash2 className="h-4 w-4" />
                                   </Button>
                                 </TableCell>
                               </TableRow>
                             ))}
                           </TableBody>
                         </Table>
                       </div>
                      
                      <div className="flex justify-end pt-4 border-t">
                        <div className="bg-muted px-4 py-2 rounded-lg">
                          <p className="font-semibold text-lg">
                            Total de Materiais: R$ {calculateTotalMaterials().toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                 </CardContent>
               </Card>
             </TabsContent>

              <TabsContent value="labor" className="space-y-4 mt-4">
                 <Card>
                   <CardHeader className="flex flex-row items-center justify-between">
                     <div>
                       <CardTitle>Mão de Obra</CardTitle>
                       <CardDescription>
                         Adicione e gerencie os itens de mão de obra utilizados
                         {!isSuperAdmin && currentOs && formData.status !== 'Aberta' && (
                           <div className="text-orange-600 mt-2">
                             ⚠️ Edição de valores de mão de obra restrita a SuperAdmins para OS não abertas
                           </div>
                         )}
                       </CardDescription>
                     </div>
                       {tempMaoDeObra.length > 0 && (
                         <p className="text-sm text-muted-foreground">
                           {tempMaoDeObra.length} item(s) aguardando salvamento
                         </p>
                       )}
                   </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Formulário para adicionar nova mão de obra */}
                     <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                       <div className="space-y-2">
                         <Label htmlFor="labor_funcao">Função/Serviço</Label>
                         <Input
                           id="labor_funcao"
                           name="labor_funcao"
                           placeholder="Ex: Soldador, Eletricista..."
                           value={newLabor.funcao || ""}
                           onChange={(e) => setNewLabor(prev => ({ ...prev, funcao: e.target.value }))}
                           required
                         />
                       </div>
                       <div className="space-y-2">
                         <Label htmlFor="labor_quantidade">Quantidade (horas)</Label>
                         <Input
                           id="labor_quantidade"
                           name="labor_quantidade"
                           type="number"
                           placeholder="0,00"
                           value={newLabor.quantidade || ""}
                           onChange={(e) => setNewLabor(prev => ({ ...prev, quantidade: e.target.value }))}
                           min="0"
                           step="0.01"
                           required
                         />
                       </div>
                       <div className="space-y-2">
                         <Label htmlFor="labor_valor">Valor Unitário (R$)</Label>
                         <Input
                           id="labor_valor"
                           name="labor_valor"
                           type="number"
                           placeholder="0,00"
                           value={newLabor.valor_unitario || ""}
                            onChange={(e) => setNewLabor(prev => ({ ...prev, valor_unitario: e.target.value }))}
                            disabled={!isSuperAdmin && currentOs && formData.status !== 'Aberta'}
                           min="0"
                           step="0.01"
                           required
                        />
                      </div>
                      <div className="flex items-end">
                         <Button
                           type="button"
                           onClick={handleAddLabor}
                           disabled={
                             !newLabor.funcao?.trim() || 
                             !newLabor.quantidade || 
                             !newLabor.valor_unitario || 
                             parseFloat(newLabor.quantidade) <= 0 || 
                             parseFloat(newLabor.valor_unitario) <= 0 ||
                             (!isSuperAdmin && currentOs && formData.status !== 'Aberta')
                           }
                           className="w-full"
                         >
                          <Plus className="h-4 w-4 mr-2" />
                          Adicionar Mão de Obra
                        </Button>
                      </div>
                    </div>

                    {/* Lista de mão de obra */}
                    {allLaborItems.length > 0 ? (
                      <div className="space-y-4">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Quantidade</TableHead>
                              <TableHead>Função/Serviço</TableHead>
                              <TableHead>Valor Unitário</TableHead>
                              <TableHead>Valor Total</TableHead>
                              <TableHead className="w-[100px]">Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {allLaborItems.map((labor) => (
                              <TableRow key={labor.id}>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {parseFloat(labor.quantidade).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} h
                                    {labor.id?.toString().startsWith('temp-') && (
                                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                                        Pendente
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="font-medium">{labor.funcao}</TableCell>
                                <TableCell>
                                  R$ {parseFloat(labor.valor_unitario).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell className="font-medium">
                                  R$ {(parseFloat(labor.quantidade) * parseFloat(labor.valor_unitario)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      if (labor.id?.toString().startsWith('temp-')) {
                                        setTempMaoDeObra(prev => prev.filter(l => l.id !== labor.id));
                                      } else {
                                        onDeleteMaoDeObra(labor.id);
                                      }
                                    }}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>

                        {/* Total de Mão de Obra */}
                        <Card className="bg-primary/5 border-primary/20">
                          <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                              <span className="text-lg font-semibold">Total Mão de Obra:</span>
                              <span className="text-2xl font-bold text-primary">
                                R$ {calculateTotalLabor().toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Nenhuma mão de obra adicionada</p>
                        <p className="text-sm">Use o formulário acima para adicionar itens de mão de obra</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Resumo Financeiro</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Materiais:</span>
                      <span>R$ {calculateTotalMaterials().toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Mão de Obra:</span>
                      <span>R$ {calculateTotalLabor().toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Valor do Serviço:</span>
                      <span>R$ {(formData.valor_servico || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg pt-2 border-t">
                      <span>Total Geral:</span>
                      <span>R$ {calculateGrandTotal().toFixed(2)}</span>
                    </div>
                  </div>
                 </CardContent>
               </Card>
             </TabsContent>

             <TabsContent value="history" className="space-y-4 mt-4">
               <Card>
                 <CardHeader>
                   <CardTitle className="flex items-center gap-2">
                     <Clock className="w-5 h-5" />
                     Histórico da OS
                   </CardTitle>
                   <CardDescription>
                     Registro das principais ações realizadas nesta ordem de serviço
                   </CardDescription>
                 </CardHeader>
                 <CardContent>
                   <div className="space-y-3">
                     {currentOs ? (
                       <>
                          <div className="flex items-start gap-3 p-3 border-l-4 border-primary bg-muted/30 rounded-r">
                            <div className="text-sm">
                              <div className="font-medium">OS Criada</div>
                              <div className="text-muted-foreground">
                                {formatBrazilianDateForDisplay(currentOs.data_abertura)}
                              </div>
                            </div>
                          </div>
                          {currentOs.data_inicio_atendimento && (
                            <div className="flex items-start gap-3 p-3 border-l-4 border-blue-500 bg-blue-50 rounded-r">
                              <div className="text-sm">
                                <div className="font-medium">Atendimento Iniciado</div>
                                <div className="text-muted-foreground">
                                  {formatBrazilianDateForDisplay(currentOs.data_inicio_atendimento as any)}
                                  {currentOs.hora_inicio_atendimento && ` às ${currentOs.hora_inicio_atendimento}`}
                                </div>
                              </div>
                            </div>
                          )}
                          {currentOs.data_encerramento_atendimento && (
                            <div className="flex items-start gap-3 p-3 border-l-4 border-green-500 bg-green-50 rounded-r">
                              <div className="text-sm">
                                <div className="font-medium">Atendimento Concluído</div>
                                <div className="text-muted-foreground">
                                  {formatBrazilianDateForDisplay(currentOs.data_encerramento_atendimento as any)}
                                  {currentOs.hora_encerramento_atendimento && ` às ${currentOs.hora_encerramento_atendimento}`}
                                </div>
                              </div>
                            </div>
                          )}
                       </>
                     ) : (
                       <div className="text-center text-muted-foreground py-6">
                         O histórico será criado após salvar a OS
                       </div>
                     )}
                   </div>
                 </CardContent>
               </Card>
             </TabsContent>
          </div>
        </Tabs>

        {/* Botões fixos no rodapé - fora das abas */}
        <DialogFooter className="px-6 py-4 border-t bg-background">
          <div className="flex justify-end space-x-2 w-full">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button 
              type="button" 
              onClick={() => {
                console.log('🔘🔘🔘 [BUTTON] Botão Salvar foi CLICADO!');
                console.log('🔘 [BUTTON] Estado atual do formulário:', JSON.stringify(formData, null, 2));
                console.log('🔘 [BUTTON] Tentando executar handleSubmit...');
                handleSubmit();
              }} 
              disabled={isSaving || currentOs?.status === 'Concluída'}
              className={`min-w-[140px] ${isSaving ? 'bg-yellow-500 hover:bg-yellow-600' : ''} ${currentOs?.status === 'Concluída' ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={currentOs?.status === 'Concluída' ? 'OS já concluída - não pode ser modificada' : ''}
            >
              {isSaving ? '💾 Salvando...' : getButtonText()}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CompleteOsForm;