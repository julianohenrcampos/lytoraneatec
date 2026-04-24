import { useState, useMemo, useEffect, useCallback } from "react";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { useNavigate } from "react-router-dom";
import { format, eachDayOfInterval, isWeekend, getDay } from "date-fns";
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
  Eye,
  Search,
  X,
  Printer,
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

import { usePermission } from "@/hooks/usePermission";
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
import { Combobox } from "@/components/ui/combobox";
import { fetchCentrosCustoFiltered } from "@/services/centrosCustoFilteredService";
import { generateFolhaPontoPDF } from "@/services/pdfService";
import type { FolhaPontoFuncionario } from "@/components/diarias/pdf/FolhaPontoPDF";


export default function DiariasApontamentoCampo() {
  usePageTitle("Apontamento de Campo - Diárias");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { permissions, isSuperAdmin, isLoading: isLoadingPermissions } = usePermission();
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
  const [solicitacaoFilter, setSolicitacaoFilter] = useState('');
  const [centroCustoFilter, setCentroCustoFilter] = useState('');
  const [gerenteFilter, setGerenteFilter] = useState('');

  // Centros de custo para o combobox
  const [centrosCustoOptions, setCentrosCustoOptions] = useState<{ value: string; label: string }[]>([]);
  useEffect(() => {
    fetchCentrosCustoFiltered(null, isSuperAdmin).then((data) => {
      setCentrosCustoOptions(data.map((cc) => ({ value: cc.id, label: cc.nome_centro_custo })));
    });
  }, [isSuperAdmin]);

  // Gerentes regionais para filtro (apenas SuperAdm)
  const { data: gerentesOptions = [] } = useQuery({
    queryKey: ['gerentes-regionais-filter'],
    queryFn: async () => {
      const { data } = await supabase
        .from('bd_centros_custo')
        .select('aprovador_diarias_id, bd_funcionarios!bd_centros_custo_aprovador_diarias_id_fkey(id, nome_completo)')
        .eq('situacao', 'Ativo')
        .not('aprovador_diarias_id', 'is', null);
      if (!data) return [];
      const map = new Map<string, string>();
      data.forEach((cc: any) => {
        const f = cc.bd_funcionarios;
        if (f?.id && f?.nome_completo) map.set(f.id, f.nome_completo);
      });
      return Array.from(map.entries())
        .map(([id, nome]) => ({ value: id, label: nome }))
        .sort((a, b) => a.label.localeCompare(b.label));
    },
    enabled: isSuperAdmin,
    staleTime: 60000,
  });

  // Mapa de CC por gerente (para filtragem client-side)
  const { data: ccByGerenteMap = new Map<string, string[]>() } = useQuery({
    queryKey: ['cc-by-gerente-map'],
    queryFn: async () => {
      const { data } = await supabase
        .from('bd_centros_custo')
        .select('id, aprovador_diarias_id')
        .eq('situacao', 'Ativo')
        .not('aprovador_diarias_id', 'is', null);
      const map = new Map<string, string[]>();
      (data || []).forEach((cc: any) => {
        const arr = map.get(cc.aprovador_diarias_id) || [];
        arr.push(cc.id);
        map.set(cc.aprovador_diarias_id, arr);
      });
      return map;
    },
    enabled: isSuperAdmin,
    staleTime: 60000,
  });

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedApontamento, setSelectedApontamento] = useState<DiariaApontamento | null>(null);
  const [modalReadOnly, setModalReadOnly] = useState(false);
  const [modalInitialDate, setModalInitialDate] = useState<string | undefined>(undefined);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

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

  // Sincroniza selectedApontamento com a versão fresca vinda do cache após mutações
  // (ex.: persistência de tipo do dia atualiza regras_operacionais_snapshot)
  useEffect(() => {
    if (!selectedApontamento) return;
    const fresh = (apontamentos as any[]).find((a) => a?.id === selectedApontamento.id);
    if (fresh && fresh !== selectedApontamento) {
      setSelectedApontamento(fresh as DiariaApontamento);
    }
  }, [apontamentos, selectedApontamento]);
  
  // Extrair IDs estáveis das solicitações para usar na query de presenças
  const solicitacaoIds = useMemo(
    () => apontamentos.map((a: any) => a.bd_diaria_solicitacoes?.id).filter(Boolean).sort() as string[],
    [apontamentos]
  );
  const solicitacaoIdsKey = solicitacaoIds.join(',');

  // Query leve para buscar status por solicitação/data da tabela bd_diaria_status
  interface DiariaStatusItem {
    solicitacao_id: string;
    data: string;
    status: string;
    editado_em: string | null;
  }
  const { data: statusDataRaw = [] } = useQuery({
    queryKey: ['diaria-status', solicitacaoIdsKey],
    queryFn: async () => {
      if (solicitacaoIds.length === 0) return [];
      const { data } = await supabase
        .from('bd_diaria_status' as any)
        .select('solicitacao_id, data, status, editado_em')
        .in('solicitacao_id', solicitacaoIds);
      return (data || []) as unknown as DiariaStatusItem[];
    },
    enabled: solicitacaoIds.length > 0,
    staleTime: 30000
  });

  // Converter para mapa compatível com o formato anterior
  interface PresencaStatus {
    data: string;
    status: string;
    editado_em: string | null;
  }
  const datasApontadasMap: Record<string, PresencaStatus[]> = useMemo(() => {
    const mapa: Record<string, PresencaStatus[]> = {};
    statusDataRaw.forEach((item: DiariaStatusItem) => {
      if (!mapa[item.solicitacao_id]) {
        mapa[item.solicitacao_id] = [];
      }
      mapa[item.solicitacao_id].push({
        data: item.data,
        status: item.status,
        editado_em: item.editado_em,
      });
    });
    return mapa;
  }, [statusDataRaw]);

  // Ordenar e filtrar client-side
  const sortedApontamentos = useMemo(() => {
    if (!apontamentos.length) return apontamentos;
    
    // Filtrar por Nº Solicitação e Centro de Custo
    let filtered = [...apontamentos];
    if (solicitacaoFilter) {
      filtered = filtered.filter((a: any) => {
        const num = a.bd_diaria_solicitacoes?.numero_solicitacao || '';
        return num.toLowerCase().includes(solicitacaoFilter.toLowerCase());
      });
    }
    if (centroCustoFilter) {
      filtered = filtered.filter((a: any) => {
        return a.bd_diaria_solicitacoes?.centro_custo_id === centroCustoFilter;
      });
    }
    if (gerenteFilter && ccByGerenteMap instanceof Map) {
      const ccIds = ccByGerenteMap.get(gerenteFilter) || [];
      filtered = filtered.filter((a: any) => {
        return ccIds.includes(a.bd_diaria_solicitacoes?.centro_custo_id);
      });
    }
    
    return filtered.sort((a: any, b: any) => {
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

      const isFinalized = (d: PresencaStatus) => d.status === 'finalizado';
      const allFinA = countDatasA > 0 && datasA.length >= countDatasA && datasA.every(isFinalized);
      const allFinB = countDatasB > 0 && datasB.length >= countDatasB && datasB.every(isFinalized);

      if (allFinA && !allFinB) return 1;
      if (!allFinA && allFinB) return -1;
      return 0;
    });
  }, [apontamentos, datasApontadasMap, solicitacaoFilter, centroCustoFilter, gerenteFilter, ccByGerenteMap]);

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
    queryClient.invalidateQueries({ queryKey: ['diaria-status'] });
  };

  // Folha de Ponto PDF - habilitado quando CC filtrado e há apontamentos com período válido
  const canPrintFolhaPonto = useMemo(() => {
    if (!centroCustoFilter) return false;
    return sortedApontamentos.some((a: any) => {
      const sol = a.bd_diaria_solicitacoes;
      return sol?.data_inicio && sol?.data_fim;
    });
  }, [centroCustoFilter, sortedApontamentos]);

  const handlePrintFolhaPonto = useCallback(async () => {
    if (!centroCustoFilter || isGeneratingPDF) return;
    setIsGeneratingPDF(true);

    try {
      // Get filtered apontamentos for selected CC
      const apontamentosCC = sortedApontamentos.filter((a: any) =>
        a.bd_diaria_solicitacoes?.centro_custo_id === centroCustoFilter
      );

      if (apontamentosCC.length === 0) {
        toast.error("Nenhum apontamento encontrado para o centro de custo selecionado.");
        return;
      }

      // Collect all solicitacao IDs and date ranges
      const solicitacaoData: { id: string; numero: string; dataInicio: string; dataFim: string; convocados: FuncionarioPreConvocado[] }[] = [];
      for (const apt of apontamentosCC) {
        const sol = (apt as any).bd_diaria_solicitacoes;
        if (!sol?.data_inicio || !sol?.data_fim) continue;
        solicitacaoData.push({
          id: sol.id,
          numero: sol.numero_solicitacao || '',
          dataInicio: sol.data_inicio,
          dataFim: sol.data_fim,
          convocados: parseConvocados(sol.convocados_pre),
        });
      }

      if (solicitacaoData.length === 0) {
        toast.error("Nenhuma solicitação válida encontrada.");
        return;
      }

      // Use first solicitação for header info (most common case)
      const firstSol = solicitacaoData[0];

      // Generate date range (weekdays always, weekends only if worked)
      const allDates = eachDayOfInterval({
        start: parseBrazilianDate(firstSol.dataInicio),
        end: parseBrazilianDate(firstSol.dataFim),
      });

      // Fetch presences for all solicitações
      const solIds = solicitacaoData.map(s => s.id);
      const { data: presencas } = await supabase
        .from('bd_diaria_presencas')
        .select('funcionario_id, data, hora_entrada, hora_saida, presente')
        .in('solicitacao_id', solIds);

      // Build presence map: funcId+data => {hora_entrada, hora_saida}
      const presencaMap = new Map<string, { hora_entrada: string; hora_saida: string }>();
      (presencas || []).forEach((p: any) => {
        if (p.presente) {
          presencaMap.set(`${p.funcionario_id}_${p.data}`, {
            hora_entrada: p.hora_entrada || '',
            hora_saida: p.hora_saida || '',
          });
        }
      });

      // Collect unique employees from all solicitações
      const funcIds = new Set<string>();
      const convocadosMetaMap = new Map<string, { nome_funcionario: string; nome_funcao: string }>();
      solicitacaoData.forEach(s => s.convocados.forEach(c => {
        funcIds.add(c.funcionario_id);
        if (c.nome_funcionario || c.nome_funcao) {
          convocadosMetaMap.set(c.funcionario_id, {
            nome_funcionario: c.nome_funcionario || '',
            nome_funcao: c.nome_funcao || '',
          });
        }
      }));

      // Fallback: if no IDs from convocados_pre, use presencas
      if (funcIds.size === 0 && presencas?.length) {
        presencas.forEach((p: any) => {
          if (p.funcionario_id) funcIds.add(p.funcionario_id);
        });
      }

      if (funcIds.size === 0) {
        toast.error("Nenhum registro de funcionário encontrado no período/solicitação.");
        return;
      }

      // Fetch employee details - handle RLS partial results gracefully
      const { data: funcionariosDB, error: funcError } = await supabase
        .from('bd_funcionarios')
        .select('id, nome_completo, matricula, cpf, data_admissao, funcao_id, centro_custo_id, banco, agencia, conta_corrente, bd_funcoes(nome_funcao), bd_centros_custo(codigo_centro_custo, nome_centro_custo)')
        .in('id', Array.from(funcIds));

      if (funcError) {
        console.warn('Erro ao buscar bd_funcionarios (RLS?):', funcError.message);
      }

      const funcMap = new Map((funcionariosDB || []).map((f: any) => [f.id, f]));
      console.log(`[FolhaPonto] funcIds: ${funcIds.size}, retornados bd_funcionarios: ${funcMap.size}, convocadosMeta: ${convocadosMetaMap.size}`);

      // Get CC info for local_trabalho
      const ccCode = (apontamentosCC[0] as any)?.bd_diaria_solicitacoes?.bd_centros_custo?.codigo_centro_custo || '';
      const ccNome = (apontamentosCC[0] as any)?.bd_diaria_solicitacoes?.bd_centros_custo?.nome_centro_custo || '';
      const localTrabalho = ccCode ? `${ccCode} - ${ccNome}` : '';

      // Build FolhaPontoFuncionario array - use fallback for missing DB records
      const funcionariosPDF: FolhaPontoFuncionario[] = [];
      for (const funcId of funcIds) {
        const funcDB = funcMap.get(funcId) as any;
        const meta = convocadosMetaMap.get(funcId);

        // Skip only if we have absolutely no info about this employee
        const nome = funcDB?.nome_completo || meta?.nome_funcionario || null;
        if (!nome) continue;

        // Build days list: weekdays always, weekends only if has presence
        const dias: FolhaPontoFuncionario['dias'] = [];
        for (const date of allDates) {
          const dateStr = format(date, 'yyyy-MM-dd');
          const presKey = `${funcId}_${dateStr}`;
          const pres = presencaMap.get(presKey);

          if (isWeekend(date)) {
            if (pres) {
              dias.push({
                data: dateStr,
                hora_entrada: pres.hora_entrada,
                intervalo_saida: '',
                intervalo_entrada: '',
                hora_saida: pres.hora_saida,
                centro_custo: ccCode,
              });
            }
          } else {
            dias.push({
              data: dateStr,
              hora_entrada: pres?.hora_entrada || '',
              intervalo_saida: '',
              intervalo_entrada: '',
              hora_saida: pres?.hora_saida || '',
              centro_custo: pres ? ccCode : '',
            });
          }
        }

        const departamento = funcDB?.bd_centros_custo
          ? `${funcDB.bd_centros_custo.codigo_centro_custo} - ${funcDB.bd_centros_custo.nome_centro_custo}`
          : '';

        funcionariosPDF.push({
          nome_completo: nome,
          matricula: funcDB?.matricula || null,
          cpf: funcDB?.cpf || '',
          data_admissao: funcDB?.data_admissao || null,
          funcao: funcDB?.bd_funcoes?.nome_funcao || meta?.nome_funcao || '-',
          departamento,
          banco: funcDB?.banco || null,
          agencia: funcDB?.agencia || null,
          conta_corrente: funcDB?.conta_corrente || null,
          dias,
        });
      }

      // Sort by name
      funcionariosPDF.sort((a, b) => a.nome_completo.localeCompare(b.nome_completo));

      if (funcionariosPDF.length === 0) {
        toast.error("Nenhum funcionário encontrado para gerar a folha de ponto.");
        return;
      }

      // Warn if partial data
      if (funcMap.size < funcIds.size) {
        toast.info(`Folha gerada com dados parciais (${funcMap.size}/${funcIds.size} cadastros acessíveis).`);
      }

      await generateFolhaPontoPDF(
        firstSol.dataInicio,
        firstSol.dataFim,
        funcionariosPDF,
        `Folha_Ponto_${ccCode}_${firstSol.dataInicio}_${firstSol.dataFim}`
      );

      toast.success("Folha de ponto gerada com sucesso!");
    } catch (error) {
      console.error('Erro ao gerar folha de ponto:', error);
      toast.error("Erro ao gerar folha de ponto.");
    } finally {
      setIsGeneratingPDF(false);
    }
  }, [centroCustoFilter, sortedApontamentos, centrosCustoOptions, isGeneratingPDF]);

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

  // Parse convocados helper - handles null, array, and stringified JSON
  const parseConvocados = (convocadosPre: any): FuncionarioPreConvocado[] => {
    if (!convocadosPre) return [];
    if (typeof convocadosPre === 'string') {
      try { return JSON.parse(convocadosPre); } catch { return []; }
    }
    if (Array.isArray(convocadosPre)) return convocadosPre;
    return [];
  };

  // Data de hoje para comparação
  const hojeStr = getCurrentBrazilianDate();

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Content */}

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("grid gap-4 grid-cols-1 sm:grid-cols-2", isSuperAdmin ? "lg:grid-cols-5" : "lg:grid-cols-4")}>
              <div>
                <Label>Nº Solicitação</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar nº solicitação..."
                    value={solicitacaoFilter}
                    onChange={(e) => setSolicitacaoFilter(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <div>
                <Label>Centro de Custo</Label>
                <Combobox
                  options={centrosCustoOptions}
                  value={centroCustoFilter}
                  onChange={setCentroCustoFilter}
                  placeholder="Todos"
                  searchPlaceholder="Buscar centro de custo..."
                  emptyText="Nenhum centro encontrado"
                />
              </div>
              {isSuperAdmin && (
                <div>
                  <Label>Gerente Regional</Label>
                  <Combobox
                    options={gerentesOptions}
                    value={gerenteFilter}
                    onChange={setGerenteFilter}
                    placeholder="Todos"
                    searchPlaceholder="Buscar gerente..."
                    emptyText="Nenhum gerente encontrado"
                  />
                </div>
              )}
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
            </div>
            <div className="flex justify-end mt-4 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrintFolhaPonto}
                disabled={!canPrintFolhaPonto || isGeneratingPDF}
                className="flex items-center gap-1.5"
              >
                {isGeneratingPDF ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Printer className="h-3.5 w-3.5" />
                )}
                Imprimir Folha de Ponto
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStatusFilter('__all__');
                  setDataFilter('');
                  setSolicitacaoFilter('');
                  setCentroCustoFilter('');
                  setGerenteFilter('');
                }}
                className="flex items-center gap-1.5"
              >
                <X className="h-3.5 w-3.5" />
                Limpar Filtros
              </Button>
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
                            if (status.status === 'finalizado') {
                              variant = "success";
                              if (status.editado_em) {
                                extraClasses = "border-2 border-gray-400 cursor-pointer hover:opacity-80 transition-all";
                              }
                            } else if (status.status === 'iniciado') {
                              variant = "warning";
                            } else {
                              // nao_apontado
                              variant = "destructive";
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
                          if (status?.status === 'finalizado') titleParts.push('Finalizado');
                          else if (status?.status === 'iniciado') titleParts.push('Iniciado');
                          else if (status) titleParts.push('Não apontado');
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
