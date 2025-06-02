import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Plus, Calculator } from "lucide-react";
import { RegistroAplicacaoDetalhesFormValues, BordoType } from "@/types/registroAplicacaoDetalhes";
import { useToast } from "@/hooks/use-toast";
import { useLogradourosRequisicao } from "@/hooks/registro-aplicacao/useLogradourosRequisicao";

interface NovaAplicacaoFormProps {
  onSave: (aplicacao: RegistroAplicacaoDetalhesFormValues) => Promise<void>;
  editingAplicacao?: RegistroAplicacaoDetalhesFormValues | null;
  onCancelEdit: () => void;
  massaRemanescente: number;
  proximaSequencia: number;
  isLoading?: boolean;
  requisicaoId?: string;
}

const NovaAplicacaoForm: React.FC<NovaAplicacaoFormProps> = ({
  onSave,
  editingAplicacao,
  onCancelEdit,
  massaRemanescente,
  proximaSequencia,
  isLoading = false,
  requisicaoId
}) => {
  const { toast } = useToast();
  const { logradouros, isLoading: loadingLogradouros } = useLogradourosRequisicao(requisicaoId);
  
  const [formData, setFormData] = useState<RegistroAplicacaoDetalhesFormValues>({
    logradouro_nome: "",
    area_aplicada: 0,
    tonelada_aplicada: 0,
    espessura_aplicada: 0,
    comprimento: 0,
    largura_media: 0,
    bordo: undefined,
    temperatura_aplicacao: undefined,
    condicoes_climaticas: "",
    densidade_compactacao: undefined,
    numero_passadas: undefined,
    equipamento_compactacao: "",
    observacoes_aplicacao: "",
    hora_inicio_aplicacao: "",
    hora_fim_aplicacao: "",
    estaca_inicial: undefined,
    estaca_final: undefined,
  });

  const [calcularComMassaTotal, setCalcularComMassaTotal] = useState(false);

  // Carregar dados para edição
  useEffect(() => {
    if (editingAplicacao) {
      setFormData(editingAplicacao);
    } else {
      // Reset form
      setFormData({
        logradouro_nome: "",
        area_aplicada: 0,
        tonelada_aplicada: 0,
        espessura_aplicada: 0,
        comprimento: 0,
        largura_media: 0,
        bordo: undefined,
        temperatura_aplicacao: undefined,
        condicoes_climaticas: "",
        densidade_compactacao: undefined,
        numero_passadas: undefined,
        equipamento_compactacao: "",
        observacoes_aplicacao: "",
        hora_inicio_aplicacao: "",
        hora_fim_aplicacao: "",
        estaca_inicial: undefined,
        estaca_final: undefined,
      });
    }
  }, [editingAplicacao]);

  // Cálculo da área
  const calculatedArea = formData.comprimento && formData.largura_media 
    ? formData.comprimento * formData.largura_media 
    : 0;

  // Cálculo da tonelada padrão (área × 0.05 × 2.4)
  const toneladaPadrao = calculatedArea > 0 
    ? calculatedArea * 0.05 * 2.4
    : 0;

  // CORREÇÃO: Tonelada aplicada real limitada pela massa remanescente
  const toneladaAplicadaReal = calculatedArea > 0 
    ? Math.min(toneladaPadrao, massaRemanescente)
    : 0;

  // CORREÇÃO: Cálculo da espessura baseado na lógica do checkbox
  const calculatedEspessura = calculatedArea > 0 
    ? (calcularComMassaTotal 
        ? massaRemanescente / calculatedArea / 2.4  // Usar toda a massa remanescente
        : toneladaAplicadaReal / calculatedArea / 2.4  // Usar tonelada aplicada real limitada
      )
    : 0;

  // Verificar se a espessura está dentro do padrão (0.035 a 0.05)
  const espessuraStatus = calculatedEspessura > 0 
    ? (calculatedEspessura >= 0.035 && calculatedEspessura <= 0.05 ? 'success' : 'warning')
    : null;

  const getEspessuraStatusText = () => {
    if (!espessuraStatus) return "";
    return espessuraStatus === 'success' ? "Dentro do Padrão" : "Fora do Padrão";
  };

  const getEspessuraStatusColor = () => {
    if (!espessuraStatus) return "";
    return espessuraStatus === 'success' ? "text-green-600" : "text-orange-600";
  };

  // Verificar se há limitação por massa remanescente
  const temLimitacaoMassa = toneladaPadrao > massaRemanescente;

  // CORREÇÃO: Nova massa remanescente considerando a massa que será aplicada
  const massaQueSeraAplicada = calcularComMassaTotal ? massaRemanescente : toneladaAplicadaReal;
  const novaMassaRemanescente = Math.max(0, massaRemanescente - massaQueSeraAplicada);

  // Atualizar campos calculados
  useEffect(() => {
    if (calculatedArea !== formData.area_aplicada) {
      setFormData(prev => ({ ...prev, area_aplicada: calculatedArea }));
    }
  }, [calculatedArea]);

  useEffect(() => {
    const massaParaAplicar = calcularComMassaTotal ? massaRemanescente : toneladaAplicadaReal;
    if (massaParaAplicar !== formData.tonelada_aplicada) {
      setFormData(prev => ({ ...prev, tonelada_aplicada: massaParaAplicar }));
    }
  }, [toneladaAplicadaReal, massaRemanescente, calcularComMassaTotal]);

  useEffect(() => {
    if (calculatedEspessura !== formData.espessura_aplicada) {
      setFormData(prev => ({ ...prev, espessura_aplicada: calculatedEspessura }));
    }
  }, [calculatedEspessura]);

  const handleInputChange = (field: keyof RegistroAplicacaoDetalhesFormValues, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLogradouroSelect = (logradouroId: string) => {
    const selectedLogradouro = logradouros.find(l => l.id === logradouroId);
    if (selectedLogradouro) {
      setFormData(prev => ({
        ...prev,
        logradouro_nome: selectedLogradouro.logradouro,
        // Pre-popular dimensões se disponíveis
        comprimento: selectedLogradouro.comprimento || prev.comprimento,
        largura_media: selectedLogradouro.largura || prev.largura_media,
      }));
    }
  };

  const handleCalcularComMassaTotalChange = (checked: boolean | "indeterminate") => {
    // Convert CheckedState to boolean
    setCalcularComMassaTotal(checked === true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação rigorosa de massa remanescente
    if (massaRemanescente <= 0) {
      toast({
        title: "Erro",
        description: "Não há massa remanescente disponível para aplicação",
        variant: "destructive",
      });
      return;
    }
    
    // Validações básicas
    if (!formData.logradouro_nome.trim()) {
      toast({
        title: "Erro",
        description: "Nome do logradouro é obrigatório",
        variant: "destructive",
      });
      return;
    }

    if (formData.area_aplicada <= 0) {
      toast({
        title: "Erro",
        description: "Área deve ser maior que zero",
        variant: "destructive",
      });
      return;
    }

    if (formData.tonelada_aplicada <= 0) {
      toast({
        title: "Erro",
        description: "Tonelada aplicada deve ser maior que zero",
        variant: "destructive",
      });
      return;
    }

    if (formData.tonelada_aplicada > massaRemanescente) {
      toast({
        title: "Erro",
        description: "Tonelada aplicada não pode exceder a massa remanescente",
        variant: "destructive",
      });
      return;
    }

    try {
      await onSave(formData);
      
      // Reset form se não estiver editando
      if (!editingAplicacao) {
        setFormData({
          logradouro_nome: "",
          area_aplicada: 0,
          tonelada_aplicada: 0,
          espessura_aplicada: 0,
          comprimento: 0,
          largura_media: 0,
          bordo: undefined,
          temperatura_aplicacao: undefined,
          condicoes_climaticas: "",
          densidade_compactacao: undefined,
          numero_passadas: undefined,
          equipamento_compactacao: "",
          observacoes_aplicacao: "",
          hora_inicio_aplicacao: "",
          hora_fim_aplicacao: "",
          estaca_inicial: undefined,
          estaca_final: undefined,
        });
        setCalcularComMassaTotal(false);
      }
    } catch (error) {
      console.error("Erro ao salvar aplicação:", error);
    }
  };

  const logradouroOptions = logradouros.map(l => ({
    value: l.id,
    label: l.logradouro
  }));

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          {editingAplicacao ? (
            <>
              <Calculator className="h-5 w-5" />
              Editar Aplicação de Rua
            </>
          ) : (
            <>
              <Plus className="h-5 w-5" />
              Nova Aplicação de Rua
            </>
          )}
        </CardTitle>
        <div className="text-sm text-gray-600 space-y-1">
          <div>Massa remanescente: <span className="font-medium text-orange-600">{massaRemanescente.toFixed(2)}t</span></div>
          {novaMassaRemanescente > 0 && (
            <div>Nova massa remanescente: <span className="font-medium text-blue-600">{novaMassaRemanescente.toFixed(2)}t</span></div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Linha 1: Logradouro e Estacas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="logradouro">Logradouro *</Label>
              <Combobox
                options={logradouros.map(l => ({
                  value: l.id,
                  label: l.logradouro
                }))}
                value={logradouros.find(l => l.logradouro === formData.logradouro_nome)?.id || ""}
                onChange={(logradouroId) => {
                  const selectedLogradouro = logradouros.find(l => l.id === logradouroId);
                  if (selectedLogradouro) {
                    setFormData(prev => ({
                      ...prev,
                      logradouro_nome: selectedLogradouro.logradouro,
                      comprimento: selectedLogradouro.comprimento || prev.comprimento,
                      largura_media: selectedLogradouro.largura || prev.largura_media,
                    }));
                  }
                }}
                placeholder="Selecione uma rua"
                emptyText="Nenhuma rua encontrada"
                disabled={loadingLogradouros}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="estaca_inicial">Estaca Inicial</Label>
              <Input
                id="estaca_inicial"
                type="number"
                step="0.01"
                value={formData.estaca_inicial || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, estaca_inicial: parseFloat(e.target.value) || undefined }))}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="estaca_final">Estaca Final</Label>
              <Input
                id="estaca_final"
                type="number"
                step="0.01"
                value={formData.estaca_final || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, estaca_final: parseFloat(e.target.value) || undefined }))}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Linha 2: Bordo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bordo">Bordo</Label>
              <Select 
                value={formData.bordo || ""} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, bordo: value as BordoType }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o bordo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Direito">Direito</SelectItem>
                  <SelectItem value="Esquerdo">Esquerdo</SelectItem>
                  <SelectItem value="Centro">Centro</SelectItem>
                  <SelectItem value="Único">Único</SelectItem>
                  <SelectItem value="Embocadura">Embocadura</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Linha 3: Dimensões */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="comprimento">Comprimento (m) *</Label>
              <Input
                id="comprimento"
                type="number"
                step="0.01"
                value={formData.comprimento || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, comprimento: parseFloat(e.target.value) || 0 }))}
                placeholder="0.00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="largura_media">Largura Média (m) *</Label>
              <Input
                id="largura_media"
                type="number"
                step="0.01"
                value={formData.largura_media || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, largura_media: parseFloat(e.target.value) || 0 }))}
                placeholder="0.00"
                required
              />
            </div>
          </div>

          {/* Linha 4: Cálculos */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Área Calculada (m²)</Label>
              <Input
                type="number"
                value={calculatedArea.toFixed(2)}
                readOnly
                className="bg-gray-50 font-medium"
              />
            </div>

            <div className="space-y-2">
              <Label>Tonelada Aplicada (t)</Label>
              <Input
                type="number"
                value={(calcularComMassaTotal ? massaRemanescente : toneladaAplicadaReal).toFixed(2)}
                readOnly
                className="bg-gray-50 font-medium"
              />
              {temLimitacaoMassa && !calcularComMassaTotal && (
                <div className="text-xs text-orange-600 font-medium">
                  Limitado pela massa remanescente (padrão: {toneladaPadrao.toFixed(2)}t)
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Espessura (cm)</Label>
              <Input
                type="number"
                value={(calculatedEspessura * 100).toFixed(1)}
                readOnly
                className="bg-gray-50 font-medium"
              />
              {espessuraStatus && (
                <div className={`text-xs font-medium ${getEspessuraStatusColor()}`}>
                  {getEspessuraStatusText()}
                </div>
              )}
            </div>
          </div>

          {/* Linha 5: Opções de cálculo */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="calcular_massa_total"
              checked={calcularComMassaTotal}
              onCheckedChange={(checked) => setCalcularComMassaTotal(checked === true)}
            />
            <Label htmlFor="calcular_massa_total" className="text-sm">
              Calcular espessura com massa total remanescente
            </Label>
          </div>

          {/* Linha 6: Temperatura */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="temperatura_aplicacao">Temperatura de Aplicação (°C)</Label>
              <Input
                id="temperatura_aplicacao"
                type="number"
                value={formData.temperatura_aplicacao || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, temperatura_aplicacao: parseFloat(e.target.value) || undefined }))}
                placeholder="160"
              />
            </div>
          </div>

          {/* Botões de ação */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            {editingAplicacao && (
              <Button type="button" variant="outline" onClick={onCancelEdit}>
                Cancelar
              </Button>
            )}
            <Button 
              type="submit" 
              disabled={isLoading || massaRemanescente <= 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? "Salvando..." : editingAplicacao ? "Atualizar Aplicação" : "Adicionar Aplicação"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default NovaAplicacaoForm;
