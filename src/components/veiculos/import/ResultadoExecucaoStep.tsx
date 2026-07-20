import React from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, Download, RotateCcw } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ExecutarImportacaoResult } from '@/services/veiculo/import/executarImportacao';

interface Props {
  resultado: ExecutarImportacaoResult;
  onReprocessarErros: () => void;
  onFechar: () => void;
  temErros: boolean;
  ocupado: boolean;
}

function baixar(obj: unknown, nome: string) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

const statusVariant = (s: string) =>
  s === 'SUCESSO' ? 'default' : s === 'JA_PROCESSADO' ? 'secondary' : 'destructive';

const ResultadoExecucaoStep: React.FC<Props> = ({ resultado, onReprocessarErros, onFechar, temErros, ocupado }) => {
  const { resumo, resultados, execution_id } = resultado;
  return (
    <div className="space-y-3">
      <Alert>
        {resumo.erros === 0 ? (
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        ) : (
          <AlertCircle className="h-4 w-4" />
        )}
        <AlertTitle>Execução concluída</AlertTitle>
        <AlertDescription className="text-xs">
          execution_id: <code className="text-[10px]">{execution_id}</code>
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-4 gap-2 text-xs">
        <Stat label="Selecionadas" value={resumo.selecionados} />
        <Stat label="Inseridas" value={resumo.inseridos} />
        <Stat label="Já processadas" value={resumo.ja_processados} />
        <Stat label="Erros" value={resumo.erros} />
      </div>

      <div className="border rounded max-h-[420px] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Linha</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>ID criado</TableHead>
              <TableHead>Mensagem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {resultados.map((r) => (
              <TableRow key={`${r.linha_excel}-${r.codigo_canonico}`}>
                <TableCell>{r.linha_excel}</TableCell>
                <TableCell className="font-mono text-xs">{r.codigo_exibicao ?? r.codigo_canonico}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                </TableCell>
                <TableCell className="font-mono text-[10px]">{r.equipamento_id ?? '—'}</TableCell>
                <TableCell className="text-xs">{r.mensagem ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => baixar(resultado, `importacao_execucao_${execution_id}.json`)}
        >
          <Download className="h-4 w-4 mr-1" /> Relatório JSON
        </Button>
        {temErros && (
          <Button variant="secondary" onClick={onReprocessarErros} disabled={ocupado}>
            <RotateCcw className="h-4 w-4 mr-1" /> Reprocessar erros
          </Button>
        )}
        <Button onClick={onFechar}>Fechar</Button>
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="border rounded p-2">
    <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
    <div className="font-semibold text-sm">{value.toLocaleString('pt-BR')}</div>
  </div>
);

export default ResultadoExecucaoStep;
