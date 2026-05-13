import { useState, useMemo, useEffect } from 'react';
import { format, startOfWeek, endOfWeek, subWeeks, differenceInDays, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { Loader2, Calendar, Download, FileArchive, Files, Info, Search, Users, CheckSquare, Square } from 'lucide-react';
import JSZip from 'jszip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerWithRange } from '@/components/ui/date-picker-range';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { generateRelatorioDiariasPDFPorPeriodoBlob, generateCompiladoDiariasPDFBlob, fetchEmpresaLogosMap, loadImageAsBase64 } from '@/services/pdfService';
import { generateRelatorioRemessaBlob } from '@/services/pdf/relatorioRemessaPdf';
import { buildCompiladoData } from '@/components/diarias/pdf/CompiladoDiariasPDF';
import type { RelatorioFolhaItem } from '@/types/diarias';
import type { DateRange } from 'react-day-picker';
import { buildRelatorioConferenciaResumo, type RelatorioConferenciaResumo } from '@/services/diarias/relatorioMetrics';

interface RelatorioSemanalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gerentesRegionais: { id: string; nome_completo: string }[];
  centrosCusto: { id: string; codigo_centro_custo: string; nome_centro_custo: string; aprovador_diarias_id: string | null }[];
  feriados: string[];
  defaultCentroCustoIds?: string[];
  defaultEmpresaId?: string;
  defaultTipoVinculo?: string;
  defaultGerenteId?: string;
  defaultSolicitacaoIds?: string[];
  /** Período exato vindo da tela Relatório/Folha. Quando presente, o modal NÃO sobrescreve com data_inicio/data_fim da solicitação. */
  defaultDateRange?: { from?: Date; to?: Date };
}

interface FuncionarioOption {
  id: string;
  nome: string;
  ativo: boolean;
}

interface RelatorioConferenciaFonte {
  funcionario_id: string;
  nome_funcionario: string | null;
  empresa_id?: string | null;
  empresa_funcionario?: string | null;
  solicitacao_id?: string | null;
  numero_solicitacao?: string | null;
  matricula_funcionario?: string | null;
  presenca_status?: string | boolean | null;
  hora_entrada?: string | null;
  hora_saida?: string | null;
}

function calcularUltimaSemana() {
  const hoje = new Date();
  const segundaAnterior = startOfWeek(subWeeks(hoje, 1), { weekStartsOn: 1 });
  const domingoAnterior = endOfWeek(subWeeks(hoje, 1), { weekStartsOn: 1 });
  return { from: segundaAnterior, to: domingoAnterior };
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function RelatorioSemanalModal({
  open,
  onOpenChange,
  gerentesRegionais,
  centrosCusto,
  feriados,
  defaultCentroCustoIds,
  defaultEmpresaId,
  defaultTipoVinculo,
  defaultGerenteId,
  defaultSolicitacaoIds,
  defaultDateRange,
}: RelatorioSemanalModalProps) {
  const [gerenteSelecionado, setGerenteSelecionado] = useState<string>('todos');
  const [modoDownload, setModoDownload] = useState<'zip' | 'individual'>('zip');
  const [isLoading, setIsLoading] = useState(false);

  const hasScreenDateRange = !!(defaultDateRange?.from && defaultDateRange?.to);

  const initialRange = useMemo<DateRange>(() => {
    if (hasScreenDateRange) {
      return { from: defaultDateRange!.from, to: defaultDateRange!.to };
    }
    return calcularUltimaSemana();
  }, [hasScreenDateRange, defaultDateRange?.from?.getTime(), defaultDateRange?.to?.getTime(), open]);

  const [dateRange, setDateRange] = useState<DateRange | undefined>(initialRange);
  // true quando o usuário clicou explicitamente em "Expandir para semana operacional"
  const [expandidoSemana, setExpandidoSemana] = useState(false);

  // Employee filter state
  const [funcionarios, setFuncionarios] = useState<FuncionarioOption[]>([]);
  const [selectedFuncionarios, setSelectedFuncionarios] = useState<Set<string>>(new Set());
  const [searchFuncionario, setSearchFuncionario] = useState('');
  const [isLoadingFuncionarios, setIsLoadingFuncionarios] = useState(false);
  const [showFuncionarioFilter, setShowFuncionarioFilter] = useState(false);
  const [conferenciaPreview, setConferenciaPreview] = useState<RelatorioConferenciaResumo | null>(null);
  const [conferenciaSource, setConferenciaSource] = useState<RelatorioConferenciaFonte[]>([]);

  const hasSolicitacaoFilter = defaultSolicitacaoIds && defaultSolicitacaoIds.length > 0;

  // Quando o modal abre, define dateRange e (se houver solicitação) carrega funcionários do período correto.
  useEffect(() => {
    if (!open) {
      setShowFuncionarioFilter(false);
      setFuncionarios([]);
      setSelectedFuncionarios(new Set());
      setSearchFuncionario('');
      setConferenciaPreview(null);
      setConferenciaSource([]);
      setExpandidoSemana(false);
      return;
    }

    // Regra principal: se a tela passou um período (defaultDateRange), respeitamos exatamente.
    // Caso contrário, fallback para min/max(data_inicio,data_fim) das solicitações; se nada, última semana.
    if (hasScreenDateRange) {
      setDateRange({ from: defaultDateRange!.from, to: defaultDateRange!.to });
      if (hasSolicitacaoFilter) {
        fetchFuncionariosFromSolicitacoes(
          defaultSolicitacaoIds!,
          format(defaultDateRange!.from!, 'yyyy-MM-dd'),
          format(defaultDateRange!.to!, 'yyyy-MM-dd'),
        );
      }
    } else if (hasSolicitacaoFilter) {
      (async () => {
        const { data } = await supabase
          .from('bd_diaria_solicitacoes')
          .select('data_inicio, data_fim')
          .in('id', defaultSolicitacaoIds!);
        let minDate: Date;
        let maxDate: Date;
        if (data && data.length > 0) {
          const starts = data.map(d => new Date(d.data_inicio + 'T12:00:00'));
          const ends = data.map(d => new Date(d.data_fim + 'T12:00:00'));
          minDate = new Date(Math.min(...starts.map(d => d.getTime())));
          maxDate = new Date(Math.max(...ends.map(d => d.getTime())));
        } else {
          const fb = calcularUltimaSemana();
          minDate = fb.from;
          maxDate = fb.to;
        }
        setDateRange({ from: minDate, to: maxDate });
        fetchFuncionariosFromSolicitacoes(
          defaultSolicitacaoIds!,
          format(minDate, 'yyyy-MM-dd'),
          format(maxDate, 'yyyy-MM-dd'),
        );
      })();
    } else {
      setDateRange(calcularUltimaSemana());
    }

    if (defaultGerenteId && gerentesRegionais.some(g => g.id === defaultGerenteId)) {
      setGerenteSelecionado(defaultGerenteId);
    } else {
      setGerenteSelecionado('todos');
    }
  }, [open, defaultGerenteId, gerentesRegionais, hasSolicitacaoFilter, hasScreenDateRange, defaultDateRange?.from?.getTime(), defaultDateRange?.to?.getTime()]);

  // Detecta se o range atual difere do range original da tela => limpa flag de "expandido" se voltou a bater.
  useEffect(() => {
    if (!hasScreenDateRange || !dateRange?.from || !dateRange?.to) return;
    const igualTela =
      isSameDay(dateRange.from, defaultDateRange!.from!) &&
      isSameDay(dateRange.to, defaultDateRange!.to!);
    if (igualTela && expandidoSemana) setExpandidoSemana(false);
  }, [dateRange?.from, dateRange?.to, hasScreenDateRange, defaultDateRange?.from, defaultDateRange?.to, expandidoSemana]);

  const handleExpandirSemana = () => {
    if (!dateRange?.from) return;
    const seg = startOfWeek(dateRange.from, { weekStartsOn: 1 });
    const dom = endOfWeek(dateRange.from, { weekStartsOn: 1 });
    setDateRange({ from: seg, to: dom });
    setExpandidoSemana(true);
    if (hasSolicitacaoFilter) {
      fetchFuncionariosFromSolicitacoes(
        defaultSolicitacaoIds!,
        format(seg, 'yyyy-MM-dd'),
        format(dom, 'yyyy-MM-dd'),
      );
    }
  };

  const handleRestaurarPeriodoTela = () => {
    if (!hasScreenDateRange) return;
    setDateRange({ from: defaultDateRange!.from, to: defaultDateRange!.to });
    setExpandidoSemana(false);
    if (hasSolicitacaoFilter) {
      fetchFuncionariosFromSolicitacoes(
        defaultSolicitacaoIds!,
        format(defaultDateRange!.from!, 'yyyy-MM-dd'),
        format(defaultDateRange!.to!, 'yyyy-MM-dd'),
      );
    }
  };

  const fetchFuncionariosFromSolicitacoes = async (
    solicitacaoIds: string[],
    dataInicio?: string,
    dataFim?: string,
  ) => {
    setIsLoadingFuncionarios(true);
    try {
      // Fetch records from the view para montar a conferência real e a lista de funcionários
      let allRecords: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        let q = supabase
          .from('vw_relatorio_diarias_folha')
          .select('funcionario_id, nome_funcionario, empresa_id, empresa_funcionario, solicitacao_id, numero_solicitacao, matricula_funcionario, presenca_status, hora_entrada, hora_saida, data')
          .in('solicitacao_id', solicitacaoIds);
        if (dataInicio) q = q.gte('data', dataInicio);
        if (dataFim) q = q.lte('data', dataFim);
        const { data, error } = await q.range(from, from + pageSize - 1);
        if (error) throw error;
        allRecords = allRecords.concat(data || []);
        hasMore = (data?.length || 0) === pageSize;
        from += pageSize;
      }

      // Deduplicate by funcionario_id
      const uniqueMap = new Map<string, string>();
      allRecords.forEach(r => {
        if (r.funcionario_id && !uniqueMap.has(r.funcionario_id)) {
          uniqueMap.set(r.funcionario_id, r.nome_funcionario || 'Sem nome');
        }
      });

      const funcionarioIds = [...uniqueMap.keys()];

      // Fetch status from bd_funcionarios
      let statusMap: Record<string, string> = {};
      if (funcionarioIds.length > 0) {
        const { data: funcData } = await supabase
          .from('bd_funcionarios')
          .select('id, situacao')
          .in('id', funcionarioIds);
        funcData?.forEach((f: any) => {
          statusMap[f.id] = f.situacao || 'ativo';
        });
      }

      const list: FuncionarioOption[] = funcionarioIds.map(id => ({
        id,
        nome: uniqueMap.get(id) || 'Sem nome',
        ativo: (statusMap[id] || 'ativo').toLowerCase() === 'ativo',
      })).sort((a, b) => a.nome.localeCompare(b.nome));

      setFuncionarios(list);
      setSelectedFuncionarios(new Set(list.map(f => f.id)));
      setShowFuncionarioFilter(true);
      setConferenciaSource(allRecords as RelatorioConferenciaFonte[]);
      setConferenciaPreview(buildRelatorioConferenciaResumo(allRecords as RelatorioFolhaItem[]));
    } catch (err) {
      console.error('Erro ao buscar funcionários:', err);
    } finally {
      setIsLoadingFuncionarios(false);
    }
  };

  const filteredFuncionarios = useMemo(() => {
    if (!searchFuncionario.trim()) return funcionarios;
    const term = searchFuncionario.toLowerCase();
    return funcionarios.filter(f => f.nome.toLowerCase().includes(term));
  }, [funcionarios, searchFuncionario]);

  const conferenciaPreviewFiltrada = useMemo(() => {
    if (!conferenciaSource.length) return conferenciaPreview;
    if (selectedFuncionarios.size === 0) return buildRelatorioConferenciaResumo([]);
    const filtrado = conferenciaSource.filter(item => selectedFuncionarios.has(item.funcionario_id));
    return buildRelatorioConferenciaResumo(filtrado as RelatorioFolhaItem[]);
  }, [conferenciaPreview, conferenciaSource, selectedFuncionarios]);

  const toggleFuncionario = (id: string) => {
    setSelectedFuncionarios(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedFuncionarios(new Set(funcionarios.map(f => f.id)));
  const deselectAll = () => setSelectedFuncionarios(new Set());

  const periodoLabel = dateRange?.from && dateRange?.to
    ? `${format(dateRange.from, 'dd/MM/yyyy')} a ${format(dateRange.to, 'dd/MM/yyyy')}`
    : '';

  const periodoFileLabel = dateRange?.from && dateRange?.to
    ? `${format(dateRange.from, 'dd-MM')}_a_${format(dateRange.to, 'dd-MM')}`
    : '';

  const handleGerar = async () => {
    if (!dateRange?.from || !dateRange?.to) {
      toast.error('Selecione o período.');
      return;
    }

    const diff = differenceInDays(dateRange.to, dateRange.from);
    if (diff < 0) {
      toast.error('Data inicial deve ser anterior à data final.');
      return;
    }
    if (diff > 31) {
      toast.error('O intervalo máximo é de 31 dias.');
      return;
    }

    if (showFuncionarioFilter && selectedFuncionarios.size === 0) {
      toast.error('Selecione ao menos um funcionário.');
      return;
    }

    setIsLoading(true);
    try {
      const dataInicio = format(dateRange.from, 'yyyy-MM-dd');
      const dataFim = format(dateRange.to, 'yyyy-MM-dd');

      let ccIds: string[] = [];
      if (defaultCentroCustoIds && defaultCentroCustoIds.length > 0) {
        ccIds = defaultCentroCustoIds;
      } else if (gerenteSelecionado !== 'todos') {
        ccIds = centrosCusto
          .filter(cc => cc.aprovador_diarias_id === gerenteSelecionado)
          .map(cc => cc.id);
        if (ccIds.length === 0) {
          toast.error('Nenhum centro de custo vinculado a este gerente.');
          return;
        }
      }

      // SEMPRE aplica o filtro de data, mesmo quando há solicitacao_id.
      // Garante que o período do PDF == período exibido no modal.
      let baseQuery = supabase
        .from('vw_relatorio_diarias_folha')
        .select('*')
        .gte('data', dataInicio)
        .lte('data', dataFim);

      if (hasSolicitacaoFilter) {
        baseQuery = baseQuery.in('solicitacao_id', defaultSolicitacaoIds!);
      }

      if (ccIds.length > 0) {
        baseQuery = baseQuery.in('centro_custo_id', ccIds);
      }

      let allData: RelatorioFolhaItem[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await baseQuery.range(from, from + pageSize - 1);
        if (error) throw error;
        allData = allData.concat((data || []) as RelatorioFolhaItem[]);
        hasMore = (data?.length || 0) === pageSize;
        from += pageSize;
      }

      if (defaultEmpresaId) {
        allData = allData.filter(r => r.empresa_id === defaultEmpresaId);
      }
      if (defaultTipoVinculo === 'diarista') {
        allData = allData.filter(r => !r.matricula_funcionario || r.matricula_funcionario.trim() === '' || r.matricula_funcionario === '---');
      } else if (defaultTipoVinculo === 'remessa') {
        allData = allData.filter(r => r.matricula_funcionario && r.matricula_funcionario.trim() !== '' && r.matricula_funcionario !== '---');
      }

      // Apply employee filter
      if (showFuncionarioFilter && selectedFuncionarios.size < funcionarios.length) {
        allData = allData.filter(r => selectedFuncionarios.has(r.funcionario_id));
      }

      if (allData.length === 0) {
        toast.error('Nenhum dado encontrado para o período e filtros selecionados.');
        return;
      }

      const conferencia = buildRelatorioConferenciaResumo(allData);
      console.table(conferencia.porEmpresa.map(item => ({ empresa: item.label, confirmados: item.totalConfirmados, registros: item.totalRegistros })));
      console.table(conferencia.porVinculo.map(item => ({ vinculo: item.label, confirmados: item.totalConfirmados, registros: item.totalRegistros })));
      console.table(conferencia.porSolicitacao.map(item => ({ solicitacao: item.label, confirmados: item.totalConfirmados, registros: item.totalRegistros })));

      const filtros = { data_inicio: dataInicio, data_fim: dataFim };

      const uniqueCCIds = [...new Set(allData.map(r => r.centro_custo_id).filter(Boolean))];
      const { data: ccsData } = await supabase
        .from('bd_centros_custo')
        .select('id, codigo_centro_custo, nome_centro_custo, aprovador_diarias_id, diretoria_id')
        .in('id', uniqueCCIds);
      const centrosCustoInfo = (ccsData || []).map((cc: any) => ({
        id: cc.id,
        codigo_centro_custo: cc.codigo_centro_custo,
        nome_centro_custo: cc.nome_centro_custo,
        aprovador_diarias_id: cc.aprovador_diarias_id,
        diretoria_id: cc.diretoria_id,
      }));

      const aprovadorIds = [...new Set(centrosCustoInfo.map(cc => cc.aprovador_diarias_id).filter(Boolean))] as string[];
      const gerentesMap: Record<string, string> = {};
      if (aprovadorIds.length > 0) {
        const { data: gerentes } = await supabase.from('bd_funcionarios').select('id, nome_completo').in('id', aprovadorIds);
        gerentes?.forEach((g: any) => { gerentesMap[g.id] = g.nome_completo; });
      }

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

      const gerentesMapCompilado: Record<string, string> = {};
      gerentesRegionais.forEach(g => { gerentesMapCompilado[g.id] = g.nome_completo; });

      const ano = new Date(dataInicio + 'T12:00:00').getFullYear();
      const sequencia = `SEM - ${periodoLabel}`;

      const { centros: centrosRemessa, empresaGroups: egRemessa, totalGeralQuantidade: tgqR, totalGeralValor: tgvR } = buildCompiladoData(
        allData, centrosCusto as any, gerentesMapCompilado, feriados, 'remessa'
      );
      const { centros: centrosSemRemessa, empresaGroups: egSemRemessa, totalGeralQuantidade: tgqSR, totalGeralValor: tgvSR } = buildCompiladoData(
        allData, centrosCusto as any, gerentesMapCompilado, feriados, 'sem_remessa'
      );

      const logoMap = await fetchEmpresaLogosMap(allData);

      toast.info('Gerando 5 relatórios, aguarde...');

      const [detalhadoBlob, compiladoRemessaBlob, compiladoSemRemessaBlob, remessaBlob, semRemessaBlob] = await Promise.all([
        generateRelatorioDiariasPDFPorPeriodoBlob(allData, filtros, feriados, {
          centrosCustoInfo, gerentesMap, diretoresMap,
        }),
        generateCompiladoDiariasPDFBlob(centrosRemessa, ano, `${sequencia} (Remessa)`, tgqR, tgvR, undefined, egRemessa, logoMap),
        generateCompiladoDiariasPDFBlob(centrosSemRemessa, ano, `${sequencia} (Sem Remessa)`, tgqSR, tgvSR, undefined, egSemRemessa, logoMap),
        generateRelatorioRemessaBlob(allData, periodoLabel, 'remessa'),
        generateRelatorioRemessaBlob(allData, periodoLabel, 'sem_remessa'),
      ]);

      const files = [
        { name: `diarias_detalhado_${periodoFileLabel}.pdf`, blob: detalhadoBlob },
        { name: `compilado_remessa_${periodoFileLabel}.pdf`, blob: compiladoRemessaBlob },
        { name: `compilado_sem_remessa_${periodoFileLabel}.pdf`, blob: compiladoSemRemessaBlob },
        { name: `remessa_${periodoFileLabel}.pdf`, blob: remessaBlob },
        { name: `sem_remessa_${periodoFileLabel}.pdf`, blob: semRemessaBlob },
      ];

      if (modoDownload === 'zip') {
        const zip = new JSZip();
        files.forEach(f => zip.file(f.name, f.blob));
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        downloadBlob(zipBlob, `relatorios_diarias_${periodoFileLabel}.zip`);
      } else {
        for (let i = 0; i < files.length; i++) {
          downloadBlob(files[i].blob, files[i].name);
          if (i < files.length - 1) await new Promise(r => setTimeout(r, 500));
        }
      }

      toast.success('Relatórios gerados com sucesso!');
      onOpenChange(false);
    } catch (error: any) {
      console.error('Erro ao gerar relatórios semanais:', error);
      toast.error(error?.message || 'Erro ao gerar relatórios semanais.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Gerar Relatórios Semanais
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 overflow-y-auto flex-1">
          {/* Período */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {hasScreenDateRange
                ? 'Período (vindo do filtro da tela Relatório/Folha)'
                : hasSolicitacaoFilter
                  ? `Período baseado em ${defaultSolicitacaoIds!.length} solicitação(ões)`
                  : 'Período (padrão: última semana completa)'}
            </Label>

            {hasScreenDateRange && !expandidoSemana && (
              <div className="flex items-center gap-1.5 text-xs text-primary bg-primary/10 rounded px-2 py-1">
                <Info className="h-3.5 w-3.5" />
                Respeitando o período exato do filtro da tela: {periodoLabel}
              </div>
            )}

            {expandidoSemana && (
              <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 rounded px-2 py-1">
                <Info className="h-3.5 w-3.5" />
                Relatório semanal expandido: {periodoLabel} (Seg→Dom)
              </div>
            )}

            {!hasScreenDateRange && hasSolicitacaoFilter && (
              <div className="flex items-center gap-1.5 text-xs text-primary bg-primary/10 rounded px-2 py-1">
                <Info className="h-3.5 w-3.5" />
                Datas calculadas automaticamente a partir das solicitações filtradas
              </div>
            )}

            <DatePickerWithRange value={dateRange} onChange={setDateRange} />

            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={handleExpandirSemana}
                disabled={!dateRange?.from}
              >
                Expandir para semana operacional (Seg→Dom)
              </Button>
              {hasScreenDateRange && expandidoSemana && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleRestaurarPeriodoTela}
                >
                  Restaurar período da tela
                </Button>
              )}
            </div>
          </div>

          {/* Gerente */}
          <div className="space-y-1.5">
            <Label>Gerente Regional</Label>
            <Select value={gerenteSelecionado} onValueChange={setGerenteSelecionado}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {gerentesRegionais.map(g => (
                  <SelectItem key={g.id} value={g.id}>{g.nome_completo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Employee Filter */}
          {showFuncionarioFilter && (
            <div className="space-y-2 border rounded-md p-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5 text-sm">
                  <Users className="h-4 w-4" />
                  Funcionários ({selectedFuncionarios.size}/{funcionarios.length})
                </Label>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={selectAll}>
                    <CheckSquare className="h-3.5 w-3.5 mr-1" />
                    Todos
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={deselectAll}>
                    <Square className="h-3.5 w-3.5 mr-1" />
                    Nenhum
                  </Button>
                </div>
              </div>

              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar funcionário..."
                  value={searchFuncionario}
                  onChange={e => setSearchFuncionario(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>

              {isLoadingFuncionarios ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-xs text-muted-foreground">Carregando funcionários...</span>
                </div>
              ) : (
                <ScrollArea className="h-[200px]">
                  <div className="space-y-0.5 pr-3">
                    {filteredFuncionarios.map(f => (
                      <label
                        key={f.id}
                        className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50 cursor-pointer text-sm"
                      >
                        <Checkbox
                          checked={selectedFuncionarios.has(f.id)}
                          onCheckedChange={() => toggleFuncionario(f.id)}
                        />
                        <span className={!f.ativo ? 'text-muted-foreground' : ''}>{f.nome}</span>
                        {!f.ativo && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-destructive border-destructive/30">
                            Inativo
                          </Badge>
                        )}
                      </label>
                    ))}
                    {filteredFuncionarios.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        Nenhum funcionário encontrado.
                      </p>
                    )}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}

          {/* Modo de Download */}
          <div className="space-y-1.5">
            <Label>Modo de Download</Label>
            <RadioGroup value={modoDownload} onValueChange={(v) => setModoDownload(v as 'zip' | 'individual')} className="flex gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="zip" id="download-zip" />
                <Label htmlFor="download-zip" className="flex items-center gap-1 cursor-pointer text-sm font-normal">
                  <FileArchive className="h-4 w-4" /> Arquivo ZIP
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="individual" id="download-individual" />
                <Label htmlFor="download-individual" className="flex items-center gap-1 cursor-pointer text-sm font-normal">
                  <Files className="h-4 w-4" /> Individual
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Relatórios info */}
          <div className="rounded-md border p-3 bg-muted/50 space-y-1">
            <Label className="text-xs text-muted-foreground">Relatórios gerados automaticamente:</Label>
            <ul className="text-sm space-y-0.5 mt-1">
              <li>📋 Detalhado (Lanç/Finan)</li>
              <li>📦 Compilado Remessa (Lanç/Finan)</li>
              <li>📦 Compilado Sem Remessa (Lanç/Finan)</li>
              <li>💰 Remessa (DP)</li>
              <li>📄 Sem Remessa (DP)</li>
            </ul>
            <p className="text-xs text-muted-foreground mt-2">
              {modoDownload === 'zip'
                ? 'Será gerado um arquivo ZIP com os 5 PDFs.'
                : 'Os 5 PDFs serão baixados individualmente.'}
            </p>
          </div>

          {conferenciaPreviewFiltrada && (
            <div className="rounded-md border p-3 bg-muted/30 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-sm">Pré-conferência</Label>
                <Badge variant="outline">{conferenciaPreviewFiltrada.totalConfirmados} confirmadas</Badge>
              </div>

              <div className="space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Por empresa</p>
                  <div className="space-y-1">
                    {conferenciaPreviewFiltrada.porEmpresa.slice(0, 4).map(item => (
                      <div key={item.chave} className="flex items-center justify-between text-xs">
                        <span className="truncate pr-2">{item.label}</span>
                        <span>{item.totalConfirmados}/{item.totalRegistros}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Por vínculo</p>
                  <div className="space-y-1">
                    {conferenciaPreviewFiltrada.porVinculo.map(item => (
                      <div key={item.chave} className="flex items-center justify-between text-xs">
                        <span>{item.label}</span>
                        <span>{item.totalConfirmados}/{item.totalRegistros}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Por solicitação</p>
                  <div className="space-y-1">
                    {conferenciaPreviewFiltrada.porSolicitacao.slice(0, 6).map(item => (
                      <div key={item.chave} className="flex items-center justify-between text-xs">
                        <span>{item.label}</span>
                        <span>{item.totalConfirmados}/{item.totalRegistros}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleGerar} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Gerar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
