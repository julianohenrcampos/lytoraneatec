// PR-3 V3 — Orquestrador de execução das RPCs do PR-2.
// Regras críticas:
//   - Concorrência 1, intervalo mínimo ~200 ms → ≤5 chamadas/s.
//   - Uma linha nunca chama duas RPCs; SEM_ALTERACAO/BLOQUEADO/ERRO nunca chamam RPC.
//   - Falha em UMA linha NUNCA interrompe as demais.
//   - Snapshot da fila é imutável; resultados são acumulados por chave lógica.

import { supabase } from '@/integrations/supabase/client';
import type { LinhaClassificada, StatusResultado } from './classificarLinhas';

export interface ResultadoLinhaV3 {
  chave: string;
  linha_excel: number;
  codigo_canonico: string;
  codigo_exibicao: string;
  acao_arquivo: LinhaClassificada['acao_arquivo'];
  status_final: StatusResultado;
  codigo_resultado: string | null;
  mensagem: string | null;
  equipamento_id: string | null;
  execution_id: string;
  tentativa: number;
  timestamp_iso: string;
  payload_enviado: Record<string, unknown> | null;
}

export interface ProgressoV3 {
  loteAtual: number;
  totalLotes: number;
  processadasGeral: number;
  totalGeral: number;
  inseridas: number;
  atualizadas: number;
  ja_processadas: number;
  ja_existentes: number;
  conflitos: number;
  erros: number;
  restantes: number;
  ultimaLinha?: ResultadoLinhaV3;
}

export interface ExecutarV3Input {
  linhas: LinhaClassificada[];
  arquivoSha256: string;
  arquivoNome: string;
  execucaoAnteriorId?: string | null;
  tentativaBase?: number; // default 1
  batchSize?: number; // default 25
  intervaloMs?: number; // default 200
  onProgresso?: (p: ProgressoV3) => void;
  /** Só para testes: injeta um dispatcher que substitui as RPCs supabase. */
  dispatcher?: RpcDispatcher;
}

export interface ExecutarV3Result {
  execution_id: string;
  resultados: ResultadoLinhaV3[];
}

// ─── Dispatcher (injetável em testes) ───────────────────────────────────────
export type RpcNome = 'fn_importador_ativos_inserir' | 'fn_importador_ativos_atualizar';
export interface RpcDispatcher {
  abrirExecucao(sha256: string, nome: string, anteriorId?: string | null): Promise<string>;
  encerrarExecucao(executionId: string, resumo: Record<string, unknown>): Promise<void>;
  chamar(nome: RpcNome, args: RpcArgs): Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
}
export interface RpcArgs {
  p_arquivo_sha256: string;
  p_execucao_anterior_id: string | null;
  p_execution_id: string;
  p_linha_excel: number;
  p_payload: Record<string, unknown>;
  p_tentativa: number;
}

const supabaseDispatcher: RpcDispatcher = {
  async abrirExecucao(sha, nome, anteriorId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rpc = supabase.rpc.bind(supabase) as any;
    const { data, error } = await rpc('fn_importador_v2_abrir_execucao', {
      p_arquivo_sha256: sha, p_arquivo_nome: nome, p_execucao_anterior_id: anteriorId ?? null,
    });
    if (error || !data) throw new Error(error?.message ?? 'FALHA_ABRIR_EXECUCAO');
    return data as string;
  },
  async encerrarExecucao(executionId, resumo) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rpc = supabase.rpc.bind(supabase) as any;
    await rpc('fn_importador_v2_encerrar_execucao', { p_execution_id: executionId, p_resumo: resumo });
  },
  async chamar(nome, args) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rpc = supabase.rpc.bind(supabase) as any;
    const res = await rpc(nome, args);
    return { data: res.data, error: res.error ?? null };
  },
};

// ─── Payload builder ────────────────────────────────────────────────────────
const CHAVES_CONTROLE = new Set(['acao']);

export function montarPayloadV3(l: LinhaClassificada): Record<string, unknown> {
  const p = l.parsed;
  if (!p) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p as Record<string, unknown>)) {
    if (CHAVES_CONTROLE.has(k)) continue;
    if (v === undefined || v === null) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    out[k] = v;
  }
  return out;
}

function mapearResultado(nome: RpcNome, data: unknown, error: { message: string; code?: string } | null): {
  status_final: StatusResultado;
  codigo_resultado: string | null;
  mensagem: string | null;
  equipamento_id: string | null;
} {
  if (error) {
    const msg = error.message ?? '';
    if (/JA_PROCESSADO/i.test(msg)) return { status_final: 'JA_PROCESSADO', codigo_resultado: 'JA_PROCESSADO', mensagem: msg, equipamento_id: null };
    if (/JA_EXISTENTE|DUPLICAT|unique/i.test(msg)) return { status_final: 'JA_EXISTENTE', codigo_resultado: 'JA_EXISTENTE', mensagem: msg, equipamento_id: null };
    if (/CONFLITO|updated_at|OPTIMISTIC|OPTIMISTIC_LOCK/i.test(msg)) return { status_final: 'CONFLITO', codigo_resultado: 'CONFLITO', mensagem: msg, equipamento_id: null };
    return { status_final: 'ERRO', codigo_resultado: error.code ?? 'ERRO_RPC', mensagem: msg, equipamento_id: null };
  }
  const r = (data ?? {}) as { status?: string; codigo?: string; mensagem?: string; equipamento_id?: string };
  const codigo = r.codigo ?? r.status ?? null;
  const eq = r.equipamento_id ?? null;
  const status = (r.status ?? '').toUpperCase();
  if (status === 'SUCESSO' || status === 'SUCESSO_INSERT' || status === 'INSERIDO') {
    return { status_final: nome === 'fn_importador_ativos_inserir' ? 'SUCESSO_INSERT' : 'SUCESSO_UPDATE', codigo_resultado: codigo, mensagem: r.mensagem ?? null, equipamento_id: eq };
  }
  if (status === 'ATUALIZADO' || status === 'SUCESSO_UPDATE') {
    return { status_final: 'SUCESSO_UPDATE', codigo_resultado: codigo, mensagem: r.mensagem ?? null, equipamento_id: eq };
  }
  if (status === 'JA_PROCESSADO') return { status_final: 'JA_PROCESSADO', codigo_resultado: codigo, mensagem: r.mensagem ?? null, equipamento_id: eq };
  if (status === 'JA_EXISTENTE') return { status_final: 'JA_EXISTENTE', codigo_resultado: codigo, mensagem: r.mensagem ?? null, equipamento_id: eq };
  if (status === 'CONFLITO') return { status_final: 'CONFLITO', codigo_resultado: codigo, mensagem: r.mensagem ?? null, equipamento_id: eq };
  if (status === 'NENHUMA_DIFERENCA' || status === 'SEM_ALTERACAO') return { status_final: 'SEM_ALTERACAO', codigo_resultado: codigo, mensagem: r.mensagem ?? null, equipamento_id: eq };
  if (status === 'ERRO') return { status_final: 'ERRO', codigo_resultado: codigo, mensagem: r.mensagem ?? null, equipamento_id: eq };
  // Sem status reconhecido → tratar como sucesso pela ação disparada.
  return {
    status_final: nome === 'fn_importador_ativos_inserir' ? 'SUCESSO_INSERT' : 'SUCESSO_UPDATE',
    codigo_resultado: codigo, mensagem: r.mensagem ?? null, equipamento_id: eq,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function executarImportacaoV3(input: ExecutarV3Input): Promise<ExecutarV3Result> {
  const dispatcher = input.dispatcher ?? supabaseDispatcher;
  const batchSize = Math.max(1, input.batchSize ?? 25);
  const intervalo = Math.max(0, input.intervaloMs ?? 200);
  const tentativaBase = Math.max(1, input.tentativaBase ?? 1);

  // Filtra somente linhas elegíveis → nunca envia SEM_ALTERACAO/BLOQUEADO/ERRO.
  const elegiveis = input.linhas.filter(
    (l) => l.status_inicial === 'NOVO_VALIDO' || l.status_inicial === 'UPDATE_VALIDO',
  );
  const totalGeral = elegiveis.length;
  const totalLotes = Math.max(1, Math.ceil(totalGeral / batchSize));

  const execution_id = await dispatcher.abrirExecucao(input.arquivoSha256, input.arquivoNome, input.execucaoAnteriorId ?? null);

  const resultados: ResultadoLinhaV3[] = [];
  let inseridas = 0, atualizadas = 0, ja_processadas = 0, ja_existentes = 0, conflitos = 0, erros = 0, feitas = 0;

  for (let li = 0; li < totalLotes; li += 1) {
    const inicio = li * batchSize;
    const fim = Math.min(totalGeral, inicio + batchSize);
    for (let i = inicio; i < fim; i += 1) {
      const l = elegiveis[i];
      const nome: RpcNome = l.status_inicial === 'NOVO_VALIDO' ? 'fn_importador_ativos_inserir' : 'fn_importador_ativos_atualizar';
      const payload = montarPayloadV3(l);
      const args: RpcArgs = {
        p_arquivo_sha256: input.arquivoSha256,
        p_execucao_anterior_id: input.execucaoAnteriorId ?? null,
        p_execution_id: execution_id,
        p_linha_excel: l.linha_excel,
        p_payload: payload,
        p_tentativa: tentativaBase,
      };

      let resultado: ResultadoLinhaV3;
      try {
        const { data, error } = await dispatcher.chamar(nome, args);
        const m = mapearResultado(nome, data, error);
        resultado = {
          chave: l.chave, linha_excel: l.linha_excel, codigo_canonico: l.codigo_canonico,
          codigo_exibicao: l.codigo_exibicao, acao_arquivo: l.acao_arquivo,
          status_final: m.status_final, codigo_resultado: m.codigo_resultado,
          mensagem: m.mensagem, equipamento_id: m.equipamento_id,
          execution_id, tentativa: tentativaBase, timestamp_iso: new Date().toISOString(),
          payload_enviado: payload,
        };
      } catch (e) {
        resultado = {
          chave: l.chave, linha_excel: l.linha_excel, codigo_canonico: l.codigo_canonico,
          codigo_exibicao: l.codigo_exibicao, acao_arquivo: l.acao_arquivo,
          status_final: 'ERRO', codigo_resultado: 'EXCEPTION',
          mensagem: e instanceof Error ? e.message : String(e),
          equipamento_id: null, execution_id, tentativa: tentativaBase,
          timestamp_iso: new Date().toISOString(), payload_enviado: payload,
        };
      }

      resultados.push(resultado);
      feitas += 1;
      switch (resultado.status_final) {
        case 'SUCESSO_INSERT': inseridas += 1; break;
        case 'SUCESSO_UPDATE': atualizadas += 1; break;
        case 'JA_PROCESSADO': ja_processadas += 1; break;
        case 'JA_EXISTENTE': ja_existentes += 1; break;
        case 'CONFLITO': conflitos += 1; break;
        case 'ERRO': erros += 1; break;
        default: break;
      }

      input.onProgresso?.({
        loteAtual: li + 1, totalLotes,
        processadasGeral: feitas, totalGeral,
        inseridas, atualizadas, ja_processadas, ja_existentes, conflitos, erros,
        restantes: totalGeral - feitas, ultimaLinha: resultado,
      });

      if (intervalo > 0 && i < fim - 1) await sleep(intervalo);
    }
  }

  await dispatcher.encerrarExecucao(execution_id, {
    total: totalGeral, inseridas, atualizadas, ja_processadas, ja_existentes, conflitos, erros,
  }).catch(() => { /* silencioso: encerramento é best-effort */ });

  return { execution_id, resultados };
}
