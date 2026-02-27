import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Combobox } from '@/components/ui/combobox';
import { useVerAgir } from '@/hooks/ssoVerAgir';
import { useAuthPermissions } from '@/hooks/useAuthPermissions';
import { VerAgirFormData } from '@/types/ssoVerAgir';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Save, X, Upload, Trash2, Loader2, FileDown } from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import { VerAgirPDFDocument } from '../pdf';

interface VerAgirDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registroId?: string;
}

export const VerAgirDialog: React.FC<VerAgirDialogProps> = ({
  open,
  onOpenChange,
  registroId
}) => {
  const isEditing = !!registroId;
  const { registro, createRegistro, updateRegistro, setStatus, isCreating, isUpdating, isChangingStatus, getSignedUrl, centrosCusto, isLoadingCentrosCusto } = useVerAgir(registroId);
  const { isSuperAdmin, userRole, userId } = useAuthPermissions();
  const canManageGestao = isSuperAdmin || userRole === 'AdmSSO' || userRole === 'AdmOBRA';

  // Opções do Combobox de Centro de Custo
  const centrosCustoOptions = useMemo(() => 
    centrosCusto.map(cc => ({
      value: cc.id,
      label: `${cc.codigo_centro_custo} - ${cc.nome_centro_custo}`
    })), 
  [centrosCusto]);

  // Form state
  const [formData, setFormData] = useState<VerAgirFormData>({
    obra: '',
    centro_custo_id: '',
    data_registro: new Date().toISOString().split('T')[0],
    hora_registro: new Date().toTimeString().slice(0, 5),
    tecnico_seguranca_id: '',
    tecnico_seguranca_nome: '',
    engenheiro_id: '',
    engenheiro_nome: '',
    descricao_nao_conformidade: '',
    resultado_alcancado_solucao: ''
  });

  // Photo state
  const [fotoAntes, setFotoAntes] = useState<File | null>(null);
  const [fotoDepois, setFotoDepois] = useState<File | null>(null);
  const [fotoAntesPreview, setFotoAntesPreview] = useState<string | null>(null);
  const [fotoDepoisPreview, setFotoDepoisPreview] = useState<string | null>(null);
  const [removerFotoAntes, setRemoverFotoAntes] = useState(false);
  const [removerFotoDepois, setRemoverFotoDepois] = useState(false);

  // PDF export state
  const [isExporting, setIsExporting] = useState(false);

  // Loading user info
  useEffect(() => {
    const loadUserInfo = async () => {
      if (!isEditing) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('nome_completo')
            .eq('id', user.id)
            .single();
          
          if (profile) {
            setFormData(prev => ({
              ...prev,
              tecnico_seguranca_nome: profile.nome_completo || ''
            }));
          }
        }
      }
    };
    
    if (open) {
      loadUserInfo();
    }
  }, [open, isEditing]);

  // Load existing data
  useEffect(() => {
    const loadRegistroData = async () => {
      if (registro && isEditing) {
        setFormData({
          obra: registro.obra || '',
          centro_custo_id: (registro as any).centro_custo_id || '',
          data_registro: registro.data_registro || '',
          hora_registro: registro.hora_registro || '',
          tecnico_seguranca_id: registro.tecnico_seguranca_id || '',
          tecnico_seguranca_nome: registro.tecnico_seguranca_nome || '',
          engenheiro_id: registro.engenheiro_id || '',
          engenheiro_nome: registro.engenheiro_nome || '',
          descricao_nao_conformidade: registro.descricao_nao_conformidade || '',
          resultado_alcancado_solucao: registro.resultado_alcancado_solucao || ''
        });

        // Load photo previews
        if (registro.foto_antes_url) {
          const url = await getSignedUrl(registro.foto_antes_url);
          setFotoAntesPreview(url);
        }
        if (registro.foto_depois_url) {
          const url = await getSignedUrl(registro.foto_depois_url);
          setFotoDepoisPreview(url);
        }
      }
    };

    loadRegistroData();
  }, [registro, isEditing, getSignedUrl]);

  // Reset form on close
  useEffect(() => {
    if (!open) {
      setFormData({
        obra: '',
        centro_custo_id: '',
        data_registro: new Date().toISOString().split('T')[0],
        hora_registro: new Date().toTimeString().slice(0, 5),
        tecnico_seguranca_id: '',
        tecnico_seguranca_nome: '',
        engenheiro_id: '',
        engenheiro_nome: '',
        descricao_nao_conformidade: '',
        resultado_alcancado_solucao: ''
      });
      setFotoAntes(null);
      setFotoDepois(null);
      setFotoAntesPreview(null);
      setFotoDepoisPreview(null);
      setRemoverFotoAntes(false);
      setRemoverFotoDepois(false);
      setIsExporting(false);
    }
  }, [open]);

  const handleFileChange = (type: 'antes' | 'depois', file: File | null) => {
    if (file) {
      const preview = URL.createObjectURL(file);
      if (type === 'antes') {
        setFotoAntes(file);
        setFotoAntesPreview(preview);
        setRemoverFotoAntes(false);
      } else {
        setFotoDepois(file);
        setFotoDepoisPreview(preview);
        setRemoverFotoDepois(false);
      }
    }
  };

  const handleRemovePhoto = (type: 'antes' | 'depois') => {
    if (type === 'antes') {
      setFotoAntes(null);
      setFotoAntesPreview(null);
      if (isEditing && registro?.foto_antes_url) {
        setRemoverFotoAntes(true);
      }
    } else {
      setFotoDepois(null);
      setFotoDepoisPreview(null);
      if (isEditing && registro?.foto_depois_url) {
        setRemoverFotoDepois(true);
      }
    }
  };

  const validateForm = (action: 'rascunho' | 'enviar' | 'concluir'): boolean => {
    const errors: string[] = [];

    // Validações básicas
    if (!formData.obra.trim()) errors.push('Obra é obrigatória');
    if (!formData.data_registro) errors.push('Data é obrigatória');
    if (!formData.hora_registro) errors.push('Hora é obrigatória');
    if (!formData.tecnico_seguranca_nome.trim()) errors.push('Técnico de Segurança é obrigatório');
    if (!formData.engenheiro_nome.trim()) errors.push('Engenheiro é obrigatório');

    if (action === 'enviar' || action === 'concluir') {
      if (!formData.descricao_nao_conformidade.trim()) {
        errors.push('Descrição da não conformidade é obrigatória');
      }
      if (!formData.resultado_alcancado_solucao.trim()) {
        errors.push('Resultado/Solução é obrigatório');
      }
    }

    if (action === 'concluir') {
      const hasFotoAntes = fotoAntes || (registro?.foto_antes_url && !removerFotoAntes);
      const hasFotoDepois = fotoDepois || (registro?.foto_depois_url && !removerFotoDepois);
      
      if (!hasFotoAntes) errors.push('Foto ANTES é obrigatória para concluir');
      if (!hasFotoDepois) errors.push('Foto DEPOIS é obrigatória para concluir');
    }

    if (errors.length > 0) {
      toast.error(errors.join('\n'));
      return false;
    }

    return true;
  };

  const handleSave = async (action: 'rascunho' | 'enviar' | 'concluir') => {
    if (!validateForm(action)) return;

    try {
      if (isEditing && registroId) {
        await updateRegistro({
          id: registroId,
          data: formData,
          fotoAntes: fotoAntes || undefined,
          fotoDepois: fotoDepois || undefined,
          removerFotoAntes,
          removerFotoDepois
        });

        // Update status if needed
        if (action === 'enviar' && registro?.status === 'RASCUNHO') {
          await setStatus({ id: registroId, status: 'ENVIADO' });
        } else if (action === 'concluir') {
          await setStatus({ id: registroId, status: 'CONCLUIDO' });
        }
      } else {
        const newRegistro = await createRegistro({
          formData,
          fotoAntes: fotoAntes || undefined,
          fotoDepois: fotoDepois || undefined
        });

        if (action === 'enviar') {
          await setStatus({ id: newRegistro.id, status: 'ENVIADO' });
        } else if (action === 'concluir') {
          await setStatus({ id: newRegistro.id, status: 'CONCLUIDO' });
        }
      }

      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao salvar:', error);
    }
  };

  // Export PDF
  const handleExportPDF = async () => {
    if (!registro) return;
    
    setIsExporting(true);
    try {
      // Get signed URLs for photos
      const photoUrls: { antes?: string; depois?: string } = {};
      
      if (registro.foto_antes_url) {
        photoUrls.antes = await getSignedUrl(registro.foto_antes_url);
      }
      if (registro.foto_depois_url) {
        photoUrls.depois = await getSignedUrl(registro.foto_depois_url);
      }
      
      // Generate PDF
      const blob = await pdf(
        <VerAgirPDFDocument registro={registro} photoUrls={photoUrls} />
      ).toBlob();
      
      // Download
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ver-agir-${registro.data_registro || 'registro'}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      
      toast.success('PDF exportado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar PDF');
    } finally {
      setIsExporting(false);
    }
  };

  const isLoading = isCreating || isUpdating || isChangingStatus;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Registro' : 'Novo Registro'} - Ver e Agir
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Seção 1 - Cabeçalho */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Identificação</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tecnico">Téc. Seg. Trabalho *</Label>
                <Input
                  id="tecnico"
                  value={formData.tecnico_seguranca_nome}
                  onChange={(e) => setFormData({ ...formData, tecnico_seguranca_nome: e.target.value })}
                  disabled={!canManageGestao && isEditing}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="engenheiro">Engenheiro(a) *</Label>
                <Input
                  id="engenheiro"
                  value={formData.engenheiro_nome}
                  onChange={(e) => setFormData({ ...formData, engenheiro_nome: e.target.value })}
                  placeholder="Nome do engenheiro"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="obra">Obra *</Label>
                <Combobox
                  options={centrosCustoOptions}
                  value={formData.centro_custo_id || ''}
                  onChange={(value) => {
                    const selected = centrosCusto.find(cc => cc.id === value);
                    setFormData({ 
                      ...formData, 
                      centro_custo_id: value,
                      obra: selected ? `${selected.codigo_centro_custo} - ${selected.nome_centro_custo}` : ''
                    });
                  }}
                  placeholder="Selecione a obra"
                  searchPlaceholder="Buscar centro de custo..."
                  emptyText="Nenhum centro de custo encontrado"
                  disabled={isLoadingCentrosCusto}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="data">Data *</Label>
                <Input
                  id="data"
                  type="date"
                  value={formData.data_registro}
                  onChange={(e) => setFormData({ ...formData, data_registro: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="hora">Hora *</Label>
                <Input
                  id="hora"
                  type="time"
                  value={formData.hora_registro}
                  onChange={(e) => setFormData({ ...formData, hora_registro: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Seção 2 - Descrição */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Descrição da Não Conformidade *</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.descricao_nao_conformidade}
                onChange={(e) => setFormData({ ...formData, descricao_nao_conformidade: e.target.value })}
                placeholder="Descreva detalhadamente a não conformidade encontrada..."
                rows={4}
              />
            </CardContent>
          </Card>

          {/* Seção 3 - Evidências */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Evidências Fotográficas</CardTitle>
              <p className="text-sm text-muted-foreground">
                Apenas 1 imagem por campo. Ao enviar outra, substitui a anterior.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Foto ANTES */}
                <div className="border rounded-lg p-4">
                  <Label className="font-medium mb-3 block">ANTES</Label>
                  {fotoAntesPreview ? (
                    <div className="relative">
                      <img
                        src={fotoAntesPreview}
                        alt="Foto Antes"
                        className="w-full h-48 object-cover rounded-lg"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2"
                        onClick={() => handleRemovePhoto('antes')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                      <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">Clique para enviar</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => handleFileChange('antes', e.target.files?.[0] || null)}
                      />
                    </label>
                  )}
                </div>

                {/* Foto DEPOIS */}
                <div className="border rounded-lg p-4">
                  <Label className="font-medium mb-3 block">DEPOIS</Label>
                  {fotoDepoisPreview ? (
                    <div className="relative">
                      <img
                        src={fotoDepoisPreview}
                        alt="Foto Depois"
                        className="w-full h-48 object-cover rounded-lg"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2"
                        onClick={() => handleRemovePhoto('depois')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                      <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">Clique para enviar</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => handleFileChange('depois', e.target.files?.[0] || null)}
                      />
                    </label>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Botão Exportar PDF - aparece somente se houver foto DEPOIS e registro salvo */}
          {isEditing && fotoDepoisPreview && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={handleExportPDF}
                disabled={isExporting}
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4 mr-2" />
                )}
                Exportar PDF
              </Button>
            </div>
          )}

          {/* Seção 4 - Solução */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Resultados Alcançados / Solução *</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.resultado_alcancado_solucao}
                onChange={(e) => setFormData({ ...formData, resultado_alcancado_solucao: e.target.value })}
                placeholder="Descreva as ações corretivas tomadas e os resultados alcançados..."
                rows={4}
              />
            </CardContent>
          </Card>

          <Separator />

          {/* Botões de ação */}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            
            <Button
              variant="secondary"
              onClick={() => handleSave('rascunho')}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar Rascunho
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
