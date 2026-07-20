import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, PlayCircle, RotateCcw, RefreshCw, Filter } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import type { LinhaConsolidada, StatusConsolidadoImportacao } from '@/services/veiculo/import/statusConsolidado';
import { contagensConsolidadas } from '@/services/veiculo/import/statusConsolidado';
import type { ProgressoImportacao } from '@/services/veiculo/import/executarImportacao';

interface Props {
  linhasConsolidadas: LinhaConsolidada[];
  progresso: ProgressoImportacao | null;
  ocupado: boolean;
  temPermissaoCriar: boolean;
  batchSize: number;
  onChangeBatchSize: (n: number) => void;
  onImportarTodosElegiveis: () => void;
  onImportarSelecionados: (linhas: number[]) => void;
  onReprocessarErros: () => void;
  onEncerrar: () => void;
  onRecarregarStatusServidor: () => void;
  onDownloadRelatorioXlsx: () => void;
  onDownloadRelatorioJson: () => void;
  onDownloadSomenteErros: () => void;
  onDownloadNaoCadastrados: () => void;
  onDownloadHistoricoJson: () => void;
}

const BATCH_SIZES = [25, 50, 100];

const STATUS_LABELS: Record<StatusConsolidadoImportacao, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  ELEGIVEL_NAO_ENVIADO: { label: 'Elegível', variant: 'outline' },
  PROCESSANDO: { label: 'Processando', variant: 'secondary' },
  SUCESSO: { label: 'Sucesso', variant: 'default' },
  JA_PROCESSADO: { label: 'Já processado', variant: 'secondary' },
  ERRO: { label: 'Erro', variant: 'destructive' },
  PENDENTE_CATALOGO: { label: 'Pendente catálogo', variant: 'outline' },
  BLOQUEADA: { label: 'Bloqueada', variant: 'destructive' },
  EXISTENTE_REVISAR: { label: 'Existente (revisar)', variant: 'secondary' },
  EXISTENTE_IGNORAR: { label: 'Existente (ignorar)', variant: 'outline' },
  NAO_APLICAVEL: { label: 'N/A', variant: 'outline' },
};

const StatusConsolidadoStep: React.FC<Props> = ({
  linhasConsolidadas, progresso, ocupado, temPermissaoCriar,
  batchSize, onChangeBatchSize,
  onImportarTodosElegiveis, onImportarSelecionados, onReprocessarErros, onEncerrar, onRecarregarStatusServidor,
  onDownloadRelatorioXlsx, onDownloadRelatorioJson, onDownloadSomenteErros, onDownloadNaoCadastrados, onDownloadHistoricoJson,
}) => {
  const [filtroStatus, setFiltroStatus] = useState<StatusConsolidadoImportacao | 'TODOS'>('TODOS');
  const [busca, setBusca] = useState('');
  const [selecionadas, setSelecionadas] = useState<Set<number>>(new Set());

  const contagens = useMemo(() => contagensConsolidadas(linhasConsolidadas), [linhasConsolidadas]);
  const totalGeral = linhasConsolidadas.length;
  const restantesElegiveis = contagens.ELEGIVEL_NAO_ENVIADO;
  const processados = contagens.SUCESSO + contagens.JA_PROCESSADO + contagens.ERRO;

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return linhasConsolidadas.filter((l) => {
      if (filtroStatus !== 'TODOS' && l.status_consolidado !== filtroStatus) return false;
      if (!q) return true;
      return (
        String(l.linha_excel).includes(q) ||
        l.codigo_ativo_exibicao.toLowerCase().includes(q) ||
        l.codigo_ativo_canonico.toLowerCase().includes(q) ||
        (l.centro_custo_origem ?? '').toLowerCase().includes(q) ||
        (l.mensagem ?? '').toLowerCase().includes(q)
      );
    });
  }, [linhasConsolidadas, filtroStatus, busca]);

  const toggle = (linha: number) => {
    const s = new Set(selecionadas);
    if (s.has(linha)) s.delete(linha); else s.add(linha);
    setSelecionadas(s);
  };

  const selecionarTodosFiltrados = () => {
    setSelecionadas(new Set(filtradas.filter((l) => l.status_consolidado === 'ELEGIVEL_NAO_ENVIADO').map((l) => l.linha_excel)));
  };
  const limpar = () => setSelecionadas(new Set());

  const percProgresso = totalGeral > 0 ? Math.round((processados / totalGeral) * 100) : 0;

  return (
    <div className="space-y-3">
      <Alert>
        <PlayCircle className="h-4 w-4" />
        <AlertTitle>Status da importação</AlertTitle>
        <AlertDescription className="text-xs">
          A fila completa é preservada. Falhas em uma linha não interrompem o lote. Você pode importar todos os elegíveis restantes,
          reprocessar somente erros, ou continuar após interrupção com o mesmo arquivo.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
        <Stat label="Total" value={totalGeral} />
        <Stat label="Elegíveis restantes" value={restantesElegiveis} highlight={restantesElegiveis > 0} />
        <Stat label="Sucessos" value={contagens.SUCESSO} />
        <Stat label="Já processados" value={contagens.JA_PROCESSADO} />
        <Stat label="Erros" value={contagens.ERRO} highlight={contagens.ERRO > 0} />
        <Stat label="Pendentes catálogo" value={contagens.PENDENTE_CATALOGO} />
        <Stat label="Bloqueadas" value={contagens.BLOQUEADA} />
        <Stat label="Existentes (revisar)" value={contagens.EXISTENTE_REVISAR} />
        <Stat label="Existentes (ignorar)" value={contagens.EXISTENTE_IGNORAR} />
        <Stat label="Processando" value={contagens.PROCESSANDO} />
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>Progresso global</span>
          <span>{processados} / {totalGeral} ({percProgresso}%)</span>
        </div>
        <Progress value={percProgresso} />
      </div>

      {progresso && (
        <Alert>
          <AlertTitle className="text-xs">
            Lote {progresso.loteAtual}/{progresso.totalLotes} — {progresso.processadasGeral}/{progresso.totalGeral}
          </AlertTitle>
          <AlertDescription className="text-xs">
            Sucessos: {progresso.sucessos} · Já processadas: {progresso.ja_processados} · Erros: {progresso.erros}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={onImportarTodosElegiveis} disabled={ocupado || !temPermissaoCriar || restantesElegiveis === 0}>
          <PlayCircle className="h-4 w-4 mr-1" /> Importar todos os elegíveis ({restantesElegiveis})
        </Button>
        <Button size="sm" variant="secondary" onClick={onReprocessarErros} disabled={ocupado || contagens.ERRO === 0}>
          <RotateCcw className="h-4 w-4 mr-1" /> Reprocessar erros ({contagens.ERRO})
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onImportarSelecionados([...selecionadas])}
          disabled={ocupado || selecionadas.size === 0 || !temPermissaoCriar}
        >
          Importar selecionados ({selecionadas.size})
        </Button>
        <Button size="sm" variant="ghost" onClick={onRecarregarStatusServidor} disabled={ocupado}>
          <RefreshCw className="h-4 w-4 mr-1" /> Recarregar status do servidor
        </Button>
        <label className="text-xs flex items-center gap-1">
          Lote:
          <select
            className="border rounded p-1 bg-background text-xs"
            value={batchSize}
            onChange={(e) => onChangeBatchSize(parseInt(e.target.value, 10))}
            disabled={ocupado}
          >
            {BATCH_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <select
          className="border rounded p-1 bg-background text-xs"
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value as StatusConsolidadoImportacao | 'TODOS')}
        >
          <option value="TODOS">Todos ({totalGeral})</option>
          {(Object.keys(STATUS_LABELS) as StatusConsolidadoImportacao[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s].label} ({contagens[s]})</option>
          ))}
        </select>
        <Input
          className="h-8 text-xs max-w-xs"
          placeholder="Buscar por código, linha, CC, mensagem…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <Button size="sm" variant="outline" onClick={selecionarTodosFiltrados} disabled={ocupado}>
          Selecionar elegíveis filtrados
        </Button>
        <Button size="sm" variant="ghost" onClick={limpar} disabled={ocupado}>Limpar</Button>
        <Badge variant="secondary">{filtradas.length} linha(s) exibidas</Badge>
      </div>

      <div className="border rounded max-h-[420px] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Linha</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tentativas</TableHead>
              <TableHead>Ação/Val.</TableHead>
              <TableHead>CC</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Mensagem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtradas.map((l) => {
              const sel = selecionadas.has(l.linha_excel);
              const cfg = STATUS_LABELS[l.status_consolidado];
              const podeSelecionar = l.status_consolidado === 'ELEGIVEL_NAO_ENVIADO' || l.status_consolidado === 'ERRO';
              return (
                <TableRow key={l.chave} data-selected={sel}>
                  <TableCell>
                    {podeSelecionar ? (
                      <Checkbox checked={sel} onCheckedChange={() => toggle(l.linha_excel)} disabled={ocupado} />
                    ) : null}
                  </TableCell>
                  <TableCell>{l.linha_excel}</TableCell>
                  <TableCell className="font-mono text-xs">{l.codigo_ativo_exibicao}</TableCell>
                  <TableCell><Badge variant={cfg.variant}>{cfg.label}</Badge></TableCell>
                  <TableCell className="text-xs">{l.numero_tentativas}</TableCell>
                  <TableCell className="text-[10px]">{l.acao_base}/{l.status_validacao}</TableCell>
                  <TableCell className="text-xs">{l.centro_custo_origem ?? '—'}</TableCell>
                  <TableCell className="text-[10px]">{l.motivo_nao_cadastrado ?? '—'}</TableCell>
                  <TableCell className="text-[10px] max-w-xs truncate" title={l.mensagem ?? ''}>{l.mensagem ?? '—'}</TableCell>
                </TableRow>
              );
            })}
            {filtradas.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center text-xs text-muted-foreground">Nenhuma linha.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onDownloadRelatorioXlsx}>
          <Download className="h-4 w-4 mr-1" /> Relatório completo XLSX
        </Button>
        <Button variant="outline" size="sm" onClick={onDownloadRelatorioJson}>
          <Download className="h-4 w-4 mr-1" /> Relatório completo JSON
        </Button>
        <Button variant="outline" size="sm" onClick={onDownloadSomenteErros} disabled={contagens.ERRO === 0}>
          <Download className="h-4 w-4 mr-1" /> Somente erros XLSX
        </Button>
        <Button variant="outline" size="sm" onClick={onDownloadNaoCadastrados}>
          <Download className="h-4 w-4 mr-1" /> Não cadastrados XLSX
        </Button>
        <Button variant="outline" size="sm" onClick={onDownloadHistoricoJson}>
          <Download className="h-4 w-4 mr-1" /> Histórico execuções JSON
        </Button>
        <Button onClick={onEncerrar} disabled={ocupado}>Encerrar importação</Button>
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: number; highlight?: boolean }> = ({ label, value, highlight }) => (
  <div className={`border rounded p-2 ${highlight ? 'border-primary' : ''}`}>
    <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
    <div className="font-semibold text-sm">{value.toLocaleString('pt-BR')}</div>
  </div>
);

export default StatusConsolidadoStep;
