import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, Download, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle, Loader2, UserPlus, UserCheck, ClipboardCheck, RefreshCw } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { processAlterdataImport, reprocessStagingErrors, AlterdataImportResult } from '@/services/alterdataImportService';
import { supabase } from '@/integrations/supabase/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface ImportAlterdataModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const ImportAlterdataModal: React.FC<ImportAlterdataModalProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<AlterdataImportResult | null>(null);

  const handleClose = (val: boolean) => {
    if (!isProcessing) {
      if (!val) setResult(null);
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setIsProcessing(true);
    setResult(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Usuário não autenticado');
        setIsProcessing(false);
        return;
      }

      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws);

      if (rows.length === 0) {
        toast.error('Arquivo vazio');
        setIsProcessing(false);
        return;
      }

      const importResult = await processAlterdataImport(rows, user.id);
      setResult(importResult);

      const total = importResult.agendamentosAtualizados + importResult.funcionariosAtualizados + importResult.funcionariosCriados;
      if (total > 0) {
        toast.success(`Sincronização concluída: ${total} registro(s) processado(s)`);
        onSuccess?.();
      }
    } catch (err: any) {
      toast.error(`Erro ao processar arquivo: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReprocess = async () => {
    setIsProcessing(true);
    try {
      const reprocessResult = await reprocessStagingErrors();
      setResult(reprocessResult);

      const total = reprocessResult.funcionariosAtualizados + reprocessResult.funcionariosCriados;
      if (total > 0) {
        toast.success(`Reprocessamento concluído: ${total} registro(s) processado(s)`);
        onSuccess?.();
      } else if (reprocessResult.erros.length > 0) {
        toast.warning('Ainda existem registros com erro');
      } else {
        toast.info('Nenhum registro para reprocessar');
      }
    } catch (err: any) {
      toast.error(`Erro ao reprocessar: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadErrors = useCallback(() => {
    if (!result || result.erros.length === 0) return;
    const data = result.erros.map(e => ({
      'Nome': e.nome,
      'Motivo': e.motivo,
      'Departamento': e.departamento || '',
      'Empresa': e.empresa || '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Erros');
    XLSX.writeFile(wb, 'erros_importacao_alterdata.xlsx');
  }, [result]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar Alterdata</DialogTitle>
          <DialogDescription>
            Importe a planilha do Alterdata para sincronizar funcionários e atualizar agendamentos.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 text-center space-y-3">
              {isProcessing ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Processando sincronização...</p>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Selecione um arquivo <strong>.xlsx</strong> ou <strong>.csv</strong>
                  </p>
                  <label>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={handleFileUpload}
                      disabled={isProcessing}
                    />
                    <Button variant="outline" asChild>
                      <span><FileSpreadsheet className="h-4 w-4 mr-2" />Selecionar Arquivo</span>
                    </Button>
                  </label>
                </>
              )}
            </div>

            <Button variant="ghost" className="w-full" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Baixar Modelo
            </Button>

            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Regras:</strong></p>
              <p>• Dados são inseridos em tabela de staging para validação</p>
              <p>• Identificação por CPF (prioridade) ou Nome normalizado</p>
              <p>• Atualiza Status Carteira para "Registrado"</p>
              <p>• Resolve Função, Centro de Custo e Empresa automaticamente</p>
              <p>• Registros com erro podem ser reprocessados após correção</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3">
              <SummaryCard icon={FileSpreadsheet} label="Linhas processadas" value={result.linhasProcessadas} />
              <SummaryCard icon={ClipboardCheck} label="Agendamentos atualizados" value={result.agendamentosAtualizados} color="text-blue-600" />
              <SummaryCard icon={UserCheck} label="Funcionários atualizados" value={result.funcionariosAtualizados} color="text-green-600" />
              <SummaryCard icon={UserPlus} label="Funcionários criados" value={result.funcionariosCriados} color="text-emerald-600" />
              <SummaryCard icon={CheckCircle2} label="Funcionários ativados" value={result.funcionariosAtivados} color="text-teal-600" />
              <SummaryCard icon={XCircle} label="Erros" value={result.erros.length} color="text-red-600" />
            </div>

            {/* Errors table */}
            {result.erros.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Detalhes dos erros ({result.erros.length})
                </h4>
                <ScrollArea className="h-52 rounded border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Nome</TableHead>
                        <TableHead className="text-xs">Motivo</TableHead>
                        <TableHead className="text-xs">Departamento</TableHead>
                        <TableHead className="text-xs">Empresa</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.erros.map((err, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs font-medium">{err.nome || '—'}</TableCell>
                          <TableCell className="text-xs text-destructive">{err.motivo}</TableCell>
                          <TableCell className="text-xs">{err.departamento || '—'}</TableCell>
                          <TableCell className="text-xs">{err.empresa || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleDownloadErrors}>
                    <Download className="h-4 w-4 mr-2" />
                    Exportar Erros
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleReprocess}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Reprocessar Erros
                  </Button>
                </div>
              </div>
            )}

            <Button className="w-full" onClick={() => handleClose(false)}>
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

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
