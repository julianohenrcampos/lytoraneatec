import { useState, useMemo, useCallback } from "react";
import { format, eachDayOfInterval, isWeekend } from "date-fns";
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
  ChevronsRight,
  Printer } from
"lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { generateRelatorioDiariasPDF, generateRelatorioDiariasPDFDetalhado, generateCompiladoDiariasPDF, generateFolhaPontoPDF } from "@/services/pdfService";
import type { FolhaPontoFuncionario } from "@/components/diarias/pdf/FolhaPontoPDF";

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

  // Filtragem client-side por empresa, tipo de vínculo e gerente regional
  const relatorio = useMemo(() => {
    let filtered = relatorioRaw;
    if (filters.empresa_id) {
      filtered = filtered.filter((r: any) => r.empresa_id === filters.empresa_id);
    }
    if (filters.tipo_vinculo === 'diarista') {
      // "Sem Remessa" = funcionários SEM matrícula
      filtered = filtered.filter((r: any) => !r.matricula_funcionario);
    } else if (filters.tipo_vinculo === 'remessa') {
      // "Remessa" = funcionários COM matrícula
      filtered = filtered.filter((r: any) => !!r.matricula_funcionario);
    }
    // Filtrar por gerente regional (via centro de custo) - multi-select
    if (gerenteRegionalFilter.length > 0) {
      const ccIdsDoGerente = centrosCusto
        .filter((cc: any) => gerenteRegionalFilter.includes(cc.aprovador_diarias_id))
        .map((cc: any) => cc.id);
      filtered = filtered.filter((r: any) => ccIdsDoGerente.includes(r.centro_custo_id));
    }
    return filtered;
  }, [relatorioRaw, filters.empresa_id, filters.tipo_vinculo, gerenteRegionalFilter, centrosCusto]);

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
      const { data: presencas } = await supabase.
      from('bd_diaria_presencas').
      select('funcionario_id, bd_funcionarios!inner(id, nome_completo)');

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
  const [isGeneratingFolhaPonto, setIsGeneratingFolhaPonto] = useState(false);
  const [exportFormat, setExportFormat] = useState<'excel' | 'pdf' | 'pdf_detalhado' | 'compilado' | 'ambos'>('excel');

  // Folha de Ponto
  const canPrintFolhaPonto = !!filters.data_inicio && !!filters.data_fim && !!filters.centro_custo_id;

  const handlePrintFolhaPonto = useCallback(async () => {
    if (!filters.data_inicio || !filters.data_fim || !filters.centro_custo_id) return;
    if (relatorio.length === 0) {
      toast.error('Não há dados para gerar a folha de ponto.');
      return;
    }

    setIsGeneratingFolhaPonto(true);
    try {
      const dtInicio = new Date(filters.data_inicio + 'T12:00:00');
      const dtFim = new Date(filters.data_fim + 'T12:00:00');
      const allDays = eachDayOfInterval({ start: dtInicio, end: dtFim });

      // Agrupar por funcionário
      const funcMap = new Map<string, {
        nome_completo: string;
        matricula: string | null;
        cpf: string;
        diasMap: Map<string, { hora_entrada: string; hora_saida: string }>;
      }>();

      for (const r of relatorio) {
        if (!funcMap.has(r.funcionario_id)) {
          funcMap.set(r.funcionario_id, {
            nome_completo: r.nome_funcionario,
            matricula: r.matricula_funcionario || null,
            cpf: r.cpf_funcionario || '',
            diasMap: new Map(),
          });
        }
        const entry = funcMap.get(r.funcionario_id)!;
        if (String(r.presenca_status) === 'true' && r.hora_entrada && r.hora_saida) {
          entry.diasMap.set(r.data, {
            hora_entrada: r.hora_entrada,
            hora_saida: r.hora_saida,
          });
        }
      }

      const funcionarios: FolhaPontoFuncionario[] = Array.from(funcMap.values()).map((f) => {
        const dias = allDays
          .filter((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            if (isWeekend(day)) {
              return f.diasMap.has(dateStr);
            }
            return true;
          })
          .map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const registro = f.diasMap.get(dateStr);
            return {
              data: dateStr,
              hora_entrada: registro?.hora_entrada || '',
              hora_saida: registro?.hora_saida || '',
            };
          });

        return {
          nome_completo: f.nome_completo,
          matricula: f.matricula,
          cpf: f.cpf,
          dias,
        };
      });

      funcionarios.sort((a, b) => a.nome_completo.localeCompare(b.nome_completo));

      const cc = centrosCusto.find((c: any) => c.id === filters.centro_custo_id);
      const codigoCC = cc ? (cc as any).codigo_centro_custo : '';

      // Buscar número da solicitação
      const solIds = [...new Set(relatorio.map((r) => r.solicitacao_id))];
      let numSolicitacao = '';
      if (solIds.length > 0) {
        const { data: sols } = await supabase
          .from('bd_diaria_solicitacoes')
          .select('numero_solicitacao')
          .in('id', solIds)
          .limit(1);
        if (sols?.length) numSolicitacao = sols[0].numero_solicitacao;
      }

      const dateStr = format(dtInicio, 'yyyyMMdd');
      const fileName = `Folha_Ponto_${codigoCC}_${dateStr}`;
      await generateFolhaPontoPDF(numSolicitacao, codigoCC, funcionarios, fileName);

      toast.success('Folha de ponto gerada com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar folha de ponto:', error);
      toast.error('Erro ao gerar folha de ponto.');
    } finally {
      setIsGeneratingFolhaPonto(false);
    }
  }, [filters, relatorio, centrosCusto]);

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

  const handleExportExcel = () => {
    exportMutation.mutate(filters);
  };

  const handleExportPDF = async () => {
    if (relatorio.length === 0) {
      toast.error('Não há dados para exportar.');
      return;
    }

    setIsPDFLoading(true);
    try {
      const dateStr = filters.data_inicio ?
      format(new Date(filters.data_inicio + 'T12:00:00'), 'yyyyMMdd') :
      format(new Date(), 'yyyyMMdd');
      const fileName = `Relatorio_Diarias_${dateStr}`;

      const resumoParaPDF = {
        total: relatorio.length,
        presentes: resumo.total_diarias,
        ausentes: 0,
        pendentes: 0,
        substituidos: 0,
        valor_total_presentes: resumo.valor_total,
        valor_total_previsto: resumo.valor_total
      };

      // Buscar nomes do Engenheiro Solicitante e Gerente Regional
      let engenheiroSolicitante: string | undefined;
      let gerenteRegionalNome: string | undefined;

      const solicitacaoIds = [...new Set(relatorio.map(r => r.solicitacao_id))];
      if (solicitacaoIds.length > 0) {
        // Buscar engenheiro solicitante
        const { data: solicitacoes } = await supabase
          .from('bd_diaria_solicitacoes')
          .select('engenheiro_solicitante_id, centro_custo_id')
          .in('id', solicitacaoIds);

        if (solicitacoes) {
          const engenheiroIds = [...new Set(solicitacoes.map(s => s.engenheiro_solicitante_id).filter(Boolean))];
          if (engenheiroIds.length > 0) {
            const { data: engenheiros } = await supabase
              .from('bd_funcionarios')
              .select('nome_completo')
              .in('id', engenheiroIds);
            if (engenheiros?.length) {
              engenheiroSolicitante = [...new Set(engenheiros.map(e => (e.nome_completo || '').split(' ')[0]))].join(' | ');
            }
          }

          // Buscar gerente regional via centro de custo
          const ccIds = [...new Set(solicitacoes.map(s => s.centro_custo_id).filter(Boolean))];
          if (ccIds.length > 0) {
            const { data: ccs } = await supabase
              .from('bd_centros_custo')
              .select('aprovador_diarias_id')
              .in('id', ccIds);
            const aprovadorIds = [...new Set(ccs?.map(cc => cc.aprovador_diarias_id).filter(Boolean) || [])];
            if (aprovadorIds.length > 0) {
              const { data: gerentes } = await supabase
                .from('bd_funcionarios')
                .select('nome_completo')
                .in('id', aprovadorIds);
              if (gerentes?.length) {
                gerenteRegionalNome = gerentes.map(g => g.nome_completo).join(', ');
              }
            }
          }
        }
      }

      await generateRelatorioDiariasPDF(relatorio, resumoParaPDF, filters, feriados, fileName, {
        engenheiroSolicitante,
        gerenteRegional: gerenteRegionalNome
      });
      toast.success('PDF gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar PDF.');
    } finally {
      setIsPDFLoading(false);
    }
  };

  const handleExportCompilado = async () => {
    if (relatorio.length === 0) {
      toast.error('Não há dados para exportar.');
      return;
    }
    setIsPDFLoading(true);
    try {
      const gerentesMap: Record<string, string> = {};
      gerentesRegionais.forEach((g: any) => { gerentesMap[g.id] = g.nome_completo; });

      const { dados, totalGeralQuantidade, totalGeralValor } = buildCompiladoData(
        relatorio,
        centrosCusto as any,
        gerentesMap,
        feriados
      );

      // Determine período label
      let mesAno: string;
      if (filters.data_inicio && filters.data_fim) {
        const dtInicio = new Date(filters.data_inicio + 'T12:00:00');
        const dtFim = new Date(filters.data_fim + 'T12:00:00');
        const mesInicio = dtInicio.getMonth();
        const mesFim = dtFim.getMonth();
        const anoInicio = dtInicio.getFullYear();
        const anoFim = dtFim.getFullYear();
        
        const mesesPT = ['JANEIRO','FEVEREIRO','MARÇO','ABRIL','MAIO','JUNHO','JULHO','AGOSTO','SETEMBRO','OUTUBRO','NOVEMBRO','DEZEMBRO'];
        
        if (mesInicio === mesFim && anoInicio === anoFim) {
          mesAno = `${mesesPT[mesInicio]} ${anoInicio}`;
        } else if (anoInicio === anoFim) {
          const diffMeses = mesFim - mesInicio;
          if (diffMeses === 1) {
            mesAno = `${mesesPT[mesInicio]} E ${mesesPT[mesFim]} ${anoInicio}`;
          } else {
            mesAno = `${mesesPT[mesInicio]} A ${mesesPT[mesFim]} ${anoInicio}`;
          }
        } else {
          mesAno = `${mesesPT[mesInicio]}/${anoInicio} A ${mesesPT[mesFim]}/${anoFim}`;
        }
      } else if (filters.data_inicio) {
        mesAno = format(new Date(filters.data_inicio + 'T12:00:00'), 'MMMM/yyyy', { locale: ptBR }).toUpperCase();
      } else {
        mesAno = format(new Date(), 'MMMM/yyyy', { locale: ptBR }).toUpperCase();
      }
      // Build periodo string
      let periodo: string | undefined;
      if (filters.data_inicio && filters.data_fim) {
        const fmtInicio = format(new Date(filters.data_inicio + 'T12:00:00'), 'dd/MM/yyyy');
        const fmtFim = format(new Date(filters.data_fim + 'T12:00:00'), 'dd/MM/yyyy');
        periodo = `${fmtInicio} à ${fmtFim}`;
      }

      const fileName = `Compilado_Diarias_${mesAno.replace(/[^a-zA-Z0-9]/g, '_')}`;
      await generateCompiladoDiariasPDF(dados, mesAno, totalGeralQuantidade, totalGeralValor, fileName, periodo);
      toast.success('PDF Compilado gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF compilado:', error);
      toast.error('Erro ao gerar PDF compilado.');
    } finally {
      setIsPDFLoading(false);
    }
  };

  const handleExportPDFDetalhado = async () => {
    if (relatorio.length === 0) {
      toast.error('Não há dados para exportar.');
      return;
    }

    setIsPDFLoading(true);
    try {
      const dateStr = filters.data_inicio ?
        format(new Date(filters.data_inicio + 'T12:00:00'), 'yyyyMMdd') :
        format(new Date(), 'yyyyMMdd');
      const fileName = `Relatorio_Diarias_Detalhado_${dateStr}`;

      const resumoParaPDF = {
        total: relatorio.length,
        presentes: resumo.total_diarias,
        ausentes: 0,
        pendentes: 0,
        substituidos: 0,
        valor_total_presentes: resumo.valor_total,
        valor_total_previsto: resumo.valor_total
      };

      // Buscar nomes do Engenheiro Solicitante e Gerente Regional
      let engenheiroSolicitante: string | undefined;
      let gerenteRegionalNome: string | undefined;

      const solicitacaoIds = [...new Set(relatorio.map(r => r.solicitacao_id))];
      if (solicitacaoIds.length > 0) {
        const { data: solicitacoes } = await supabase
          .from('bd_diaria_solicitacoes')
          .select('engenheiro_solicitante_id, centro_custo_id')
          .in('id', solicitacaoIds);

        if (solicitacoes) {
          const engenheiroIds = [...new Set(solicitacoes.map(s => s.engenheiro_solicitante_id).filter(Boolean))];
          if (engenheiroIds.length > 0) {
            const { data: engenheiros } = await supabase
              .from('bd_funcionarios')
              .select('nome_completo')
              .in('id', engenheiroIds);
            if (engenheiros?.length) {
              engenheiroSolicitante = [...new Set(engenheiros.map(e => (e.nome_completo || '').split(' ')[0]))].join(' | ');
            }
          }

          const ccIds = [...new Set(solicitacoes.map(s => s.centro_custo_id).filter(Boolean))];
          if (ccIds.length > 0) {
            const { data: ccs } = await supabase
              .from('bd_centros_custo')
              .select('aprovador_diarias_id')
              .in('id', ccIds);
            const aprovadorIds = [...new Set(ccs?.map(cc => cc.aprovador_diarias_id).filter(Boolean) || [])];
            if (aprovadorIds.length > 0) {
              const { data: gerentes } = await supabase
                .from('bd_funcionarios')
                .select('nome_completo')
                .in('id', aprovadorIds);
              if (gerentes?.length) {
                gerenteRegionalNome = gerentes.map(g => g.nome_completo).join(', ');
              }
            }
          }
        }
      }

      await generateRelatorioDiariasPDFDetalhado(relatorio, resumoParaPDF, filters, feriados, fileName, {
        engenheiroSolicitante,
        gerenteRegional: gerenteRegionalNome
      });
      toast.success('PDF Detalhado gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF detalhado:', error);
      toast.error('Erro ao gerar PDF detalhado.');
    } finally {
      setIsPDFLoading(false);
    }
  };

  const handleExport = async () => {
    if (relatorio.length === 0) {
      toast.error('Não há dados para exportar.');
      return;
    }
    if (exportFormat === 'excel') {
      handleExportExcel();
    } else if (exportFormat === 'pdf') {
      await handleExportPDF();
    } else if (exportFormat === 'pdf_detalhado') {
      await handleExportPDFDetalhado();
    } else if (exportFormat === 'compilado') {
      await handleExportCompilado();
    } else {
      // Ambos em paralelo
      handleExportExcel();
      await handleExportPDF();
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
            <h1 className="text-2xl font-bold tracking-tight">Relatório de Diárias</h1>
            <p className="text-muted-foreground">
              Folha de ponto e controle de pagamentos
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
              <span><strong>Empresa:</strong> {filters.empresa_id ? empresas.find((e: any) => e.id === filters.empresa_id)?.nome_empresa || '—' : 'Todas'}</span>
              <span><strong>Centro de Custo:</strong> {filters.centro_custo_id ? centrosCusto.find((c: any) => c.id === filters.centro_custo_id)?.nome_centro_custo || '—' : 'Todos'}</span>
            </div>
          </div>
          {canExport &&
          <div className="flex items-center gap-4">
              <RadioGroup
                value={exportFormat}
                onValueChange={(v) => setExportFormat(v as 'excel' | 'pdf' | 'pdf_detalhado' | 'compilado' | 'ambos')}
                className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="excel" id="export-excel" />
                  <Label htmlFor="export-excel" className="text-sm cursor-pointer">Excel</Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="pdf" id="export-pdf" />
                  <Label htmlFor="export-pdf" className="text-sm cursor-pointer">PDF</Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="pdf_detalhado" id="export-pdf-detalhado" />
                  <Label htmlFor="export-pdf-detalhado" className="text-sm cursor-pointer">PDF Detalhado</Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="compilado" id="export-compilado" />
                  <Label htmlFor="export-compilado" className="text-sm cursor-pointer">Compilado</Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="ambos" id="export-ambos" />
                  <Label htmlFor="export-ambos" className="text-sm cursor-pointer">Ambos</Label>
                </div>
              </RadioGroup>
              <Button
                onClick={handleExport}
                disabled={exportMutation.isPending || isPDFLoading || relatorio.length === 0}>
                {(exportMutation.isPending || isPDFLoading) ?
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> :
                  <Download className="h-4 w-4 mr-2" />
                }
                Exportar
              </Button>
              <Button
                variant="outline"
                onClick={handlePrintFolhaPonto}
                disabled={!canPrintFolhaPonto || isGeneratingFolhaPonto || relatorio.length === 0}>
                {isGeneratingFolhaPonto ?
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> :
                  <Printer className="h-4 w-4 mr-2" />
                }
                Folha de Ponto
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
                <Combobox
                  options={[
                  { value: '__all__', label: 'Todas' },
                  ...solicitacoesAutorizadas.map((s: any) => ({
                    value: s.id,
                    label: s.numero_solicitacao
                  }))]
                  }
                  value={filters.solicitacao_id ?? '__all__'}
                  onChange={(v) => setFilters({ ...filters, solicitacao_id: v === '__all__' ? undefined : v })}
                  placeholder="Todas"
                  searchPlaceholder="Buscar por número..."
                  emptyText="Nenhuma solicitação encontrada" />

              </div>
              <div>
                <Label>Centro de Custo</Label>
                <Combobox
                  options={[
                  { value: '__all__', label: 'Todos' },
                  ...centrosCusto.map((cc: any) => ({
                    value: cc.id,
                    label: cc.codigo_centro_custo
                  }))]
                  }
                  value={filters.centro_custo_id ?? '__all__'}
                  onChange={(v) => setFilters({ ...filters, centro_custo_id: v === '__all__' ? undefined : v })}
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
                        item.tipo_diaria === 'completa' ? item.valor_diaria_aplicada || 0 :
                        item.tipo_diaria === 'uma_e_meia' ? (item.valor_diaria_aplicada || 0) * (2 / 3) :
                        0
                      )}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(
                        item.tipo_diaria === 'meia' ? item.valor_diaria_aplicada || 0 :
                        item.tipo_diaria === 'uma_e_meia' ? (item.valor_diaria_aplicada || 0) * (1 / 3) :
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

              <div className="text-lg font-bold">
                Total: {formatCurrency(resumo.valor_total)}
              </div>
            </div>
          }
        </Card>
      </div>
    </MainLayout>);

}