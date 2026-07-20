// PR-3.1 — Semântica de reprocessamento no orquestrador.
// Cobre: só ERRO é reprocessado; tentativa++ e execucao_anterior_id são propagados;
// CONFLITO/JA_EXISTENTE/JA_PROCESSADO não são reenviados automaticamente pela lógica de seleção.
import { describe, it, expect, vi } from 'vitest';
import {
  executarImportacaoV3, type RpcArgs, type RpcDispatcher,
  type ResultadoLinhaV3,
} from '../executarImportacaoV3';
import type { LinhaClassificada, StatusResultado } from '../classificarLinhas';

function mkLinha(i: number): LinhaClassificada {
  return {
    chave: `k${i}`, linha_excel: i + 1,
    codigo_canonico: `LYE${String(i).padStart(3, '0')}`,
    codigo_exibicao: `LYE${String(i).padStart(3, '0')}`,
    frota_codigo: 'LYE', numero_frota: String(i), centro_custo_codigo: '',
    subcategoria_nome: '', acao_arquivo: 'INSERIR', status_inicial: 'NOVO_VALIDO',
    campos_atualizar: '', mensagem: '', parsed: { acao: 'INSERIR' } as never, raw: {},
  };
}

// Espelha a mesma regra do hook (statusFinalPorChave) para simular a seleção "reprocessar erros".
function alvoReprocessar(linhas: LinhaClassificada[], acumulados: ResultadoLinhaV3[]): LinhaClassificada[] {
  const m = new Map<string, StatusResultado>();
  for (const r of acumulados) m.set(r.chave, r.status_final);
  const NAO_REPROCESSA: StatusResultado[] = ['CONFLITO', 'JA_EXISTENTE', 'JA_PROCESSADO', 'SUCESSO_INSERT', 'SUCESSO_UPDATE'];
  return linhas.filter((l) => {
    const st = m.get(l.chave);
    if (!st) return false;
    if (NAO_REPROCESSA.includes(st)) return false;
    return st === 'ERRO';
  });
}

describe('Executor V3 — reprocessamento', () => {
  it('rodada 1 mista → apenas ERRO entra no reprocessamento; tentativa++/execAnterior propagados; terminais NÃO reenviados', async () => {
    const linhas = [0, 1, 2, 3].map(mkLinha);
    // Rodada 1: [SUCESSO, ERRO, CONFLITO, JA_EXISTENTE]
    const outs1 = [
      { data: { status: 'SUCESSO_INSERT' }, error: null },
      { data: null, error: { message: 'boom' } },
      { data: { status: 'CONFLITO', mensagem: 'updated_at' }, error: null },
      { data: { status: 'JA_EXISTENTE' }, error: null },
    ];
    let i = 0;
    const disp1: RpcDispatcher = {
      abrirExecucao: vi.fn(async () => 'exec-1'),
      encerrarExecucao: vi.fn(async () => {}),
      chamar: vi.fn(async () => outs1[i++]),
    };
    const r1 = await executarImportacaoV3({
      linhas, arquivoSha256: 'sha', arquivoNome: 'x.xlsx',
      batchSize: 25, intervaloMs: 0, dispatcher: disp1,
    });
    expect(r1.resultados.map((r) => r.status_final)).toEqual([
      'SUCESSO_INSERT', 'ERRO', 'CONFLITO', 'JA_EXISTENTE',
    ]);
    expect(r1.resultados.every((r) => r.tentativa === 1)).toBe(true);

    // Seleção de reprocessamento: apenas 1 linha (ERRO).
    const alvo = alvoReprocessar(linhas, r1.resultados);
    expect(alvo.length).toBe(1);
    expect(alvo[0].chave).toBe('k1');

    // Rodada 2: reprocessa somente esta linha, com tentativa=2 e execAnterior=exec-1.
    let ultimoArgs: RpcArgs | null = null;
    const disp2: RpcDispatcher = {
      abrirExecucao: vi.fn(async () => 'exec-2'),
      encerrarExecucao: vi.fn(async () => {}),
      chamar: vi.fn(async (_n, args) => { ultimoArgs = args; return { data: { status: 'SUCESSO_INSERT' }, error: null }; }),
    };
    const r2 = await executarImportacaoV3({
      linhas: alvo, arquivoSha256: 'sha', arquivoNome: 'x.xlsx',
      tentativaBase: 2, execucaoAnteriorId: 'exec-1',
      batchSize: 25, intervaloMs: 0, dispatcher: disp2,
    });

    expect((disp2.chamar as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
    expect(ultimoArgs?.p_tentativa).toBe(2);
    expect(ultimoArgs?.p_execucao_anterior_id).toBe('exec-1');
    expect(r2.resultados[0].status_final).toBe('SUCESSO_INSERT');
    expect(r2.resultados[0].execution_id).toBe('exec-2');
    expect(r2.resultados[0].tentativa).toBe(2);

    // Histórico anterior permanece intacto — rodada 1 não foi alterada.
    expect(r1.resultados[2].status_final).toBe('CONFLITO');
    expect(r1.resultados[3].status_final).toBe('JA_EXISTENTE');
  });
});
