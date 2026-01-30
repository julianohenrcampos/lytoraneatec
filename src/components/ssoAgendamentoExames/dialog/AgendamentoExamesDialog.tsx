import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Combobox } from '@/components/ui/combobox';
import { FileUploader } from '@/components/ui/file-uploader';
import { AgendamentoExameFormData, TIPOS_EXAME, STATUS_AGENDAMENTO } from '@/types/ssoAgendamentoExames';
import { useAgendamentoExames } from '@/hooks/ssoAgendamentoExames';
import { agendamentoExamesStorageService } from '@/services/ssoAgendamentoExames/agendamentoExamesStorageService';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Paperclip, Trash2, Download } from 'lucide-react';

interface AgendamentoExamesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agendamentoId?: string;
  canChangeStatus?: boolean;
}

const initialFormData: AgendamentoExameFormData = {
  empresa: '',
  contrato: '',
  nome_colaborador: '',
  funcao: '',
  data_nascimento: '',
  rg: '',
  cpf: '',
  tipo_exame: 'Admissional',
  data_agendamento: new Date().toISOString().split('T')[0],
  horario_agendamento: '08:00',
  local_atendimento_id: '',
  observacoes: '',
  documentos_anexados: false,
  status: 'Pendente',
  tecnico_seguranca: ''
};

export const AgendamentoExamesDialog: React.FC<AgendamentoExamesDialogProps> = ({
  open,
  onOpenChange,
  agendamentoId,
  canChangeStatus = true
}) => {
  const [formData, setFormData] = useState<AgendamentoExameFormData>(initialFormData);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const { 
    agendamento, locais, funcoes, empresas, centrosCusto, isLoading, create, update, isCreating, isUpdating,
    anexos, uploadAnexo, deleteAnexo, isUploadingAnexo, isDeletingAnexo
  } = useAgendamentoExames(agendamentoId);

  const funcoesOptions = useMemo(() => 
    funcoes.map(f => ({ value: f.nome_funcao, label: f.nome_funcao })), 
    [funcoes]
  );

  const empresasOptions = useMemo(() => 
    empresas.map(e => ({ value: e.nome_empresa, label: e.nome_empresa })), 
    [empresas]
  );

  const centrosCustoOptions = useMemo(() => 
    centrosCusto.map(c => ({ value: c.nome_centro_custo, label: c.nome_centro_custo })), 
    [centrosCusto]
  );

  // Buscar nome do usuário logado ao abrir novo agendamento
  useEffect(() => {
    const fetchCurrentUser = async () => {
      if (!agendamentoId && open) {
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
  }, [agendamentoId, open]);

  useEffect(() => {
    if (agendamento && agendamentoId) {
      setFormData({
        empresa: agendamento.empresa,
        contrato: agendamento.contrato || '',
        nome_colaborador: agendamento.nome_colaborador,
        funcao: agendamento.funcao,
        data_nascimento: agendamento.data_nascimento || '',
        rg: agendamento.rg || '',
        cpf: agendamento.cpf || '',
        tipo_exame: agendamento.tipo_exame,
        data_agendamento: agendamento.data_agendamento,
        horario_agendamento: agendamento.horario_agendamento.substring(0, 5),
        local_atendimento_id: agendamento.local_atendimento_id,
        observacoes: agendamento.observacoes || '',
        documentos_anexados: agendamento.documentos_anexados,
        status: agendamento.status,
        tecnico_seguranca: agendamento.tecnico_seguranca || ''
      });
    } else if (!agendamentoId) {
      setFormData(prev => ({
        ...initialFormData,
        tecnico_seguranca: prev.tecnico_seguranca // Manter o nome do técnico já buscado
      }));
    }
  }, [agendamento, agendamentoId, open]);

  const handleFilesSelected = (files: FileList | null) => {
    if (files) {
      setPendingFiles(Array.from(files));
    } else {
      setPendingFiles([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.empresa || !formData.nome_colaborador || !formData.funcao || !formData.local_atendimento_id || !formData.data_nascimento || !formData.cpf) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    try {
      let savedAgendamentoId = agendamentoId;
      
      if (agendamentoId) {
        await update({ id: agendamentoId, data: formData });
      } else {
        const newAgendamento = await create(formData);
        savedAgendamentoId = newAgendamento?.id;
      }
      
      // Upload de arquivos pendentes
      if (pendingFiles.length > 0 && savedAgendamentoId) {
        setIsUploadingFiles(true);
        for (const file of pendingFiles) {
          await uploadAnexo({ agendamentoId: savedAgendamentoId, file });
        }
        setIsUploadingFiles(false);
      }
      
      setPendingFiles([]);
      onOpenChange(false);
    } catch (error) {
      setIsUploadingFiles(false);
      console.error('Erro ao salvar:', error);
    }
  };

  const handleChange = (field: keyof AgendamentoExameFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{agendamentoId ? 'Editar Agendamento' : 'Novo Agendamento'}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-4">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Dados do Colaborador */}
            <Card className="p-4">
              <h4 className="font-semibold mb-4">Dados do Colaborador</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Empresa *</Label>
                  <Combobox
                    options={empresasOptions}
                    value={formData.empresa}
                    onChange={(value) => handleChange('empresa', value)}
                    placeholder="Selecione a empresa..."
                    searchPlaceholder="Buscar empresa..."
                    emptyText="Nenhuma empresa encontrada"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contrato/Obra</Label>
                  <Combobox
                    options={centrosCustoOptions}
                    value={formData.contrato}
                    onChange={(value) => handleChange('contrato', value)}
                    placeholder="Selecione o contrato/obra..."
                    searchPlaceholder="Buscar contrato/obra..."
                    emptyText="Nenhum contrato encontrado"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nome do Colaborador *</Label>
                  <Input value={formData.nome_colaborador} onChange={(e) => handleChange('nome_colaborador', e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Função *</Label>
                  <Combobox
                    options={funcoesOptions}
                    value={formData.funcao}
                    onChange={(value) => handleChange('funcao', value)}
                    placeholder="Selecione a função..."
                    searchPlaceholder="Buscar função..."
                    emptyText="Nenhuma função encontrada"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data de Nascimento *</Label>
                  <Input type="date" value={formData.data_nascimento} onChange={(e) => handleChange('data_nascimento', e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>RG</Label>
                  <Input value={formData.rg} onChange={(e) => handleChange('rg', e.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>CPF *</Label>
                  <Input value={formData.cpf} onChange={(e) => handleChange('cpf', e.target.value)} placeholder="000.000.000-00" required />
                </div>
              </div>
            </Card>

            {/* Agendamento */}
            <Card className="p-4">
              <h4 className="font-semibold mb-4">Agendamento</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Exame *</Label>
                  <Select value={formData.tipo_exame} onValueChange={(v) => handleChange('tipo_exame', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIPOS_EXAME.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Local de Atendimento *</Label>
                  <Select value={formData.local_atendimento_id} onValueChange={(v) => handleChange('local_atendimento_id', v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {locais.map((l) => (<SelectItem key={l.id} value={l.id}>{l.nome_local}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Data do Agendamento *</Label>
                  <Input type="date" value={formData.data_agendamento} onChange={(e) => handleChange('data_agendamento', e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Horário *</Label>
                  <Input type="time" value={formData.horario_agendamento} onChange={(e) => handleChange('horario_agendamento', e.target.value)} required />
                </div>
              </div>
            </Card>

            {/* Observações e Status */}
            <Card className="p-4">
              <h4 className="font-semibold mb-4">Observações e Status</h4>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Responsável *</Label>
                  <Input
                    value={formData.tecnico_seguranca}
                    readOnly
                    className="bg-muted cursor-not-allowed"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea value={formData.observacoes} onChange={(e) => handleChange('observacoes', e.target.value)} rows={3} />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="docs" checked={formData.documentos_anexados} onCheckedChange={(v) => handleChange('documentos_anexados', v)} />
                  <Label htmlFor="docs">Possui documentos anexos</Label>
                </div>
                
                {formData.documentos_anexados && (
                  <div className="space-y-4 mt-4 p-4 border rounded-lg bg-muted/30">
                    <Label className="flex items-center gap-2">
                      <Paperclip className="h-4 w-4" />
                      Anexar Documentos
                    </Label>
                    
                    <FileUploader
                      onFilesSelected={handleFilesSelected}
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      maxFiles={10}
                      label="Arraste arquivos aqui ou clique para selecionar (PDF, DOC, imagens)"
                    />
                    
                    {/* Lista de arquivos já salvos (modo edição) */}
                    {agendamentoId && anexos.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Arquivos anexados:</p>
                        <ul className="space-y-1">
                          {anexos.map((anexo) => (
                            <li key={anexo.id} className="flex items-center justify-between bg-background p-2 rounded-md border">
                              <span className="text-sm truncate flex-1">{anexo.arquivo_nome}</span>
                              <div className="flex gap-1">
                                <Button 
                                  type="button" 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => window.open(agendamentoExamesStorageService.getPublicUrl(anexo.arquivo_path))}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                                <Button 
                                  type="button" 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => deleteAnexo(anexo)} 
                                  disabled={isDeletingAnexo}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                {(canChangeStatus || agendamentoId) && (
                  <div className="space-y-2">
                    <Label>Status *</Label>
                    <Select 
                      value={formData.status} 
                      onValueChange={(v) => handleChange('status', v)}
                      disabled={!canChangeStatus}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_AGENDAMENTO.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </Card>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={isCreating || isUpdating || isUploadingFiles}>
                {(isCreating || isUpdating || isUploadingFiles) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isUploadingFiles ? 'Enviando arquivos...' : agendamentoId ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
