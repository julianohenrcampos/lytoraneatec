import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { useNavigate } from "react-router-dom";
import { formatBrazilianDateForDisplay } from "@/utils/timezoneUtils";
import { useIsMobile } from "@/hooks/use-mobile";
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
  Undo2,
  Eye,
  Users,
  DollarSign,
  Search,
  CalendarPlus,
  ClipboardCheck
} from "lucide-react";
import { lerConvocadosPre, derivarFuncionariosPlanos } from "@/lib/diarias/convocadosPreAdapter";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAditivosPendentesPorSolicitacao } from "@/hooks/diarias/useAditivosPendentesPorSolicitacao";
import { useHidratarNomesSolicitacoes } from "@/hooks/diarias/useHidratarNomesSolicitacoes";
import { useEstimativasListagem } from "@/hooks/diarias/useEstimativasListagem";
import { AditivoConfirmacaoModal } from "@/components/diarias/AditivoConfirmacaoModal";
import { useUserProfile } from "@/hooks/useUserProfile";

function contarConvocados(sol: { convocados_pre?: unknown; data_inicio: string; data_fim: string }): number {
  return derivarFuncionariosPlanos(
    lerConvocadosPre(sol.convocados_pre, { inicio: sol.data_inicio, fim: sol.data_fim })
  ).length;
}

import MainLayout from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
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
import { Combobox } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { usePermission } from "@/hooks/usePermission";
import DeleteSolicitacaoDialog from "@/components/diarias/DeleteSolicitacaoDialog";
import { 
  useSolicitacoesDiaria, 
  useSolicitacoesResumo,
  useCreateSolicitacao,
  useUpdateSolicitacao,
  useDeleteSolicitacao,
  useEnviarParaAutorizacao,
  useAutorizarSolicitacao,
  useReprovarSolicitacao,
  useCancelarEnvioSolicitacao,
  useCancelarAutorizacao,
  useDiariasDataScope
} from "@/hooks/diarias";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { StatusSolicitacao, SolicitacaoFormData, SolicitacaoFilters, DiariaSolicitacao } from "@/types/diarias";
import { SolicitacaoFormModal } from "@/components/diarias/SolicitacaoFormModal";
import { AprovacaoModal } from "@/components/diarias/AprovacaoModal";
import { SolicitacaoDetalhesModal } from "@/components/diarias/SolicitacaoDetalhesModal";
import { AditivoSolicitarModal } from "@/components/diarias/AditivoSolicitarModal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { usePagination } from "@/hooks/usePagination";
import TablePagination from "@/components/ui/table-pagination";
import { toast } from "sonner";

// Format currency helper
function formatCurrencyValue(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

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
  usePageTitle("Solicitações de Diária");
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { permissions, userId, isSuperAdmin, hasActionPermission, isLoading: isLoadingPermissions } = usePermission();
  const hasPermission = (perm: string) => permissions.includes(perm);
  
  // Hook de escopo de dados - RBAC
  const {
    userScope,
    scopeFilters,
    centrosCustoGerenciados,
    isLoading: isLoadingScope,
    canCreateSolicitacao,
    canEditSolicitacao,
    canDeleteSolicitacao,
    canResendSolicitacao,
    canApproveSolicitacao,
    canCancelAutorizacao,
    isOwnSolicitacao
  } = useDiariasDataScope();
  
  // Verificar permissão de acesso
  const hasAccess = isSuperAdmin || hasPermission('diarias_view') || hasPermission('diarias_solicitacoes_view') || userScope === 'admsso';
  
  // Filters
  const [filters, setFilters] = useState<SolicitacaoFilters>({});
  
  // Dialogs
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAprovacaoOpen, setIsAprovacaoOpen] = useState(false);
  const [isDetalhesOpen, setIsDetalhesOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detalhesId, setDetalhesId] = useState<string | null>(null);
  const [aprovacaoAction, setAprovacaoAction] = useState<'autorizar' | 'reprovar'>('autorizar');
  const [comentario, setComentario] = useState("");
  const [editingSolicitacao, setEditingSolicitacao] = useState<DiariaSolicitacao | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [cancelAutorizacaoDialogOpen, setCancelAutorizacaoDialogOpen] = useState(false);
  const [cancelAutorizacaoId, setCancelAutorizacaoId] = useState<string | null>(null);
  const [aditivoSolicitacaoId, setAditivoSolicitacaoId] = useState<string | null>(null);
  const [aditivoAnaliseId, setAditivoAnaliseId] = useState<string | null>(null);
  const [aditivoAnaliseSolicitacao, setAditivoAnaliseSolicitacao] = useState<DiariaSolicitacao | null>(null);
  const abrirAnaliseAditivo = (sol: DiariaSolicitacao) => {
    const pendentes = getPendentes(sol);
    if (!pendentes.length) return;
    setAditivoAnaliseSolicitacao(sol);
    setAditivoAnaliseId(pendentes[0].id);
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug('[AUDIT][aditivo-modal:open]', {
        solicitacaoId: sol.id,
        numeroSolicitacao: (sol as any).numero_solicitacao,
        pendentesRecebidos: pendentes.length,
        primeiroAditivoId: pendentes[0].id,
        hasPermAprovar: isSuperAdmin || !!profile?.acesso_global || hasActionPermission('diarias_aditivo_aprovar', 'aprovar'),
        source: 'pendentesMap',
      });
    }
  };
  const podeSolicitarAditivo = (sol: DiariaSolicitacao) =>
    sol.status === 'autorizada' &&
    (isSuperAdmin || hasPermission('diarias_aditivo_solicitar'));

  // Acesso global para análise de aditivos (Fase I.4)
  const { user: profile } = useUserProfile();

  // Fonte defensiva de escopo: prioriza centrosCustoGerenciados, fallback para scopeFilters.
  const allowedCentroIds = ((centrosCustoGerenciados?.length
    ? centrosCustoGerenciados
    : (scopeFilters?.centro_custo_ids ?? [])) as string[]);

  // RBAC base para aprovar aditivo
  const podeAnalisarAditivoBase =
    isSuperAdmin ||
    !!profile?.acesso_global ||
    hasActionPermission('diarias_aditivo_aprovar', 'aprovar');

  // Queries - COM ESCOPO OBRIGATÓRIO
  const { data: solicitacoes = [], isLoading } = useSolicitacoesDiaria(filters, scopeFilters);
  const { data: resumo } = useSolicitacoesResumo(filters, scopeFilters);

  // Aditivos pendentes da lista INTEIRA (pré-paginação), para permitir ordenação por pendências.
  const idsTotais = useMemo(() => solicitacoes.map((s) => s.id), [solicitacoes]);
  const { data: pendentesMap } = useAditivosPendentesPorSolicitacao(idsTotais);
  const getPendentes = (sol: DiariaSolicitacao) => pendentesMap?.get(sol.id) ?? [];

  // Ordenação: solicitações com mais aditivos pendentes primeiro; empate mantém ordem do service.
  const solicitacoesOrdenadas = useMemo(() => {
    const arr = solicitacoes.map((s, idx) => ({
      s,
      idx,
      p: pendentesMap?.get(s.id)?.length ?? 0,
    }));
    arr.sort((a, b) => (b.p - a.p) || (a.idx - b.idx));
    return arr.map((x) => x.s);
  }, [solicitacoes, pendentesMap]);

  // Pagination
  const pagination = usePagination(solicitacoesOrdenadas, { pageSize: 10 });

  // Estimativas recalculadas em tempo real (Fase I.4 — Ajuste B).
  const estimativasMap = useEstimativasListagem(pagination.paginatedData);

  // Hidratação de nomes via RPC SECURITY DEFINER (S1).
  const { nomesMap } = useHidratarNomesSolicitacoes(pagination.paginatedData);

  const getValorEstimado = (sol: DiariaSolicitacao) =>
    estimativasMap.get(sol.id) ?? sol.valor_estimado_total ?? 0;
  const getNomeEngenheiro = (sol: DiariaSolicitacao) =>
    (sol as any).engenheiro_solicitante?.nome_completo
      || (sol.engenheiro_solicitante_id ? nomesMap.get(sol.engenheiro_solicitante_id) : null)
      || '-';

  // Gate combinado: RBAC + escopo de CC + existência de pendentes.
  const podeAprovarAditivo = (sol: DiariaSolicitacao): boolean => {
    const pendentes = getPendentes(sol).length;
    if (pendentes === 0) return false;
    const bypass = isSuperAdmin || !!profile?.acesso_global;
    const hasPermAprovar = bypass || hasActionPermission('diarias_aditivo_aprovar', 'aprovar');
    const dentroDoEscopo = bypass || allowedCentroIds.includes(sol.centro_custo_id);
    const ok = pendentes > 0 && hasPermAprovar && dentroDoEscopo;
    if (import.meta.env.DEV) {
      const motivoBloqueio = ok
        ? null
        : !hasPermAprovar
          ? 'sem_permissao_diarias_aditivo_aprovar'
          : !dentroDoEscopo
            ? 'fora_do_escopo_cc'
            : 'sem_pendentes';
      // eslint-disable-next-line no-console
      console.debug('[AUDIT][diarias-solicitacoes:aditivo-action]', {
        solicitacaoId: sol.id,
        numeroSolicitacao: (sol as any).numero_solicitacao,
        centroCustoId: sol.centro_custo_id,
        aditivosPendentesCount: pendentes,
        userScope,
        hasPermAprovar,
        dentroDoEscopo,
        podeAprovarAditivo: ok,
        motivoBloqueio,
      });
    }
    return ok;
  };

  // DEV-only: auditoria de ordenação por pendências.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const primeiraPagina = solicitacoesOrdenadas.slice(0, 10);
    const counts = solicitacoesOrdenadas.map((s) => pendentesMap?.get(s.id)?.length ?? 0);
    // eslint-disable-next-line no-console
    console.debug('[AUDIT][diarias-solicitacoes:aditivo-sort]', {
      totalSolicitacoes: solicitacoesOrdenadas.length,
      comAditivoPendente: counts.filter((c) => c > 0).length,
      maxAditivosPendentes: counts.length ? Math.max(...counts) : 0,
      primeiraPaginaIds: primeiraPagina.map((s) => s.id),
      primeiraPaginaComAditivos: primeiraPagina.map((s) => ({
        id: s.id,
        pendentes: pendentesMap?.get(s.id)?.length ?? 0,
      })),
    });
  }, [solicitacoesOrdenadas, pendentesMap]);

  
  // Centro de custos — Fase 3-B.1: respeita escopo de dados (GerenteRegional/AdmOBRA)
  // Fonte do combo = centrosCustoGerenciados (sempre populado para gerente/admsede/admobra),
  // independente de scopeFilters ficar {} quando o usuário tem diarias_relatorio_view:visualizar.
  const canViewAllCcs = isSuperAdmin || userScope === 'admsso';
  const scopeCcIds = canViewAllCcs
    ? []
    : (centrosCustoGerenciados.length > 0
        ? centrosCustoGerenciados
        : (scopeFilters?.centro_custo_ids ?? []));
  const scopeKey = canViewAllCcs ? 'all' : [...scopeCcIds].sort().join(',');
  const { data: centrosCusto = [] } = useQuery({
    queryKey: ['centros-custo-solicitacoes', canViewAllCcs, scopeKey],
    enabled: !isLoadingScope,
    queryFn: async () => {
      // Fail-closed: usuário com escopo de CC mas sem CCs vinculados → lista vazia
      if (!canViewAllCcs && scopeCcIds.length === 0) return [];
      let query = supabase
        .from('bd_centros_custo')
        .select('id, codigo_centro_custo, nome_centro_custo');
      if (canViewAllCcs) {
        if (!isSuperAdmin) query = query.neq('codigo_centro_custo', 'DIR001');
      } else {
        query = query.in('id', scopeCcIds);
      }
      const { data } = await query.order('nome_centro_custo');
      if (import.meta.env.DEV) {
        console.log('[AUDIT][diarias-solicitacoes:cc-combo]', {
          userId,
          userScope,
          isSuperAdmin,
          canViewAllCcs,
          allowedCentroIds: scopeCcIds.length,
          returnedCentrosCount: (data || []).length,
          containsL498: (data || []).some((c: any) => c.codigo_centro_custo === 'L498'),
          source: canViewAllCcs ? 'all' : (centrosCustoGerenciados.length > 0 ? 'centrosCustoGerenciados' : 'scopeFilters'),
        });
      }
      return data || [];
    }
  });


  // Fase 3-B.4 — Abrir Detalhes via deep-link de notificação (?solicitacao_id=...)
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const solId = searchParams.get('solicitacao_id');
    if (!solId) return;
    const sol = solicitacoes.find((s) => s.id === solId);
    if (sol) {
      setDetalhesId(sol.id);
      setIsDetalhesOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete('solicitacao_id');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, solicitacoes, setSearchParams]);

  // Mutations
  const createMutation = useCreateSolicitacao();
  const updateMutation = useUpdateSolicitacao();
  const deleteMutation = useDeleteSolicitacao();
  const enviarMutation = useEnviarParaAutorizacao();
  const autorizarMutation = useAutorizarSolicitacao();
  const reprovarMutation = useReprovarSolicitacao();
  const cancelarEnvioMutation = useCancelarEnvioSolicitacao();
  const cancelarAutorizacaoMutation = useCancelarAutorizacao();
  
  // Loading de permissões e escopo
  if (isLoadingPermissions || isLoadingScope) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Carregando...</span>
        </div>
      </MainLayout>
    );
  }
  
  // Sem permissão
  if (!hasAccess) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
            <p className="text-xs text-muted-foreground mt-1">Permissão necessária: diarias_solicitacoes_view</p>
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
    try {
      if (editingSolicitacao) {
        await updateMutation.mutateAsync({ id: editingSolicitacao.id, formData });
      } else {
        await createMutation.mutateAsync(formData);
      }
      setIsFormOpen(false);
      setEditingSolicitacao(null);
    } catch (error) {
      console.error("Erro ao salvar solicitação:", error);
    }
  };

  const handleEnviar = async (id: string) => {
    try {
      await enviarMutation.mutateAsync(id);
    } catch (error) {
      console.error("Erro ao enviar solicitação:", error);
    }
  };

  const handleOpenAprovacao = (solicitacao: DiariaSolicitacao, action: 'autorizar' | 'reprovar') => {
    // Bloquear aprovação se não tiver responsável de campo definido
    if (action === 'autorizar' && !solicitacao.responsavel_campo_id) {
      toast.error('Defina o responsável pelo apontamento de campo antes de aprovar.');
      return;
    }
    setSelectedId(solicitacao.id);
    setAprovacaoAction(action);
    setIsAprovacaoOpen(true);
  };

  const handleConfirmarAprovacao = async (data: {
    responsavel_campo_id?: string;
    observacao_gerente?: string;
  }) => {
    if (!selectedId) return;
    try {
      if (aprovacaoAction === 'autorizar') {
        await autorizarMutation.mutateAsync({ 
          id: selectedId, 
          responsavelCampoId: data.responsavel_campo_id,
          observacaoGerente: data.observacao_gerente
        });
      } else {
        await reprovarMutation.mutateAsync({ 
          id: selectedId, 
          observacaoGerente: data.observacao_gerente
        });
      }
      setIsAprovacaoOpen(false);
    } catch (error) {
      console.error("Erro na aprovação:", error);
    }
  };

  const handleOpenDeleteDialog = (id: string) => {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteMutation.mutateAsync(deletingId);
    } catch (error) {
      console.error("Erro ao excluir solicitação:", error);
    } finally {
      setDeleteDialogOpen(false);
      setDeletingId(null);
    }
  };


  const handleOpenCancelarAutorizacao = (id: string) => {
    setCancelAutorizacaoId(id);
    setCancelAutorizacaoDialogOpen(true);
  };

  const handleConfirmCancelarAutorizacao = async () => {
    if (!cancelAutorizacaoId) return;
    try {
      await cancelarAutorizacaoMutation.mutateAsync(cancelAutorizacaoId);
    } catch (error) {
      console.error("Erro ao cancelar autorização:", error);
    } finally {
      setCancelAutorizacaoDialogOpen(false);
      setCancelAutorizacaoId(null);
    }
  };

  const handleCancelarEnvio = async (id: string) => {
    try {
      await cancelarEnvioMutation.mutateAsync(id);
    } catch (error) {
      console.error("Erro ao cancelar envio:", error);
    }
  };

  const handleVerDetalhes = (solicitacao: DiariaSolicitacao) => {
    setDetalhesId(solicitacao.id);
    setIsDetalhesOpen(true);
  };

  // Check segregation - usando hook de escopo
  const canUserAutorizar = (sol: DiariaSolicitacao) => {
    return canApproveSolicitacao(sol);
  };

  // Verificar permissão de edição/exclusão
  const canUserEdit = (sol: DiariaSolicitacao) => {
    return canEditSolicitacao(sol) && ['rascunho', 'enviada'].includes(sol.status);
  };

  const canUserDelete = (sol: DiariaSolicitacao) => {
    return canDeleteSolicitacao(sol);
  };

  const canUserResend = (sol: DiariaSolicitacao) => {
    return canResendSolicitacao(sol);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div></div>
          {canCreateSolicitacao && (
            <Button onClick={() => handleOpenForm()}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Solicitação
            </Button>
          )}
        </div>

        {/* Summary Cards */}
        {resumo && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                <CardTitle className="text-xs font-medium">Total</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xl md:text-2xl font-bold">{resumo.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                <CardTitle className="text-xs font-medium">Aguardando</CardTitle>
                <Send className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xl md:text-2xl font-bold">{resumo.enviada}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                <CardTitle className="text-xs font-medium">Autorizadas</CardTitle>
                <Check className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xl md:text-2xl font-bold">{resumo.autorizada}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                <CardTitle className="text-xs font-medium">Reprovadas</CardTitle>
                <X className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xl md:text-2xl font-bold">{resumo.reprovada}</div>
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
            <div className="grid gap-4 md:grid-cols-5">
              <div>
                <Label>Nº Solicitação</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar nº..."
                    value={filters.numero_solicitacao || ''}
                    onChange={(e) => setFilters({ ...filters, numero_solicitacao: e.target.value || undefined })}
                    className="pl-8"
                  />
                </div>
              </div>
              <div>
                <Label>Data Início</Label>
                <Input
                  type="date"
                  value={filters.periodo_inicio || ''}
                  onChange={(e) => setFilters({ ...filters, periodo_inicio: e.target.value || undefined })}
                />
              </div>
              <div>
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={filters.periodo_fim || ''}
                  onChange={(e) => setFilters({ ...filters, periodo_fim: e.target.value || undefined })}
                />
              </div>
              <div>
                <Label>Centro de Custo</Label>
                <Combobox
                  options={[
                    { value: '__all__', label: 'Todos' },
                    ...centrosCusto.map((cc: any) => ({
                      value: cc.id,
                      label: `${cc.codigo_centro_custo} - ${cc.nome_centro_custo}`
                    }))
                  ]}
                  value={filters.centro_custo_id ?? '__all__'}
                  onChange={(v) => setFilters({ ...filters, centro_custo_id: v === '__all__' ? undefined : v })}
                  placeholder="Todos"
                  searchPlaceholder="Buscar centro de custo..."
                  emptyText="Nenhum centro de custo encontrado"
                />
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
              isMobile ? (
                /* Mobile Card View */
                <div className="p-3 space-y-3">
                  {pagination.paginatedData.map((sol) => {
                    const qtdAditivosPendentes = getPendentes(sol).length;
                    const temAditivoPendente = qtdAditivosPendentes > 0;
                    const labelAditivoPendente = qtdAditivosPendentes === 1
                      ? "Aditivo pendente"
                      : `${qtdAditivosPendentes} aditivos pendentes`;
                    return (
                    <Card
                      key={sol.id}
                      className={cn(
                        sol.status === 'rascunho' && 'bg-muted/40',
                        sol.status === 'enviada' && 'bg-amber-50 border-l-4 border-l-amber-500',
                        sol.status === 'reprovada' && 'border-destructive/50 bg-destructive/5',
                        temAditivoPendente && 'bg-amber-50/70 border-l-4 border-l-amber-500',
                      )}
                      title={temAditivoPendente ? 'Esta solicitação possui aditivo pendente de aprovação.' : undefined}
                    >
                      <CardContent className="p-4 space-y-3">
                        {/* Header: Nº + Status */}
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-mono font-semibold text-primary text-base">
                              {sol.numero_solicitacao}
                            </span>
                            <p className="text-xs text-black mt-0.5">
                              {formatBrazilianDateForDisplay(sol.created_at?.split('T')[0])}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <StatusBadge status={sol.status} />
                            {temAditivoPendente && (
                              <Badge variant="outline" className="border-amber-500 text-amber-700 bg-amber-50 w-fit px-1.5 py-0 text-[10px] leading-4 font-medium">
                                {labelAditivoPendente}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Centro de Custo */}
                        <div className="flex items-center gap-2 text-sm">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="truncate">
                            {sol.bd_centros_custo?.nome_centro_custo?.startsWith(sol.bd_centros_custo?.codigo_centro_custo) ? sol.bd_centros_custo?.nome_centro_custo : `${sol.bd_centros_custo?.codigo_centro_custo} - ${sol.bd_centros_custo?.nome_centro_custo}`}
                          </span>
                        </div>

                        {/* Engenheiro Solicitante */}
                        <div className="flex items-center gap-2 text-sm">
                          <Users className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="truncate">
                            {getNomeEngenheiro(sol)}
                          </span>
                        </div>

                        {/* Período */}
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CalendarIcon className="h-3.5 w-3.5 flex-shrink-0" />
                          <span>
                            {formatBrazilianDateForDisplay(sol.data_inicio)}
                            {sol.data_fim !== sol.data_inicio && (
                              <> → {formatBrazilianDateForDisplay(sol.data_fim)}</>
                            )}
                          </span>
                        </div>

                        {/* Convocados + Valor */}
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Users className="h-3.5 w-3.5" />
                            <span>{contarConvocados(sol)} convocados</span>
                          </div>
                          <div className="flex items-center gap-1 font-medium">
                            <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{formatCurrencyValue(getValorEstimado(sol))}</span>
                          </div>
                        </div>

                        {/* Ações */}
                        <div className="flex items-center justify-end gap-1 pt-1 border-t">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0"
                            onClick={() => handleVerDetalhes(sol)}
                            title="Ver Detalhes"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {podeSolicitarAditivo(sol) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-primary hover:bg-primary/10"
                              onClick={() => setAditivoSolicitacaoId(sol.id)}
                              title="Solicitação de Aditivo"
                            >
                              <CalendarPlus className="h-4 w-4" />
                            </Button>
                          )}
                          {podeAprovarAditivo(sol) && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 relative text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                    onClick={() => abrirAnaliseAditivo(sol)}
                                    aria-label="Analisar aditivo pendente"
                                  >
                                    <ClipboardCheck className="h-4 w-4" />
                                    {getPendentes(sol).length > 1 && (
                                      <span className="absolute -top-1 -right-1 bg-amber-600 text-white rounded-full text-[10px] leading-none px-1 py-0.5">
                                        {getPendentes(sol).length}
                                      </span>
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Esta solicitação possui aditivo pendente de aprovação.</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {sol.status === 'enviada' && canUserAutorizar(sol) && (
                            <>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() => handleOpenAprovacao(sol, 'autorizar')}
                                title="Autorizar"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleOpenAprovacao(sol, 'reprovar')}
                                title="Reprovar"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {canUserEdit(sol) && (
                                <DropdownMenuItem onClick={() => handleOpenForm(sol)}>Editar</DropdownMenuItem>
                              )}
                              {canUserDelete(sol) && (
                                <DropdownMenuItem className="text-destructive" onClick={() => handleOpenDeleteDialog(sol.id)}>Excluir</DropdownMenuItem>
                              )}
                              {sol.status === 'enviada' && isOwnSolicitacao(sol) && (
                                <DropdownMenuItem onClick={() => handleCancelarEnvio(sol.id)}>
                                  <Undo2 className="h-4 w-4 mr-2" />Cancelar Envio
                                </DropdownMenuItem>
                              )}
                              {sol.status === 'autorizada' && canCancelAutorizacao(sol) && (
                                <DropdownMenuItem className="text-orange-600" onClick={() => handleOpenCancelarAutorizacao(sol.id)}>
                                  <Undo2 className="h-4 w-4 mr-2" />Cancelar Autorização
                                </DropdownMenuItem>
                              )}
                              {canUserResend(sol) && (
                                <DropdownMenuItem onClick={() => handleOpenForm(sol)}>
                                  <Undo2 className="h-4 w-4 mr-2" />Reenviar
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardContent>
                    </Card>
                    );
                  })}
                </div>
              ) : (
                /* Desktop Table View */
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Nº</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Centro de Custo</TableHead>
                      <TableHead>Eng. Solicitante</TableHead>
                      <TableHead className="text-center">Convocados</TableHead>
                      <TableHead className="text-right">Valor Estimado</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagination.paginatedData.map((sol) => {
                      const qtdAditivosPendentes = getPendentes(sol).length;
                      const temAditivoPendente = qtdAditivosPendentes > 0;
                      const labelAditivoPendente = qtdAditivosPendentes === 1
                        ? "Aditivo pendente"
                        : `${qtdAditivosPendentes} aditivos pendentes`;
                      return (
                      <TableRow
                        key={sol.id}
                        className={cn(
                          "transition-colors",
                          sol.status === 'rascunho' && 'bg-muted/40 hover:bg-muted/60',
                          sol.status === 'enviada' && 'bg-amber-50 hover:bg-amber-100',
                          sol.status === 'reprovada' && 'bg-red-50 hover:bg-red-100',
                          temAditivoPendente && 'bg-amber-50/70 border-l-4 border-l-amber-500 hover:bg-amber-100/70',
                        )}
                        title={temAditivoPendente ? 'Esta solicitação possui aditivo pendente de aprovação.' : undefined}
                      >
                        <TableCell>
                          <div>
                            <span className="font-mono font-bold text-primary text-base whitespace-nowrap">
                              {sol.numero_solicitacao}
                            </span>
                            <p className="text-xs text-black mt-0.5">
                              {formatBrazilianDateForDisplay(sol.created_at?.split('T')[0])}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-start gap-2">
                            <CalendarIcon className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div className="text-sm">
                              <span>{formatBrazilianDateForDisplay(sol.data_inicio)}</span>
                              {sol.data_fim !== sol.data_inicio && (
                                <>
                                  <span className="block text-muted-foreground">↓</span>
                                  <span>{formatBrazilianDateForDisplay(sol.data_fim)}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            {sol.bd_centros_custo?.codigo_centro_custo || '-'}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getNomeEngenheiro(sol)}
                        </TableCell>
                        <TableCell className="text-center">
                          {contarConvocados(sol)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrencyValue(getValorEstimado(sol))}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <StatusBadge status={sol.status} />
                            {temAditivoPendente && (
                              <Badge variant="outline" className="border-amber-500 text-amber-700 bg-amber-50 w-fit px-1.5 py-0 text-[10px] leading-4 font-medium">
                                {labelAditivoPendente}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Botão Ver Detalhes para status finalizados (autorizada/reprovada) */}
                            {(sol.status === 'autorizada' || sol.status === 'reprovada') && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                onClick={() => handleVerDetalhes(sol)}
                                title="Ver Detalhes"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                            {podeSolicitarAditivo(sol) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-primary hover:bg-primary/10"
                                onClick={() => setAditivoSolicitacaoId(sol.id)}
                                title="Solicitação de Aditivo"
                              >
                                <CalendarPlus className="h-4 w-4" />
                              </Button>
                            )}
                            {podeAprovarAditivo(sol) && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0 relative text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                      onClick={() => abrirAnaliseAditivo(sol)}
                                      aria-label="Analisar aditivo pendente"
                                    >
                                      <ClipboardCheck className="h-4 w-4" />
                                      {getPendentes(sol).length > 1 && (
                                        <span className="absolute -top-1 -right-1 bg-amber-600 text-white rounded-full text-[10px] leading-none px-1 py-0.5">
                                          {getPendentes(sol).length}
                                        </span>
                                      )}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Esta solicitação possui aditivo pendente de aprovação.</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            {/* Botões diretos de aprovação para status "enviada" */}
                            {sol.status === 'enviada' && canUserAutorizar(sol) && (
                              <>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  onClick={() => handleVerDetalhes(sol)}
                                  title="Ver Detalhes"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                  onClick={() => handleOpenAprovacao(sol, 'autorizar')}
                                  title="Autorizar"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => handleOpenAprovacao(sol, 'reprovar')}
                                  title="Reprovar"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {canUserEdit(sol) && (
                                <DropdownMenuItem onClick={() => handleOpenForm(sol)}>
                                  Editar
                                </DropdownMenuItem>
                              )}
                              {canUserDelete(sol) && (
                                <>
                                  {canUserEdit(sol) && <DropdownMenuSeparator />}
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
                                  {canUserAutorizar(sol) && (
                                    <>
                                      <DropdownMenuItem onClick={() => handleOpenAprovacao(sol, 'autorizar')}>
                                        <Check className="h-4 w-4 mr-2 text-green-500" />
                                        Autorizar
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleOpenAprovacao(sol, 'reprovar')}>
                                        <X className="h-4 w-4 mr-2 text-red-500" />
                                        Reprovar
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  {/* Opções do criador */}
                                  {isOwnSolicitacao(sol) && (
                                    <>
                                      {canUserAutorizar(sol) && <DropdownMenuSeparator />}
                                      <DropdownMenuItem onClick={() => handleCancelarEnvio(sol.id)}>
                                        <Undo2 className="h-4 w-4 mr-2 text-orange-500" />
                                        Cancelar Envio
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </>
                              )}
                              {/* Cancelar autorização para autorizadas */}
                              {sol.status === 'autorizada' && canCancelAutorizacao(sol) && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    className="text-orange-600"
                                    onClick={() => handleOpenCancelarAutorizacao(sol.id)}
                                  >
                                    <Undo2 className="h-4 w-4 mr-2 text-orange-500" />
                                    Cancelar Autorização
                                  </DropdownMenuItem>
                                </>
                              )}
                              {/* Botão reenviar para reprovadas */}
                              {canUserResend(sol) && (
                                <DropdownMenuItem onClick={() => handleOpenForm(sol)}>
                                  <Undo2 className="h-4 w-4 mr-2 text-blue-500" />
                                  Reenviar
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )
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
            try {
              if (editingSolicitacao) {
                await updateMutation.mutateAsync({ id: editingSolicitacao.id, formData });
                await enviarMutation.mutateAsync(editingSolicitacao.id);
              } else {
                console.info('[Diarias][Page] fluxo salvar e enviar', {
                  userId: userId || null,
                  canCreateSolicitacao,
                  payload: formData,
                });
                const result = await createMutation.mutateAsync(formData);
                if (result?.id) {
                  await enviarMutation.mutateAsync(result.id);
                }
              }
            } catch (error) {
              console.error('Erro ao salvar e enviar:', error);
              throw error;
            }
          }}
          editingSolicitacao={editingSolicitacao}
          isSaving={createMutation.isPending || updateMutation.isPending || enviarMutation.isPending}
        />

        {/* Aprovação Modal */}
        <AprovacaoModal
          isOpen={isAprovacaoOpen}
          onClose={() => setIsAprovacaoOpen(false)}
          solicitacao={solicitacoes.find(s => s.id === selectedId) || null}
          action={aprovacaoAction}
          onConfirm={handleConfirmarAprovacao}
          isLoading={autorizarMutation.isPending || reprovarMutation.isPending}
        />

        {/* Detalhes Modal */}
        <SolicitacaoDetalhesModal
          isOpen={isDetalhesOpen}
          onClose={() => setIsDetalhesOpen(false)}
          solicitacao={solicitacoes.find(s => s.id === detalhesId) || null}
          canAutorizar={(() => {
            const sol = solicitacoes.find(s => s.id === detalhesId);
            return sol ? canUserAutorizar(sol) : false;
          })()}
          onAutorizar={(sol) => {
            setIsDetalhesOpen(false);
            setTimeout(() => handleOpenAprovacao(sol, 'autorizar'), 300);
          }}
          onReprovar={(sol) => {
            setIsDetalhesOpen(false);
            setTimeout(() => handleOpenAprovacao(sol, 'reprovar'), 300);
          }}
        />

        {/* Aditivo Modal (Fase I.3) */}
        {(() => {
          const sol = solicitacoes.find((s) => s.id === aditivoSolicitacaoId);
          if (!sol) return null;
          return (
            <AditivoSolicitarModal
              open={!!aditivoSolicitacaoId}
              onOpenChange={(o) => !o && setAditivoSolicitacaoId(null)}
              solicitacao={sol}
            />
          );
        })()}

        {/* Aditivo — Análise rápida a partir da listagem (Fase I.4) */}
        <AditivoConfirmacaoModal
          aditivoId={aditivoAnaliseId}
          aditivos={aditivoAnaliseSolicitacao ? getPendentes(aditivoAnaliseSolicitacao) : undefined}
          solicitacaoInfo={
            aditivoAnaliseSolicitacao
              ? {
                  id: aditivoAnaliseSolicitacao.id,
                  numero_solicitacao: (aditivoAnaliseSolicitacao as any).numero_solicitacao,
                  centro_custo_id: aditivoAnaliseSolicitacao.centro_custo_id,
                  criado_por: (aditivoAnaliseSolicitacao as any).criado_por ?? null,
                  bd_centros_custo: (aditivoAnaliseSolicitacao as any).bd_centros_custo ?? null,
                  engenheiro_solicitante_id: (aditivoAnaliseSolicitacao as any).engenheiro_solicitante_id ?? null,
                }
              : undefined
          }
          open={!!aditivoAnaliseId}
          onOpenChange={(v) => {
            if (!v) {
              setAditivoAnaliseId(null);
              setAditivoAnaliseSolicitacao(null);
            }
          }}
        />

        {/* Pagination */}
        {solicitacoes.length > 0 && (
          <TablePagination pagination={pagination} className="mt-4" />
        )}

        {/* Cancelar Autorização Dialog */}
        <ConfirmDialog
          isOpen={cancelAutorizacaoDialogOpen}
          onClose={() => setCancelAutorizacaoDialogOpen(false)}
          onConfirm={handleConfirmCancelarAutorizacao}
          title="Cancelar Autorização"
          description="Tem certeza que deseja cancelar a autorização desta solicitação? Os apontamentos de campo e presenças registradas serão removidos permanentemente. A solicitação voltará para o status 'Aguardando Aprovação'."
          confirmText="Sim, Cancelar Autorização"
          cancelText="Não, Manter"
          variant="warning"
          isLoading={cancelarAutorizacaoMutation.isPending}
        />

        {/* Delete Confirmation Dialog */}
        <DeleteSolicitacaoDialog
          isOpen={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
          onConfirm={handleConfirmDelete}
          solicitacaoId={deletingId}
          solicitacaoNumero={solicitacoes.find(s => s.id === deletingId)?.numero_solicitacao || null}
          isDeleting={deleteMutation.isPending}
        />
      </div>
    </MainLayout>
  );
}
