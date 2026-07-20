// PR-3.3 Fase C3 (Turn 2) — Modal do Importador V3 SIMPLIFICADO.
// - Layout simplificado (21 colunas físicas) é o ÚNICO oficial.
// - Layout 41-colunas legado é rejeitado com CTA para baixar o novo modelo.
// - Gate: VITE_IMPORTADOR_V3_WRITE_ENABLED=false desativa a execução.

import React, { useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { FileUploader } from '@/components/ui/file-uploader';
import { AlertCircle, Info, Play, FileSpreadsheet, Lock } from 'lucide-react';
import { useEquipamentosImportV3Simplificado } from '@/hooks/vehicles/useEquipamentosImportV3Simplificado';
import type { AcaoInferida } from '@/services/veiculo/importV3/parseWorkbookV3Simplificado';
import type { StatusResultadoV3S } from '@/services/veiculo/importV3/executarImportacaoV3Simplificado';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImportSucesso?: () => void;
}

const BADGE_ACAO: Record<AcaoInferida, string> = {
  INSERIR: 'bg-primary/15 text-primary border-primary/30',
  ATUALIZAR: 'bg-blue-500/15 text-blue-700 border-blue-500/30',
  SEM_ALTERACAO: 'bg-muted text-muted-foreground border-border',
  IGNORADA: 'bg-muted text-muted-foreground',
  ERRO: 'bg-destructive/15 text-destructive border-destructive/30',
};

const BADGE_FINAL: Partial<Record<StatusResultadoV3S, string>> = {
  SUCESSO_INSERT: 'bg-green-500/15 text-green-700 border-green-500/30',
  SUCESSO_UPDATE: 'bg-green-500/15 text-green-700 border-green-500/30',
  JA_PROCESSADO: 'bg-muted text-muted-foreground',
  JA_EXISTENTE: 'bg-yellow-500/15 text-yellow-700 border-yellow-500/30',
  CONFLITO: 'bg-orange-500/15 text-orange-700 border-orange-500/30',
  ERRO: 'bg-destructive/15 text-destructive border-destructive/30',
  ERRO_PARSER: 'bg-destructive/15 text-destructive border-destructive/30',
  SEM_ALTERACAO: 'bg-muted text-muted-foreground',
};

/** Gate global. Default = habilitado. */
export function writeEnabledV3(): boolean {
  const v = String(import.meta.env.VITE_IMPORTADOR_V3_WRITE_ENABLED ?? 'true').toLowerCase();
  return v !== 'false' && v !== '0';
}

const ImportadorV3Modal: React.FC<Props> = ({ isOpen, onClose, onImportSucesso }) => {
  const {
    state, statusPorChave, reset, carregarArquivo,
    toggleSelecionado, selecionarTodos, limparSelecao, processar, chaveLinha,
  } = useEquipamentosImportV3Simplificado();

  const [filtro, setFiltro] = useState<'TODOS' | AcaoInferida>('TODOS');
  const writeEnabled = writeEnabledV3();

  const linhasFiltradas = useMemo(() => {
    if (filtro === 'TODOS') return state.linhas;
    return state.linhas.filter((l) => l.acao === filtro);
  }, [filtro, state.linhas]);

  const resumo = state.parsed?.resumo;
  const handleClose = () => { reset(); onClose(); };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importador V3 — Equipamentos (Simplificado)
          </DialogTitle>
          <DialogDescription>
            Layout oficial: 20 colunas operacionais + inferência automática de ação por diff canônico.
            Apenas o novo modelo simplificado é aceito.
          </DialogDescription>
        </DialogHeader>

        {!writeEnabled && (
          <Alert>
            <Lock className="h-4 w-4" />
            <AlertTitle>Importação em atualização</AlertTitle>
            <AlertDescription>
              O novo importador está em atualização. O modelo e a exportação já estão disponíveis,
              mas a execução permanece temporariamente bloqueada.
            </AlertDescription>
          </Alert>
        )}

        {state.status === 'idle' || state.status === 'parsing' || state.status === 'error' ? (
          <div className="space-y-4 overflow-y-auto pr-1">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Como funciona</AlertTitle>
              <AlertDescription className="text-xs space-y-1">
                <p><strong>INSERIR:</strong> linhas novas (sem <code>_controle_ref</code>).</p>
                <p><strong>ATUALIZAR:</strong> inferido automaticamente por diff canônico contra o snapshot.</p>
                <p><strong>SEM_ALTERACAO:</strong> nenhuma RPC é chamada; a linha permanece no relatório.</p>
                <p><strong>Campos protegidos:</strong> frota, número, centro de custo — nunca alteráveis por importação.</p>
              </AlertDescription>
            </Alert>

            <FileUploader
              accept=".xlsx"
              onFilesSelected={(files) => { if (files && files[0]) carregarArquivo(files[0]); }}
              label="Arraste o arquivo XLSX SIMPLIFICADO ou clique para selecionar"
              maxFiles={1}
            />

            {state.status === 'parsing' && (
              <Alert><AlertDescription>Lendo e classificando o arquivo…</AlertDescription></Alert>
            )}
            {state.erroGlobal && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Arquivo incompatível</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>{state.erroGlobal}</p>
                  <p className="text-xs">
                    Este arquivo pertence a uma versão anterior (17/41 colunas, CSV ou schema divergente).
                    Baixe o novo modelo simplificado e tente novamente.
                  </p>
                </AlertDescription>
              </Alert>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline">Arquivo: {state.file?.name}</Badge>
              <Badge variant="outline" className="font-mono">SHA lógico {state.arquivoSha256Logico.slice(0, 12)}…</Badge>
              <Badge variant="outline">Schema: SIMPLIFICADO</Badge>
            </div>

            {resumo && (
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs">
                <Card label="Total" v={resumo.total} onClick={() => setFiltro('TODOS')} active={filtro === 'TODOS'} />
                <Card label="Inserir" v={resumo.inserir} onClick={() => setFiltro('INSERIR')} active={filtro === 'INSERIR'} />
                <Card label="Atualizar" v={resumo.atualizar} onClick={() => setFiltro('ATUALIZAR')} active={filtro === 'ATUALIZAR'} />
                <Card label="Sem alteração" v={resumo.sem_alteracao} onClick={() => setFiltro('SEM_ALTERACAO')} active={filtro === 'SEM_ALTERACAO'} />
                <Card label="Ignoradas" v={resumo.ignorada} onClick={() => setFiltro('IGNORADA')} active={filtro === 'IGNORADA'} />
                <Card label="Erros" v={resumo.erro} onClick={() => setFiltro('ERRO')} active={filtro === 'ERRO'} />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={selecionarTodos} disabled={state.isProcessing}>Selecionar todos elegíveis</Button>
              <Button size="sm" variant="ghost" onClick={limparSelecao} disabled={state.isProcessing}>Limpar seleção</Button>
              <div className="flex-1" />
              <Badge variant="outline">{state.selecionados.size} selecionados</Badge>
              <Button size="sm" onClick={processar}
                disabled={state.isProcessing || state.selecionados.size === 0 || !writeEnabled}
                title={!writeEnabled ? 'Execução bloqueada — importador em atualização' : undefined}>
                <Play className="h-4 w-4 mr-1" />
                {writeEnabled ? 'Importar' : 'Bloqueado'}
              </Button>
            </div>

            {state.progresso && (
              <div className="border rounded-md p-2 text-xs bg-muted/30 space-y-1">
                <div className="flex flex-wrap gap-3">
                  <span>Lote {state.progresso.loteAtual}/{state.progresso.totalLotes}</span>
                  <span>Processadas: {state.progresso.processadasGeral}/{state.progresso.totalGeral}</span>
                  <span>Inseridas: {state.progresso.inseridas}</span>
                  <span>Atualizadas: {state.progresso.atualizadas}</span>
                  <span>Já processadas: {state.progresso.ja_processadas}</span>
                  <span>Conflitos: {state.progresso.conflitos}</span>
                  <span>Erros: {state.progresso.erros}</span>
                </div>
                <Progress value={state.progresso.totalGeral === 0 ? 0
                  : Math.round((state.progresso.processadasGeral / state.progresso.totalGeral) * 100)} />
              </div>
            )}

            <div className="flex-1 overflow-auto border rounded-md">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="p-2 text-left w-8"></th>
                    <th className="p-2 text-left">Linha</th>
                    <th className="p-2 text-left">Frota/Núm</th>
                    <th className="p-2 text-left">Subcategoria</th>
                    <th className="p-2 text-left">Proprietário</th>
                    <th className="p-2 text-left">CC</th>
                    <th className="p-2 text-left">Fabricante</th>
                    <th className="p-2 text-left">Modelo</th>
                    <th className="p-2 text-left">Ação inferida</th>
                    <th className="p-2 text-left">Campos alterados</th>
                    <th className="p-2 text-left">Status</th>
                    <th className="p-2 text-left">Mensagem</th>
                  </tr>
                </thead>
                <tbody>
                  {linhasFiltradas.map((l) => {
                    const key = chaveLinha(l);
                    const final = statusPorChave.get(key);
                    const elegivel = l.acao === 'INSERIR' || l.acao === 'ATUALIZAR';
                    const r = l.raw as Record<string, unknown>;
                    return (
                      <tr key={`${key}-${l.linha_excel}`} className="border-t hover:bg-muted/30">
                        <td className="p-2">
                          <input type="checkbox"
                            disabled={!elegivel || state.isProcessing}
                            checked={state.selecionados.has(key)}
                            onChange={() => toggleSelecionado(key)} />
                        </td>
                        <td className="p-2 font-mono">{l.linha_excel}</td>
                        <td className="p-2 font-mono">{String(r['frota_codigo'] ?? '')}/{String(r['numero_frota'] ?? '')}</td>
                        <td className="p-2">{String(r['subcategoria'] ?? '')}</td>
                        <td className="p-2">{String(r['proprietario'] ?? '')}</td>
                        <td className="p-2 font-mono">{String(r['centro_custo'] ?? '')}</td>
                        <td className="p-2">{String(r['fabricante'] ?? '')}</td>
                        <td className="p-2">{String(r['modelo'] ?? '')}</td>
                        <td className="p-2">
                          <Badge variant="outline" className={BADGE_ACAO[l.acao]}>{l.acao}</Badge>
                        </td>
                        <td className="p-2 text-muted-foreground max-w-[180px] truncate">{l.campos_atualizar.join('|')}</td>
                        <td className="p-2">
                          {final ? (
                            <Badge variant="outline" className={BADGE_FINAL[final] ?? ''}>{final}</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-2 text-muted-foreground max-w-[220px] truncate"
                            title={l.erros.map((e) => e.mensagem).join(' | ')}>
                          {l.erros.map((e) => e.mensagem).join(' | ')}
                        </td>
                      </tr>
                    );
                  })}
                  {linhasFiltradas.length === 0 && (
                    <tr><td colSpan={12} className="p-6 text-center text-muted-foreground">Nenhuma linha neste filtro.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <div className="flex-1" />
              <Button size="sm" variant="ghost" onClick={reset} disabled={state.isProcessing}>Carregar outro arquivo</Button>
              <Button size="sm" onClick={() => { onImportSucesso?.(); handleClose(); }} disabled={state.isProcessing}>Fechar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const Card: React.FC<{ label: string; v: number; onClick?: () => void; active?: boolean }> = ({ label, v, onClick, active }) => (
  <button type="button" onClick={onClick}
    className={`text-left border rounded-md p-2 hover:bg-muted/50 transition-colors ${active ? 'border-primary bg-primary/5' : ''}`}>
    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    <div className="text-lg font-semibold">{v}</div>
  </button>
);

export default ImportadorV3Modal;
