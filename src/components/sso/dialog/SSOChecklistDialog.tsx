import { useState, useEffect, useRef, useCallback } from 'react';
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
import { SSOChecklistItem, SSOChecklist, SSOChecklistFormData, AvaliacaoTipo, SSOFoto } from '@/types/sso';
import { comRetryDeRede, isErroDeRede, MENSAGEM_SEM_CONEXAO } from '@/services/sso/ssoNetwork';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ssoItemService, ssoStorageService } from '@/services/sso';
import { usePermission } from '@/hooks/usePermission';
import { useIsMobile } from '@/hooks/use-mobile';

interface SSOChecklistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checklistId?: string;
}

export const SSOChecklistDialog = ({ open, onOpenChange, checklistId }: SSOChecklistDialogProps) => {
  const isEdit = !!checklistId;
  const { checklist, createChecklist, updateChecklist, isCreating, isUpdating } = useSSOChecklist(checklistId);
  const { isSuperAdmin, userRole } = usePermission();
  const isMobile = useIsMobile();
  
  const [activeTab, setActiveTab] = useState('dados');
  const [formData, setFormData] = useState<SSOChecklistFormData>({
    obra_id: '',
    gerente_regional: '',
    engenheiro_obra: '',
    tecnico_seguranca: '',
    data_inspecao: new Date().toISOString().split('T')[0],
    etapa_vistoria: '1ª Etapa',
    total_efetivo: undefined,
    observacoes_gerais: '',
  });
  
  const [itens, setItens] = useState<SSOChecklistItem[]>([]);
  // Usar useRef para manter arquivos persistentes entre re-renders
  const itemFilesRef = useRef<Map<string, File[]>>(new Map());
  const [isLoadingEditData, setIsLoadingEditData] = useState(false);
  
  // Estado para controlar se o scroll chegou ao final (mobile)
  const [isScrollAtEnd, setIsScrollAtEnd] = useState(false);

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
        etapa_vistoria: '1ª Etapa',
        total_efetivo: undefined,
        observacoes_gerais: '',
      });
      setActiveTab('dados');
      setIsLoadingEditData(false);
      // Limpar ref de arquivos
      itemFilesRef.current.clear();
    }
  }, [open]);

  // Carregar dados do checklist ao editar
  useEffect(() => {
    if (isEdit && open && !checklist) {
      setIsLoadingEditData(true);
    }
    
    if (isEdit && checklist) {
      setFormData({
        obra_id: checklist.obra_id,
        gerente_regional: checklist.gerente_regional,
        engenheiro_obra: checklist.engenheiro_obra,
        tecnico_seguranca: checklist.tecnico_seguranca,
        data_inspecao: checklist.data_inspecao,
        etapa_vistoria: checklist.etapa_vistoria || '1ª Etapa',
        total_efetivo: checklist.total_efetivo,
        observacoes_gerais: checklist.observacoes_gerais || '',
      });
      
      if (checklist.bd_sso_checklist_itens) {
        setItens(checklist.bd_sso_checklist_itens);
      }
      setIsLoadingEditData(false);
    }
  }, [isEdit, checklist, open]);

  const handleFormChange = (field: string, value: string) => {
    setFormData(prev => ({ 
      ...prev, 
      [field]: field === 'total_efetivo' ? (value ? parseInt(value, 10) : undefined) : value 
    }));
  };

  const handleItemChange = (itemId: string, field: keyof SSOChecklistItem, value: any) => {
    setItens(prev => prev.map(item => 
      item.id === itemId ? { ...item, [field]: value } : item
    ));
  };

  const handleItemFilesChange = useCallback((itemId: string, files: File[]) => {
    itemFilesRef.current.set(itemId, files);
  }, []);

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
        // 1. Atualizar checklist existente
        await updateChecklist({ id: checklistId, data: formData });
        
        // 2. Subir apenas as fotos novas. É o único passo que exige uma
        //    requisição por arquivo; os itens sem foto nova não pagam nada.
        const fotosPorItem = new Map<string, SSOFoto[]>();
        const fotosNaoEnviadas: number[] = [];

        for (const item of itens) {
          const files = itemFilesRef.current.get(item.id) || [];

          // Filtrar fotos existentes válidas (proteção robusta contra perda de dados)
          const fotosExistentes = (item.fotos || []).filter(f => {
            // Deve ter path válido do Storage (formato: checklistId/filename.ext)
            const hasValidPath = f.path && typeof f.path === 'string' && f.path.includes('/');
            // URL não pode ser base64 nem vazia (apenas URLs do Storage ou vazias)
            const hasValidUrl = !f.url || (typeof f.url === 'string' && !f.url.startsWith('data:'));
            return hasValidPath && hasValidUrl;
          });

          if (files.length === 0) {
            fotosPorItem.set(item.id, fotosExistentes);
            continue;
          }

          try {
            const uploads = await ssoStorageService.uploadMultiple(checklistId, files);
            fotosPorItem.set(item.id, [
              ...fotosExistentes,
              ...uploads.map(upload => ({
                path: upload.path,
                url: upload.url,
                created_at: new Date().toISOString(),
              })),
            ]);
          } catch (uploadError) {
            // Falha de upload não pode descartar a edição inteira:
            // preserva as fotos que já estavam salvas e segue.
            console.error(`Falha ao enviar fotos do item ${item.ordem}:`, uploadError);
            fotosPorItem.set(item.id, fotosExistentes);
            fotosNaoEnviadas.push(item.ordem);
          }
        }

        // 3. Gravar TODOS os itens numa única requisição.
        //    Antes era um UPDATE por item, em série: com 36 itens bastava uma
        //    oscilação de sinal para a edição parar pela metade, sem aviso.
        await comRetryDeRede(
          () =>
            ssoItemService.updateMany(
              itens.map(item => ({
                id: item.id,
                checklist_id: checklistId,
                item_modelo_id: item.item_modelo_id,
                avaliacao: item.avaliacao,
                evidencia: item.evidencia,
                ordem: item.ordem,
                tema: item.tema,
                descricao: item.descricao,
                fotos: (fotosPorItem.get(item.id) ?? []) as any,
              }))
            ),
          'atualizar itens do checklist'
        );

        if (fotosNaoEnviadas.length > 0) {
          toast.warning(
            `Checklist atualizado. As fotos dos itens ${fotosNaoEnviadas.join(', ')} não subiram — ` +
            'tente reenviá-las.'
          );
        } else {
          toast.success('Checklist atualizado com sucesso!');
        }
      } else {
        // Criar novo checklist com itens preenchidos
        await createChecklist({
          formData,
          itens,
          itemFiles: Object.fromEntries(itemFilesRef.current)
        });
      }
      
      onOpenChange(false);
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      toast.error(
        isErroDeRede(error)
          ? MENSAGEM_SEM_CONEXAO
          : error.message || 'Erro ao salvar checklist'
      );
    }
  };

  const isLoading = isCreating || isUpdating;
  
  // Callback para quando o scroll muda
  const handleScrollEnd = useCallback((isAtEnd: boolean) => {
    setIsScrollAtEnd(isAtEnd);
  }, []);
  
  // Mostrar botões se: NÃO for mobile OU estiver na aba "dados" OU scroll chegou ao final
  const showFooterButtons = !isMobile || activeTab === 'dados' || isScrollAtEnd;

  // Mostrar loading enquanto carrega dados no modo edição
  if (isEdit && isLoadingEditData) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Carregando checklist...</span>
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
            {isEdit ? 'Editar CHECK LIST - AUTOS DE INFRAÇÃO MTE_TAC' : 'Novo CHECK LIST - AUTOS DE INFRAÇÃO MTE_TAC'}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
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
            <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-3 mt-2 flex-shrink-0">
              <span className="font-medium">Atenção:</span> Preencha a Obra, Gerente Regional e Engenheiro da Obra para acessar o Checklist
            </div>
          )}

          <TabsContent value="dados" className="mt-4 flex-1 overflow-y-auto pb-4">
            <SSOChecklistFormHeader
              formData={formData}
              onChange={handleFormChange}
              checklistId={checklistId}
            />
          </TabsContent>

          <TabsContent value="checklist" className="mt-4 flex-1 overflow-y-auto pb-4">
            {itens.length > 0 ? (
              <SSOChecklistFormItems
                itens={itens}
                onChange={handleItemChange}
                onFilesChange={handleItemFilesChange}
                onScrollEnd={handleScrollEnd}
              />
            ) : (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Indicador para mobile quando botões estão escondidos */}
        {isMobile && activeTab === 'checklist' && !isScrollAtEnd && (
          <div className="flex-shrink-0 text-xs text-muted-foreground bg-muted/50 rounded-md p-2 text-center">
            ⬇️ Role até o final para ver os botões de Salvar
          </div>
        )}

        {showFooterButtons && (
          <DialogFooter className="flex-shrink-0 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Atualizar' : 'Salvar'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};
