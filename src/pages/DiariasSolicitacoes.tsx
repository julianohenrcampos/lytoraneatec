import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Plus, 
  Send, 
  Check, 
  X, 
  FileText, 
  Calendar as CalendarIcon,
  Building2,
  Filter,
  MoreHorizontal,
  Loader2,
  Undo2
} from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

import { useDynamicPermissions } from "@/hooks/useDynamicPermissions";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { 
  useSolicitacoesDiaria, 
  useSolicitacoesResumo,
  useCreateSolicitacao,
  useUpdateSolicitacao,
  useDeleteSolicitacao,
  useEnviarParaAutorizacao,
  useAutorizarSolicitacao,
  useReprovarSolicitacao,
  useCancelarEnvioSolicitacao
} from "@/hooks/diarias";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { StatusSolicitacao, SolicitacaoFormData, SolicitacaoFilters, DiariaSolicitacao } from "@/types/diarias";
import { SolicitacaoFormModal } from "@/components/diarias/SolicitacaoFormModal";

// Status Badge Component
function StatusBadge({ status }: { status: StatusSolicitacao }) {
  const variants: Record<StatusSolicitacao, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    rascunho: { variant: "secondary", label: "Rascunho" },
    enviada: { variant: "outline", label: "Aguardando" },
    autorizada: { variant: "default", label: "Autorizada" },
    reprovada: { variant: "destructive", label: "Reprovada" },
  };
  const config = variants[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export default function DiariasSolicitacoes() {
  const navigate = useNavigate();
  const { permissions, userId, isSuperAdmin, isLoading: isLoadingPermissions } = useDynamicPermissions();
  const hasPermission = (perm: string) => permissions.includes(perm);
  
  // Verificar permissão de acesso
  const hasAccess = isSuperAdmin || hasPermission('diarias_view');
  
  // Filters
  const [filters, setFilters] = useState<SolicitacaoFilters>({});
  
  // Dialogs
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAprovacaoOpen, setIsAprovacaoOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [aprovacaoAction, setAprovacaoAction] = useState<'autorizar' | 'reprovar'>('autorizar');
  const [comentario, setComentario] = useState("");
  const [editingSolicitacao, setEditingSolicitacao] = useState<DiariaSolicitacao | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Queries - DEVE VIR ANTES DOS EARLY RETURNS
  const { data: solicitacoes = [], isLoading } = useSolicitacoesDiaria(filters);
  const { data: resumo } = useSolicitacoesResumo(filters);
  
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

  // Mutations
  const createMutation = useCreateSolicitacao();
  const updateMutation = useUpdateSolicitacao();
  const deleteMutation = useDeleteSolicitacao();
  const enviarMutation = useEnviarParaAutorizacao();
  const autorizarMutation = useAutorizarSolicitacao();
  const reprovarMutation = useReprovarSolicitacao();
  const cancelarEnvioMutation = useCancelarEnvioSolicitacao();

  // Permissions
  const canSolicitar = isSuperAdmin || hasPermission('diarias_solicitar');
  const canAutorizar = isSuperAdmin || hasPermission('diarias_autorizar');
  
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

  // Handlers
  const handleOpenForm = (solicitacao?: DiariaSolicitacao) => {
    setEditingSolicitacao(solicitacao || null);
    setIsFormOpen(true);
  };

  const handleSaveForm = async (formData: SolicitacaoFormData) => {
    if (editingSolicitacao) {
      await updateMutation.mutateAsync({ id: editingSolicitacao.id, formData });
    } else {
      await createMutation.mutateAsync(formData);
    }
    setIsFormOpen(false);
    setEditingSolicitacao(null);
  };

  const handleEnviar = async (id: string) => {
    await enviarMutation.mutateAsync(id);
  };

  const handleOpenAprovacao = (id: string, action: 'autorizar' | 'reprovar') => {
    setSelectedId(id);
    setAprovacaoAction(action);
    setComentario("");
    setIsAprovacaoOpen(true);
  };

  const handleConfirmarAprovacao = async () => {
    if (!selectedId) return;
    
    if (aprovacaoAction === 'autorizar') {
      await autorizarMutation.mutateAsync({ id: selectedId, comentario });
    } else {
      await reprovarMutation.mutateAsync({ id: selectedId, comentario });
    }
    setIsAprovacaoOpen(false);
  };

  const handleOpenDeleteDialog = (id: string) => {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (deletingId) {
      await deleteMutation.mutateAsync(deletingId);
      setDeleteDialogOpen(false);
      setDeletingId(null);
    }
  };

  const handleCriarConvocacao = (solicitacao: any) => {
    navigate(`/requisicoes/diarias/convocacoes?solicitacao_id=${solicitacao.id}`);
  };

  const handleCancelarEnvio = async (id: string) => {
    await cancelarEnvioMutation.mutateAsync(id);
  };

  // Check segregation
  const canUserAutorizar = (criadoPor: string | null) => {
    return canAutorizar && criadoPor !== userId;
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Solicitações de Diária</h1>
            <p className="text-muted-foreground">
              Gerencie solicitações de diária para fins de semana e feriados
            </p>
          </div>
          {canSolicitar && (
            <Button onClick={() => handleOpenForm()}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Solicitação
            </Button>
          )}
        </div>

        {/* Summary Cards */}
        {resumo && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
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
                <div className="text-2xl font-bold">{resumo.enviada}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Autorizadas</CardTitle>
                <Check className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{resumo.autorizada}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Reprovadas</CardTitle>
                <X className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{resumo.reprovada}</div>
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
                  onValueChange={(v) => setFilters({ ...filters, status: (v === '__all__' ? undefined : (v as StatusSolicitacao)) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos</SelectItem>
                    <SelectItem value="rascunho">Rascunho</SelectItem>
                    <SelectItem value="enviada">Aguardando</SelectItem>
                    <SelectItem value="autorizada">Autorizada</SelectItem>
                    <SelectItem value="reprovada">Reprovada</SelectItem>
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
            ) : solicitacoes.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground">
                Nenhuma solicitação encontrada.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Centro de Custo</TableHead>
                    <TableHead>Justificativa</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {solicitacoes.map((sol) => (
                    <TableRow key={sol.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                          {format(new Date(sol.data), 'dd/MM/yyyy', { locale: ptBR })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {sol.bd_centros_custo?.codigo_centro_custo} - {sol.bd_centros_custo?.nome_centro_custo}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {sol.justificativa}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={sol.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {sol.status === 'rascunho' && canSolicitar && sol.criado_por === userId && (
                              <>
                                <DropdownMenuItem onClick={() => handleOpenForm(sol)}>
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  className="text-destructive"
                                  onClick={() => handleOpenDeleteDialog(sol.id)}
                                >
                                  Excluir
                                </DropdownMenuItem>
                              </>
                            )}
                            {sol.status === 'enviada' && (
                              <>
                                {/* Opções do aprovador */}
                                {canUserAutorizar(sol.criado_por) && (
                                  <>
                                    <DropdownMenuItem onClick={() => handleOpenAprovacao(sol.id, 'autorizar')}>
                                      <Check className="h-4 w-4 mr-2 text-green-500" />
                                      Autorizar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleOpenAprovacao(sol.id, 'reprovar')}>
                                      <X className="h-4 w-4 mr-2 text-red-500" />
                                      Reprovar
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {/* Opções do criador */}
                                {sol.criado_por === userId && (
                                  <>
                                    {canUserAutorizar(sol.criado_por) && <DropdownMenuSeparator />}
                                    <DropdownMenuItem onClick={() => handleCancelarEnvio(sol.id)}>
                                      <Undo2 className="h-4 w-4 mr-2 text-orange-500" />
                                      Cancelar Envio
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </>
                            )}
                            {sol.status === 'autorizada' && (
                              <DropdownMenuItem onClick={() => handleCriarConvocacao(sol)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Criar Convocação
                              </DropdownMenuItem>
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

        {/* Form Modal (novo modal com etapas) */}
        <SolicitacaoFormModal
          isOpen={isFormOpen}
          onClose={() => {
            setIsFormOpen(false);
            setEditingSolicitacao(null);
          }}
          onSave={handleSaveForm}
          onSaveAndSend={async (formData) => {
            if (editingSolicitacao) {
              await updateMutation.mutateAsync({ id: editingSolicitacao.id, formData });
              await enviarMutation.mutateAsync(editingSolicitacao.id);
            } else {
              const result = await createMutation.mutateAsync(formData);
              if (result?.id) {
                await enviarMutation.mutateAsync(result.id);
              }
            }
          }}
          editingSolicitacao={editingSolicitacao}
          isSaving={createMutation.isPending || updateMutation.isPending || enviarMutation.isPending}
        />

        {/* Aprovação Dialog */}
        <Dialog open={isAprovacaoOpen} onOpenChange={setIsAprovacaoOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {aprovacaoAction === 'autorizar' ? 'Autorizar Solicitação' : 'Reprovar Solicitação'}
              </DialogTitle>
              <DialogDescription>
                {aprovacaoAction === 'autorizar' 
                  ? 'Confirme a autorização desta solicitação de diária.'
                  : 'Informe o motivo da reprovação.'}
              </DialogDescription>
            </DialogHeader>
            <div>
              <Label>Comentário {aprovacaoAction === 'reprovar' && '*'}</Label>
              <Textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Adicione um comentário..."
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAprovacaoOpen(false)}>
                Cancelar
              </Button>
              <Button 
                variant={aprovacaoAction === 'autorizar' ? 'default' : 'destructive'}
                onClick={handleConfirmarAprovacao}
                disabled={autorizarMutation.isPending || reprovarMutation.isPending}
              >
                {(autorizarMutation.isPending || reprovarMutation.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {aprovacaoAction === 'autorizar' ? 'Autorizar' : 'Reprovar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <ConfirmDialog
          isOpen={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
          onConfirm={handleConfirmDelete}
          title="Excluir Solicitação"
          description="Tem certeza que deseja excluir esta solicitação? Esta ação não poderá ser desfeita."
          confirmText="Excluir"
          variant="danger"
          isLoading={deleteMutation.isPending}
        />
      </div>
    </MainLayout>
  );
}
