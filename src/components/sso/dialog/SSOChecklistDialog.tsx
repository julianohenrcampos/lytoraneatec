import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SSOChecklistFormHeader } from './SSOChecklistFormHeader';
import { SSOChecklistFormItems } from './SSOChecklistFormItems';
import { useSSOChecklist } from '@/hooks/sso/useSSOChecklist';
import { SSOChecklistItem, SSOChecklist, SSOChecklistFormData, AvaliacaoTipo } from '@/types/sso';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ssoItemService } from '@/services/sso';

interface SSOChecklistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checklistId?: string;
}

export const SSOChecklistDialog = ({ open, onOpenChange, checklistId }: SSOChecklistDialogProps) => {
  const isEdit = !!checklistId;
  const { checklist, createChecklist, updateChecklist, isCreating, isUpdating } = useSSOChecklist(checklistId);
  
  const [activeTab, setActiveTab] = useState('dados');
  const [formData, setFormData] = useState<SSOChecklistFormData>({
    obra_id: '',
    gerente_regional: '',
    engenheiro_obra: '',
    tecnico_seguranca: '',
    data_inspecao: new Date().toISOString().split('T')[0],
    observacoes_gerais: '',
  });
  
  const [itens, setItens] = useState<SSOChecklistItem[]>([]);

  // Auto-preencher Técnico de Segurança com usuário logado
  useEffect(() => {
    const fetchCurrentUser = async () => {
      if (!isEdit && open) {
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
  }, [isEdit, open]);

  // Carregar 36 itens modelo ao criar novo checklist
  useEffect(() => {
    const loadItensModelo = async () => {
      if (!isEdit && open) {
        try {
          const itensModelo = await ssoItemService.getModelo();
          
          const itensTemp: SSOChecklistItem[] = itensModelo.map(modelo => ({
            id: crypto.randomUUID(),
            checklist_id: '',
            item_modelo_id: modelo.id,
            avaliacao: 'NA' as AvaliacaoTipo,
            evidencia: undefined,
            fotos: [],
            ordem: modelo.ordem,
            tema: modelo.tema,
            descricao: modelo.descricao
          }));
          
          setItens(itensTemp);
        } catch (error) {
          console.error('Erro ao carregar itens:', error);
          toast.error('Erro ao carregar checklist');
        }
      }
    };
    loadItensModelo();
  }, [isEdit, open]);

  // Limpar estado ao fechar dialog
  useEffect(() => {
    if (!open) {
      setItens([]);
      setFormData({
        obra_id: '',
        gerente_regional: '',
        engenheiro_obra: '',
        tecnico_seguranca: '',
        data_inspecao: new Date().toISOString().split('T')[0],
        observacoes_gerais: '',
      });
      setActiveTab('dados');
    }
  }, [open]);

  // Carregar dados do checklist ao editar
  useEffect(() => {
    if (isEdit && checklist) {
      setFormData({
        obra_id: checklist.obra_id,
        gerente_regional: checklist.gerente_regional,
        engenheiro_obra: checklist.engenheiro_obra,
        tecnico_seguranca: checklist.tecnico_seguranca,
        data_inspecao: checklist.data_inspecao,
        observacoes_gerais: checklist.observacoes_gerais || '',
      });
      
      if (checklist.bd_sso_checklist_itens) {
        setItens(checklist.bd_sso_checklist_itens);
      }
    }
  }, [isEdit, checklist]);

  const handleFormChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleItemChange = (itemId: string, field: keyof SSOChecklistItem, value: any) => {
    setItens(prev => prev.map(item => 
      item.id === itemId ? { ...item, [field]: value } : item
    ));
  };

  // Validação dos campos obrigatórios para habilitar aba Checklist
  const isDadosCompletos = formData.obra_id && 
                            formData.gerente_regional && 
                            formData.engenheiro_obra;

  const handleTabChange = (value: string) => {
    if (value === 'checklist' && !isDadosCompletos) {
      toast.warning('Preencha Obra, Gerente Regional e Engenheiro antes de acessar o Checklist');
      return;
    }
    setActiveTab(value);
  };

  const handleSave = async () => {
    // Validações básicas
    if (!isDadosCompletos || !formData.tecnico_seguranca) {
      toast.error('Preencha Obra, Gerente Regional, Engenheiro da Obra e Técnico de Segurança antes de salvar');
      setActiveTab('dados');
      return;
    }

    // Verificar se todos os itens foram avaliados
    const itensNaoAvaliados = itens.filter(item => !item.avaliacao);
    if (itensNaoAvaliados.length > 0) {
      toast.error(`${itensNaoAvaliados.length} itens ainda não foram avaliados`);
      setActiveTab('checklist');
      return;
    }

    try {
      if (isEdit && checklistId) {
        // Atualizar checklist existente
        await updateChecklist({ id: checklistId, data: formData });
        // TODO: Atualizar itens individualmente
        toast.success('Checklist atualizado com sucesso!');
      } else {
        // Criar novo checklist
        await createChecklist(formData);
        toast.success('Checklist criado com sucesso!');
      }
      
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar checklist');
    }
  };

  const isLoading = isCreating || isUpdating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Editar Checklist SSO NR-18' : 'Novo Checklist SSO NR-18'}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="dados">Dados Operacionais</TabsTrigger>
            <TabsTrigger 
              value="checklist"
              disabled={!isDadosCompletos}
              className="disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Checklist ({itens.filter(i => i.avaliacao && i.avaliacao !== 'NA').length}/{itens.length})
            </TabsTrigger>
          </TabsList>

          {!isDadosCompletos && activeTab === 'dados' && (
            <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-3 mt-2">
              <span className="font-medium">Atenção:</span> Preencha a Obra, Gerente Regional e Engenheiro da Obra para acessar o Checklist
            </div>
          )}

          <TabsContent value="dados" className="mt-4">
            <SSOChecklistFormHeader
              formData={formData}
              onChange={handleFormChange}
            />
          </TabsContent>

          <TabsContent value="checklist" className="mt-4">
            {itens.length > 0 ? (
              <SSOChecklistFormItems
                itens={itens}
                onChange={handleItemChange}
              />
            ) : (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? 'Atualizar' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
