import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FileUploader } from '@/components/ui/file-uploader';
import { AlertCircle, CheckCircle2, Download, ShieldAlert } from 'lucide-react';
import { executarDryRun, type DryRunContext } from '@/services/veiculo/import/executarDryRun';
import type { DryRunSnapshot, MapaCatalogoLinha, DecisaoLinha } from '@/services/veiculo/import/types';
import type { DecisaoUsuarioCatalogoItem } from '@/services/veiculo/import/tiposResolucao';
import ResolverCatalogosStep from './ResolverCatalogosStep';
import StatusConsolidadoStep from './StatusConsolidadoStep';
import { usePermission } from '@/hooks/usePermission';
import {
  executarImportacao,
  fetchFrotaIdPorPrefixo,
  type LinhaResultadoImportacao,
  type ProgressoImportacao,
} from '@/services/veiculo/import/executarImportacao';
import { fetchStatusPorArquivo } from '@/services/veiculo/import/fetchStatusPorArquivo';
import {
  consolidarStatusPorLinha,
  type StatusPersistidoLinha,
} from '@/services/veiculo/import/statusConsolidado';
import {
  gerarRelatorioFinalXlsx,
  gerarRelatorioFinalJson,
  gerarSomenteErrosXlsx,
  gerarHistoricoExecucoesJson,
  type ExecucaoRegistro,
} from '@/services/veiculo/import/gerarRelatorioFinal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type Etapa = 'UPLOAD' | 'RESOLVER' | 'RESULTADO' | 'STATUS';

const ImportadorV2Wizard: React.FC<Props> = ({ isOpen, onClose }) => {
  const { hasActionPermission } = usePermission();
  const podeCriar = hasActionPermission('gestao_maquinas_caminhoes_view', 'criar');

  const [etapa, setEtapa] = useState<Etapa>('UPLOAD');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<DryRunSnapshot | null>(null);
  const [snapshotInicial, setSnapshotInicial] = useState<DryRunSnapshot | null>(null);
  const [contexto, setContexto] = useState<DryRunContext | null>(null);
  // Estado imutável do dry-run final (após decisões do usuário) — nunca é substituído por resultado de execução.
  const [dryRunFinal, setDryRunFinal] = useState<DecisaoLinha[]>([]);
  const [mapaCatalogo, setMapaCatalogo] = useState<MapaCatalogoLinha[]>([]);
  const [decisoes, setDecisoes] = useState<Map<string, DecisaoUsuarioCatalogoItem>>(new Map());
  const [relatorio, setRelatorio] = useState<Blob | null>(null);
  const [duplicidadesJson, setDuplicidadesJson] = useState<Blob | null>(null);
  const [pendenciasJson, setPendenciasJson] = useState<Blob | null>(null);
  const [batchSize, setBatchSize] = useState<number>(25);
  const [progresso, setProgresso] = useState<ProgressoImportacao | null>(null);
  // Acumulador de todos os resultados de execução na sessão.
  const [resultadosAcumulados, setResultadosAcumulados] = useState<LinhaResultadoImportacao[]>([]);
  const [execucoes, setExecucoes] = useState<ExecucaoRegistro[]>([]);
  const [statusPersistido, setStatusPersistido] = useState<StatusPersistidoLinha[]>([]);
  const [ultimaExecId, setUltimaExecId] = useState<string | null>(null);

  const reset = () => {
    setEtapa('UPLOAD');
    setFile(null); setBusy(false); setErro(null);
    setSnapshot(null); setSnapshotInicial(null); setContexto(null);
    setDryRunFinal([]);
    setMapaCatalogo([]); setDecisoes(new Map());
    setRelatorio(null); setDuplicidadesJson(null); setPendenciasJson(null);
    setProgresso(null);
    setResultadosAcumulados([]);
    setExecucoes([]);
    setStatusPersistido([]);
    setUltimaExecId(null);
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || !files[0]) return;
    reset();
    setFile(files[0]);
  };

  const rodarInicial = async () => {
    if (!file) return;
    setBusy(true); setErro(null);
    try {
      const r = await executarDryRun(file, new Map());
      setSnapshotInicial(r.snapshot);
      setSnapshot(r.snapshot);
      setContexto(r.contexto);
      setDryRunFinal(r.decisoesFinal);
      setMapaCatalogo(r.mapaCatalogo);
      setRelatorio(r.relatorio);
      setDuplicidadesJson(r.duplicidadesJson);
      setPendenciasJson(r.pendenciasCatalogoJson);
      // Recupera progresso persistido para este arquivo.
      try {
        const persist = await fetchStatusPorArquivo(r.contexto.arquivoSha256);
        setStatusPersistido(persist);
      } catch {
        // Recuperação silenciosa: prossegue sem persistido.
      }
      setEtapa('RESOLVER');
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const recalcular = async () => {
    if (!file || !contexto) return;
    setBusy(true); setErro(null);
    try {
      const r = await executarDryRun(file, decisoes, contexto);
      setSnapshot(r.snapshot);
      setDryRunFinal(r.decisoesFinal);
      setRelatorio(r.relatorio);
      setDuplicidadesJson(r.duplicidadesJson);
      setPendenciasJson(r.pendenciasCatalogoJson);
      setEtapa('RESULTADO');
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const linhasConsolidadas = useMemo(() => {
    if (!contexto) return [];
    return consolidarStatusPorLinha({
      arquivoSha256: contexto.arquivoSha256,
      decisoes: dryRunFinal,
      resultadosAcumulados,
      persistido: statusPersistido,
    });
  }, [contexto, dryRunFinal, resultadosAcumulados, statusPersistido]);

  async function importarLinhas(alvoLinhas: number[]) {
    if (!contexto || alvoLinhas.length === 0) return;
    setBusy(true); setErro(null); setProgresso(null);
    const iniciada = new Date().toISOString();
    try {
      const frotaMap = await fetchFrotaIdPorPrefixo();
      const alvoSet = new Set(alvoLinhas);
      const res = await executarImportacao({
        decisoes: dryRunFinal,
        linhasSelecionadas: alvoSet,
        frotaIdPorPrefixo: frotaMap,
        arquivoSha256: contexto.arquivoSha256,
        arquivoNome: contexto.arquivoNome,
        execucaoAnteriorId: ultimaExecId,
        batchSize,
        onProgresso: (p) => setProgresso(p),
      });
      // Acumula, nunca substitui.
      setResultadosAcumulados((prev) => [...prev, ...res.resultados]);
      setExecucoes((prev) => [...prev, {
        execution_id: res.execution_id,
        execucao_anterior_id: ultimaExecId,
        iniciada_em: iniciada,
        encerrada_em: new Date().toISOString(),
        selecionadas: res.resumo.selecionados,
        sucessos: res.resumo.inseridos,
        ja_processados: res.resumo.ja_processados,
        erros: res.resumo.erros,
      }]);
      setUltimaExecId(res.execution_id);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const importarTodosElegiveis = () => {
    const alvo = linhasConsolidadas.filter((l) => l.status_consolidado === 'ELEGIVEL_NAO_ENVIADO').map((l) => l.linha_excel);
    void importarLinhas(alvo);
  };
  const reprocessarErros = () => {
    const alvo = linhasConsolidadas.filter((l) => l.status_consolidado === 'ERRO').map((l) => l.linha_excel);
    void importarLinhas(alvo);
  };
  const importarSelecionadas = (linhas: number[]) => {
    // Só considera elegíveis ou erros — nunca REVISAR/PENDENTE/BLOQUEADA/IGNORAR.
    const permitidas = new Set(
      linhasConsolidadas
        .filter((l) => l.status_consolidado === 'ELEGIVEL_NAO_ENVIADO' || l.status_consolidado === 'ERRO')
        .map((l) => l.linha_excel),
    );
    void importarLinhas(linhas.filter((n) => permitidas.has(n)));
  };

  const recarregarStatusServidor = async () => {
    if (!contexto) return;
    setBusy(true);
    try {
      const persist = await fetchStatusPorArquivo(contexto.arquivoSha256);
      setStatusPersistido(persist);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const download = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  };

  const relatorioInput = () => ({
    arquivo_sha256: contexto?.arquivoSha256 ?? '',
    arquivo_nome: contexto?.arquivoNome ?? file?.name ?? '',
    linhas: linhasConsolidadas,
    execucoes,
  });

  const linhasValidasCount = useMemo(
    () => linhasConsolidadas.filter((l) => l.status_consolidado === 'ELEGIVEL_NAO_ENVIADO').length,
    [linhasConsolidadas],
  );

  return (
    <Dialog open={isOpen} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importador V2 — Dry-Run + Rodada 2A.5</DialogTitle>
          <DialogDescription>
            Fila completa preservada. Importe em lotes contínuos, reprocesse erros, retome após interrupção.
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Fluxo legado</AlertTitle>
          <AlertDescription className="text-xs">
            Fluxo legado mantido apenas para contingência técnica. Para novas importações, utilize o Importador V3.
          </AlertDescription>
        </Alert>

        {etapa === 'UPLOAD' && (
          <div className="space-y-3">
            <Alert>
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Modo somente-leitura para análise</AlertTitle>
              <AlertDescription className="text-xs">
                O dry-run não executa escrita. Escritas ocorrem apenas nos lotes de importação confirmados.
              </AlertDescription>
            </Alert>
            <FileUploader
              accept=".xlsx"
              onFilesSelected={handleFiles}
              label="Selecione o arquivo oficial BASE ROMULO (.xlsx)"
              maxFiles={1}
            />
            {file && (
              <div className="text-xs text-muted-foreground">
                Arquivo: <strong>{file.name}</strong> ({file.size.toLocaleString('pt-BR')} bytes)
              </div>
            )}
            {erro && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erro no dry-run</AlertTitle>
                <AlertDescription>{erro}</AlertDescription>
              </Alert>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
              <Button disabled={!file || busy} onClick={rodarInicial}>
                {busy ? 'Analisando…' : 'Executar Dry-Run'}
              </Button>
            </div>
          </div>
        )}

        {etapa === 'RESOLVER' && snapshotInicial && (
          <div className="space-y-3">
            <Alert>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle>Etapa 2 — Resolver catálogos</AlertTitle>
              <AlertDescription className="text-xs">
                INSERIR={snapshotInicial.contagens.inserir} · REVISAR={snapshotInicial.contagens.revisar} · IGNORAR={snapshotInicial.contagens.ignorar} · VALIDAS={snapshotInicial.contagens.validas} · PENDENTES={snapshotInicial.contagens.pendentes} · BLOQUEADAS={snapshotInicial.contagens.bloqueadas}
                {statusPersistido.length > 0 && (
                  <div className="mt-1 text-primary">
                    Recuperado do servidor: {statusPersistido.length} linha(s) já processada(s) anteriormente para este arquivo.
                  </div>
                )}
              </AlertDescription>
            </Alert>
            {erro && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erro no recálculo</AlertTitle>
                <AlertDescription>{erro}</AlertDescription>
              </Alert>
            )}
            <ResolverCatalogosStep
              mapaCatalogo={mapaCatalogo}
              decisoes={decisoes}
              onChange={setDecisoes}
              onVoltar={() => setEtapa('UPLOAD')}
              onConfirmar={recalcular}
            />
          </div>
        )}

        {etapa === 'RESULTADO' && snapshot && (
          <div className="space-y-3">
            <Alert>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle>Dry-run concluído — escopo {snapshot.escopo.escopo_resultado}</AlertTitle>
              <AlertDescription className="text-xs break-all">
                SHA-256: <code className="text-[10px]">{snapshot.arquivo_sha256}</code>
                {snapshot.reconciliacao && !snapshot.reconciliacao.ok && (
                  <div className="text-destructive">Inconsistências: {snapshot.reconciliacao.inconsistencias.join(' | ')}</div>
                )}
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <Stat label="linhas_uteis" value={snapshot.contagens.linhas_uteis} />
              <Stat label="INSERIR" value={snapshot.contagens.inserir} />
              <Stat label="VALIDAS" value={snapshot.contagens.validas} />
              <Stat label="Elegíveis restantes" value={linhasValidasCount} />
              <Stat label="Já processadas (servidor)" value={statusPersistido.length} />
              <Stat label="PENDENTES catálogo" value={snapshot.contagens.pendentes} />
            </div>

            {(() => {
              const bloqueado = snapshot.reconciliacao ? !snapshot.reconciliacao.ok : false;
              return (
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="outline" onClick={() => setEtapa('RESOLVER')}>Voltar para catálogos</Button>
                  <Button
                    variant="outline"
                    disabled={bloqueado}
                    onClick={() => download(
                      new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' }),
                      `dry_run_evidencia_${Date.now()}.json`,
                    )}
                  >
                    <Download className="h-4 w-4 mr-1" /> Evidência Dry-Run JSON
                  </Button>
                  <Button
                    variant="outline"
                    disabled={bloqueado}
                    onClick={() => relatorio && download(relatorio, `dry_run_veiculos_${Date.now()}.xlsx`)}
                  >
                    <Download className="h-4 w-4 mr-1" /> Relatório dry-run XLSX
                  </Button>
                  <Button
                    disabled={bloqueado || !podeCriar || linhasValidasCount === 0}
                    onClick={() => setEtapa('STATUS')}
                    title={!podeCriar ? 'Sem permissão criar em gestao_maquinas_caminhoes_view' : ''}
                  >
                    Ir para importação ({linhasValidasCount} elegíveis)
                  </Button>
                </div>
              );
            })()}
          </div>
        )}

        {etapa === 'STATUS' && (
          <>
            {erro && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erro na importação</AlertTitle>
                <AlertDescription>{erro}</AlertDescription>
              </Alert>
            )}
            <StatusConsolidadoStep
              linhasConsolidadas={linhasConsolidadas}
              progresso={progresso}
              ocupado={busy}
              temPermissaoCriar={podeCriar}
              batchSize={batchSize}
              onChangeBatchSize={setBatchSize}
              onImportarTodosElegiveis={importarTodosElegiveis}
              onImportarSelecionados={importarSelecionadas}
              onReprocessarErros={reprocessarErros}
              onEncerrar={() => { reset(); onClose(); }}
              onRecarregarStatusServidor={() => void recarregarStatusServidor()}
              onDownloadRelatorioXlsx={() => download(gerarRelatorioFinalXlsx(relatorioInput()), `importacao_relatorio_${Date.now()}.xlsx`)}
              onDownloadRelatorioJson={() => download(gerarRelatorioFinalJson(relatorioInput()), `importacao_relatorio_${Date.now()}.json`)}
              onDownloadSomenteErros={() => download(gerarSomenteErrosXlsx(linhasConsolidadas), `importacao_erros_${Date.now()}.xlsx`)}
              onDownloadNaoCadastrados={() => {
                const somenteNao = linhasConsolidadas.filter((l) =>
                  ['ERRO','PENDENTE_CATALOGO','BLOQUEADA','EXISTENTE_REVISAR','EXISTENTE_IGNORAR','ELEGIVEL_NAO_ENVIADO'].includes(l.status_consolidado)
                );
                download(
                  gerarRelatorioFinalXlsx({ ...relatorioInput(), linhas: somenteNao }),
                  `importacao_nao_cadastrados_${Date.now()}.xlsx`,
                );
              }}
              onDownloadHistoricoJson={() => download(
                gerarHistoricoExecucoesJson(relatorioInput(), resultadosAcumulados),
                `importacao_historico_${Date.now()}.json`,
              )}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

const Stat: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="border rounded p-2">
    <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
    <div className="font-semibold text-sm">{value.toLocaleString('pt-BR')}</div>
  </div>
);

export default ImportadorV2Wizard;
