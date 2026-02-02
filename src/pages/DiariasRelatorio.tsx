import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Download, 
  FileSpreadsheet,
  Users,
  DollarSign,
  Building2,
  Filter,
  Loader2,
  Calendar as CalendarIcon,
  CheckCircle,
  XCircle,
  Clock
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useDynamicPermissions } from "@/hooks/useDynamicPermissions";
import { 
  useRelatorioFolha,
  usePresencaResumo,
  useExportarExcel
} from "@/hooks/diarias";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { RelatorioFilters, StatusPresenca } from "@/types/diarias";

// Status Badge Component
function PresencaBadge({ status }: { status: StatusPresenca }) {
  const config: Record<StatusPresenca, { variant: "default" | "secondary" | "destructive" | "outline"; label: string; icon: React.ReactNode }> = {
    presente: { variant: "default", label: "Presente", icon: <CheckCircle className="h-3 w-3" /> },
    ausente: { variant: "destructive", label: "Ausente", icon: <XCircle className="h-3 w-3" /> },
    pendente: { variant: "secondary", label: "Pendente", icon: <Clock className="h-3 w-3" /> },
    substituido: { variant: "outline", label: "Substituído", icon: <Users className="h-3 w-3" /> },
  };
  const c = config[status];
  return (
    <Badge variant={c.variant} className="gap-1">
      {c.icon}
      {c.label}
    </Badge>
  );
}

export default function DiariasRelatorio() {
  const { permissions, isSuperAdmin, isLoading: isLoadingPermissions } = useDynamicPermissions();
  const hasPermission = (perm: string) => permissions.includes(perm);
  
  // Verificar permissão de acesso
  const hasAccess = isSuperAdmin || hasPermission('diarias_relatorio_view') || hasPermission('diarias_view');
  
  // Filters
  const [filters, setFilters] = useState<RelatorioFilters>({
    presenca_status: 'presente' // Por padrão só mostra presentes
  });

  // Queries - DEVE VIR ANTES DOS EARLY RETURNS
  const { data: relatorio = [], isLoading } = useRelatorioFolha(filters);
  const { data: resumo } = usePresencaResumo(filters);
  
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

  // Funcionários
  const { data: funcionarios = [] } = useQuery({
    queryKey: ['funcionarios-lista'],
    queryFn: async () => {
      const { data } = await supabase
        .from('bd_funcionarios')
        .select('id, nome_completo')
        .order('nome_completo');
      return data || [];
    }
  });

  // Export mutation
  const exportMutation = useExportarExcel();

  // Permissions
  const canExport = isSuperAdmin || hasPermission('diarias_exportar_excel');
  const canViewRelatorio = isSuperAdmin || hasPermission('diarias_relatorio_view');

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Calcular total da tabela
  const totalValor = relatorio
    .filter((r: any) => r.presenca_status === 'presente')
    .reduce((acc: number, r: any) => acc + (r.valor_diaria_aplicada || 0), 0);

  const handleExport = () => {
    exportMutation.mutate(filters);
  };
  
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
              Folha de ponto e controle de pagamentos de diárias
            </p>
          </div>
          {canExport && (
            <Button onClick={handleExport} disabled={exportMutation.isPending}>
              {exportMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Exportar Excel
            </Button>
          )}
        </div>

        {/* Summary Cards */}
        {resumo && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Convocados</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{resumo.total}</div>
                <p className="text-xs text-muted-foreground">
                  {resumo.presentes} presentes, {resumo.ausentes} ausentes
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Presentes</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{resumo.presentes}</div>
                <p className="text-xs text-muted-foreground">
                  {resumo.pendentes} pendentes
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Valor Presentes</CardTitle>
                <DollarSign className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(resumo.valor_total_presentes)}</div>
                <p className="text-xs text-muted-foreground">
                  a pagar
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Valor Previsto</CardTitle>
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(resumo.valor_total_previsto)}</div>
                <p className="text-xs text-muted-foreground">
                  total convocado
                </p>
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
                <Label>Funcionário</Label>
                <Select
                  value={filters.funcionario_id ?? '__all__'}
                  onValueChange={(v) => setFilters({ ...filters, funcionario_id: v === '__all__' ? undefined : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos</SelectItem>
                    {funcionarios.map((f: any) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nome_completo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Presença</Label>
                <Select
                  value={filters.presenca_status ?? '__all__'}
                  onValueChange={(v) => setFilters({ ...filters, presenca_status: (v === '__all__' ? undefined : (v as StatusPresenca)) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos</SelectItem>
                    <SelectItem value="presente">Presente</SelectItem>
                    <SelectItem value="ausente">Ausente</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
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
            ) : relatorio.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground">
                Nenhum registro encontrado.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Centro de Custo</TableHead>
                      <TableHead>Funcionário</TableHead>
                      <TableHead>Função</TableHead>
                      <TableHead>Entrada</TableHead>
                      <TableHead>Saída</TableHead>
                      <TableHead>Intervalo</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {relatorio.map((item: any) => (
                      <TableRow key={item.convocado_id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                            {format(new Date(item.data), 'dd/MM/yyyy', { locale: ptBR })}
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
                        <TableCell className="font-medium">
                          {item.nome_funcionario}
                        </TableCell>
                        <TableCell>
                          {item.nome_funcao}
                        </TableCell>
                        <TableCell>
                          {item.hora_entrada || '-'}
                        </TableCell>
                        <TableCell>
                          {item.hora_saida || '-'}
                        </TableCell>
                        <TableCell>
                          {item.intervalo_inicio && item.intervalo_fim 
                            ? `${item.intervalo_inicio} - ${item.intervalo_fim}`
                            : '-'}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(item.valor_diaria_aplicada)}
                        </TableCell>
                        <TableCell>
                          <PresencaBadge status={item.presenca_status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
          
          {/* Footer com total */}
          {relatorio.length > 0 && (
            <div className="border-t p-4 flex items-center justify-between bg-muted/50">
              <div className="text-sm text-muted-foreground">
                {relatorio.length} registros encontrados
              </div>
              <div className="text-lg font-bold">
                Total: {formatCurrency(totalValor)}
              </div>
            </div>
          )}
        </Card>
      </div>
    </MainLayout>
  );
}
