// PR-3.3 Fase C3 (Turn 2) — Hook orquestrador do Importador V3 SIMPLIFICADO.
// Usa parseWorkbookV3Simplificado + executarImportacaoV3Simplificado.

import { useCallback, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  parseWorkbookV3Simplificado, type LinhaClassificadaSimplificada,
  type ParseWorkbookV3SimplificadoResult, type AcaoInferida,
} from '../../services/veiculo/importV3/parseWorkbookV3Simplificado';
import {
  executarImportacaoV3Simplificado,
  type ProgressoV3S, type ResultadoLinhaV3S, type StatusResultadoV3S,
} from '../../services/veiculo/importV3/executarImportacaoV3Simplificado';
import {
  carregarListasReferenciaV3, type ListasReferenciaV3,
} from '../../services/veiculo/importV3/carregarListasReferenciaV3';

export type StatusV3S = 'idle' | 'parsing' | 'ready' | 'running' | 'done' | 'error';

export interface UseImportV3SState {
  status: StatusV3S;
  file: File | null;
  parsed: ParseWorkbookV3SimplificadoResult | null;
  linhas: LinhaClassificadaSimplificada[];
  arquivoSha256Logico: string;
  listas: ListasReferenciaV3 | null;
  selecionados: Set<string>; // chaves
  resultados: ResultadoLinhaV3S[];
  progresso: ProgressoV3S | null;
  isProcessing: boolean;
  erroGlobal: string | null;
}

const EMPTY: UseImportV3SState = {
  status: 'idle', file: null, parsed: null, linhas: [], arquivoSha256Logico: '',
  listas: null, selecionados: new Set(), resultados: [], progresso: null,
  isProcessing: false, erroGlobal: null,
};

function chaveLinha(l: LinhaClassificadaSimplificada): string {
  return l.controle_ref ?? `NEW:${l.codigo_canonico}:${l.linha_excel}`;
}

export function useEquipamentosImportV3Simplificado() {
  const [state, setState] = useState<UseImportV3SState>(EMPTY);
  const snapshotRef = useRef<LinhaClassificadaSimplificada[]>([]);

  const reset = useCallback(() => { snapshotRef.current = []; setState(EMPTY); }, []);

  const carregarArquivo = useCallback(async (file: File) => {
    setState((s) => ({ ...s, status: 'parsing', file, erroGlobal: null }));
    try {
      if (!file.name.toLowerCase().endsWith('.xlsx')) {
        throw new Error('Apenas arquivos XLSX são aceitos no Importador V3.');
      }
      const buf = await file.arrayBuffer();
      const parsed = await parseWorkbookV3Simplificado(buf);
      if (parsed.erros_globais.length > 0) {
        throw new Error(parsed.erros_globais[0].mensagem);
      }
      // Carrega listas EXPORTACAO (mantém inativos vinculados)
      const listas = await carregarListasReferenciaV3({ modo: 'EXPORTACAO' });
      snapshotRef.current = parsed.linhas;
      const selecionados = new Set(
        parsed.linhas
          .filter((l) => l.acao === 'INSERIR' || l.acao === 'ATUALIZAR')
          .map((l) => chaveLinha(l)),
      );
      setState((s) => ({
        ...s, status: 'ready', file, parsed, linhas: parsed.linhas,
        arquivoSha256Logico: parsed.arquivo_sha256_logico ?? '', listas, selecionados,
      }));
    } catch (e) {
      setState((s) => ({ ...s, status: 'error', erroGlobal: e instanceof Error ? e.message : String(e) }));
    }
  }, []);

  const toggleSelecionado = useCallback((chave: string) => {
    setState((s) => {
      const l = s.linhas.find((x) => chaveLinha(x) === chave);
      if (!l || (l.acao !== 'INSERIR' && l.acao !== 'ATUALIZAR')) return s;
      const nv = new Set(s.selecionados);
      if (nv.has(chave)) nv.delete(chave); else nv.add(chave);
      return { ...s, selecionados: nv };
    });
  }, []);

  const selecionarTodos = useCallback(() => {
    setState((s) => ({
      ...s,
      selecionados: new Set(
        s.linhas
          .filter((l) => l.acao === 'INSERIR' || l.acao === 'ATUALIZAR')
          .map((l) => chaveLinha(l)),
      ),
    }));
  }, []);

  const limparSelecao = useCallback(() => setState((s) => ({ ...s, selecionados: new Set() })), []);

  const processar = useCallback(async () => {
    if (state.isProcessing || !state.listas) return;
    const alvo = state.linhas.filter((l) => state.selecionados.has(chaveLinha(l)));
    if (alvo.length === 0) return;
    setState((s) => ({ ...s, isProcessing: true, status: 'running', progresso: null }));
    try {
      const res = await executarImportacaoV3Simplificado({
        linhas: alvo,
        listas: state.listas,
        arquivoSha256Logico: state.arquivoSha256Logico,
        arquivoNome: state.file?.name ?? '(sem-nome)',
        onProgresso: (p) => setState((s) => ({ ...s, progresso: p })),
      });
      setState((s) => ({
        ...s, isProcessing: false, status: 'done',
        resultados: [...s.resultados, ...res.resultados],
      }));
    } catch (e) {
      setState((s) => ({ ...s, isProcessing: false, status: 'error',
        erroGlobal: e instanceof Error ? e.message : String(e) }));
    }
  }, [state.arquivoSha256Logico, state.file, state.isProcessing, state.linhas, state.listas, state.selecionados]);

  const statusPorChave = useMemo(() => {
    const m = new Map<string, StatusResultadoV3S>();
    for (const r of state.resultados) m.set(r.chave, r.status_final);
    return m;
  }, [state.resultados]);

  return { state, statusPorChave, reset, carregarArquivo, toggleSelecionado, selecionarTodos, limparSelecao, processar, chaveLinha };
}
