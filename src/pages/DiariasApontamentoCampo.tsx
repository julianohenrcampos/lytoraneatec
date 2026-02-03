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
  Users
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
import { useApontamentosCampo } from "@/hooks/diarias/useApontamentosCampo";
import { useDiariasDataScope } from "@/hooks/diarias";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { StatusApontamento, FuncionarioPreConvocado, DiariaApontamento } from "@/types/diarias";
import ApontamentoDiariasModal from "@/components/diarias/ApontamentoDiariasModal";
import { toast } from "sonner";
import { usePagination } from "@/hooks/usePagination";
import TablePagination from "@/components/ui/table-pagination";


export default function DiariasApontamentoCampo() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { permissions, isSuperAdmin, isLoading: isLoadingPermissions } = useDynamicPermissions();
  const hasPermission = (perm: string) => permissions.includes(perm);

  // Hook de escopo de dados - RBAC
  const { 
    userScope, 
    getApontamentosFilter,
    isLoading: isLoadingScope 
  } = useDiariasDataScope();

  const hasAccess = isSuperAdmin || hasPermission('diarias_apontamento_view') || hasPermission('diarias_view');

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusApontamento | '__all__'>('__all__');
  const [dataFilter, setDataFilter] = useState('');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedApontamento, setSelectedApontamento] = useState<DiariaApontamento | null>(null);

  // Query apontamentos - COM ESCOPO OBRIGATÓRIO
  const apontamentoScopeFilters = getApontamentosFilter();
  const { data: apontamentos = [], isLoading, refetch } = useApontamentosCampo(
    statusFilter !== '__all__' ? { status: statusFilter } : undefined,
    apontamentoScopeFilters
  );
  
  // Pagination
  const pagination = usePagination(apontamentos, { pageSize: 6 });

  // Query para buscar datas apontadas por solicitação
  const { data: datasApontadasMap = {} } = useQuery({
    queryKey: ['datas-apontadas-por-solicitacao'],
    queryFn: async () => {
      const { data } = await supabase
        .from('bd_diaria_presencas')
        .select('solicitacao_id, data');
      
      const mapa: Record<string, string[]> = {};
      (data || []).forEach((p) => {
        if (!mapa[p.solicitacao_id]) {
          mapa[p.solicitacao_id] = [];
        }
        if (!mapa[p.solicitacao_id].includes(p.data)) {
          mapa[p.solicitacao_id].push(p.data);
        }
      });
      return mapa;
    },
    enabled: apontamentos.length > 0
  });

  // Handlers
  const handleOpenModal = (apontamento: any) => {
    setSelectedApontamento(apontamento as DiariaApontamento);
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

              // Datas já apontadas para esta solicitação
              const datasApontadas = datasApontadasMap[solicitacao?.id] || [];

              return (
                <Card key={apontamento.id} className="hover:shadow-md transition-shadow">
                  {/* Header: Centro de Custo + Nº Solicitação */}
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      <span>{centroCusto?.codigo_centro_custo} - {centroCusto?.nome_centro_custo}</span>
                      {solicitacao?.numero_solicitacao && (
                        <Badge variant="secondary" className="font-mono text-xs ml-auto">
                          {solicitacao.numero_solicitacao}
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Linha de informações */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
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
                          const isApontado = datasApontadas.includes(dataStr);
                          const isHoje = dataStr === hojeStr;
                          const dia = format(parseBrazilianDate(dataStr), 'dd');

                          return (
                            <Badge
                              key={dataStr}
                              variant={isApontado ? "success" : "outline"}
                              className={cn(
                                "text-xs w-8 h-8 flex items-center justify-center rounded-md cursor-default",
                                !isApontado && isHoje && "border-primary text-primary border-2",
                                !isApontado && !isHoje && "bg-muted text-muted-foreground"
                              )}
                              title={`${formatBrazilianDateForDisplay(dataStr)}${isApontado ? ' - Apontado' : isHoje ? ' - Hoje' : ''}`}
                            >
                              {dia}
                            </Badge>
                          );
                        })}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleOpenModal(apontamento)}
                      >
                        <ClipboardCheck className="h-4 w-4 mr-1" />
                        Apontamento de Diária
                      </Button>
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
        />
      </div>
    </MainLayout>
  );
}
