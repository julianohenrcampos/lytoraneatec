import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseBrazilianDate, formatBrazilianDateForDisplay, getCurrentBrazilianDate } from "@/utils/timezoneUtils";
import {
  ClipboardCheck,
  Calendar,
  Building2,
  User,
  Loader2,
  Filter,
  Users,
  Eye
} from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { useDynamicPermissions } from "@/hooks/useDynamicPermissions";
import { useApontamentosCampo, useToggleEdicaoLiberada } from "@/hooks/diarias/useApontamentosCampo";
import { useDiariasDataScope } from "@/hooks/diarias";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { StatusApontamento, FuncionarioPreConvocado, DiariaApontamento } from "@/types/diarias";
import ApontamentoDiariasModal from "@/components/diarias/ApontamentoDiariasModal";
import { toast } from "sonner";
import { usePagination } from "@/hooks/usePagination";
import TablePagination from "@/components/ui/table-pagination";
import { Switch } from "@/components/ui/switch";


export default function DiariasApontamentoCampo() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { permissions, isSuperAdmin, isLoading: isLoadingPermissions } = useDynamicPermissions();
  const hasPermission = (perm: string) => permissions.includes(perm);

  // Hook de escopo de dados - RBAC
  const { 
    userScope, 
    getApontamentosFilter,
    canApontar,
    isLoading: isLoadingScope 
  } = useDiariasDataScope();

  const hasAccess = isSuperAdmin || hasPermission('diarias_apontamento_view') || hasPermission('diarias_view') || userScope === 'admsso';

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusApontamento | '__all__'>('__all__');
  const [dataFilter, setDataFilter] = useState('');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedApontamento, setSelectedApontamento] = useState<DiariaApontamento | null>(null);
  const [modalReadOnly, setModalReadOnly] = useState(false);
  const [modalInitialDate, setModalInitialDate] = useState<string | undefined>(undefined);

  // Mutation toggle edição
  const toggleEdicao = useToggleEdicaoLiberada();

  // Query apontamentos - COM ESCOPO OBRIGATÓRIO
  const apontamentoScopeFilters = useMemo(() => getApontamentosFilter(), [getApontamentosFilter]);
  const statusFilterMemo = useMemo(
    () => (statusFilter !== '__all__' ? { status: statusFilter } : undefined),
    [statusFilter]
  );
  const { data: apontamentos = [], isLoading, refetch } = useApontamentosCampo(
    statusFilterMemo,
    apontamentoScopeFilters
  );
  
  // Extrair IDs estáveis das solicitações para usar na query de presenças
  const solicitacaoIds = useMemo(
    () => apontamentos.map((a: any) => a.bd_diaria_solicitacoes?.id).filter(Boolean).sort() as string[],
    [apontamentos]
  );
  const solicitacaoIdsKey = solicitacaoIds.join(',');

  // Query para buscar datas apontadas por solicitação com status de horários
  interface PresencaStatus { data: string; temEntrada: boolean; temSaida: boolean; temRegistro: boolean; todosFalta: boolean }
  const { data: datasApontadasMap = {} } = useQuery({
    queryKey: ['datas-apontadas-por-solicitacao', solicitacaoIdsKey],
    queryFn: async () => {
      if (solicitacaoIds.length === 0) return {};
      
      const { data } = await supabase
        .from('bd_diaria_presencas')
        .select('solicitacao_id, data, hora_entrada, hora_saida, presente')
        .in('solicitacao_id', solicitacaoIds);
      
      const mapa: Record<string, PresencaStatus[]> = {};
      (data || []).forEach((p) => {
        if (!mapa[p.solicitacao_id]) {
          mapa[p.solicitacao_id] = [];
        }
        const existing = mapa[p.solicitacao_id].find(x => x.data === p.data);
        if (existing) {
          if (p.hora_entrada) existing.temEntrada = true;
          if (p.hora_saida) existing.temSaida = true;
          existing.temRegistro = true;
          if (p.presente) existing.todosFalta = false;
        } else {
          mapa[p.solicitacao_id].push({
            data: p.data,
            temEntrada: !!p.hora_entrada,
            temSaida: !!p.hora_saida,
            temRegistro: true,
            todosFalta: !p.presente
          });
        }
      });
      return mapa;
    },
    enabled: solicitacaoIds.length > 0,
    staleTime: 30000
  });

  // Ordenar: apontamentos totalmente finalizados vão para o final
  const sortedApontamentos = useMemo(() => {
    if (!apontamentos.length) return apontamentos;
    return [...apontamentos].sort((a: any, b: any) => {
      const solA = a.bd_diaria_solicitacoes;
      const solB = b.bd_diaria_solicitacoes;
      const datasA = datasApontadasMap[solA?.id] || [];
      const datasB = datasApontadasMap[solB?.id] || [];
      
      const countDatasA = (() => {
        try {
          return eachDayOfInterval({
            start: parseBrazilianDate(solA?.data_inicio),
            end: parseBrazilianDate(solA?.data_fim)
          }).length;
        } catch { return 0; }
      })();
      const countDatasB = (() => {
        try {
          return eachDayOfInterval({
            start: parseBrazilianDate(solB?.data_inicio),
            end: parseBrazilianDate(solB?.data_fim)
          }).length;
        } catch { return 0; }
      })();

      const allFinA = countDatasA > 0 && datasA.length >= countDatasA && datasA.every((d: any) => (d.temEntrada && d.temSaida) || (d.temRegistro && d.todosFalta));
      const allFinB = countDatasB > 0 && datasB.length >= countDatasB && datasB.every((d: any) => (d.temEntrada && d.temSaida) || (d.temRegistro && d.todosFalta));

      if (allFinA && !allFinB) return 1;
      if (!allFinA && allFinB) return -1;
      return 0;
    });
  }, [apontamentos, datasApontadasMap]);

  // Pagination
  const pagination = usePagination(sortedApontamentos, { pageSize: 6 });

  // Handlers
  const handleOpenModal = (apontamento: any, readOnly: boolean = false, initialDate?: string) => {
    setSelectedApontamento(apontamento as DiariaApontamento);
    setModalReadOnly(readOnly);
    setModalInitialDate(initialDate);
    setIsModalOpen(true);
  };

  const handleSaveSuccess = () => {
    toast.success("Apontamento salvo com sucesso!");
    refetch();
    queryClient.invalidateQueries({ queryKey: ['diaria-presencas'] });
    queryClient.invalidateQueries({ queryKey: ['datas-apontadas-por-solicitacao'] });
  };

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

  if (!hasAccess) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Parse convocados helper
  const parseConvocados = (convocadosPre: any): FuncionarioPreConvocado[] => {
    if (!convocadosPre) return [];
    if (Array.isArray(convocadosPre)) return convocadosPre;
    return [];
  };

  // Data de hoje para comparação
  const hojeStr = getCurrentBrazilianDate();

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6" />
            Apontamento de Campo - Diárias
          </h1>
          <p className="text-muted-foreground">
            Registre a presença e horários dos funcionários em campo
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label>Data</Label>
                <Input
                  type="date"
                  value={dataFilter}
                  onChange={(e) => setDataFilter(e.target.value)}
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={statusFilter}
                  onValueChange={(v) => setStatusFilter(v as StatusApontamento | '__all__')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos</SelectItem>
                    <SelectItem value="aberto">Aberto</SelectItem>
                    <SelectItem value="em_andamento">Em Andamento</SelectItem>
                    <SelectItem value="finalizado">Finalizado</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setStatusFilter('__all__');
                    setDataFilter('');
                  }}
                >
                  Limpar Filtros
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Apontamentos List */}
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : apontamentos.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <ClipboardCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum apontamento encontrado.</p>
              <p className="text-sm mt-1">
                Apontamentos são criados automaticamente quando uma solicitação é aprovada.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {pagination.paginatedData.map((apontamento: any) => {
              const solicitacao = apontamento.bd_diaria_solicitacoes;
              const convocados = parseConvocados(solicitacao?.convocados_pre);
              const centroCusto = solicitacao?.bd_centros_custo;

              // Gerar todas as datas do período (IIFE para evitar hook dentro do map)
              const todasDatas = (() => {
                if (!solicitacao?.data_inicio || !solicitacao?.data_fim) return [];
                try {
                  return eachDayOfInterval({
                    start: parseBrazilianDate(solicitacao.data_inicio),
                    end: parseBrazilianDate(solicitacao.data_fim)
                  }).map(d => format(d, 'yyyy-MM-dd'));
                } catch {
                  return [];
                }
              })();

              // Datas já apontadas para esta solicitação (com status)
              const datasApontadas = datasApontadasMap[solicitacao?.id] || [];
              const getDataStatus = (dataStr: string) => datasApontadas.find((d: PresencaStatus) => d.data === dataStr);
              return (
                <Card key={apontamento.id} className="hover:shadow-md transition-shadow">
                  {/* Header: Centro de Custo + Nº Solicitação */}
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      <span title={centroCusto?.nome_centro_custo}>{centroCusto?.codigo_centro_custo}</span>
                      {solicitacao?.numero_solicitacao && (
                        <Badge variant="secondary" className="font-mono text-xs ml-auto">
                          {solicitacao.numero_solicitacao}
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Linha de informações */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Responsável</p>
                          <p className="font-medium">{apontamento.responsavel_campo?.nome_completo || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Funcionários</p>
                          <p className="font-medium">{convocados.length} convocados</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Período</p>
                          <p className="font-medium">
                            {solicitacao?.data_inicio && format(parseBrazilianDate(solicitacao.data_inicio), 'dd/MM')} → {solicitacao?.data_fim && formatBrazilianDateForDisplay(solicitacao.data_fim)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Datas com indicadores + Botão */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pt-3 border-t gap-4">
                      <div className="flex flex-wrap gap-1 flex-1">
                        {todasDatas.map((dataStr) => {
                          const status = getDataStatus(dataStr);
                          const isHoje = dataStr === hojeStr;
                          const isPast = dataStr < hojeStr;
                          const dia = format(parseBrazilianDate(dataStr), 'dd');
                          const isLiberado = (apontamento as any).edicao_liberada;

                          // Determinar variante e classes
                          let variant: "success" | "warning" | "destructive" | "outline" = "outline";
                          let extraClasses = "";

                          if (status) {
                            if ((status.temEntrada && status.temSaida) || (status.temRegistro && status.todosFalta)) {
                              // Finalizado (todos com entrada+saída OU todos são falta)
                              variant = "success";
                              if (isLiberado) {
                                extraClasses = "border-2 border-gray-400 cursor-pointer hover:opacity-80 transition-all";
                              }
                            } else if (status.temEntrada && !status.temSaida) {
                              // Iniciado (só entrada)
                              variant = "warning";
                            }
                          } else {
                            // Sem registro
                            if (isPast) {
                              variant = "destructive";
                            } else if (isHoje) {
                              extraClasses = "border-primary text-primary border-2 bg-transparent";
                            } else {
                              extraClasses = "bg-muted text-muted-foreground";
                            }
                          }

                          const isClickable = isLiberado && isSuperAdmin && (isPast || isHoje);

                          const titleParts = [formatBrazilianDateForDisplay(dataStr)];
                          if (status?.temEntrada && status?.temSaida) titleParts.push('Finalizado');
                          else if (status?.temEntrada) titleParts.push('Iniciado');
                          else if (isPast) titleParts.push('Não apontado');
                          else if (isHoje) titleParts.push('Hoje');
                          if (isClickable) titleParts.push('Clique para editar');

                          return (
                            <Badge
                              key={dataStr}
                              variant={variant}
                              className={cn(
                                "text-xs w-8 h-8 flex items-center justify-center rounded-md",
                                !isClickable && "cursor-default",
                                extraClasses
                              )}
                              title={titleParts.join(' - ')}
                              onClick={() => {
                                if (isClickable) {
                                  handleOpenModal(apontamento, false, dataStr);
                                }
                              }}
                            >
                              {dia}
                            </Badge>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-3">
                        {/* Toggle SuperAdmin para liberar edição */}
                        {isSuperAdmin && (
                          <div className="flex items-center gap-2">
                            {(apontamento as any).edicao_liberada && (
                              <Badge className="text-[10px] bg-yellow-500 text-white">Liberado</Badge>
                            )}
                            <div className="flex items-center gap-1.5">
                              <Switch
                                checked={(apontamento as any).edicao_liberada || false}
                                onCheckedChange={(checked) => toggleEdicao.mutate({ id: apontamento.id, liberada: checked })}
                                disabled={toggleEdicao.isPending}
                              />
                              <span className="text-xs text-muted-foreground whitespace-nowrap">Liberar</span>
                            </div>
                          </div>
                        )}
                        <Button
                          size="sm"
                          variant={canApontar(apontamento.responsavel_campo_id, apontamento.bd_diaria_solicitacoes?.criado_por) ? "default" : "outline"}
                          onClick={() => handleOpenModal(apontamento, !canApontar(apontamento.responsavel_campo_id, apontamento.bd_diaria_solicitacoes?.criado_por))}
                        >
                          {canApontar(apontamento.responsavel_campo_id, apontamento.bd_diaria_solicitacoes?.criado_por) ? (
                            <>
                              <ClipboardCheck className="h-4 w-4 mr-1" />
                              Apontamento
                            </>
                          ) : (
                            <>
                              <Eye className="h-4 w-4 mr-1" />
                              Visualizar
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {apontamentos.length > 0 && (
          <TablePagination pagination={pagination} className="mt-4" />
        )}

        {/* Modal de Apontamento */}
        <ApontamentoDiariasModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          apontamento={selectedApontamento}
          onSaveSuccess={handleSaveSuccess}
          readOnly={modalReadOnly}
          edicaoLiberada={(selectedApontamento as any)?.edicao_liberada || false}
          initialDate={modalInitialDate}
          isSuperAdmin={isSuperAdmin}
        />
      </div>
    </MainLayout>
  );
}
