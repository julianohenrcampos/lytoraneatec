import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  SSODesvioFormData, 
  TIPOS_DESVIO, 
  CLASSIFICACAO_DESVIO,
  TipoDesvio 
} from '@/types/ssoDesvios';
import { useSSODesvio } from '@/hooks/ssoDesvios/useSSODesvio';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Camera, Image as ImageIcon, X } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuthPermissions } from '@/hooks/useAuthPermissions';

interface SSODesvioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  desvioId?: string;
}

const initialFormData: SSODesvioFormData = {
  obra_id: '',
  gerente_regional: '',
  engenheiro_obra: '',
  data_registro: new Date().toISOString().split('T')[0],
  tecnico_seguranca: '',
  encarregado_mestre: '',
  tipos_desvio: [],
  tipo_outros: '',
  analise_tecnica: '',
  adequacao_imediata: '',
  responsavel_acao: '',
  prazo_correcao: '',
  status_acao: 'Aberto',
  reincidencia: false,
  classificacao_desvio: 'Leve'
};

export const SSODesvioDialog: React.FC<SSODesvioDialogProps> = ({
  open,
  onOpenChange,
  desvioId
}) => {
  const isMobile = useIsMobile();
  const { isSuperAdmin, userRole } = useAuthPermissions();
  const [formData, setFormData] = useState<SSODesvioFormData>(initialFormData);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('dados');
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { desvio, isLoading, createDesvio, updateDesvio } = useSSODesvio(desvioId);
  const isEditing = !!desvioId;
  
  // Determinar se é TecSSO (só pode usar câmera, sem galeria)
  const isTecSSO = userRole === 'TecSSO' && !isSuperAdmin;

  // Buscar obras
  const { data: obras = [] } = useQuery({
    queryKey: ['obras-ativas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bd_centros_custo')
        .select('id, nome_centro_custo, codigo_centro_custo')
        .eq('situacao', 'Ativo')
        .order('nome_centro_custo');
      if (error) throw error;
      return data || [];
    }
  });

  const obraOptions = React.useMemo(() => 
    obras.map(obra => ({
      value: obra.id,
      label: `${obra.codigo_centro_custo} - ${obra.nome_centro_custo}`
    }))
  , [obras]);

  // Auto-preencher Técnico de Segurança com usuário logado
  useEffect(() => {
    const fetchCurrentUser = async () => {
      if (!isEditing && open) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('nome_completo')
            .eq('id', user.id)
            .single();
          
          if (profile?.nome_completo) {
            setFormData(prev => ({
              ...prev,
              tecnico_seguranca: profile.nome_completo
            }));
          }
        }
      }
    };
    fetchCurrentUser();
  }, [isEditing, open]);

  // Carregar dados ao editar
  useEffect(() => {
    if (isEditing && desvio) {
      setFormData({
        obra_id: desvio.obra_id,
        gerente_regional: desvio.gerente_regional,
        engenheiro_obra: desvio.engenheiro_obra,
        data_registro: desvio.data_registro,
        tecnico_seguranca: desvio.tecnico_seguranca,
        encarregado_mestre: desvio.encarregado_mestre || '',
        tipos_desvio: desvio.tipos_desvio || [],
        tipo_outros: desvio.tipo_outros || '',
        analise_tecnica: desvio.analise_tecnica,
        adequacao_imediata: desvio.adequacao_imediata || '',
        responsavel_acao: desvio.responsavel_acao || '',
        prazo_correcao: desvio.prazo_correcao || '',
        status_acao: desvio.status_acao,
        reincidencia: desvio.reincidencia,
        classificacao_desvio: desvio.classificacao_desvio
      });
    } else if (!isEditing) {
      setFormData(prev => ({
        ...initialFormData,
        tecnico_seguranca: prev.tecnico_seguranca // Manter o técnico preenchido
      }));
      setFiles([]);
      setPreviews([]);
    }
  }, [isEditing, desvio]);

  // Reset ao fechar
  useEffect(() => {
    if (!open) {
      setActiveTab('dados');
      if (!isEditing) {
        setFormData(initialFormData);
        setFiles([]);
        setPreviews([]);
      }
    }
  }, [open, isEditing]);

  // Auto-resize do textarea de análise técnica
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [formData.analise_tecnica]);

  const handleChange = (field: keyof SSODesvioFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleTipoDesvioChange = (tipo: TipoDesvio, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      tipos_desvio: checked 
        ? [...prev.tipos_desvio, tipo]
        : prev.tipos_desvio.filter(t => t !== tipo)
    }));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const validFiles = selectedFiles.filter(file => {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} não é uma imagem válida`);
        return false;
      }
      if (file.size > 15 * 1024 * 1024) {
        toast.error(`${file.name} excede o limite de 15MB`);
        return false;
      }
      return true;
    });

    setFiles(prev => [...prev, ...validFiles]);
    
    // Gerar previews
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  // Validação dos campos obrigatórios para habilitar aba Detalhamento
  const isDadosCompletos = formData.obra_id && 
                            formData.gerente_regional && 
                            formData.engenheiro_obra;

  const handleTabChange = (value: string) => {
    if (value === 'detalhamento' && !isDadosCompletos) {
      toast.warning('Preencha Obra, Gerente Regional e Engenheiro antes de acessar o Detalhamento');
      return;
    }
    setActiveTab(value);
  };

  const validateForm = (): boolean => {
    if (!formData.obra_id) {
      toast.error('Selecione a obra');
      setActiveTab('dados');
      return false;
    }
    if (!formData.gerente_regional) {
      toast.error('Informe a gerência regional');
      setActiveTab('dados');
      return false;
    }
    if (!formData.engenheiro_obra) {
      toast.error('Informe o engenheiro da obra');
      setActiveTab('dados');
      return false;
    }
    if (!formData.tecnico_seguranca) {
      toast.error('Informe o técnico de segurança');
      setActiveTab('dados');
      return false;
    }
    if (formData.tipos_desvio.length === 0) {
      toast.error('Selecione pelo menos um tipo de desvio');
      setActiveTab('dados');
      return false;
    }
    if (formData.tipos_desvio.includes('Outros') && !formData.tipo_outros) {
      toast.error('Descreva o tipo de desvio "Outros"');
      setActiveTab('dados');
      return false;
    }
    if (!formData.analise_tecnica) {
      toast.error('A análise técnica é obrigatória');
      setActiveTab('detalhamento');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      if (isEditing) {
        await updateDesvio({
          id: desvioId!,
          data: formData,
          newFiles: files
        });
      } else {
        await createDesvio({
          formData,
          files
        });
      }
      onOpenChange(false);
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditing && isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Carregando registro...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] sm:max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>
            {isEditing ? 'Editar Registro de Desvio' : 'Novo Registro de Desvio'}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
            <TabsTrigger value="dados">Dados Operacionais</TabsTrigger>
            <TabsTrigger 
              value="detalhamento"
              disabled={!isDadosCompletos}
              className="disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Detalhamento
            </TabsTrigger>
          </TabsList>

          {!isDadosCompletos && activeTab === 'dados' && (
            <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-3 mt-2 flex-shrink-0">
              <span className="font-medium">Atenção:</span> Preencha a Obra, Gerente Regional e Engenheiro da Obra para acessar o Detalhamento
            </div>
          )}

          {/* Tab 1: Dados Operacionais */}
          <TabsContent value="dados" className="mt-4 flex-1 overflow-y-auto pb-4 space-y-6">
            {/* Seção: Identificação */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data do Registro *</Label>
                  <Input
                    type="date"
                    value={formData.data_registro}
                    onChange={(e) => handleChange('data_registro', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Obra *</Label>
                  <Combobox
                    options={obraOptions}
                    value={formData.obra_id}
                    onChange={(value) => handleChange('obra_id', value)}
                    placeholder="Buscar obra..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Gerência Regional *</Label>
                  <Input
                    value={formData.gerente_regional}
                    onChange={(e) => handleChange('gerente_regional', e.target.value)}
                    placeholder="Nome da gerência regional"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Engenheiro da Obra *</Label>
                  <Input
                    value={formData.engenheiro_obra}
                    onChange={(e) => handleChange('engenheiro_obra', e.target.value)}
                    placeholder="Nome do engenheiro"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Técnico de Segurança *</Label>
                  <Input
                    value={formData.tecnico_seguranca}
                    readOnly
                    className="bg-muted"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Encarregado / Mestre</Label>
                  <Input
                    value={formData.encarregado_mestre}
                    onChange={(e) => handleChange('encarregado_mestre', e.target.value)}
                    placeholder="Nome do encarregado"
                  />
                </div>
              </div>
            </div>

            {/* Seção: Tipos de Desvio */}
            <Card className="p-4">
              <h3 className="font-medium mb-4">Tipo(s) de Desvio *</h3>
              <div className="space-y-3">
                {TIPOS_DESVIO.map((tipo) => (
                  <div key={tipo} className="flex items-center space-x-3">
                    <Checkbox
                      id={tipo}
                      checked={formData.tipos_desvio.includes(tipo)}
                      onCheckedChange={(checked) => handleTipoDesvioChange(tipo, !!checked)}
                    />
                    <Label htmlFor={tipo} className="cursor-pointer">{tipo}</Label>
                  </div>
                ))}
              </div>

              {formData.tipos_desvio.includes('Outros') && (
                <div className="mt-4 space-y-2">
                  <Label>Descreva o tipo de desvio *</Label>
                  <Textarea
                    value={formData.tipo_outros}
                    onChange={(e) => handleChange('tipo_outros', e.target.value)}
                    placeholder="Descreva o tipo de desvio..."
                  />
                </div>
              )}
            </Card>

            {/* Seção: Classificação */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Classificação do Desvio *</Label>
                <Select 
                  value={formData.classificacao_desvio} 
                  onValueChange={(value) => handleChange('classificacao_desvio', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLASSIFICACAO_DESVIO.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-3 pt-8">
                <Checkbox
                  id="reincidencia"
                  checked={formData.reincidencia}
                  onCheckedChange={(checked) => handleChange('reincidencia', !!checked)}
                />
                <Label htmlFor="reincidencia" className="cursor-pointer">
                  Reincidência?
                </Label>
              </div>
            </div>
          </TabsContent>

          {/* Tab 2: Detalhamento */}
          <TabsContent value="detalhamento" className="mt-4 flex-1 overflow-y-auto pb-4 space-y-6">
            {/* Análise Técnica */}
            <div className="space-y-2">
              <Label>Análise Técnica *</Label>
              <Textarea
                ref={textareaRef}
                value={formData.analise_tecnica}
                onChange={(e) => handleChange('analise_tecnica', e.target.value)}
                placeholder="Descreva a análise técnica detalhada do desvio identificado..."
                className="min-h-[120px] resize-none overflow-hidden"
              />
            </div>

            {/* Ações Corretivas */}
            <Card className="p-4 space-y-4">
              <h3 className="font-medium">Ações Corretivas</h3>
              
              <div className="space-y-2">
                <Label>Adequação Imediata Adotada</Label>
                <Textarea
                  value={formData.adequacao_imediata}
                  onChange={(e) => handleChange('adequacao_imediata', e.target.value)}
                  placeholder="Descreva a ação imediata adotada..."
                  rows={3}
                />
              </div>
            </Card>

            {/* Fotos */}
            <Card className="p-4">
              <h3 className="font-medium mb-4">Registro Fotográfico</h3>
              
              <div className="flex gap-2 mb-4">
                <label className="cursor-pointer">
                  <Button variant="outline" asChild>
                    <span>
                      <Camera className="h-4 w-4 mr-2" />
                      Tirar Foto
                    </span>
                  </Button>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </label>

                {!isTecSSO && (
                  <label className="cursor-pointer">
                    <Button variant="outline" asChild>
                      <span>
                        <ImageIcon className="h-4 w-4 mr-2" />
                        Galeria
                      </span>
                    </Button>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                  </label>
                )}
              </div>

              {previews.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {previews.map((preview, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={preview}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeFile(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhuma foto adicionada. Fotos são recomendadas para desvios graves ou críticos.
                </p>
              )}
            </Card>

            {/* Footer - Apenas na aba Detalhamento */}
            <div className="flex justify-end gap-2 pt-4 mt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Atualizar' : 'Salvar'}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
