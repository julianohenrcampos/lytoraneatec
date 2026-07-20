// PR-3 V3 — Hook orquestrador do Importador V3.
// Snapshot IMUTÁVEL da classificação. Resultados são acumulados por chave.
// Retomada por SHA-256 marca sucessos como JA_PROCESSADO SEM reenvio.

import { useCallback, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { parseWorkbookV3, type ParseWorkbookV3Result } from '../../services/veiculo/importV3/parseWorkbookV3';
import { calcularSha256 } from '../../services/veiculo/importV3/sha256';
import {
  classificarLinhas, type LinhaClassificada, type ClassificacaoResumo,
  type StatusResultado,
} from '../../services/veiculo/importV3/classificarLinhas';
import {
  executarImportacaoV3, type ProgressoV3, type ResultadoLinhaV3,
} from '../../services/veiculo/importV3/executarImportacaoV3';
import {
  gerarRelatorioV3Xlsx, baixarBlob, type ExecucaoResumo,
} from '../../services/veiculo/importV3/gerarRelatorioV3';
import { isReprocessavel } from '../../services/veiculo/importV3/reprocessRules';

export type StatusV3 = 'idle' | 'parsing' | 'ready' | 'running' | 'done' | 'error';

export interface UseEquipamentosImportV3State {
  status: StatusV3;
  file: File | null;
  arquivoSha256: string;
  parsed: ParseWorkbookV3Result | null;
  linhas: LinhaClassificada[]; // snapshot imutável
  resumo: ClassificacaoResumo | null;
  selecionados: Set<string>; // chaves
  resultadosAcumulados: ResultadoLinhaV3[];
  historicoExecucoes: ExecucaoResumo[];
  progresso: ProgressoV3 | null;
  isProcessing: boolean;
  erroGlobal: string | null;
  retomadaAplicada: number;
  /** PR-3.2 — a consulta ao histórico por SHA falhou; bloqueia escrita até
   *  o usuário reconsultar ou confirmar prosseguir sem retomada. */
  retomadaFalhou: boolean;
  retomadaAviso: string | null;
}

const EMPTY: UseEquipamentosImportV3State = {
  status: 'idle', file: null, arquivoSha256: '', parsed: null, linhas: [],
  resumo: null, selecionados: new Set(), resultadosAcumulados: [], historicoExecucoes: [],
  progresso: null, isProcessing: false, erroGlobal: null, retomadaAplicada: 0,
  retomadaFalhou: false, retomadaAviso: null,
};

function statusFinalPorChave(r: ResultadoLinhaV3[]): Map<string, StatusResultado> {
  const m = new Map<string, StatusResultado>();
  for (const x of r) m.set(x.chave, x.status_final);
  return m;
}

export function useEquipamentosImportV3() {
  const [state, setState] = useState<UseEquipamentosImportV3State>(EMPTY);
  const snapshotRef = useRef<LinhaClassificada[]>([]);

  const reset = useCallback(() => {
    snapshotRef.current = [];
    setState(EMPTY);
  }, []);

  const carregarArquivo = useCallback(async (file: File) => {
    setState((s) => ({ ...s, status: 'parsing', file, erroGlobal: null }));
    try {
      if (!file.name.toLowerCase().endsWith('.xlsx')) {
        throw new Error('Apenas arquivos XLSX são aceitos no Importador V3.');
      }
      const buf = await file.arrayBuffer();
      const sha = await calcularSha256(buf);
      const parsed = parseWorkbookV3(buf);
      const { linhas, resumo } = classificarLinhas(sha, parsed);
      snapshotRef.current = linhas;

      // Retomada por SHA — PR-3.2: NÃO é silenciosa. Se a consulta falhar, sinaliza
      // retomadaFalhou e bloqueia a escrita até reconsultar ou o usuário confirmar
      // prosseguir sem retomada.
      let retomadaAplicada = 0;
      let retomadaFalhou = false;
      let retomadaAviso: string | null = null;
      const resultadosPreexistentes: ResultadoLinhaV3[] = [];
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rpc = supabase.rpc.bind(supabase) as any;
        const { data, error } = await rpc('fn_importador_v2_status_arquivo', { p_arquivo_sha256: sha });
        if (error) {
          retomadaFalhou = true;
          retomadaAviso = `Não foi possível verificar o histórico deste arquivo (SHA-256). `
            + `A escrita está bloqueada até nova consulta ou confirmação manual. Detalhe: ${error.message ?? 'erro desconhecido'}`;
        } else if (Array.isArray(data)) {
          type Row = { linha_excel: number; status: string; codigo_resultado?: string | null; equipamento_id: string | null; execution_id: string; numero_tentativas: number; mensagem: string | null };
          const porLinha = new Map<number, Row>();
          for (const r of data as Row[]) porLinha.set(r.linha_excel, r);
          for (const l of linhas) {
            const prev = porLinha.get(l.linha_excel);
            if (!prev) continue;
            const su = String(prev.status ?? '').toUpperCase();
            const cod = String(prev.codigo_resultado ?? '').toUpperCase() || null;
            let status_final: StatusResultado | null = null;
            let codigo_resultado: string | null = cod;
            if (su === 'SUCESSO' || su === 'JA_PROCESSADO' || su === 'SUCESSO_INSERT' || su === 'SUCESSO_UPDATE') {
              status_final = 'JA_PROCESSADO';
              codigo_resultado = cod ?? 'RETOMADA';
            } else if (su === 'CONFLITO') {
              status_final = 'CONFLITO';
              codigo_resultado = cod ?? 'CONFLITO_DADO_ATUAL_DESATUALIZADO';
            } else if (su === 'JA_EXISTENTE') {
              status_final = 'JA_EXISTENTE';
              codigo_resultado = cod ?? 'JA_EXISTENTE';
            } else if (su === 'ERRO') {
              status_final = 'ERRO';
              codigo_resultado = cod ?? 'ERRO_RPC';
            }
            if (!status_final) continue;
            if (status_final === 'JA_PROCESSADO') retomadaAplicada += 1;
            resultadosPreexistentes.push({
              chave: l.chave, linha_excel: l.linha_excel, codigo_canonico: l.codigo_canonico,
              codigo_exibicao: l.codigo_exibicao, acao_arquivo: l.acao_arquivo,
              status_final, codigo_resultado,
              mensagem: prev.mensagem, equipamento_id: prev.equipamento_id,
              execution_id: prev.execution_id, tentativa: prev.numero_tentativas,
              timestamp_iso: new Date().toISOString(), payload_enviado: null,
            });
          }
        }
      } catch (e) {
        retomadaFalhou = true;
        retomadaAviso = `Não foi possível verificar o histórico deste arquivo (SHA-256). `
          + `A escrita está bloqueada até nova consulta ou confirmação manual. Detalhe: ${e instanceof Error ? e.message : String(e)}`;
      }

      // Seleção default: elegíveis cujo histórico não é terminal (sucesso/conflito/ja_existente).
      const terminaisChaves = new Set(resultadosPreexistentes.map((r) => r.chave));
      const selecionados = new Set(
        linhas.filter((l) =>
          (l.status_inicial === 'NOVO_VALIDO' || l.status_inicial === 'UPDATE_VALIDO')
          && !terminaisChaves.has(l.chave),
        ).map((l) => l.chave),
      );

      setState((s) => ({
        ...s, status: 'ready', file, arquivoSha256: sha, parsed, linhas, resumo,
        selecionados, resultadosAcumulados: resultadosPreexistentes, retomadaAplicada,
        retomadaFalhou, retomadaAviso,
      }));
    } catch (e) {
      setState((s) => ({ ...s, status: 'error', erroGlobal: e instanceof Error ? e.message : String(e) }));
    }
  }, []);

  const toggleSelecionado = useCallback((chave: string) => {
    setState((s) => {
      const l = s.linhas.find((x) => x.chave === chave);
      if (!l) return s;
      if (l.status_inicial !== 'NOVO_VALIDO' && l.status_inicial !== 'UPDATE_VALIDO') return s;
      const nv = new Set(s.selecionados);
      if (nv.has(chave)) nv.delete(chave); else nv.add(chave);
      return { ...s, selecionados: nv };
    });
  }, []);

  const selecionarTodosElegiveis = useCallback((visiveis?: LinhaClassificada[]) => {
    setState((s) => {
      const base = visiveis ?? s.linhas;
      const nv = new Set(s.selecionados);
      const done = statusFinalPorChave(s.resultadosAcumulados);
      for (const l of base) {
        if ((l.status_inicial === 'NOVO_VALIDO' || l.status_inicial === 'UPDATE_VALIDO')
            && done.get(l.chave) !== 'SUCESSO_INSERT' && done.get(l.chave) !== 'SUCESSO_UPDATE'
            && done.get(l.chave) !== 'JA_PROCESSADO') {
          nv.add(l.chave);
        }
      }
      return { ...s, selecionados: nv };
    });
  }, []);

  const limparSelecao = useCallback(() => setState((s) => ({ ...s, selecionados: new Set() })), []);

  const processar = useCallback(async () => {
    if (state.isProcessing) return;
    if (state.retomadaFalhou) return; // PR-3.2 — gate: escrita bloqueada.
    const alvo = state.linhas.filter((l) => state.selecionados.has(l.chave));
    if (alvo.length === 0) return;
    setState((s) => ({ ...s, isProcessing: true, status: 'running', progresso: null }));
    const iniciada_em = new Date().toISOString();
    try {
      const res = await executarImportacaoV3({
        linhas: alvo,
        arquivoSha256: state.arquivoSha256,
        arquivoNome: state.file?.name ?? '(sem-nome)',
        onProgresso: (p) => setState((s) => ({ ...s, progresso: p })),
      });
      const done = statusFinalPorChave([...state.resultadosAcumulados, ...res.resultados]);
      const conta = (s: StatusResultado) => Array.from(done.values()).filter((x) => x === s).length;
      const resumoExec: ExecucaoResumo = {
        execution_id: res.execution_id, tentativa: 1, iniciada_em,
        encerrada_em: new Date().toISOString(),
        total: alvo.length, inseridas: conta('SUCESSO_INSERT'), atualizadas: conta('SUCESSO_UPDATE'),
        ja_processadas: conta('JA_PROCESSADO'), ja_existentes: conta('JA_EXISTENTE'),
        conflitos: conta('CONFLITO'), erros: conta('ERRO'),
      };
      setState((s) => {
        // Remove das selecionadas todas as chaves com status terminal (sucessos, ja_proc, ja_exist, conflito).
        const novaSel = new Set(s.selecionados);
        for (const r of res.resultados) {
          if (r.status_final === 'SUCESSO_INSERT' || r.status_final === 'SUCESSO_UPDATE'
              || r.status_final === 'JA_PROCESSADO' || r.status_final === 'JA_EXISTENTE'
              || r.status_final === 'CONFLITO') {
            novaSel.delete(r.chave);
          }
        }
        return {
          ...s, isProcessing: false, status: 'done',
          resultadosAcumulados: [...s.resultadosAcumulados, ...res.resultados],
          historicoExecucoes: [...s.historicoExecucoes, resumoExec],
          selecionados: novaSel,
        };
      });
    } catch (e) {
      setState((s) => ({ ...s, isProcessing: false, status: 'error',
        erroGlobal: e instanceof Error ? e.message : String(e) }));
    }
  }, [state.arquivoSha256, state.file, state.isProcessing, state.linhas, state.resultadosAcumulados, state.selecionados, state.retomadaFalhou]);

  const reprocessarErros = useCallback(async () => {
    if (state.isProcessing) return;
    if (state.retomadaFalhou) return; // PR-3.2 — gate: escrita bloqueada.
    // PR-3.2 — CONFLITO e códigos definitivos NUNCA são reenviados; apenas
    // ERRO reprocessável (rede, timeout, RPC indisponível, exceção interna).
    const ultimoPorChave = new Map<string, ResultadoLinhaV3>();
    for (const r of state.resultadosAcumulados) ultimoPorChave.set(r.chave, r);
    const chavesElegiveis = new Set<string>();
    for (const r of ultimoPorChave.values()) if (isReprocessavel(r)) chavesElegiveis.add(r.chave);
    const alvo = state.linhas.filter((l) => chavesElegiveis.has(l.chave));
    if (alvo.length === 0) return;
    const tentativaMax = Math.max(
      0,
      ...state.resultadosAcumulados
        .filter((r) => chavesElegiveis.has(r.chave))
        .map((r) => r.tentativa),
    );
    const execAnterior = state.historicoExecucoes[state.historicoExecucoes.length - 1]?.execution_id
      ?? Array.from(ultimoPorChave.values()).find((r) => chavesElegiveis.has(r.chave))?.execution_id
      ?? null;
    setState((s) => ({ ...s, isProcessing: true, status: 'running', progresso: null }));
    const iniciada_em = new Date().toISOString();
    try {
      const res = await executarImportacaoV3({
        linhas: alvo,
        arquivoSha256: state.arquivoSha256,
        arquivoNome: state.file?.name ?? '(sem-nome)',
        execucaoAnteriorId: execAnterior,
        tentativaBase: tentativaMax + 1,
        onProgresso: (p) => setState((s) => ({ ...s, progresso: p })),
      });
      const acumulado = [...state.resultadosAcumulados, ...res.resultados];
      const done2 = statusFinalPorChave(acumulado);
      const conta = (s: StatusResultado) => Array.from(done2.values()).filter((x) => x === s).length;
      const resumoExec: ExecucaoResumo = {
        execution_id: res.execution_id, tentativa: tentativaMax + 1, iniciada_em,
        encerrada_em: new Date().toISOString(),
        total: alvo.length, inseridas: conta('SUCESSO_INSERT'), atualizadas: conta('SUCESSO_UPDATE'),
        ja_processadas: conta('JA_PROCESSADO'), ja_existentes: conta('JA_EXISTENTE'),
        conflitos: conta('CONFLITO'), erros: conta('ERRO'),
      };
      setState((s) => ({
        ...s, isProcessing: false, status: 'done',
        resultadosAcumulados: acumulado,
        historicoExecucoes: [...s.historicoExecucoes, resumoExec],
      }));
    } catch (e) {
      setState((s) => ({ ...s, isProcessing: false, status: 'error',
        erroGlobal: e instanceof Error ? e.message : String(e) }));
    }
  }, [state.arquivoSha256, state.file, state.historicoExecucoes, state.isProcessing, state.linhas, state.resultadosAcumulados, state.retomadaFalhou]);

  const baixarRelatorio = useCallback((tipo: 'completo' | 'erros' | 'nao_processados' = 'completo') => {
    const done = statusFinalPorChave(state.resultadosAcumulados);
    let linhas = state.linhas;
    if (tipo === 'erros') linhas = state.linhas.filter((l) => done.get(l.chave) === 'ERRO' || l.status_inicial === 'ERRO');
    else if (tipo === 'nao_processados') linhas = state.linhas.filter((l) =>
      (l.status_inicial === 'NOVO_VALIDO' || l.status_inicial === 'UPDATE_VALIDO') && !done.has(l.chave));
    const blob = gerarRelatorioV3Xlsx({
      arquivoNome: state.file?.name ?? '(sem-nome)',
      arquivoSha256: state.arquivoSha256,
      linhas, resultados: state.resultadosAcumulados, execucoes: state.historicoExecucoes,
    });
    const stamp = new Date().toISOString().slice(0, 10);
    baixarBlob(blob, `relatorio_importacao_v3_${tipo}_${stamp}.xlsx`);
  }, [state.arquivoSha256, state.file, state.historicoExecucoes, state.linhas, state.resultadosAcumulados]);

  /** PR-3.2 — Repete a consulta do histórico por SHA-256 (dryRunSnapshot preservado). */
  const reconsultarRetomada = useCallback(async () => {
    if (!state.arquivoSha256 || state.isProcessing) return;
    setState((s) => ({ ...s, retomadaAviso: 'Consultando histórico…' }));
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rpc = supabase.rpc.bind(supabase) as any;
      const { data, error } = await rpc('fn_importador_v2_status_arquivo', { p_arquivo_sha256: state.arquivoSha256 });
      if (error) throw new Error(error.message ?? 'erro desconhecido');
      const rows = Array.isArray(data) ? (data as Array<{ linha_excel: number; status: string; codigo_resultado?: string | null; equipamento_id: string | null; execution_id: string; numero_tentativas: number; mensagem: string | null }>) : [];
      const porLinha = new Map<number, typeof rows[number]>();
      for (const r of rows) porLinha.set(r.linha_excel, r);
      const novos: ResultadoLinhaV3[] = [];
      let retomadaAplicada = 0;
      for (const l of state.linhas) {
        const prev = porLinha.get(l.linha_excel);
        if (!prev) continue;
        const su = String(prev.status ?? '').toUpperCase();
        const cod = String(prev.codigo_resultado ?? '').toUpperCase() || null;
        let status_final: StatusResultado | null = null;
        let codigo_resultado: string | null = cod;
        if (su === 'SUCESSO' || su === 'JA_PROCESSADO' || su === 'SUCESSO_INSERT' || su === 'SUCESSO_UPDATE') {
          status_final = 'JA_PROCESSADO'; codigo_resultado = cod ?? 'RETOMADA';
        } else if (su === 'CONFLITO') { status_final = 'CONFLITO'; codigo_resultado = cod ?? 'CONFLITO_DADO_ATUAL_DESATUALIZADO'; }
        else if (su === 'JA_EXISTENTE') { status_final = 'JA_EXISTENTE'; codigo_resultado = cod ?? 'JA_EXISTENTE'; }
        else if (su === 'ERRO') { status_final = 'ERRO'; codigo_resultado = cod ?? 'ERRO_RPC'; }
        if (!status_final) continue;
        if (status_final === 'JA_PROCESSADO') retomadaAplicada += 1;
        novos.push({
          chave: l.chave, linha_excel: l.linha_excel, codigo_canonico: l.codigo_canonico,
          codigo_exibicao: l.codigo_exibicao, acao_arquivo: l.acao_arquivo,
          status_final, codigo_resultado, mensagem: prev.mensagem,
          equipamento_id: prev.equipamento_id, execution_id: prev.execution_id,
          tentativa: prev.numero_tentativas, timestamp_iso: new Date().toISOString(), payload_enviado: null,
        });
      }
      setState((s) => ({
        ...s, retomadaFalhou: false, retomadaAviso: null,
        resultadosAcumulados: novos, retomadaAplicada,
      }));
    } catch (e) {
      setState((s) => ({
        ...s, retomadaFalhou: true,
        retomadaAviso: `Falha ao reconsultar histórico: ${e instanceof Error ? e.message : String(e)}`,
      }));
    }
  }, [state.arquivoSha256, state.isProcessing, state.linhas]);

  /** PR-3.2 — Libera manualmente o gate quando o usuário aceita prosseguir sem retomada. */
  const confirmarProsseguirSemRetomada = useCallback(() => {
    setState((s) => ({ ...s, retomadaFalhou: false,
      retomadaAviso: 'Execução liberada manualmente sem verificação de histórico.' }));
  }, []);

  const consolidadoPorChave = useMemo(() => statusFinalPorChave(state.resultadosAcumulados), [state.resultadosAcumulados]);

  return {
    state, consolidadoPorChave,
    reset, carregarArquivo,
    toggleSelecionado, selecionarTodosElegiveis, limparSelecao,
    processar, reprocessarErros, baixarRelatorio,
    reconsultarRetomada, confirmarProsseguirSemRetomada,
  };
}
