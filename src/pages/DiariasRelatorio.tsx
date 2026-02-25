import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { 
  Download, 
  FileText,
  DollarSign,
  Building2,
  Filter,
  Loader2,
  Calendar as CalendarIcon,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from "lucide-react";
import { generateRelatorioDiariasPDF } from "@/services/pdfService";

import MainLayout from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";

import { useDynamicPermissions } from "@/hooks/useDynamicPermissions";
import { 
  useRelatorioFolha,
  useExportarExcel,
  useDiariasDataScope
} from "@/hooks/diarias";
import { usePagination } from "@/hooks/usePagination";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { RelatorioFilters, RelatorioFolhaItem } from "@/types/diarias";
import { Badge } from "@/components/ui/badge";

export default function DiariasRelatorio() {
  const { permissions, isSuperAdmin, isLoading: isLoadingPermissions } = useDynamicPermissions();
  const hasPermission = (perm: string) => permissions.includes(perm);
  
  // Hook de escopo de dados - RBAC
  const { 
    userScope,
    scopeFilters,
    isLoading: isLoadingScope 
  } = useDiariasDataScope();
  
  // Verificar permissão de acesso (inclui AdmSSO explicitamente)
  const hasAccess = isSuperAdmin || userScope === 'admsso' || hasPermission('diarias_relatorio_view') || hasPermission('diarias_view');
  
  // Filters - sem filtro padrão para exibir todos os registros
  const [filters, setFilters] = useState<RelatorioFilters>({});

  // Queries - COM ESCOPO OBRIGATÓRIO
  const { data: relatorio = [], isLoading } = useRelatorioFolha(filters, scopeFilters);
  
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

  // Funcionários que já foram apontados (distinct)
  const { data: funcionariosApontados = [] } = useQuery({
    queryKey: ['funcionarios-apontados'],
    queryFn: async () => {
      const { data: presencas } = await supabase
        .from('bd_diaria_presencas')
        .select('funcionario_id, bd_funcionarios!inner(id, nome_completo)');
      
      // Extrair funcionários únicos
      const funcionariosMap = new Map();
      presencas?.forEach((p: any) => {
        if (p.bd_funcionarios && !funcionariosMap.has(p.bd_funcionarios.id)) {
          funcionariosMap.set(p.bd_funcionarios.id, {
            id: p.bd_funcionarios.id,
            nome_completo: p.bd_funcionarios.nome_completo
          });
        }
      });
      
      // Ordenar por nome
      return Array.from(funcionariosMap.values()).sort((a, b) => 
        a.nome_completo.localeCompare(b.nome_completo)
      );
    }
  });

  // Solicitações autorizadas para filtro por número
  const { data: solicitacoesAutorizadas = [] } = useQuery({
    queryKey: ['solicitacoes-autorizadas'],
    queryFn: async () => {
      const { data } = await supabase
        .from('bd_diaria_solicitacoes')
        .select('id, numero_solicitacao')
        .eq('status', 'autorizada')
        .order('numero_solicitacao', { ascending: false });
      return data || [];
    }
  });

  // Feriados para classificação de dias no PDF
  const { data: feriados = [] } = useQuery({
    queryKey: ['feriados-relatorio'],
    queryFn: async () => {
      const { data } = await supabase
        .from('bd_feriados')
        .select('data');
      return data?.map(f => f.data) || [];
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
      valor_total: diariasCompletas.reduce((acc, r) => acc + (r.valor_diaria_aplicada || 0) + (r.valor_refeicao_aplicado || 0), 0)
    };
  }, [relatorio]);

  const handleExport = () => {
    exportMutation.mutate(filters);
  };

  const handleExportPDF = async () => {
    if (relatorio.length === 0) {
      toast.error('Não há dados para exportar.');
      return;
    }
    
    setIsPDFLoading(true);
    try {
      const dateStr = filters.data_inicio 
        ? format(new Date(filters.data_inicio + 'T12:00:00'), 'yyyyMMdd') 
        : format(new Date(), 'yyyyMMdd');
      const fileName = `Relatorio_Diarias_${dateStr}`;
      
      // Usar resumo calculado localmente
      const resumoParaPDF = {
        total: relatorio.length,
        presentes: resumo.total_diarias,
        ausentes: 0,
        pendentes: 0,
        substituidos: 0,
        valor_total_presentes: resumo.valor_total,
        valor_total_previsto: resumo.valor_total
      };
      
      await generateRelatorioDiariasPDF(relatorio, resumoParaPDF, filters, feriados, fileName);
      toast.success('PDF gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar PDF.');
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
            <p className="text-xs text-muted-foreground mt-1">Permissão necessária: diarias_relatorio_view</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Relatório de Diárias</h1>
            <p className="text-muted-foreground">
              Folha de ponto e controle de pagamentos
            </p>
          </div>
          {canExport && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleExportPDF}
                disabled={isPDFLoading || relatorio.length === 0}
              >
                {isPDFLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                Exportar PDF
              </Button>
              <Button onClick={handleExport} disabled={exportMutation.isPending}>
                {exportMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Exportar Excel
              </Button>
            </div>
          )}
        </div>

        {/* 2 Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Diárias Executadas</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{resumo.total_diarias}</div>
              <p className="text-xs text-muted-foreground">
                diárias apontadas
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor Total a Pagar</CardTitle>
              <DollarSign className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(resumo.valor_total)}</div>
              <p className="text-xs text-muted-foreground">
                a pagar
              </p>
            </CardContent>
          </Card>
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
                <Label>Nº Solicitação</Label>
                <Combobox
                  options={[
                    { value: '__all__', label: 'Todas' },
                    ...solicitacoesAutorizadas.map((s: any) => ({
                      value: s.id,
                      label: s.numero_solicitacao
                    }))
                  ]}
                  value={filters.solicitacao_id ?? '__all__'}
                  onChange={(v) => setFilters({ ...filters, solicitacao_id: v === '__all__' ? undefined : v })}
                  placeholder="Todas"
                  searchPlaceholder="Buscar por número..."
                  emptyText="Nenhuma solicitação encontrada"
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
                <Label>Funcionário</Label>
                <Combobox
                  options={[
                    { value: '__all__', label: 'Todos' },
                    ...funcionariosApontados.map((f: any) => ({
                      value: f.id,
                      label: f.nome_completo
                    }))
                  ]}
                  value={filters.funcionario_id ?? '__all__'}
                  onChange={(v) => setFilters({ ...filters, funcionario_id: v === '__all__' ? undefined : v })}
                  placeholder="Todos"
                  searchPlaceholder="Buscar funcionário..."
                  emptyText="Nenhum funcionário encontrado"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table with 7 columns */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : relatorio.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground">
                Nenhum registro encontrado.
              </div>
            ) : (
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.map((item, idx) => (
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
                          {item.tipo_diaria === 'uma_e_meia' && (
                            <Badge className="text-xs bg-blue-600 text-white">1½ Diária</Badge>
                          )}
                          {item.tipo_diaria === 'completa' && (
                            <Badge variant="default" className="text-xs bg-green-600 text-white">1 Diária</Badge>
                          )}
                          {item.tipo_diaria === 'meia' && (
                            <Badge variant="secondary" className="text-xs bg-yellow-500 text-white">½ Diária</Badge>
                          )}
                          {(!item.tipo_diaria || item.tipo_diaria === 'nenhuma') && (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(
                            item.tipo_diaria === 'completa' ? (item.valor_diaria_aplicada || 0) :
                            item.tipo_diaria === 'uma_e_meia' ? (item.valor_diaria_aplicada || 0) * (2/3) :
                            0
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(
                            item.tipo_diaria === 'meia' ? (item.valor_diaria_aplicada || 0) :
                            item.tipo_diaria === 'uma_e_meia' ? (item.valor_diaria_aplicada || 0) * (1/3) :
                            0
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.valor_refeicao_aplicado || 0)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency((item.valor_diaria_aplicada || 0) + (item.valor_refeicao_aplicado || 0))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
          
          {/* Pagination Footer */}
          {relatorio.length > 0 && (
            <div className="border-t p-4 flex flex-col sm:flex-row items-center justify-between gap-4 bg-muted/50">
              <div className="text-sm text-muted-foreground">
                {totalItems} registros encontrados
              </div>
              
              <div className="flex items-center gap-2">
                <Select
                  value={pageSize.toString()}
                  onValueChange={(v) => setPageSize(Number(v))}
                >
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
                  disabled={!canPreviousPage}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={previousPage}
                  disabled={!canPreviousPage}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm px-2">
                  {currentPage + 1} de {totalPages || 1}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={nextPage}
                  disabled={!canNextPage}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={goToLastPage}
                  disabled={!canNextPage}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="text-lg font-bold">
                Total: {formatCurrency(resumo.valor_total)}
              </div>
            </div>
          )}
        </Card>
      </div>
    </MainLayout>
  );
}
