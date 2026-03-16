import React, { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Upload, Download, FileSpreadsheet, CheckCircle2, XCircle,
  AlertTriangle, Loader2, UserPlus, UserCheck, ClipboardCheck,
  RefreshCw, ChevronDown, Rocket, Search, UserX, AlertCircle,
  Play, Trash2,
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import {
  importToStaging,
  analyzeStaging,
  confirmStagingImport,
  reprocessStagingErrors,
  checkPendingImport,
  discardPendingImport,
  loadStagingCounts,
  StagingAnalysisResult,
  AlterdataImportResult,
  AlterdataImportError,
  AuditRow,
  PendingImportInfo,
  StagingCounts,
} from '@/services/alterdataImportService';
import { supabase } from '@/integrations/supabase/client';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface ImportAlterdataModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type ModalStage = 'loading' | 'pending' | 'idle' | 'imported' | 'analyzed' | 'processed';

export const ImportAlterdataModal: React.FC<ImportAlterdataModalProps> = ({
  open, onOpenChange, onSuccess,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [stage, setStage] = useState<ModalStage>('loading');
  const [loteId, setLoteId] = useState<string | null>(null);
  const [totalImportados, setTotalImportados] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<StagingAnalysisResult | null>(null);
  const [processResult, setProcessResult] = useState<AlterdataImportResult | null>(null);
  const [pendingInfo, setPendingInfo] = useState<PendingImportInfo | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Check for pending import when modal opens
  useEffect(() => {
    if (!open) return;
    
    const check = async () => {
      setStage('loading');
      try {
        const pending = await checkPendingImport();
        if (pending && pending.total > 0) {
          setPendingInfo(pending);
          setLoteId(pending.loteId);
          setStage('pending');
        } else {
          setPendingInfo(null);
          setStage('idle');
        }
      } catch {
        setStage('idle');
      }
    };
    check();
  }, [open]);

  const handleClose = (val: boolean) => {
    if (!isProcessing) {
      if (!val) {
        // Only reset local UI state, don't touch staging
        setStage('loading');
        setTotalImportados(0);
        setAnalysisResult(null);
        setProcessResult(null);
        setPendingInfo(null);
      }
      onOpenChange(val);
    }
  };

  const handleDownloadTemplate = useCallback(() => {
    const data = [
      { Funcionario: '', CPF: '', Matricula: '', 'Função': '', Departamento: '', Empresa: '', 'Admissão': '' },
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Modelo');
    XLSX.writeFile(wb, 'modelo_importacao_alterdata.xlsx');
    toast.success('Modelo baixado!');
  }, []);

  // ── CONTINUAR FLUXO EXISTENTE ──
  const handleContinueExisting = async () => {
    if (!pendingInfo || !loteId) return;
    setIsProcessing(true);
    try {
      const counts = await loadStagingCounts(loteId);
      setTotalImportados(counts.total);

      if (counts.validados > 0 || (counts.erros > 0 && counts.pendentes === 0)) {
        // Already analyzed
        setAnalysisResult({
          linhasProcessadas: counts.total,
          validados: counts.validados,
          erros: counts.errorDetails,
          validadosNomes: [], // Names not stored, but counts are correct
        });
        setStage('analyzed');
      } else {
        // Needs analysis
        setStage('imported');
      }
    } catch (err: any) {
      toast.error(`Erro ao carregar dados: ${err.message}`);
      setStage('idle');
    } finally {
      setIsProcessing(false);
    }
  };

  // ── DESCARTAR IMPORTAÇÃO PENDENTE ──
  const handleDiscardPending = async () => {
    if (!loteId) return;
    setIsProcessing(true);
    try {
      await discardPendingImport(loteId);
      setPendingInfo(null);
      setLoteId(null);
      setTotalImportados(0);
      setStage('idle');
      toast.success('Importação pendente descartada');
    } catch (err: any) {
      toast.error(`Erro ao descartar: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setShowDiscardConfirm(false);
    }
  };

  // ── ETAPA 1: IMPORTAR ──
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setIsProcessing(true);
    setAnalysisResult(null);
    setProcessResult(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('Usuário não autenticado'); setIsProcessing(false); return; }

      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws);

      if (rows.length === 0) { toast.error('Arquivo vazio'); setIsProcessing(false); return; }

      const result = await importToStaging(rows, user.id);
      setLoteId(result.loteId);
      setTotalImportados(result.totalImportados);
      setStage('imported');
      toast.success(`${result.totalImportados} registro(s) importado(s) para análise`);
    } catch (err: any) {
      toast.error(`Erro ao importar: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // ── ETAPA 2: ANALISAR ──
  const handleAnalyze = async () => {
    if (!loteId) return;
    setIsProcessing(true);
    try {
      const result = await analyzeStaging(loteId);
      setAnalysisResult(result);
      setStage('analyzed');
      if (result.validados > 0) toast.success(`${result.validados} registro(s) validado(s)`);
      if (result.erros.length > 0) toast.warning(`${result.erros.length} registro(s) com erro`);
    } catch (err: any) {
      toast.error(`Erro na análise: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // ── ETAPA 3: PROCESSAR ──
  const handleConfirmImport = async () => {
    if (!loteId) return;
    setIsProcessing(true);
    try {
      const result = await confirmStagingImport(loteId);
      setProcessResult(result);
      setStage('processed');
      const total = result.funcionariosAtualizados + result.funcionariosCriados;
      if (total > 0) {
        toast.success(`${total} funcionário(s) processado(s)`);
        onSuccess?.();
      }
      if (result.erros.length > 0) toast.warning(`${result.erros.length} erro(s) restante(s)`);
    } catch (err: any) {
      toast.error(`Erro ao processar: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // ── REPROCESSAR ERROS ──
  const handleReprocess = async () => {
    if (!loteId) return;
    setIsProcessing(true);
    try {
      const reResult = await reprocessStagingErrors(loteId);
      setAnalysisResult(prev => prev ? {
        ...prev,
        validados: prev.validados + reResult.validados,
        erros: reResult.erros,
        validadosNomes: [...prev.validadosNomes, ...reResult.validadosNomes],
      } : reResult);
      if (reResult.validados > 0) toast.success(`${reResult.validados} registro(s) revalidado(s)`);
      else if (reResult.erros.length > 0) toast.warning('Ainda existem registros com erro');
      else toast.info('Nenhum registro para reprocessar');
    } catch (err: any) {
      toast.error(`Erro ao reprocessar: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadErrors = useCallback((errors: AlterdataImportError[]) => {
    if (!errors || errors.length === 0) return;
    const data = errors.map(e => ({
      'Nome': e.nome, 'CPF': e.cpf || '', 'Motivo': e.motivo,
      'Departamento': e.departamento || '', 'Empresa': e.empresa || '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Erros');
    XLSX.writeFile(wb, 'erros_importacao_alterdata.xlsx');
    toast.success('Erros exportados!');
  }, []);

  const handleDownloadAudit = useCallback((details: AuditRow[]) => {
    if (!details || details.length === 0) return;
    const data = details.map(d => ({
      'Nome': d.nome, 'CPF': d.cpf, 'Matrícula': d.matricula,
      'Função': d.funcao, 'Empresa': d.empresa, 'Centro de Custo': d.centro_custo,
      'Data Admissão': d.data_admissao, 'Motivo': d.motivo,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sem Agendamento');
    XLSX.writeFile(wb, 'funcionarios_sem_agendamento.xlsx');
    toast.success('Relatório exportado!');
  }, []);

  const getStageDescription = () => {
    switch (stage) {
      case 'loading': return 'Verificando importações pendentes...';
      case 'pending': return 'Existe uma importação pendente de conclusão.';
      case 'idle': return 'Importe a planilha do Alterdata para sincronizar funcionários.';
      case 'imported': return 'Dados importados. Clique em "Analisar Dados" para validar.';
      case 'analyzed': return 'Revise os resultados da análise antes de atualizar o sistema.';
      case 'processed': return 'Processamento concluído. Veja os resultados abaixo.';
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Importar Alterdata</DialogTitle>
            <DialogDescription>{getStageDescription()}</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-1 space-y-4">
            {stage === 'loading' && (
              <div className="flex flex-col items-center gap-2 py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Verificando importações pendentes...</p>
              </div>
            )}

            {stage === 'pending' && pendingInfo && (
              <PendingStage
                info={pendingInfo}
                isProcessing={isProcessing}
                onContinue={handleContinueExisting}
                onDiscard={() => setShowDiscardConfirm(true)}
              />
            )}

            {stage === 'idle' && (
              <IdleStage
                isProcessing={isProcessing}
                onFileUpload={handleFileUpload}
                onDownloadTemplate={handleDownloadTemplate}
              />
            )}

            {stage === 'imported' && (
              <ImportedStage
                totalImportados={totalImportados}
                isProcessing={isProcessing}
                onAnalyze={handleAnalyze}
                onClose={() => handleClose(false)}
              />
            )}

            {stage === 'analyzed' && analysisResult && (
              <AnalyzedStage
                result={analysisResult}
                totalImportados={totalImportados}
                isProcessing={isProcessing}
                onConfirm={handleConfirmImport}
                onReprocess={handleReprocess}
                onDownloadErrors={handleDownloadErrors}
                onClose={() => handleClose(false)}
              />
            )}

            {stage === 'processed' && processResult && (
              <ProcessedStage
                result={processResult}
                onDownloadErrors={handleDownloadErrors}
                onDownloadAudit={handleDownloadAudit}
                onClose={() => handleClose(false)}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        isOpen={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        onConfirm={handleDiscardPending}
        title="Descartar importação pendente?"
        description="Todos os registros pendentes serão removidos permanentemente. Essa ação não pode ser desfeita."
        confirmText="Sim, descartar"
        cancelText="Cancelar"
        variant="danger"
        isLoading={isProcessing}
      />
    </>
  );
};

// ── Pending Stage ──

function PendingStage({ info, isProcessing, onContinue, onDiscard }: {
  info: PendingImportInfo;
  isProcessing: boolean;
  onContinue: () => void;
  onDiscard: () => void;
}) {
  const getCurrentStep = () => {
    if (info.pendentes > 0 && info.validados === 0 && info.erros === 0) {
      return { label: 'Análise pendente', description: 'Os dados foram importados mas ainda não foram analisados.' };
    }
    if (info.validados > 0) {
      return { label: 'Processamento pendente', description: 'Os dados foram analisados e estão prontos para atualizar o sistema.' };
    }
    if (info.erros > 0) {
      return { label: 'Erros aguardando correção', description: 'Existem registros com erro que precisam ser corrigidos ou reprocessados.' };
    }
    return { label: 'Importação pendente', description: 'Existe uma importação em andamento.' };
  };

  const step = getCurrentStep();

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4 space-y-2">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Importação pendente encontrada
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
              Existe uma importação Alterdata pendente de conclusão. É necessário continuar ou descartar essa importação antes de iniciar uma nova.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Etapa atual</p>
        <p className="text-sm font-semibold">{step.label}</p>
        <p className="text-xs text-muted-foreground">{step.description}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <SummaryCard icon={FileSpreadsheet} label="Pendentes" value={info.pendentes} />
        <SummaryCard icon={CheckCircle2} label="Validados" value={info.validados} color="text-green-600" />
        <SummaryCard icon={XCircle} label="Erros" value={info.erros} color={info.erros > 0 ? 'text-red-600' : undefined} />
      </div>

      <div className="flex flex-col gap-2">
        <Button onClick={onContinue} disabled={isProcessing} className="w-full">
          {isProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
          Continuar fluxo existente
        </Button>
        <Button variant="outline" onClick={onDiscard} disabled={isProcessing} className="w-full text-destructive hover:text-destructive">
          <Trash2 className="h-4 w-4 mr-2" />
          Descartar importação pendente e iniciar nova
        </Button>
      </div>
    </div>
  );
}

// ── Idle Stage ──

function IdleStage({ isProcessing, onFileUpload, onDownloadTemplate }: {
  isProcessing: boolean;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDownloadTemplate: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 text-center space-y-3">
        {isProcessing ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Importando dados...</p>
          </div>
        ) : (
          <>
            <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Selecione um arquivo <strong>.xlsx</strong> ou <strong>.csv</strong>
            </p>
            <label>
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFileUpload} disabled={isProcessing} />
              <Button variant="outline" asChild>
                <span><FileSpreadsheet className="h-4 w-4 mr-2" />Selecionar Arquivo</span>
              </Button>
            </label>
          </>
        )}
      </div>
      <Button variant="ghost" className="w-full" onClick={onDownloadTemplate}>
        <Download className="h-4 w-4 mr-2" />Baixar Modelo
      </Button>
      <div className="text-xs text-muted-foreground space-y-1">
        <p><strong>Fluxo:</strong></p>
        <p>1. Envie o arquivo → dados são importados para análise</p>
        <p>2. Clique em "Analisar Dados" → validação de empresa, função e centro de custo</p>
        <p>3. Clique em "Atualizar Sistema Lytotec" → funcionários são atualizados/criados</p>
      </div>
    </div>
  );
}

// ── Imported Stage ──

function ImportedStage({ totalImportados, isProcessing, onAnalyze, onClose }: {
  totalImportados: number;
  isProcessing: boolean;
  onAnalyze: () => void;
  onClose: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3">
        <SummaryCard icon={FileSpreadsheet} label="Registros importados" value={totalImportados} />
      </div>
      <p className="text-sm text-muted-foreground text-center">
        Dados importados com sucesso. Clique abaixo para validar empresa, função e centro de custo.
      </p>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onClose} className="flex-1">Fechar</Button>
        <Button onClick={onAnalyze} disabled={isProcessing} className="flex-1">
          {isProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
          Analisar Dados
        </Button>
      </div>
    </div>
  );
}

// ── Analyzed Stage ──

function AnalyzedStage({ result, totalImportados, isProcessing, onConfirm, onReprocess, onDownloadErrors, onClose }: {
  result: StagingAnalysisResult;
  totalImportados: number;
  isProcessing: boolean;
  onConfirm: () => void;
  onReprocess: () => void;
  onDownloadErrors: (errors: AlterdataImportError[]) => void;
  onClose: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard icon={FileSpreadsheet} label="Importados" value={totalImportados} />
        <SummaryCard icon={CheckCircle2} label="Validados" value={result.validados} color="text-green-600" />
        <SummaryCard icon={XCircle} label="Erros" value={result.erros.length} color="text-red-600" />
      </div>

      <NameListSection title="Registros validados" names={result.validadosNomes}
        icon={CheckCircle2} colorClass="text-green-600" bgClass="bg-green-50 dark:bg-green-950/30" />

      {result.erros.length > 0 && (
        <ErrorsSection errors={result.erros} onDownloadErrors={onDownloadErrors}
          onReprocess={onReprocess} isProcessing={isProcessing} />
      )}

      <div className="flex gap-2">
        <Button variant="outline" onClick={onClose} className="flex-1">Fechar</Button>
        {result.validados > 0 && (
          <Button onClick={onConfirm} disabled={isProcessing} className="flex-1">
            {isProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Rocket className="h-4 w-4 mr-2" />}
            Atualizar Sistema Lytotec
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Processed Stage ──

function ProcessedStage({ result, onDownloadErrors, onDownloadAudit, onClose }: {
  result: AlterdataImportResult;
  onDownloadErrors: (errors: AlterdataImportError[]) => void;
  onDownloadAudit: (details: AuditRow[]) => void;
  onClose: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard icon={UserPlus} label="Funcionários criados" value={result.funcionariosCriados} color="text-emerald-600" />
        <SummaryCard icon={UserCheck} label="Funcionários atualizados" value={result.funcionariosAtualizados} color="text-green-600" />
        <SummaryCard icon={ClipboardCheck} label="Com agendamento" value={result.funcionariosComAgendamento} color="text-blue-600" />
        <SummaryCard icon={UserX} label="Sem agendamento" value={result.funcionariosSemAgendamento}
          color={result.funcionariosSemAgendamento > 0 ? 'text-amber-600' : 'text-muted-foreground'} />
        {result.erros.length > 0 && (
          <SummaryCard icon={XCircle} label="Erros" value={result.erros.length} color="text-red-600" />
        )}
      </div>

      <NameListSection title="Funcionários adicionados" names={result.funcionariosAdicionadosNomes}
        icon={UserPlus} colorClass="text-emerald-600" bgClass="bg-emerald-50 dark:bg-emerald-950/30" />
      <NameListSection title="Funcionários atualizados" names={result.funcionariosAtualizadosNomes}
        icon={UserCheck} colorClass="text-green-600" bgClass="bg-green-50 dark:bg-green-950/30" />
      <NameListSection title="Com agendamento de exames" names={result.comAgendamentoNomes}
        icon={ClipboardCheck} colorClass="text-blue-600" bgClass="bg-blue-50 dark:bg-blue-950/30" />
      <NameListSection title="Sem agendamento de exames" names={result.semAgendamentoNomes}
        icon={UserX} colorClass="text-amber-600" bgClass="bg-amber-50 dark:bg-amber-950/30" />

      {result.erros.length > 0 && (
        <ErrorsSection errors={result.erros} onDownloadErrors={onDownloadErrors} isProcessing={false} />
      )}

      <div className="flex flex-col gap-2">
        {result.semAgendamentoDetalhes.length > 0 && (
          <Button variant="outline" className="w-full" onClick={() => onDownloadAudit(result.semAgendamentoDetalhes)}>
            <Download className="h-4 w-4 mr-2" />Exportar Funcionários Sem Agendamento
          </Button>
        )}
        <Button className="w-full" onClick={onClose}>Fechar</Button>
      </div>
    </div>
  );
}

// ── Shared Components ──

function SummaryCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border p-3">
      <Icon className={`h-5 w-5 ${color || 'text-muted-foreground'}`} />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold">{value}</p>
      </div>
    </div>
  );
}

function NameListSection({ title, names, icon: Icon, colorClass, bgClass }: {
  title: string; names: string[]; icon: any; colorClass: string; bgClass: string;
}) {
  if (names.length === 0) return null;
  return (
    <Collapsible defaultOpen={names.length <= 20}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-1.5 px-2 rounded hover:bg-muted/50">
        <ChevronDown className="h-4 w-4 transition-transform" />
        <Icon className={`h-4 w-4 ${colorClass}`} />
        <span className="text-sm font-medium">{title} ({names.length})</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className={`mt-1 rounded-md ${bgClass} p-2 space-y-0.5`}>
          {names.map((name, i) => <p key={i} className="text-xs">{name}</p>)}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ErrorsSection({ errors, onDownloadErrors, onReprocess, isProcessing }: {
  errors: AlterdataImportError[];
  onDownloadErrors: (errors: AlterdataImportError[]) => void;
  onReprocess?: () => void;
  isProcessing: boolean;
}) {
  return (
    <Collapsible defaultOpen>
      <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-1.5 px-2 rounded hover:bg-muted/50">
        <ChevronDown className="h-4 w-4 text-destructive transition-transform" />
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <span className="text-sm font-medium">Erros ({errors.length})</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 rounded border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Nome</TableHead>
                <TableHead className="text-xs">CPF</TableHead>
                <TableHead className="text-xs">Motivo</TableHead>
                <TableHead className="text-xs">Departamento</TableHead>
                <TableHead className="text-xs">Empresa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {errors.map((err, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs font-medium">{err.nome || '—'}</TableCell>
                  <TableCell className="text-xs">{err.cpf || '—'}</TableCell>
                  <TableCell className="text-xs text-destructive">{err.motivo}</TableCell>
                  <TableCell className="text-xs">{err.departamento || '—'}</TableCell>
                  <TableCell className="text-xs">{err.empresa || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex gap-2 mt-2">
          <Button variant="outline" size="sm" onClick={() => onDownloadErrors(errors)}>
            <Download className="h-4 w-4 mr-2" />Exportar Erros
          </Button>
          {onReprocess && (
            <Button variant="secondary" size="sm" onClick={onReprocess} disabled={isProcessing}>
              {isProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Reprocessar Erros
            </Button>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
