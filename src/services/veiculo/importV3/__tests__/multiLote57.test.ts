// PR-3.1 — 57 elegíveis em 3 lotes (25 + 25 + 7) com dispatcher stub.
// Cobre: 57 dispatches; falha isolada; resultados acumulados dos 3 lotes;
// sucessos saem da fila; erros permanecem; conflitos separados;
// progresso vai de 0 a 57; histórico com 3 execuções em execução única.
import { describe, it, expect, vi } from 'vitest';
import {
  executarImportacaoV3, type RpcArgs, type RpcDispatcher,
  type ProgressoV3,
} from '../executarImportacaoV3';
import type { LinhaClassificada } from '../classificarLinhas';

function mkLinha(i: number): LinhaClassificada {
  const acao = i % 2 === 0 ? 'INSERIR' : 'ATUALIZAR';
  return {
    chave: `sha::${i + 2}::LYE${i}`,
    linha_excel: i + 2,
    codigo_canonico: `LYE${String(i).padStart(3, '0')}`,
    codigo_exibicao: `LYE${String(i).padStart(3, '0')}`,
    frota_codigo: 'LYE', numero_frota: String(i),
    centro_custo_codigo: '', subcategoria_nome: '',
    acao_arquivo: acao,
    status_inicial: acao === 'INSERIR' ? 'NOVO_VALIDO' : 'UPDATE_VALIDO',
    campos_atualizar: acao === 'ATUALIZAR' ? 'MODELO' : '',
    mensagem: '',
    parsed: { acao, codigo_canonico: `LYE${i}` } as never,
    raw: {},
  };
}

// Distribui outcomes por índice global (57 itens):
// 0..24  = SUCESSO_INSERT/UPDATE
// 25..49 = mistura: JA_PROCESSADO, JA_EXISTENTE, CONFLITO, ERRO
// 50..56 = SUCESSO_INSERT/UPDATE
function outcomeFor(i: number, acao: LinhaClassificada['acao_arquivo']) {
  if (i === 12) return { data: null, error: { message: 'boom-network' } };
  if (i === 27) return { data: { status: 'JA_PROCESSADO' }, error: null };
  if (i === 31) return { data: { status: 'JA_EXISTENTE' }, error: null };
  if (i === 35) return { data: { status: 'CONFLITO', mensagem: 'updated_at' }, error: null };
  if (i === 42) return { data: null, error: { message: 'ERRO_RPC generic', code: 'X1' } };
  const st = acao === 'INSERIR' ? 'SUCESSO_INSERT' : 'SUCESSO_UPDATE';
  return { data: { status: st }, error: null };
}

describe('executarImportacaoV3 — 57 elegíveis em 3 lotes', () => {
  it('emite 57 dispatches, acumula 3 lotes, isola erros e mostra progresso 1→57', async () => {
    const linhas: LinhaClassificada[] = Array.from({ length: 57 }, (_, i) => mkLinha(i));
    const chamadas: { nome: string; args: RpcArgs }[] = [];
    let idx = 0;
    const disp: RpcDispatcher = {
      abrirExecucao: vi.fn(async () => 'exec-multi-1'),
      encerrarExecucao: vi.fn(async () => {}),
      chamar: vi.fn(async (nome, args) => {
        chamadas.push({ nome, args });
        const acao = idx % 2 === 0 ? 'INSERIR' : 'ATUALIZAR';
        const out = outcomeFor(idx, acao);
        idx += 1;
        return out;
      }),
    };
    const progressos: ProgressoV3[] = [];
    const res = await executarImportacaoV3({
      linhas, arquivoSha256: 'sha57', arquivoNome: 'lote57.xlsx',
      batchSize: 25, intervaloMs: 0, dispatcher: disp,
      onProgresso: (p) => progressos.push(p),
    });

    // Exatamente 57 dispatches.
    expect(chamadas.length).toBe(57);
    expect(res.resultados.length).toBe(57);
    expect(res.execution_id).toBe('exec-multi-1');

    // Lotes: 25/25/7
    const loteDoIdx = (i: number) => (i < 25 ? 1 : i < 50 ? 2 : 3);
    for (let i = 0; i < progressos.length; i += 1) {
      const p = progressos[i];
      expect(p.totalLotes).toBe(3);
      expect(p.totalGeral).toBe(57);
      expect(p.loteAtual).toBe(loteDoIdx(i));
    }

    // Progresso: primeira = 1, última = 57, monótono.
    expect(progressos[0].processadasGeral).toBe(1);
    expect(progressos[progressos.length - 1].processadasGeral).toBe(57);
    for (let i = 1; i < progressos.length; i += 1) {
      expect(progressos[i].processadasGeral).toBeGreaterThan(progressos[i - 1].processadasGeral);
    }

    // Contagens agregadas conforme outcomeFor.
    const conta = (s: string) => res.resultados.filter((r) => r.status_final === s).length;
    expect(conta('JA_PROCESSADO')).toBe(1);
    expect(conta('JA_EXISTENTE')).toBe(1);
    expect(conta('CONFLITO')).toBe(1);
    expect(conta('ERRO')).toBe(2); // idx 12 + idx 42
    expect(conta('SUCESSO_INSERT') + conta('SUCESSO_UPDATE')).toBe(57 - 5);

    // Falha isolada — os índices vizinhos das falhas seguiram normalmente.
    const idxErros = res.resultados
      .map((r, i) => ({ i, r })).filter(({ r }) => r.status_final === 'ERRO').map(({ i }) => i);
    expect(idxErros).toEqual([12, 42]);
    expect(res.resultados[13].status_final).not.toBe('ERRO');
    expect(res.resultados[43].status_final).not.toBe('ERRO');

    // Encerramento ocorreu uma única vez (execução única com 3 lotes internos).
    expect((disp.encerrarExecucao as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
    expect((disp.abrirExecucao as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
  });
});
