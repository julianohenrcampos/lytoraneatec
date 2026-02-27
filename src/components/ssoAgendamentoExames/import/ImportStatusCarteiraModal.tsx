import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, Download, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

interface Agendamento {
  id: string;
  cpf: string | null;
  nome_colaborador: string;
  status_carteira: string | null;
  data_agendamento: string;
  [key: string]: any;
}

interface ImportStatusCarteiraModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agendamentos: Agendamento[];
  updateStatusCarteira: (params: { id: string; status: string }) => Promise<any>;
}

interface ImportResult {
  total: number;
  atualizados: number;
  jaCorretos: number;
  naoEncontrados: number;
  ignorados: number;
  erros: ErrorRecord[];
}

interface ErrorRecord {
  nome: string;
  cpf: string;
  motivo: string;
}

const STATUS_HIERARCHY: Record<string, number> = {
  'Pendente': 0,
  'Registrado': 1,
  'Revisado': 2,
};

const VALID_STATUSES = Object.keys(STATUS_HIERARCHY);

function normalizeCpf(cpf: string | null | undefined): string {
  if (!cpf) return '';
  const cleaned = String(cpf).replace(/[\.\-\/\s]/g, '').trim();
  if (cleaned.length === 0) return '';
  return cleaned.padStart(11, '0');
}

function normalizeText(text: string | null | undefined): string {
  if (!text) return '';
  return text.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

export const ImportStatusCarteiraModal: React.FC<ImportStatusCarteiraModalProps> = ({
  open,
  onOpenChange,
  agendamentos,
  updateStatusCarteira,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleClose = (val: boolean) => {
    if (!isProcessing) {
      if (!val) setResult(null);
      onOpenChange(val);
    }
  };

  const handleDownloadTemplate = useCallback(() => {
    const data = agendamentos.map(a => ({
      'CPF': a.cpf || '',
      'Nome Colaborador': a.nome_colaborador,
      'Status Carteira': a.status_carteira || 'Pendente',
    }));
    if (data.length === 0) {
      data.push({ 'CPF': '', 'Nome Colaborador': '', 'Status Carteira': 'Pendente' });
    }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Status Carteira');
    XLSX.writeFile(wb, 'modelo_status_carteira.xlsx');
    toast.success('Modelo baixado!');
  }, [agendamentos]);

  const findAgendamento = useCallback((cpf: string, nome: string): Agendamento | null => {
    const normalCpf = normalizeCpf(cpf);
    const normalNome = normalizeText(nome);

    let matches: Agendamento[] = [];

    if (normalCpf.length >= 9) {
      matches = agendamentos.filter(a => normalizeCpf(a.cpf) === normalCpf);
    }

    if (matches.length === 0 && normalNome) {
      matches = agendamentos.filter(a => {
        const nomeA = normalizeText(a.nome_colaborador);
        return nomeA === normalNome || nomeA.includes(normalNome) || normalNome.includes(nomeA);
      });
    }

    if (matches.length === 0) return null;
    if (matches.length === 1) return matches[0];

    // Multiple: pick most recent
    return matches.sort((a, b) => b.data_agendamento.localeCompare(a.data_agendamento))[0];
  }, [agendamentos]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setIsProcessing(true);
    setResult(null);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws);

      if (rows.length === 0) {
        toast.error('Arquivo vazio');
        setIsProcessing(false);
        return;
      }

      const result: ImportResult = {
        total: rows.length,
        atualizados: 0,
        jaCorretos: 0,
        naoEncontrados: 0,
        ignorados: 0,
        erros: [],
      };

      for (const row of rows) {
        const cpf = String(row['CPF'] || row['cpf'] || row['C.P.F.'] || row['Cpf'] || row['C.P.F'] || '');
        const nome = String(
          row['Nome Colaborador'] || row['nome_colaborador'] || row['Nome'] || row['nome'] ||
          row['Funcionário'] || row['Funcionario'] || row['funcionario'] ||
          row['Nome Funcionário'] || row['Nome Funcionario'] ||
          row['Colaborador'] || row['colaborador'] || ''
        );
        const statusExcel = String(row['Status Carteira'] || row['status_carteira'] || row['Status'] || row['status'] || '').trim();

        // Validate status
        if (!VALID_STATUSES.includes(statusExcel)) {
          result.ignorados++;
          result.erros.push({
            nome: nome || '(vazio)',
            cpf: cpf || '(vazio)',
            motivo: statusExcel ? `Status inválido: "${statusExcel}"` : 'Status Carteira vazio',
          });
          continue;
        }

        // Find matching agendamento
        const agendamento = findAgendamento(cpf, nome);
        if (!agendamento) {
          result.naoEncontrados++;
          result.erros.push({
            nome: nome || '(vazio)',
            cpf: cpf || '(vazio)',
            motivo: 'Funcionário não encontrado',
          });
          continue;
        }

        const currentStatus = agendamento.status_carteira || 'Pendente';
        const currentLevel = STATUS_HIERARCHY[currentStatus] ?? 0;
        const newLevel = STATUS_HIERARCHY[statusExcel];

        if (newLevel === currentLevel) {
          result.jaCorretos++;
          continue;
        }

        if (newLevel < currentLevel) {
          result.ignorados++;
          result.erros.push({
            nome: agendamento.nome_colaborador,
            cpf: agendamento.cpf || '',
            motivo: `Downgrade não permitido: ${currentStatus} → ${statusExcel}`,
          });
          continue;
        }

        // Upgrade allowed
        try {
          await updateStatusCarteira({ id: agendamento.id, status: statusExcel });
          result.atualizados++;
        } catch (err: any) {
          result.erros.push({
            nome: agendamento.nome_colaborador,
            cpf: agendamento.cpf || '',
            motivo: `Erro ao atualizar: ${err.message}`,
          });
          result.ignorados++;
        }
      }

      setResult(result);
      if (result.atualizados > 0) {
        toast.success(`${result.atualizados} registro(s) atualizado(s)!`);
      }
    } catch (err: any) {
      toast.error(`Erro ao processar arquivo: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadErrors = useCallback(() => {
    if (!result || result.erros.length === 0) return;
    const data = result.erros.map(e => ({
      'Nome': e.nome,
      'CPF': e.cpf,
      'Motivo': e.motivo,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Erros');
    XLSX.writeFile(wb, 'relatorio_erros_importacao.xlsx');
  }, [result]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar Status Carteira</DialogTitle>
          <DialogDescription>
            Importe um arquivo Excel para atualizar o Status Carteira dos agendamentos.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 text-center space-y-3">
              {isProcessing ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Processando arquivo...</p>
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
              Baixar Modelo Preenchido
            </Button>

            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Regras:</strong></p>
              <p>• Identificação por CPF (prioridade) ou Nome</p>
              <p>• Apenas evolução: Pendente → Registrado → Revisado</p>
              <p>• Downgrade não é permitido</p>
              <p>• Nenhum novo registro será criado</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-3">
              <SummaryCard icon={FileSpreadsheet} label="Total processadas" value={result.total} />
              <SummaryCard icon={CheckCircle2} label="Atualizados" value={result.atualizados} color="text-green-600" />
              <SummaryCard icon={CheckCircle2} label="Já corretos" value={result.jaCorretos} color="text-blue-600" />
              <SummaryCard icon={XCircle} label="Não encontrados" value={result.naoEncontrados} color="text-red-600" />
              <SummaryCard icon={AlertTriangle} label="Ignorados" value={result.ignorados} color="text-yellow-600" />
            </div>

            {/* Errors list */}
            {result.erros.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Detalhes dos erros ({result.erros.length})</h4>
                <ScrollArea className="h-40 rounded border">
                  <div className="p-2 space-y-1">
                    {result.erros.map((err, i) => (
                      <div key={i} className="text-xs p-2 rounded bg-muted">
                        <span className="font-medium">{err.nome}</span>
                        {err.cpf && err.cpf !== '(vazio)' && (
                          <span className="text-muted-foreground"> — CPF: {err.cpf}</span>
                        )}
                        <br />
                        <span className="text-destructive">{err.motivo}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <Button variant="outline" size="sm" onClick={handleDownloadErrors}>
                  <Download className="h-4 w-4 mr-2" />
                  Baixar Relatório de Erros
                </Button>
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
