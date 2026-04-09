import { useState, useMemo, useCallback } from "react";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { format, eachDayOfInterval, isWeekend } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Download,
  FileText,
  DollarSign,
  Building2,
  Filter,
  Loader2,
  Calendar as CalendarIcon,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Trash2 } from
"lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { generateCompiladoDiariasPDF, generateRelatorioDiariasPDFPorPeriodo } from "@/services/pdfService";
import { generateRelatorioFolhaPDF } from "@/services/pdf/relatorioFolhaPdf";
import { generateProtocoloDocumentosPDF } from "@/services/pdf/protocoloDocumentosPdf";
import { deletePresencaRegistro } from "@/services/diarias/presencasService";

import { RelatorioSemanalModal } from "@/components/diarias/RelatorioSemanalModal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";

import MainLayout from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow } from
"@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue } from
"@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { MultiCombobox } from "@/components/ui/multi-combobox";
import { buildCompiladoData } from "@/components/diarias/pdf/CompiladoDiariasPDF";

import { useDynamicPermissions } from "@/hooks/useDynamicPermissions";
import {
  useRelatorioFolha,
  useExportarExcel,
  useDiariasDataScope } from
"@/hooks/diarias";
import { usePagination } from "@/hooks/usePagination";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { RelatorioFilters, RelatorioFolhaItem } from "@/types/diarias";
import { Badge } from "@/components/ui/badge";

export default function DiariasRelatorio() {
  usePageTitle("Relatório de Diárias");
  const { permissions, isSuperAdmin, isLoading: isLoadingPermissions } = useDynamicPermissions();
  const hasPermission = (perm: string) => permissions.includes(perm);

  // Hook de escopo de dados - RBAC
  const {
    userScope,
    scopeFilters,
    isLoading: isLoadingScope,
    canDeletePresenca
  } = useDiariasDataScope();
  const queryClient = useQueryClient();

  // Verificar permissão de acesso (inclui AdmSSO explicitamente)
  const hasAccess = isSuperAdmin || userScope === 'admsso' || hasPermission('diarias_relatorio_view') || hasPermission('diarias_view');

  // Filters - sem filtro padrão para exibir todos os registros
  const [filters, setFilters] = useState<RelatorioFilters>({});

  // Queries - COM ESCOPO OBRIGATÓRIO
  const { data: relatorioRaw = [], isLoading } = useRelatorioFolha(filters, scopeFilters);

  // Centro de custos (com aprovador)
  const { data: centrosCusto = [] } = useQuery({
    queryKey: ['centros-custo-com-aprovador', isSuperAdmin],
    queryFn: async () => {
      let query = supabase.
      from('bd_centros_custo').
      select('id, codigo_centro_custo, nome_centro_custo, aprovador_diarias_id');
      if (!isSuperAdmin) query = query.neq('codigo_centro_custo', 'DIR001');
      const { data } = await query.order('nome_centro_custo');
      return data || [];
    }
  });

  // Gerentes regionais (funcionários que são aprovadores de algum CC)
  const { data: gerentesRegionais = [] } = useQuery({
    queryKey: ['gerentes-regionais', centrosCusto],
    queryFn: async () => {
      const aprovadorIds = [...new Set(centrosCusto.map((cc: any) => cc.aprovador_diarias_id).filter(Boolean))];
      if (aprovadorIds.length === 0) return [];
      const { data } = await supabase
        .from('bd_funcionarios')
        .select('id, nome_completo')
        .in('id', aprovadorIds)
        .order('nome_completo');
      return data || [];
    },
    enabled: centrosCusto.length > 0
  });

  // Filtro de gerente regional (estado)
  const [gerenteRegionalFilter, setGerenteRegionalFilter] = useState<string[]>([]);
  // Filtros multi-select client-side
  const [solicitacaoFilter, setSolicitacaoFilter] = useState<string[]>([]);
  const [centroCustoFilter, setCentroCustoFilter] = useState<string[]>([]);

  // Modal calendário para data de pagamento (Protocolo)
  const [dataPagamentoOpen, setDataPagamentoOpen] = useState(false);
  const [dataPagamento, setDataPagamento] = useState<Date | undefined>(new Date());

  // Filtragem client-side por empresa, tipo de vínculo e gerente regional
  const relatorio = useMemo(() => {
    let filtered = relatorioRaw;
    if (filters.empresa_id) {
      filtered = filtered.filter((r: any) => r.empresa_id === filters.empresa_id);
    }
    const hasRealMatricula = (m: any) => !!m && m !== '---' && String(m).trim() !== '';
    if (filters.tipo_vinculo === 'diarista') {
      filtered = filtered.filter((r: any) => !hasRealMatricula(r.matricula_funcionario));
    } else if (filters.tipo_vinculo === 'remessa') {
      filtered = filtered.filter((r: any) => hasRealMatricula(r.matricula_funcionario));
    }
    // Filtrar por solicitação (multi-select)
    if (solicitacaoFilter.length > 0) {
      filtered = filtered.filter((r: any) => solicitacaoFilter.includes(r.solicitacao_id));
    }
    // Filtrar por centro de custo (multi-select)
    if (centroCustoFilter.length > 0) {
      filtered = filtered.filter((r: any) => centroCustoFilter.includes(r.centro_custo_id));
    }
    // Filtrar por gerente regional (via centro de custo) - multi-select
    if (gerenteRegionalFilter.length > 0) {
      const ccIdsDoGerente = centrosCusto
        .filter((cc: any) => gerenteRegionalFilter.includes(cc.aprovador_diarias_id))
        .map((cc: any) => cc.id);
      filtered = filtered.filter((r: any) => ccIdsDoGerente.includes(r.centro_custo_id));
    }
    return filtered;
  }, [relatorioRaw, filters.empresa_id, filters.tipo_vinculo, solicitacaoFilter, centroCustoFilter, gerenteRegionalFilter, centrosCusto]);

  // Empresas
  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas-ativas'],
    queryFn: async () => {
      const { data } = await supabase.
      from('bd_empresas').
      select('id, nome_empresa').
      in('situacao', ['Ativo', 'Ativa']).
      order('nome_empresa');
      return data || [];
    }
  });

  // Funcionários que já foram apontados (distinct)
  const { data: funcionariosApontados = [] } = useQuery({
    queryKey: ['funcionarios-apontados'],
    queryFn: async () => {
      const funcionariosMap = new Map();
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: presencas } = await supabase
          .from('bd_diaria_presencas')
          .select('funcionario_id, bd_funcionarios!inner(id, nome_completo)')
          .range(from, from + pageSize - 1);

        presencas?.forEach((p: any) => {
          if (p.bd_funcionarios && !funcionariosMap.has(p.bd_funcionarios.id)) {
            funcionariosMap.set(p.bd_funcionarios.id, {
              id: p.bd_funcionarios.id,
              nome_completo: p.bd_funcionarios.nome_completo
            });
          }
        });

        hasMore = (presencas?.length || 0) === pageSize;
        from += pageSize;
      }

      return Array.from(funcionariosMap.values()).sort((a, b) =>
        a.nome_completo.localeCompare(b.nome_completo)
      );
    }
  });

  // Solicitações autorizadas para filtro por número
  const { data: solicitacoesAutorizadas = [] } = useQuery({
    queryKey: ['solicitacoes-autorizadas'],
    queryFn: async () => {
      const { data } = await supabase.
      from('bd_diaria_solicitacoes').
      select('id, numero_solicitacao').
      eq('status', 'autorizada').
      order('numero_solicitacao', { ascending: false });
      return data || [];
    }
  });

  // Feriados para classificação de dias no PDF
  const { data: feriados = [] } = useQuery({
    queryKey: ['feriados-relatorio'],
    queryFn: async () => {
      const { data } = await supabase.
      from('bd_feriados').
      select('data');
      return data?.map((f) => f.data) || [];
    },
    staleTime: 1000 * 60 * 60 // 1 hora
  });

  // Pagination
  const {
    paginatedData,
    currentPage,
    totalPages,
    totalItems,
    canPreviousPage,
    canNextPage,
    nextPage,
    previousPage,
    goToFirstPage,
    goToLastPage,
    setPageSize,
    pageSize
  } = usePagination<RelatorioFolhaItem>(relatorio, { pageSize: 25 });

  // Export mutation
  const exportMutation = useExportarExcel();
  const [isPDFLoading, setIsPDFLoading] = useState(false);
  // Folha de Ponto removida
  const [deleteTarget, setDeleteTarget] = useState<RelatorioFolhaItem | null>(null);
  const [semanalModalOpen, setSemanalModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Verificar se o user pode ver a coluna de ações
  const showDeleteColumn = useMemo(() => {
    return relatorio.some(item => canDeletePresenca(item));
  }, [relatorio, canDeletePresenca]);

  // Handler: Protocolo de Documentos
  const handleExportProtocolo = () => {
    if (relatorio.length === 0) {
      toast.error('Não há dados para exportar.');
      return;
    }
    setDataPagamentoOpen(true);
  };

  const handleConfirmProtocolo = () => {
    if (!dataPagamento) return;
    try {
      const dataPag = format(dataPagamento, 'yyyy-MM-dd');
      console.log('Gerando protocolo com', relatorio.length, 'registros, data:', dataPag);
      generateProtocoloDocumentosPDF(relatorio, dataPag);
      toast.success('Protocolo de Documentos gerado com sucesso!');
      setDataPagamentoOpen(false);
      setDataPagamento(undefined);
    } catch (error: any) {
      console.error('Erro ao gerar Protocolo:', error);
      toast.error(error?.message || 'Erro ao gerar o PDF. Verifique os dados.');
    }
  };

  // Handler: Excluir presença
  const handleDeletePresenca = async () => {
    if (!deleteTarget?.presenca_id) return;
    setIsDeleting(true);
    try {
      await deletePresencaRegistro(deleteTarget.presenca_id);
      toast.success('Registro excluído com sucesso.');
      queryClient.invalidateQueries({ queryKey: ['relatorio-folha'] });
    } catch (error: any) {
      console.error('Erro ao excluir registro:', error);
      toast.error(error?.message || 'Erro ao excluir registro.');
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  // Folha de Ponto — removido

  // Permissions
  const canExport = isSuperAdmin || hasPermission('diarias_exportar_excel');

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Calcular totais (somente presentes com entrada e saída)
  // A view retorna presenca_status como string "true"/"false"
  const resumo = useMemo(() => {
    const diariasCompletas = relatorio.filter(
      (r) => String(r.presenca_status) === 'true' && r.hora_entrada && r.hora_saida
    );
    return {
      total_diarias: diariasCompletas.length,
      valor_total: diariasCompletas.reduce((acc, r) => acc + Math.ceil(r.valor_diaria_aplicada || 0) + Math.ceil(r.valor_refeicao_aplicado || 0), 0)
    };
  }, [relatorio]);

  const handleExportExcel = () => {
    exportMutation.mutate(filters);
  };

  // handleExportPDF removido — usar PDF Consolidado ou PDF por Período

  const handleExportCompilado = async () => {
    if (relatorio.length === 0) {
      toast.error('Não há dados para exportar.');
      return;
    }
    setIsPDFLoading(true);
    try {
      const gerentesMap: Record<string, string> = {};
      gerentesRegionais.forEach((g: any) => { gerentesMap[g.id] = g.nome_completo; });

      const { centros, totalGeralQuantidade, totalGeralValor } = buildCompiladoData(
        relatorio,
        centrosCusto as any,
        gerentesMap,
        feriados
      );

      // Determine year
      const ano = filters.data_inicio
        ? new Date(filters.data_inicio + 'T12:00:00').getFullYear()
        : new Date().getFullYear();

      // Sequence number (simple: "01 - YEAR")
      const sequencia = `01 - ${ano}`;

      const fileName = `Relatorio_Diarias_${ano}`;
      await generateCompiladoDiariasPDF(centros, ano, sequencia, totalGeralQuantidade, totalGeralValor, fileName);
      toast.success('PDF Compilado gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF compilado:', error);
      toast.error('Erro ao gerar PDF compilado.');
    } finally {
      setIsPDFLoading(false);
    }
  };

  const handleExportPDFPorPeriodo = async () => {
    if (relatorio.length === 0) {
      toast.error('Não há dados para exportar.');
      return;
    }

    setIsPDFLoading(true);
    try {
      const dateStr = filters.data_inicio
        ? format(new Date(filters.data_inicio + 'T12:00:00'), 'yyyyMMdd')
        : format(new Date(), 'yyyyMMdd');
      const fileName = `Relatorio_Diarias_Periodo_${dateStr}`;

      // Build centrosCustoInfo
      const ccIds = [...new Set(relatorio.map(r => r.centro_custo_id).filter(Boolean))];
      let centrosCustoInfo: { id: string; codigo_centro_custo: string; nome_centro_custo: string; aprovador_diarias_id: string | null; diretoria_id: string | null }[] = [];

      if (ccIds.length > 0) {
        const { data: ccsData } = await supabase
          .from('bd_centros_custo')
          .select('id, codigo_centro_custo, nome_centro_custo, aprovador_diarias_id, diretoria_id')
          .in('id', ccIds);
        centrosCustoInfo = (ccsData || []).map((cc: any) => ({
          id: cc.id,
          codigo_centro_custo: cc.codigo_centro_custo,
          nome_centro_custo: cc.nome_centro_custo,
          aprovador_diarias_id: cc.aprovador_diarias_id,
          diretoria_id: cc.diretoria_id,
        }));
      }

      // Build gerentesMap
      const aprovadorIds = [...new Set(centrosCustoInfo.map(cc => cc.aprovador_diarias_id).filter(Boolean))] as string[];
      const gerentesMap: Record<string, string> = {};
      if (aprovadorIds.length > 0) {
        const { data: gerentes } = await supabase
          .from('bd_funcionarios')
          .select('id, nome_completo')
          .in('id', aprovadorIds);
        gerentes?.forEach((g: any) => { gerentesMap[g.id] = g.nome_completo; });
      }

      // Build diretoresMap
      const diretoriaIds = [...new Set(centrosCustoInfo.map(cc => cc.diretoria_id).filter(Boolean))] as string[];
      const diretoresMap: Record<string, string> = {};
      if (diretoriaIds.length > 0) {
        const { data: diretorias } = await supabase
          .from('bd_diretorias')
          .select('id, diretor_id, bd_funcionarios!bd_diretorias_diretor_id_fkey(nome_completo)')
          .in('id', diretoriaIds);
        diretorias?.forEach((d: any) => {
          const nome = d.bd_funcionarios?.nome_completo;
          if (nome) diretoresMap[d.id] = nome;
        });
      }

      await generateRelatorioDiariasPDFPorPeriodo(relatorio, filters, feriados, fileName, {
        centrosCustoInfo,
        gerentesMap,
        diretoresMap,
      });
      toast.success('PDF Detalhado por Período gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF por período:', error);
      toast.error('Erro ao gerar PDF por período.');
    } finally {
      setIsPDFLoading(false);
    }
  };


  // Loading de permissões e escopo
  if (isLoadingPermissions || isLoadingScope) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Carregando...</span>
        </div>
      </MainLayout>);

  }

  // Sem permissão
  if (!hasAccess) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
            <p className="text-xs text-muted-foreground mt-1">Permissão necessária: diarias_relatorio_view</p>
          </div>
        </div>
      </MainLayout>);

  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
              <span><strong>Empresa:</strong> {filters.empresa_id ? empresas.find((e: any) => e.id === filters.empresa_id)?.nome_empresa || '—' : 'Todas'}</span>
              <span><strong>Centro de Custo:</strong> {centroCustoFilter.length > 0 ? centrosCusto.filter((c: any) => centroCustoFilter.includes(c.id)).map((c: any) => c.codigo_centro_custo).join(', ') : 'Todos'}</span>
            </div>
          </div>
          {canExport &&
          <div className="flex items-center gap-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button disabled={exportMutation.isPending || isPDFLoading || relatorio.length === 0}>
                    {(exportMutation.isPending || isPDFLoading) ?
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> :
                      <Download className="h-4 w-4 mr-2" />
                    }
                    Exportar
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleExportExcel} className="cursor-pointer">
                    📊 Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportPDFPorPeriodo} className="cursor-pointer">
                    📋 PDF Detalhado por Período
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportCompilado} className="cursor-pointer">
                    📦 Compilado
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { handleExportExcel(); handleExportPDFPorPeriodo(); }} className="cursor-pointer">
                    🗂 Ambos
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportProtocolo} className="cursor-pointer">
                    📋 Protocolo de Documentos
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="outline"
                onClick={() => setSemanalModalOpen(true)}>
                <CalendarIcon className="h-4 w-4 mr-2" />
                Relatório Semanal
              </Button>
            </div>
          }
        </div>

        {/* 2 Summary Cards */}
        


























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
                  onChange={(e) => setFilters({ ...filters, data_inicio: e.target.value || undefined })} />

              </div>
              <div>
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={filters.data_fim || ''}
                  onChange={(e) => setFilters({ ...filters, data_fim: e.target.value || undefined })} />

              </div>
              <div>
                <Label>Nº Solicitação</Label>
                <MultiCombobox
                  options={solicitacoesAutorizadas.map((s: any) => ({
                    value: s.id,
                    label: s.numero_solicitacao
                  }))}
                  value={solicitacaoFilter}
                  onChange={setSolicitacaoFilter}
                  placeholder="Todas"
                  searchPlaceholder="Buscar por número..."
                  emptyText="Nenhuma solicitação encontrada" />
              </div>
              <div>
                <Label>Centro de Custo</Label>
                <MultiCombobox
                  options={centrosCusto.map((cc: any) => ({
                    value: cc.id,
                    label: cc.codigo_centro_custo
                  }))}
                  value={centroCustoFilter}
                  onChange={setCentroCustoFilter}
                  placeholder="Todos"
                  searchPlaceholder="Buscar centro de custo..."
                  emptyText="Nenhum centro de custo encontrado" />
              </div>
              <div>
                <Label>Funcionário</Label>
                <Combobox
                  options={[
                  { value: '__all__', label: 'Todos' },
                  ...funcionariosApontados.map((f: any) => ({
                    value: f.id,
                    label: f.nome_completo
                  }))]
                  }
                  value={filters.funcionario_id ?? '__all__'}
                  onChange={(v) => setFilters({ ...filters, funcionario_id: v === '__all__' ? undefined : v })}
                  placeholder="Todos"
                  searchPlaceholder="Buscar funcionário..."
                  emptyText="Nenhum funcionário encontrado" />

              </div>
              <div>
                <Label>Empresa</Label>
                <Combobox
                  options={[
                  { value: '__all__', label: 'Todas' },
                  ...empresas.map((e: any) => ({
                    value: e.id,
                    label: e.nome_empresa
                  }))]
                  }
                  value={filters.empresa_id ?? '__all__'}
                  onChange={(v) => setFilters({ ...filters, empresa_id: v === '__all__' ? undefined : v })}
                  placeholder="Todas"
                  searchPlaceholder="Buscar empresa..."
                  emptyText="Nenhuma empresa encontrada" />

              </div>
              <div>
                <Label>Gerente Regional</Label>
                <MultiCombobox
                  options={gerentesRegionais.map((g: any) => ({
                    value: g.id,
                    label: g.nome_completo
                  }))}
                  value={gerenteRegionalFilter}
                  onChange={setGerenteRegionalFilter}
                  placeholder="Todos"
                  searchPlaceholder="Buscar gerente..."
                  emptyText="Nenhum gerente encontrado"
                />
              </div>
              <div>
                <Label>Tipo Vínculo</Label>
                <Select
                  value={filters.tipo_vinculo || 'todos'}
                  onValueChange={(v) => setFilters({ ...filters, tipo_vinculo: v === 'todos' ? undefined : v as 'diarista' | 'remessa' })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="diarista">Sem Remessa</SelectItem>
                    <SelectItem value="remessa">Remessa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table with 7 columns */}
        <Card>
          <CardContent className="p-0">
            {isLoading ?
            <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div> :
            relatorio.length === 0 ?
            <div className="text-center p-8 text-muted-foreground">
                Nenhum registro encontrado.
              </div> :

            <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Nº Sol.</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Centro de Custo</TableHead>
                      <TableHead>Solicitante</TableHead>
                      <TableHead>Apontador</TableHead>
                      <TableHead>Funcionário</TableHead>
                      <TableHead>Função</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">V. Diária</TableHead>
                      <TableHead className="text-right">V. ½ Diária</TableHead>
                      <TableHead className="text-right">V. Refeição</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      {showDeleteColumn && <TableHead className="w-12"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.map((item, idx) =>
                  <TableRow key={item.presenca_id || idx}>
                        <TableCell className="font-mono text-sm text-primary">
                          {item.numero_solicitacao}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                            {format(new Date(item.data + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span className="truncate max-w-[150px]">
                              {item.codigo_centro_custo} - {item.nome_centro_custo}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {item.solicitante_nome || '-'}
                        </TableCell>
                        <TableCell>
                          {item.apontador_nome || '-'}
                        </TableCell>
                        <TableCell className="font-medium">
                          {item.nome_funcionario}
                        </TableCell>
                        <TableCell>
                          {item.nome_funcao || '-'}
                        </TableCell>
                        <TableCell>
                          {item.tipo_diaria === 'uma_e_meia' &&
                      <Badge className="text-xs bg-blue-600 text-white">1½ Diária</Badge>
                      }
                          {item.tipo_diaria === 'completa' &&
                      <Badge variant="default" className="text-xs bg-green-600 text-white">1 Diária</Badge>
                      }
                          {item.tipo_diaria === 'meia' &&
                      <Badge variant="secondary" className="text-xs bg-yellow-500 text-white">½ Diária</Badge>
                      }
                          {(!item.tipo_diaria || item.tipo_diaria === 'nenhuma') &&
                      <span className="text-xs text-muted-foreground">-</span>
                      }
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(
                        item.tipo_diaria === 'completa' ? Math.ceil(item.valor_diaria_aplicada || 0) :
                        item.tipo_diaria === 'uma_e_meia' ? Math.ceil((item.valor_diaria_aplicada || 0) * (2 / 3)) :
                        0
                      )}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(
                        item.tipo_diaria === 'meia' ? Math.ceil(item.valor_diaria_aplicada || 0) :
                        item.tipo_diaria === 'uma_e_meia' ? Math.ceil((item.valor_diaria_aplicada || 0) * (1 / 3)) :
                        0
                      )}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(Math.ceil(item.valor_refeicao_aplicado || 0))}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(Math.ceil(item.valor_diaria_aplicada || 0) + Math.ceil(item.valor_refeicao_aplicado || 0))}
                        </TableCell>
                        {showDeleteColumn && (
                          <TableCell className="text-center">
                            {canDeletePresenca(item) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setDeleteTarget(item)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                  )}
                  </TableBody>
                </Table>
              </div>
            }
          </CardContent>
          
          {/* Pagination Footer */}
          {relatorio.length > 0 &&
          <div className="border-t p-4 flex flex-col sm:flex-row items-center justify-between gap-4 bg-muted/50">
              <div className="text-sm text-muted-foreground">
                {totalItems} registros encontrados
              </div>
              
              <div className="flex items-center gap-2">
                <Select
                value={pageSize.toString()}
                onValueChange={(v) => setPageSize(Number(v))}>

                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">por página</span>
              </div>

              <div className="flex items-center gap-1">
                <Button
                variant="outline"
                size="icon"
                onClick={goToFirstPage}
                disabled={!canPreviousPage}>

                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                variant="outline"
                size="icon"
                onClick={previousPage}
                disabled={!canPreviousPage}>

                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm px-2">
                  {currentPage + 1} de {totalPages || 1}
                </span>
                <Button
                variant="outline"
                size="icon"
                onClick={nextPage}
                disabled={!canNextPage}>

                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                variant="outline"
                size="icon"
                onClick={goToLastPage}
                disabled={!canNextPage}>

                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>

            </div>
          }
        </Card>
      </div>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeletePresenca}
        title="Excluir Registro"
        description={`Tem certeza que deseja excluir o registro de "${deleteTarget?.nome_funcionario || ''}" do dia ${deleteTarget?.data ? format(new Date(deleteTarget.data + 'T12:00:00'), 'dd/MM/yyyy') : ''}?`}
        confirmText="Excluir"
        cancelText="Cancelar"
        variant="danger"
        isLoading={isDeleting}
      />

      {/* Modal: Data de Pagamento para Protocolo */}
      <Dialog open={dataPagamentoOpen} onOpenChange={setDataPagamentoOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Selecione a data de pagamento</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center py-4">
            <Calendar
              mode="single"
              selected={dataPagamento}
              onSelect={setDataPagamento}
              className="pointer-events-auto"
              locale={ptBR}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDataPagamentoOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmProtocolo} disabled={!dataPagamento}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RelatorioSemanalModal
        open={semanalModalOpen}
        onOpenChange={setSemanalModalOpen}
        gerentesRegionais={gerentesRegionais as any}
        centrosCusto={centrosCusto as any}
        feriados={feriados}
      />
    </MainLayout>);

}