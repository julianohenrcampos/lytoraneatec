import { useState, useMemo } from 'react';
import { format, startOfWeek, endOfWeek, subWeeks, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { Loader2, Calendar, Download, FileArchive, Files } from 'lucide-react';
import JSZip from 'jszip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerWithRange } from '@/components/ui/date-picker-range';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { generateRelatorioDiariasPDFPorPeriodoBlob, generateCompiladoDiariasPDFBlob, fetchEmpresaLogosMap, loadImageAsBase64 } from '@/services/pdfService';
import { generateRelatorioRemessaBlob } from '@/services/pdf/relatorioRemessaPdf';
import { buildCompiladoData } from '@/components/diarias/pdf/CompiladoDiariasPDF';
import type { RelatorioFolhaItem } from '@/types/diarias';
import type { DateRange } from 'react-day-picker';

interface RelatorioSemanalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gerentesRegionais: { id: string; nome_completo: string }[];
  centrosCusto: { id: string; codigo_centro_custo: string; nome_centro_custo: string; aprovador_diarias_id: string | null }[];
  feriados: string[];
  // Filtros herdados da página (opcionais)
  defaultCentroCustoIds?: string[];
  defaultEmpresaId?: string;
  defaultTipoVinculo?: string;
  defaultGerenteId?: string;
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
}: RelatorioSemanalModalProps) {
  const [gerenteSelecionado, setGerenteSelecionado] = useState<string>('todos');
  const [modoDownload, setModoDownload] = useState<'zip' | 'individual'>('zip');
  const [isLoading, setIsLoading] = useState(false);

  const defaultRange = useMemo(() => calcularUltimaSemana(), [open]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(defaultRange);

  useMemo(() => {
    if (open) {
      setDateRange(calcularUltimaSemana());
      // Pre-selecionar gerente da página se disponível
      if (defaultGerenteId && gerentesRegionais.some(g => g.id === defaultGerenteId)) {
        setGerenteSelecionado(defaultGerenteId);
      } else {
        setGerenteSelecionado('todos');
      }
    }
  }, [open, defaultGerenteId, gerentesRegionais]);

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

    setIsLoading(true);
    try {
      const dataInicio = format(dateRange.from, 'yyyy-MM-dd');
      const dataFim = format(dateRange.to, 'yyyy-MM-dd');

      // Determinar CCs: prioridade defaultCentroCustoIds > gerente selecionado
      let ccIds: string[] = [];
      if (defaultCentroCustoIds && defaultCentroCustoIds.length > 0) {
        // Filtro de CC da página tem prioridade
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

      let baseQuery = supabase
        .from('vw_relatorio_diarias_folha')
        .select('*')
        .gte('data', dataInicio)
        .lte('data', dataFim);

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

      // Aplicar filtros de empresa e tipo vínculo da página (se definidos)
      if (defaultEmpresaId) {
        allData = allData.filter(r => r.empresa_id === defaultEmpresaId);
      }
      if (defaultTipoVinculo === 'diarista') {
        allData = allData.filter(r => !r.matricula_funcionario || r.matricula_funcionario.trim() === '' || r.matricula_funcionario === '---');
      } else if (defaultTipoVinculo === 'remessa') {
        allData = allData.filter(r => r.matricula_funcionario && r.matricula_funcionario.trim() !== '' && r.matricula_funcionario !== '---');
      }

      if (allData.length === 0) {
        toast.error('Nenhum dado encontrado para o período e filtros selecionados.');
        return;
      }

      const filtros = { data_inicio: dataInicio, data_fim: dataFim };

      // Fetch CC info
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

      // Compilado data for both types
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

      // Fetch empresa logos for compilado
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
        // Individual downloads with small delay between each
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Gerar Relatórios Semanais
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Período */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Período (padrão: última semana completa)</Label>
            <DatePickerWithRange value={dateRange} onChange={setDateRange} />
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
