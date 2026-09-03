// PR-3.2 — Hook: retomada por SHA-256 (sucesso/falha), CONFLITO terminal e isolamento por arquivo.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// -------- Mocks --------
const rpcMock = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: (...a: unknown[]) => rpcMock(...a) },
}));

vi.mock('../parseWorkbookV3', () => ({
  parseWorkbookV3: vi.fn(() => ({
    schema_version: '3.0.0', metadados: {},
    linhas: [
      { linha_excel: 2, raw: {}, parsed: { acao: 'INSERIR', codigo_ativo_canonico: 'LYE001', frota_codigo: 'LYE', numero_frota: '1', centro_custo_codigo: '', subcategoria_nome: '' } },
      { linha_excel: 3, raw: {}, parsed: { acao: 'INSERIR', codigo_ativo_canonico: 'LYE002', frota_codigo: 'LYE', numero_frota: '2', centro_custo_codigo: '', subcategoria_nome: '' } },
      { linha_excel: 4, raw: {}, parsed: { acao: 'INSERIR', codigo_ativo_canonico: 'LYE003', frota_codigo: 'LYE', numero_frota: '3', centro_custo_codigo: '', subcategoria_nome: '' } },
    ],
    linhas_invalidas: [], linhas_bloqueadas: [],
  })),
}));

const shaSeq: string[] = [];
vi.mock('../sha256', () => ({
  calcularSha256: vi.fn(async () => shaSeq.shift() ?? 'SHA_DEFAULT'),
}));

vi.mock('../classificarLinhas', async (orig) => {
  const real = await orig<typeof import('../classificarLinhas')>();
  return {
    ...real,
    classificarLinhas: vi.fn((_sha: string, parsed: { linhas: unknown[] }) => {
      const linhas = (parsed.linhas as Array<{ linha_excel: number; parsed: { codigo_ativo_canonico: string } }>).map((p) => ({
        chave: `k::${p.linha_excel}`, linha_excel: p.linha_excel,
        codigo_canonico: p.parsed.codigo_ativo_canonico,
        codigo_exibicao: p.parsed.codigo_ativo_canonico,
        frota_codigo: 'LYE', numero_frota: String(p.linha_excel), centro_custo_codigo: '',
        subcategoria_nome: '', acao_arquivo: 'INSERIR', status_inicial: 'NOVO_VALIDO',
        campos_atualizar: '', mensagem: '', parsed: p.parsed, raw: {},
      }));
      const resumo = { total: linhas.length, novos_validos: linhas.length, updates_validos: 0, sem_alteracao: 0, bloqueados: 0, erros: 0 };
      return { linhas, resumo };
    }),
  };
});

const executorMock = vi.fn();
vi.mock('../executarImportacaoV3', () => ({
  executarImportacaoV3: (...a: unknown[]) => executorMock(...a),
}));

// -------- Import após mocks --------
import { useEquipamentosImportV3 } from '@/hooks/vehicles/useEquipamentosImportV3';

function fakeFile(name = 'a.xlsx') {
  return new File([new Uint8Array([0x50, 0x4b])], name, { type: 'application/vnd.openxmlformats' });
}

beforeEach(() => {
  rpcMock.mockReset(); executorMock.mockReset(); shaSeq.length = 0;
});

describe('Hook V3 — Retomada SHA-256 e CONFLITO terminal', () => {
  it('sucesso na retomada: linhas já processadas voltam como JA_PROCESSADO e não são reenviadas', async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        { linha_excel: 2, codigo_ativo_canonico: 'LYE001', status: 'SUCESSO', codigo_resultado: 'INSERIDO', equipamento_id: 'e1', execution_id: 'x1', numero_tentativas: 1, mensagem: null },
      ],
      error: null,
    });
    shaSeq.push('SHA_A');
    const { result } = renderHook(() => useEquipamentosImportV3());
    await act(async () => { await result.current.carregarArquivo(fakeFile()); });
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    expect(result.current.state.retomadaAplicada).toBe(1);
    expect(result.current.state.retomadaFalhou).toBe(false);
    // Chave da linha 2 já não deve estar selecionada.
    expect(result.current.state.selecionados.has('k::2')).toBe(false);
    expect(result.current.state.selecionados.has('k::3')).toBe(true);
  });

  it('falha na consulta de histórico bloqueia escrita (gate)', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    shaSeq.push('SHA_B');
    const { result } = renderHook(() => useEquipamentosImportV3());
    await act(async () => { await result.current.carregarArquivo(fakeFile()); });
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    expect(result.current.state.retomadaFalhou).toBe(true);
    expect(result.current.state.retomadaAviso).toMatch(/histórico/i);
    // Tentativa de processar não chama o executor.
    await act(async () => { await result.current.processar(); });
    expect(executorMock).not.toHaveBeenCalled();
    // Após confirmar prosseguir, escrita é liberada.
    act(() => { result.current.confirmarProsseguirSemRetomada(); });
    expect(result.current.state.retomadaFalhou).toBe(false);
  });

  it('CONFLITO é terminal: reprocessarErros não reenvia linhas em CONFLITO', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });
    shaSeq.push('SHA_C');
    const { result } = renderHook(() => useEquipamentosImportV3());
    await act(async () => { await result.current.carregarArquivo(fakeFile()); });
    await waitFor(() => expect(result.current.state.status).toBe('ready'));

    // Rodada 1: [SUCESSO, ERRO transitório, CONFLITO]
    executorMock.mockResolvedValueOnce({
      execution_id: 'exec-1',
      resultados: [
        { chave: 'k::2', linha_excel: 2, codigo_canonico: 'LYE001', codigo_exibicao: 'LYE001', acao_arquivo: 'INSERIR', status_final: 'SUCESSO_INSERT', codigo_resultado: 'INSERIDO', mensagem: null, equipamento_id: 'e1', execution_id: 'exec-1', tentativa: 1, timestamp_iso: '', payload_enviado: null },
        { chave: 'k::3', linha_excel: 3, codigo_canonico: 'LYE002', codigo_exibicao: 'LYE002', acao_arquivo: 'INSERIR', status_final: 'ERRO', codigo_resultado: 'NETWORK_ERROR', mensagem: 'timeout', equipamento_id: null, execution_id: 'exec-1', tentativa: 1, timestamp_iso: '', payload_enviado: null },
        { chave: 'k::4', linha_excel: 4, codigo_canonico: 'LYE003', codigo_exibicao: 'LYE003', acao_arquivo: 'INSERIR', status_final: 'CONFLITO', codigo_resultado: 'CONFLITO_DADO_ATUAL_DESATUALIZADO', mensagem: 'x', equipamento_id: null, execution_id: 'exec-1', tentativa: 1, timestamp_iso: '', payload_enviado: null },
      ],
    });
    await act(async () => { await result.current.processar(); });

    // Rodada 2: reprocessarErros deve chamar executor apenas com k::3.
    executorMock.mockImplementationOnce(async (args: { linhas: Array<{ chave: string }>; tentativaBase?: number; execucaoAnteriorId?: string | null }) => {
      expect(args.linhas.map((l) => l.chave)).toEqual(['k::3']);
      expect(args.tentativaBase).toBe(2);
      expect(args.execucaoAnteriorId).toBe('exec-1');
      return { execution_id: 'exec-2', resultados: [
        { chave: 'k::3', linha_excel: 3, codigo_canonico: 'LYE002', codigo_exibicao: 'LYE002', acao_arquivo: 'INSERIR', status_final: 'SUCESSO_INSERT', codigo_resultado: 'INSERIDO', mensagem: null, equipamento_id: 'e2', execution_id: 'exec-2', tentativa: 2, timestamp_iso: '', payload_enviado: null },
      ] };
    });
    await act(async () => { await result.current.reprocessarErros(); });
    expect(executorMock).toHaveBeenCalledTimes(2);
  });

  it('isolamento por arquivo: reset limpa resultados e SHA antes do próximo carregamento', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });
    shaSeq.push('SHA_D1', 'SHA_D2');
    const { result } = renderHook(() => useEquipamentosImportV3());
    await act(async () => { await result.current.carregarArquivo(fakeFile('a.xlsx')); });
    await waitFor(() => expect(result.current.state.arquivoSha256).toBe('SHA_D1'));
    act(() => { result.current.reset(); });
    expect(result.current.state.arquivoSha256).toBe('');
    expect(result.current.state.resultadosAcumulados).toEqual([]);
    await act(async () => { await result.current.carregarArquivo(fakeFile('b.xlsx')); });
    await waitFor(() => expect(result.current.state.arquivoSha256).toBe('SHA_D2'));
  });
});
