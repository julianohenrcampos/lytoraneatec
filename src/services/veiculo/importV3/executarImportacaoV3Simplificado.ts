// PR-3.3 Fase C3 (Turn 2) — Executor V3 SIMPLIFICADO.
// Despacha para as MESMAS RPCs (fn_importador_ativos_inserir/atualizar) usando
// o payload simplificado montado por montarPayloadRpcV3Simplificado.
// Regras: SEM_ALTERACAO/IGNORADA/ERRO nunca chamam RPC; lote 25; ≤5 rpc/s.

import { supabase } from '@/integrations/supabase/client';
import type { LinhaClassificadaSimplificada } from './parseWorkbookV3Simplificado';
import type { ListasReferenciaV3 } from './carregarListasReferenciaV3';
import { montarPayloadRpcV3Simplificado } from './montarPayloadRpcV3Simplificado';

export type StatusResultadoV3S =
  | 'SUCESSO_INSERT' | 'SUCESSO_UPDATE'
  | 'JA_PROCESSADO' | 'JA_EXISTENTE' | 'CONFLITO'
  | 'SEM_ALTERACAO' | 'BLOQUEADO' | 'ERRO' | 'ERRO_PARSER';

export interface ResultadoLinhaV3S {
  chave: string;
  linha_excel: number;
  codigo_canonico: string;
  acao: 'INSERIR' | 'ATUALIZAR';
  status_final: StatusResultadoV3S;
  codigo_resultado: string | null;
  mensagem: string | null;
  equipamento_id: string | null;
  execution_id: string;
  tentativa: number;
  timestamp_iso: string;
  payload_enviado: Record<string, unknown> | null;
}

export interface ProgressoV3S {
  loteAtual: number; totalLotes: number;
  processadasGeral: number; totalGeral: number;
  inseridas: number; atualizadas: number;
  ja_processadas: number; ja_existentes: number;
  conflitos: number; erros: number; restantes: number;
  ultimaLinha?: ResultadoLinhaV3S;
}

export interface ExecutarV3SInput {
  linhas: LinhaClassificadaSimplificada[];
  listas: ListasReferenciaV3;
  arquivoSha256Logico: string;
  arquivoNome: string;
  execucaoAnteriorId?: string | null;
  tentativaBase?: number;
  batchSize?: number;
  intervaloMs?: number;
  onProgresso?: (p: ProgressoV3S) => void;
  dispatcher?: RpcDispatcherS;
}

export type RpcNomeS = 'fn_importador_ativos_inserir' | 'fn_importador_ativos_atualizar';
export interface RpcDispatcherS {
  abrirExecucao(sha256: string, nome: string, anteriorId?: string | null): Promise<string>;
  encerrarExecucao(executionId: string, resumo: Record<string, unknown>): Promise<void>;
  chamar(nome: RpcNomeS, args: RpcArgsS): Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
}
export interface RpcArgsS {
  p_arquivo_sha256: string;
  p_execucao_anterior_id: string | null;
  p_execution_id: string;
  p_linha_excel: number;
  p_payload: Record<string, unknown>;
  p_tentativa: number;
}

const dispatcherPadrao: RpcDispatcherS = {
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

function mapear(nome: RpcNomeS, data: unknown, error: { message: string; code?: string } | null): {
  status_final: StatusResultadoV3S; codigo_resultado: string | null;
  mensagem: string | null; equipamento_id: string | null;
} {
  if (error) {
    const msg = error.message ?? '';
    if (/JA_PROCESSADO/i.test(msg)) return { status_final: 'JA_PROCESSADO', codigo_resultado: 'JA_PROCESSADO', mensagem: msg, equipamento_id: null };
    if (/JA_EXISTENTE|DUPLICAT|unique/i.test(msg)) return { status_final: 'JA_EXISTENTE', codigo_resultado: 'JA_EXISTENTE', mensagem: msg, equipamento_id: null };
    if (/CONFLITO|updated_at|OPTIMISTIC/i.test(msg)) return { status_final: 'CONFLITO', codigo_resultado: 'CONFLITO', mensagem: msg, equipamento_id: null };
    return { status_final: 'ERRO', codigo_resultado: error.code ?? 'ERRO_RPC', mensagem: msg, equipamento_id: null };
  }
  const r = (data ?? {}) as { status?: string; codigo?: string; mensagem?: string; equipamento_id?: string };
  const st = (r.status ?? '').toUpperCase();
  const cod = r.codigo ?? r.status ?? null;
  const eq = r.equipamento_id ?? null;
  if (st === 'SUCESSO' || st === 'INSERIDO') return { status_final: nome === 'fn_importador_ativos_inserir' ? 'SUCESSO_INSERT' : 'SUCESSO_UPDATE', codigo_resultado: cod, mensagem: r.mensagem ?? null, equipamento_id: eq };
  if (st === 'ATUALIZADO' || st === 'SUCESSO_UPDATE') return { status_final: 'SUCESSO_UPDATE', codigo_resultado: cod, mensagem: r.mensagem ?? null, equipamento_id: eq };
  if (st === 'JA_PROCESSADO') return { status_final: 'JA_PROCESSADO', codigo_resultado: cod, mensagem: r.mensagem ?? null, equipamento_id: eq };
  if (st === 'JA_EXISTENTE') return { status_final: 'JA_EXISTENTE', codigo_resultado: cod, mensagem: r.mensagem ?? null, equipamento_id: eq };
  if (st === 'CONFLITO') return { status_final: 'CONFLITO', codigo_resultado: cod, mensagem: r.mensagem ?? null, equipamento_id: eq };
  if (st === 'NENHUMA_DIFERENCA' || st === 'SEM_ALTERACAO') return { status_final: 'SEM_ALTERACAO', codigo_resultado: cod, mensagem: r.mensagem ?? null, equipamento_id: eq };
  if (st === 'ERRO') return { status_final: 'ERRO', codigo_resultado: cod, mensagem: r.mensagem ?? null, equipamento_id: eq };
  return { status_final: nome === 'fn_importador_ativos_inserir' ? 'SUCESSO_INSERT' : 'SUCESSO_UPDATE', codigo_resultado: cod, mensagem: r.mensagem ?? null, equipamento_id: eq };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface ExecutarV3SResult {
  execution_id: string;
  resultados: ResultadoLinhaV3S[];
}

export async function executarImportacaoV3Simplificado(input: ExecutarV3SInput): Promise<ExecutarV3SResult> {
  const dispatcher = input.dispatcher ?? dispatcherPadrao;
  const batch = Math.max(1, input.batchSize ?? 25);
  const intervalo = Math.max(0, input.intervaloMs ?? 200);
  const tentativa = Math.max(1, input.tentativaBase ?? 1);

  const elegiveis = input.linhas.filter((l) => l.acao === 'INSERIR' || l.acao === 'ATUALIZAR');
  const total = elegiveis.length;
  const totalLotes = Math.max(1, Math.ceil(total / batch));

  const execution_id = await dispatcher.abrirExecucao(input.arquivoSha256Logico, input.arquivoNome, input.execucaoAnteriorId ?? null);

  const resultados: ResultadoLinhaV3S[] = [];
  let inseridas = 0, atualizadas = 0, ja_processadas = 0, ja_existentes = 0, conflitos = 0, erros = 0, feitas = 0;

  for (let li = 0; li < totalLotes; li += 1) {
    const inicio = li * batch;
    const fim = Math.min(total, inicio + batch);
    for (let i = inicio; i < fim; i += 1) {
      const l = elegiveis[i];
      const chave = l.controle_ref ?? `NEW:${l.codigo_canonico}:${l.linha_excel}`;
      const nome: RpcNomeS = l.acao === 'INSERIR' ? 'fn_importador_ativos_inserir' : 'fn_importador_ativos_atualizar';
      const { payload, erros: perr } = montarPayloadRpcV3Simplificado(l, { listas: input.listas });

      let resultado: ResultadoLinhaV3S;
      if (!payload) {
        resultado = {
          chave, linha_excel: l.linha_excel, codigo_canonico: l.codigo_canonico,
          acao: l.acao as 'INSERIR' | 'ATUALIZAR',
          status_final: 'ERRO_PARSER', codigo_resultado: perr[0]?.codigo ?? 'PAYLOAD_INVALIDO',
          mensagem: perr.map((e) => e.mensagem).join(' | '), equipamento_id: null,
          execution_id, tentativa, timestamp_iso: new Date().toISOString(), payload_enviado: null,
        };
        erros += 1;
      } else {
        try {
          const { data, error } = await dispatcher.chamar(nome, {
            p_arquivo_sha256: input.arquivoSha256Logico,
            p_execucao_anterior_id: input.execucaoAnteriorId ?? null,
            p_execution_id: execution_id,
            p_linha_excel: l.linha_excel,
            p_payload: payload as unknown as Record<string, unknown>,
            p_tentativa: tentativa,
          });
          const m = mapear(nome, data, error);
          resultado = {
            chave, linha_excel: l.linha_excel, codigo_canonico: l.codigo_canonico,
            acao: l.acao as 'INSERIR' | 'ATUALIZAR',
            status_final: m.status_final, codigo_resultado: m.codigo_resultado,
            mensagem: m.mensagem, equipamento_id: m.equipamento_id,
            execution_id, tentativa, timestamp_iso: new Date().toISOString(),
            payload_enviado: payload as unknown as Record<string, unknown>,
          };
        } catch (e) {
          resultado = {
            chave, linha_excel: l.linha_excel, codigo_canonico: l.codigo_canonico,
            acao: l.acao as 'INSERIR' | 'ATUALIZAR',
            status_final: 'ERRO', codigo_resultado: 'EXCEPTION',
            mensagem: e instanceof Error ? e.message : String(e),
            equipamento_id: null, execution_id, tentativa,
            timestamp_iso: new Date().toISOString(), payload_enviado: payload as unknown as Record<string, unknown>,
          };
        }
      }

      resultados.push(resultado);
      feitas += 1;
      switch (resultado.status_final) {
        case 'SUCESSO_INSERT': inseridas += 1; break;
        case 'SUCESSO_UPDATE': atualizadas += 1; break;
        case 'JA_PROCESSADO': ja_processadas += 1; break;
        case 'JA_EXISTENTE': ja_existentes += 1; break;
        case 'CONFLITO': conflitos += 1; break;
        case 'ERRO':
        case 'ERRO_PARSER': erros += 1; break;
        default: break;
      }
      input.onProgresso?.({
        loteAtual: li + 1, totalLotes,
        processadasGeral: feitas, totalGeral: total,
        inseridas, atualizadas, ja_processadas, ja_existentes, conflitos, erros,
        restantes: total - feitas, ultimaLinha: resultado,
      });
      if (intervalo > 0 && i < fim - 1) await sleep(intervalo);
    }
  }

  await dispatcher.encerrarExecucao(execution_id, {
    total, inseridas, atualizadas, ja_processadas, ja_existentes, conflitos, erros,
  }).catch(() => {});

  return { execution_id, resultados };
}
