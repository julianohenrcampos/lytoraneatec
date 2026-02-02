import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Plus, 
  Send, 
  Check, 
  X, 
  Users, 
  Calendar as CalendarIcon,
  Building2,
  Filter,
  MoreHorizontal,
  Loader2,
  Trash2,
  Play,
  Square,
  Ban
} from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

import { useDynamicPermissions } from "@/hooks/useDynamicPermissions";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { 
  useConvocacoesDiaria, 
  useConvocacoesResumo,
  useCreateConvocacao,
  useDeleteConvocacao,
  useEnviarParaAprovacao,
  useAprovarConvocacao,
  useReprovarConvocacao,
  useIniciarExecucao,
  useFinalizarConvocacao,
  useCancelarConvocacao,
  useConvocadosByConvocacao,
  useAddConvocado,
  useRemoveConvocado
} from "@/hooks/diarias";
import { useSolicitacoesDiaria } from "@/hooks/diarias";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { StatusConvocacao, ConvocacaoFormData, ConvocacaoFilters } from "@/types/diarias";

// Status Badge Component
function StatusBadge({ status }: { status: StatusConvocacao }) {
  const variants: Record<StatusConvocacao, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    rascunho: { variant: "secondary", label: "Rascunho" },
    enviada_aprovacao: { variant: "outline", label: "Aguardando" },
    aprovada: { variant: "default", label: "Aprovada" },
    reprovada: { variant: "destructive", label: "Reprovada" },
    executando: { variant: "default", label: "Em Execução" },
    finalizada: { variant: "default", label: "Finalizada" },
    cancelada: { variant: "destructive", label: "Cancelada" },
  };
  const config = variants[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export default function DiariasConvocacoes() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const solicitacaoIdParam = searchParams.get('solicitacao_id');
  
  const { permissions, userId, isSuperAdmin, isLoading: isLoadingPermissions } = useDynamicPermissions();
  const hasPermission = (perm: string) => permissions.includes(perm);
  
  // Verificar permissão de acesso
  const hasAccess = isSuperAdmin || hasPermission('diarias_view');
  
  // Filters
  const [filters, setFilters] = useState<ConvocacaoFilters>({});
  
  // Dialogs
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAprovacaoOpen, setIsAprovacaoOpen] = useState(false);
  const [isConvocadosOpen, setIsConvocadosOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [aprovacaoAction, setAprovacaoAction] = useState<'aprovar' | 'reprovar' | 'cancelar'>('aprovar');
  const [comentario, setComentario] = useState("");
  const [deleteConvocacaoDialogOpen, setDeleteConvocacaoDialogOpen] = useState(false);
  const [deletingConvocacaoId, setDeletingConvocacaoId] = useState<string | null>(null);
  const [removeConvocadoDialogOpen, setRemoveConvocadoDialogOpen] = useState(false);
  const [removingConvocadoId, setRemovingConvocadoId] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState<ConvocacaoFormData>({
    solicitacao_id: '',
    data: format(new Date(), 'yyyy-MM-dd'),
    centro_custo_id: '',
    observacao: ''
  });
  
  // Add funcionario
  const [selectedFuncionarioId, setSelectedFuncionarioId] = useState<string>('');

  // Open form with solicitacao from URL
  useEffect(() => {
    if (solicitacaoIdParam) {
      setFormData(prev => ({ ...prev, solicitacao_id: solicitacaoIdParam }));
      setIsFormOpen(true);
    }
  }, [solicitacaoIdParam]);

  // Queries - DEVE VIR ANTES DOS EARLY RETURNS
  const { data: convocacoes = [], isLoading } = useConvocacoesDiaria(filters);
  const { data: resumo } = useConvocacoesResumo(filters);
  const { data: convocados = [], isLoading: isLoadingConvocados } = useConvocadosByConvocacao(selectedId || undefined);
  
  // Solicitações autorizadas para criar convocação
  const { data: solicitacoesAutorizadas = [] } = useSolicitacoesDiaria({ status: 'autorizada' });
  
  // Centro de custos
  const { data: centrosCusto = [] } = useQuery({
    queryKey: ['centros-custo'],
    queryFn: async () => {
      const { data } = await supabase
        .from('bd_centros_custo')
        .select('id, codigo_centro_custo, nome_centro_custo')
        .order('nome_centro_custo');
      return data || [];
    }
  });

  // Funcionários para adicionar
  const { data: funcionarios = [] } = useQuery({
    queryKey: ['funcionarios-diaria'],
    queryFn: async () => {
      const { data } = await supabase
        .from('bd_funcionarios')
        .select(`
          id, 
          nome_completo, 
          funcao_id,
          bd_funcoes (
            id,
            nome_funcao,
            valor_diaria,
            valor_diaria_exclusiva
          )
        `)
        .eq('status', 'Ativo')
        .not('funcao_id', 'is', null)
        .order('nome_completo');
      return data || [];
    }
  });

  // Mutations
  const createMutation = useCreateConvocacao();
  const deleteMutation = useDeleteConvocacao();
  const enviarMutation = useEnviarParaAprovacao();
  const aprovarMutation = useAprovarConvocacao();
  const reprovarMutation = useReprovarConvocacao();
  const iniciarMutation = useIniciarExecucao();
  const finalizarMutation = useFinalizarConvocacao();
  const cancelarMutation = useCancelarConvocacao();
  const addConvocadoMutation = useAddConvocado();
  const removeConvocadoMutation = useRemoveConvocado();

  // Permissions
  const canConvocar = isSuperAdmin || hasPermission('diarias_convocar');
  const canAprovar = isSuperAdmin || hasPermission('diarias_aprovar_convocacao');
  
  // Loading de permissões - APÓS TODOS OS HOOKS
  if (isLoadingPermissions) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Carregando...</span>
        </div>
      </MainLayout>
    );
  }
  
  // Sem permissão - APÓS TODOS OS HOOKS
  if (!hasAccess) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
            <p className="text-xs text-muted-foreground mt-1">Permissão necessária: diarias_view</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Handler: Select solicitacao and auto-fill data
  const handleSelectSolicitacao = (solId: string) => {
    const sol = solicitacoesAutorizadas.find((s: any) => s.id === solId);
    if (sol) {
      setFormData({
        solicitacao_id: solId,
        data: sol.data,
        centro_custo_id: sol.centro_custo_id,
        observacao: ''
      });
    }
  };

  const handleSaveForm = async () => {
    if (!formData.solicitacao_id || !formData.centro_custo_id) return;
    
    await createMutation.mutateAsync(formData);
    setIsFormOpen(false);
    navigate('/requisicoes/diarias/convocacoes'); // limpar params
  };

  const handleEnviar = async (id: string) => {
    await enviarMutation.mutateAsync(id);
  };

  const handleOpenAprovacao = (id: string, action: 'aprovar' | 'reprovar' | 'cancelar') => {
    setSelectedId(id);
    setAprovacaoAction(action);
    setComentario("");
    setIsAprovacaoOpen(true);
  };

  const handleConfirmarAprovacao = async () => {
    if (!selectedId) return;
    
    if (aprovacaoAction === 'aprovar') {
      await aprovarMutation.mutateAsync({ id: selectedId, comentario });
    } else if (aprovacaoAction === 'reprovar') {
      await reprovarMutation.mutateAsync({ id: selectedId, comentario });
    } else {
      await cancelarMutation.mutateAsync({ id: selectedId, comentario });
    }
    setIsAprovacaoOpen(false);
  };

  const handleOpenDeleteConvocacaoDialog = (id: string) => {
    setDeletingConvocacaoId(id);
    setDeleteConvocacaoDialogOpen(true);
  };

  const handleConfirmDeleteConvocacao = async () => {
    if (deletingConvocacaoId) {
      await deleteMutation.mutateAsync(deletingConvocacaoId);
      setDeleteConvocacaoDialogOpen(false);
      setDeletingConvocacaoId(null);
    }
  };

  const handleOpenConvocados = (id: string) => {
    setSelectedId(id);
    setSelectedFuncionarioId('');
    setIsConvocadosOpen(true);
  };

  const handleAddConvocado = async () => {
    if (!selectedId || !selectedFuncionarioId) return;
    await addConvocadoMutation.mutateAsync({
      convocacaoId: selectedId,
      funcionarioId: selectedFuncionarioId,
      usarDiariaExclusiva: true
    });
    setSelectedFuncionarioId('');
  };

  const handleOpenRemoveConvocadoDialog = (convocadoId: string) => {
    setRemovingConvocadoId(convocadoId);
    setRemoveConvocadoDialogOpen(true);
  };

  const handleConfirmRemoveConvocado = async () => {
    if (removingConvocadoId) {
      await removeConvocadoMutation.mutateAsync(removingConvocadoId);
      setRemoveConvocadoDialogOpen(false);
      setRemovingConvocadoId(null);
    }
  };

  // Check segregation
  const canUserAprovar = (criadoPor: string | null) => {
    return canAprovar && criadoPor !== userId;
  };

  // Funcionários já convocados
  const funcionariosConvocadosIds = convocados.map((c: any) => c.funcionario_id);
  const funcionariosDisponiveis = funcionarios.filter((f: any) => 
    !funcionariosConvocadosIds.includes(f.id) && f.bd_funcoes?.valor_diaria
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Convocações de Diária</h1>
            <p className="text-muted-foreground">
              Gerencie as convocações e funcionários para diárias
            </p>
          </div>
          {canConvocar && (
            <Button onClick={() => setIsFormOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Convocação
            </Button>
          )}
        </div>

        {/* Summary Cards */}
        {resumo && (
          <div className="grid gap-4 md:grid-cols-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{resumo.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Aguardando</CardTitle>
                <Send className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{resumo.enviada_aprovacao}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Aprovadas</CardTitle>
                <Check className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{resumo.aprovada}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Em Execução</CardTitle>
                <Play className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{resumo.executando}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Finalizadas</CardTitle>
                <Square className="h-4 w-4 text-gray-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{resumo.finalizada}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <Label>Data Início</Label>
                <Input
                  type="date"
                  value={filters.data_inicio || ''}
                  onChange={(e) => setFilters({ ...filters, data_inicio: e.target.value || undefined })}
                />
              </div>
              <div>
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={filters.data_fim || ''}
                  onChange={(e) => setFilters({ ...filters, data_fim: e.target.value || undefined })}
                />
              </div>
              <div>
                <Label>Centro de Custo</Label>
                <Select
                  value={filters.centro_custo_id ?? '__all__'}
                  onValueChange={(v) => setFilters({ ...filters, centro_custo_id: v === '__all__' ? undefined : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos</SelectItem>
                    {centrosCusto.map((cc: any) => (
                      <SelectItem key={cc.id} value={cc.id}>
                        {cc.codigo_centro_custo} - {cc.nome_centro_custo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={filters.status ?? '__all__'}
                  onValueChange={(v) => setFilters({ ...filters, status: (v === '__all__' ? undefined : (v as StatusConvocacao)) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos</SelectItem>
                    <SelectItem value="rascunho">Rascunho</SelectItem>
                    <SelectItem value="enviada_aprovacao">Aguardando</SelectItem>
                    <SelectItem value="aprovada">Aprovada</SelectItem>
                    <SelectItem value="executando">Em Execução</SelectItem>
                    <SelectItem value="finalizada">Finalizada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : convocacoes.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground">
                Nenhuma convocação encontrada.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Centro de Custo</TableHead>
                    <TableHead>Convocados</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {convocacoes.map((conv: any) => (
                    <TableRow key={conv.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                          {format(new Date(conv.data), 'dd/MM/yyyy', { locale: ptBR })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {conv.bd_centros_custo?.codigo_centro_custo} - {conv.bd_centros_custo?.nome_centro_custo}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {conv.bd_diaria_convocados?.length || 0} funcionários
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={conv.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenConvocados(conv.id)}>
                              <Users className="h-4 w-4 mr-2" />
                              Ver Convocados
                            </DropdownMenuItem>
                            
                            {conv.status === 'rascunho' && canConvocar && conv.criado_por === userId && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleEnviar(conv.id)}>
                                  <Send className="h-4 w-4 mr-2" />
                                  Enviar para Aprovação
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  className="text-destructive"
                                  onClick={() => handleOpenDeleteConvocacaoDialog(conv.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Excluir
                                </DropdownMenuItem>
                              </>
                            )}
                            
                            {conv.status === 'enviada_aprovacao' && canUserAprovar(conv.criado_por) && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleOpenAprovacao(conv.id, 'aprovar')}>
                                  <Check className="h-4 w-4 mr-2 text-green-500" />
                                  Aprovar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleOpenAprovacao(conv.id, 'reprovar')}>
                                  <X className="h-4 w-4 mr-2 text-red-500" />
                                  Reprovar
                                </DropdownMenuItem>
                              </>
                            )}
                            
                            {conv.status === 'aprovada' && canConvocar && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => iniciarMutation.mutate(conv.id)}>
                                  <Play className="h-4 w-4 mr-2 text-blue-500" />
                                  Iniciar Execução
                                </DropdownMenuItem>
                              </>
                            )}
                            
                            {conv.status === 'executando' && canConvocar && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => finalizarMutation.mutate(conv.id)}>
                                  <Square className="h-4 w-4 mr-2" />
                                  Finalizar
                                </DropdownMenuItem>
                              </>
                            )}
                            
                            {['rascunho', 'enviada_aprovacao', 'aprovada'].includes(conv.status) && canConvocar && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  className="text-destructive"
                                  onClick={() => handleOpenAprovacao(conv.id, 'cancelar')}
                                >
                                  <Ban className="h-4 w-4 mr-2" />
                                  Cancelar
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Create Form Dialog */}
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Convocação de Diária</DialogTitle>
              <DialogDescription>
                Selecione uma solicitação autorizada para criar a convocação.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Solicitação Autorizada *</Label>
                <Select
                  value={formData.solicitacao_id}
                  onValueChange={handleSelectSolicitacao}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma solicitação..." />
                  </SelectTrigger>
                  <SelectContent>
                    {solicitacoesAutorizadas.map((sol: any) => (
                      <SelectItem key={sol.id} value={sol.id}>
                        {format(new Date(sol.data), 'dd/MM/yyyy')} - {sol.bd_centros_custo?.nome_centro_custo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data</Label>
                <Input type="date" value={formData.data} disabled />
              </div>
              <div>
                <Label>Centro de Custo</Label>
                <Select value={formData.centro_custo_id} disabled>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {centrosCusto.map((cc: any) => (
                      <SelectItem key={cc.id} value={cc.id}>
                        {cc.codigo_centro_custo} - {cc.nome_centro_custo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Observação</Label>
                <Textarea
                  value={formData.observacao || ''}
                  onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                  placeholder="Observações adicionais..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsFormOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleSaveForm}
                disabled={createMutation.isPending || !formData.solicitacao_id}
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Criar Convocação
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Aprovação Dialog */}
        <Dialog open={isAprovacaoOpen} onOpenChange={setIsAprovacaoOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {aprovacaoAction === 'aprovar' ? 'Aprovar Convocação' : 
                 aprovacaoAction === 'reprovar' ? 'Reprovar Convocação' : 'Cancelar Convocação'}
              </DialogTitle>
            </DialogHeader>
            <div>
              <Label>Comentário</Label>
              <Textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Adicione um comentário..."
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAprovacaoOpen(false)}>
                Voltar
              </Button>
              <Button 
                variant={aprovacaoAction === 'aprovar' ? 'default' : 'destructive'}
                onClick={handleConfirmarAprovacao}
                disabled={aprovarMutation.isPending || reprovarMutation.isPending || cancelarMutation.isPending}
              >
                {(aprovarMutation.isPending || reprovarMutation.isPending || cancelarMutation.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {aprovacaoAction === 'aprovar' ? 'Aprovar' : 
                 aprovacaoAction === 'reprovar' ? 'Reprovar' : 'Cancelar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Convocados Dialog */}
        <Dialog open={isConvocadosOpen} onOpenChange={setIsConvocadosOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Funcionários Convocados</DialogTitle>
              <DialogDescription>
                Gerencie os funcionários desta convocação de diária.
              </DialogDescription>
            </DialogHeader>
            
            {canConvocar && (
              <>
                <div className="flex gap-2">
                  <Select
                    value={selectedFuncionarioId}
                    onValueChange={setSelectedFuncionarioId}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecione um funcionário..." />
                    </SelectTrigger>
                    <SelectContent>
                      {funcionariosDisponiveis.map((f: any) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.nome_completo} - {f.bd_funcoes?.nome_funcao} (R$ {f.bd_funcoes?.valor_diaria_exclusiva || f.bd_funcoes?.valor_diaria})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    onClick={handleAddConvocado}
                    disabled={!selectedFuncionarioId || addConvocadoMutation.isPending}
                  >
                    {addConvocadoMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <Separator />
              </>
            )}

            {isLoadingConvocados ? (
              <div className="flex justify-center p-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : convocados.length === 0 ? (
              <div className="text-center p-4 text-muted-foreground">
                Nenhum funcionário convocado ainda.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead>Valor Diária</TableHead>
                    <TableHead>Presença</TableHead>
                    {canConvocar && <TableHead></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {convocados.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.bd_funcionarios?.nome_completo}</TableCell>
                      <TableCell>{c.bd_funcoes?.nome_funcao}</TableCell>
                      <TableCell>R$ {c.valor_diaria_aplicada.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={
                          c.presenca_status === 'presente' ? 'default' :
                          c.presenca_status === 'ausente' ? 'destructive' : 'secondary'
                        }>
                          {c.presenca_status === 'presente' ? 'Presente' :
                           c.presenca_status === 'ausente' ? 'Ausente' : 'Pendente'}
                        </Badge>
                      </TableCell>
                      {canConvocar && (
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleOpenRemoveConvocadoDialog(c.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsConvocadosOpen(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Convocacao Dialog */}
        <ConfirmDialog
          isOpen={deleteConvocacaoDialogOpen}
          onClose={() => setDeleteConvocacaoDialogOpen(false)}
          onConfirm={handleConfirmDeleteConvocacao}
          title="Excluir Convocação"
          description="Tem certeza que deseja excluir esta convocação? Esta ação não poderá ser desfeita."
          confirmText="Excluir"
          variant="danger"
          isLoading={deleteMutation.isPending}
        />

        {/* Remove Convocado Dialog */}
        <ConfirmDialog
          isOpen={removeConvocadoDialogOpen}
          onClose={() => setRemoveConvocadoDialogOpen(false)}
          onConfirm={handleConfirmRemoveConvocado}
          title="Remover Funcionário"
          description="Tem certeza que deseja remover este funcionário da convocação?"
          confirmText="Remover"
          variant="danger"
          isLoading={removeConvocadoMutation.isPending}
        />
      </div>
    </MainLayout>
  );
}
