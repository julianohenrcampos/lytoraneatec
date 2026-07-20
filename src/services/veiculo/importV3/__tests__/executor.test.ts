// PR-3 V3 — Testes do executor com dispatcher stub. Não chama Supabase real.
import { describe, it, expect, vi } from 'vitest';
import {
  executarImportacaoV3, type RpcDispatcher, type RpcArgs,
} from '../executarImportacaoV3';
import type { LinhaClassificada } from '../classificarLinhas';

function mkLinha(o: Partial<LinhaClassificada> & { linha_excel: number; status_inicial: LinhaClassificada['status_inicial'] }): LinhaClassificada {
  return {
    chave: `sha::${o.linha_excel}::${o.codigo_canonico ?? 'LYE1'}`,
    linha_excel: o.linha_excel, codigo_canonico: o.codigo_canonico ?? 'LYE1',
    codigo_exibicao: o.codigo_exibicao ?? 'LYE001',
    frota_codigo: 'LYE', numero_frota: '1', centro_custo_codigo: '', subcategoria_nome: '',
    acao_arquivo: o.status_inicial === 'NOVO_VALIDO' ? 'INSERIR' : o.status_inicial === 'UPDATE_VALIDO' ? 'ATUALIZAR' : 'SEM_ALTERACAO',
    status_inicial: o.status_inicial, campos_atualizar: '',
    mensagem: '', parsed: { acao: o.status_inicial === 'NOVO_VALIDO' ? 'INSERIR' : 'ATUALIZAR' } as any,
    raw: {},
  };
}

function stubDispatcher(handler: (nome: string, args: RpcArgs) => Promise<{ data: unknown; error: { message: string } | null }>): RpcDispatcher {
  return {
    abrirExecucao: vi.fn(async () => 'exec-1'),
    encerrarExecucao: vi.fn(async () => {}),
    chamar: vi.fn(async (nome, args) => handler(nome, args)),
  };
}

describe('executarImportacaoV3', () => {
  it('SEM_ALTERACAO/BLOQUEADO/ERRO nunca chamam RPC', async () => {
    const chamadas: string[] = [];
    const disp = stubDispatcher(async (n) => { chamadas.push(n); return { data: { status: 'SUCESSO' }, error: null }; });
    const linhas: LinhaClassificada[] = [
      mkLinha({ linha_excel: 2, status_inicial: 'SEM_ALTERACAO' }),
      mkLinha({ linha_excel: 3, status_inicial: 'BLOQUEADO' }),
      mkLinha({ linha_excel: 4, status_inicial: 'ERRO' }),
    ];
    const res = await executarImportacaoV3({
      linhas, arquivoSha256: 'sha', arquivoNome: 'a.xlsx', intervaloMs: 0, dispatcher: disp,
    });
    expect(chamadas.length).toBe(0);
    expect(res.resultados.length).toBe(0);
  });

  it('INSERIR chama apenas fn_importador_ativos_inserir e ATUALIZAR apenas fn_importador_ativos_atualizar', async () => {
    const chamadas: string[] = [];
    const disp = stubDispatcher(async (n) => { chamadas.push(n); return { data: { status: 'SUCESSO' }, error: null }; });
    const linhas: LinhaClassificada[] = [
      mkLinha({ linha_excel: 2, status_inicial: 'NOVO_VALIDO', codigo_canonico: 'LYE9' }),
      mkLinha({ linha_excel: 3, status_inicial: 'UPDATE_VALIDO', codigo_canonico: 'LYE10' }),
    ];
    await executarImportacaoV3({
      linhas, arquivoSha256: 'sha', arquivoNome: 'a.xlsx', intervaloMs: 0, dispatcher: disp,
    });
    expect(chamadas).toEqual(['fn_importador_ativos_inserir', 'fn_importador_ativos_atualizar']);
  });

  it('erro em uma linha não interrompe as demais', async () => {
    let n = 0;
    const disp = stubDispatcher(async () => {
      n += 1;
      if (n === 2) return { data: null, error: { message: 'boom' } };
      return { data: { status: 'SUCESSO' }, error: null };
    });
    const linhas: LinhaClassificada[] = [1, 2, 3].map((i) => mkLinha({ linha_excel: i + 1, status_inicial: 'NOVO_VALIDO', codigo_canonico: `LYE${i}` }));
    const res = await executarImportacaoV3({
      linhas, arquivoSha256: 'sha', arquivoNome: 'a.xlsx', intervaloMs: 0, dispatcher: disp,
    });
    expect(res.resultados.length).toBe(3);
    expect(res.resultados[1].status_final).toBe('ERRO');
    expect(res.resultados[0].status_final).toBe('SUCESSO_INSERT');
    expect(res.resultados[2].status_final).toBe('SUCESSO_INSERT');
  });

  it('respeita rate-limit: intervalo entre chamadas ≥ intervaloMs', async () => {
    const timestamps: number[] = [];
    const disp = stubDispatcher(async () => { timestamps.push(Date.now()); return { data: { status: 'SUCESSO' }, error: null }; });
    const linhas: LinhaClassificada[] = [1, 2].map((i) => mkLinha({ linha_excel: i + 1, status_inicial: 'NOVO_VALIDO', codigo_canonico: `LYE${i}` }));
    await executarImportacaoV3({
      linhas, arquivoSha256: 'sha', arquivoNome: 'a.xlsx', intervaloMs: 50, dispatcher: disp,
    });
    expect(timestamps.length).toBe(2);
    expect(timestamps[1] - timestamps[0]).toBeGreaterThanOrEqual(45);
  });

  it('passa p_tentativa e p_execucao_anterior_id para reprocessamento', async () => {
    let ultimo: RpcArgs | null = null;
    const disp = stubDispatcher(async (_n, args) => { ultimo = args; return { data: { status: 'SUCESSO' }, error: null }; });
    await executarImportacaoV3({
      linhas: [mkLinha({ linha_excel: 2, status_inicial: 'NOVO_VALIDO', codigo_canonico: 'LYE9' })],
      arquivoSha256: 'sha', arquivoNome: 'a.xlsx', intervaloMs: 0, dispatcher: disp,
      tentativaBase: 3, execucaoAnteriorId: 'prev-42',
    });
    expect(ultimo?.p_tentativa).toBe(3);
    expect(ultimo?.p_execucao_anterior_id).toBe('prev-42');
  });
});
