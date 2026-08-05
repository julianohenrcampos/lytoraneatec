import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
const invoke = vi.fn();
const from = vi.fn();
const getSession = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    from: (...args: unknown[]) => from(...args),
    functions: { invoke: (...args: unknown[]) => invoke(...args) },
    auth: { getSession: () => getSession() },
  },
}));

import {
  atualizarRascunho,
  criarPop,
  descartarRascunho,
  enviarArquivoRascunho,
  iniciarRevisao,
  popsModuloDisponivel,
  publicarRascunho,
  reativarPop,
  tornarObsoleto,
} from '@/services/popsService';

beforeEach(() => {
  rpc.mockReset();
  invoke.mockReset();
  from.mockReset();
  getSession.mockReset();
});

describe('POPs — gate de homologação', () => {
  it('libera somente quando a RPC retorna true', async () => {
    rpc.mockResolvedValueOnce({ data: true, error: null });
    await expect(popsModuloDisponivel()).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith('fn_pop_gate_homologacao');
  });

  it('é fail-closed em erro ou retorno não-true', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'denied' } });
    await expect(popsModuloDisponivel()).resolves.toBe(false);
    rpc.mockResolvedValueOnce({ data: false, error: null });
    await expect(popsModuloDisponivel()).resolves.toBe(false);
  });
});

describe('POPs — mutações passam exclusivamente por RPC', () => {
  it('criarPop chama fn_pop_criar', async () => {
    rpc.mockResolvedValueOnce({ data: 'pop-1', error: null });
    await expect(
      criarPop({ codigo: 'POP-1', titulo: 'T', setor_id: 'setor-1' }),
    ).resolves.toBe('pop-1');
    expect(rpc).toHaveBeenCalledWith('fn_pop_criar', expect.objectContaining({
      p_codigo: 'POP-1',
      p_titulo: 'T',
      p_setor_id: 'setor-1',
    }));
    expect(from).not.toHaveBeenCalled();
  });

  it('iniciarRevisao repassa o tipo de incremento', async () => {
    rpc.mockResolvedValueOnce({ data: 'rasc-1', error: null });
    await iniciarRevisao({ pop_id: 'pop-1', tipo_incremento: 'major', motivo: 'reestruturação' });
    expect(rpc).toHaveBeenCalledWith('fn_pop_iniciar_revisao', expect.objectContaining({
      p_pop_id: 'pop-1',
      p_tipo_incremento: 'major',
      p_motivo: 'reestruturação',
    }));
  });

  it('atualizarRascunho omite campos não informados', async () => {
    rpc.mockResolvedValueOnce({ data: 'rasc-1', error: null });
    await atualizarRascunho({ pop_id: 'pop-1', titulo: 'Novo' });
    const args = rpc.mock.calls[0][1] as Record<string, unknown>;
    expect(args.p_titulo).toBe('Novo');
    expect(args.p_codigo).toBeUndefined();
  });

  it('publicarRascunho propaga erro do banco (ex.: sem PDF)', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'POP_ARQUIVO_OBRIGATORIO' } });
    await expect(publicarRascunho('pop-1')).rejects.toMatchObject({
      message: 'POP_ARQUIVO_OBRIGATORIO',
    });
  });

  it('tornarObsoleto e reativarPop usam as RPCs de aprovação', async () => {
    rpc.mockResolvedValueOnce({ data: 'pop-1', error: null });
    await tornarObsoleto('pop-1', 'substituído');
    expect(rpc).toHaveBeenLastCalledWith('fn_pop_tornar_obsoleto', {
      p_pop_id: 'pop-1',
      p_motivo: 'substituído',
    });

    rpc.mockResolvedValueOnce({ data: 'pop-1', error: null });
    await reativarPop('pop-1');
    expect(rpc).toHaveBeenLastCalledWith('fn_pop_reativar', { p_pop_id: 'pop-1' });
  });
});

describe('POPs — arquivo via Edge Function', () => {
  const makeFile = (name: string, size: number, type: string) =>
    ({ name, size, type }) as unknown as File;

  it('bloqueia arquivo inválido antes de qualquer chamada de rede', async () => {
    await expect(
      enviarArquivoRascunho('pop-1', makeFile('pop.txt', 10, 'text/plain')),
    ).rejects.toThrow(/PDF/i);
    expect(invoke).not.toHaveBeenCalled();
  });

  it('envia multipart para pop-upload-arquivo', async () => {
    invoke.mockResolvedValueOnce({
      data: { ok: true, arquivo_path: 'pop-1/abc.pdf', arquivo_sha256: 'abc' },
      error: null,
    });
    const res = await enviarArquivoRascunho(
      'pop-1',
      makeFile('pop.pdf', 2048, 'application/pdf'),
    );
    expect(invoke).toHaveBeenCalledWith('pop-upload-arquivo', expect.anything());
    expect(res).toEqual({ arquivo_path: 'pop-1/abc.pdf', arquivo_sha256: 'abc' });
  });

  it('descarte usa a Edge dedicada e propaga falha', async () => {
    invoke.mockResolvedValueOnce({ data: { ok: true, arquivo_path_removido: 'p/x.pdf' }, error: null });
    await descartarRascunho('pop-1', 'erro de conteúdo');
    expect(invoke).toHaveBeenCalledWith('pop-descartar-rascunho', {
      body: { pop_id: 'pop-1', motivo: 'erro de conteúdo' },
    });

    invoke.mockResolvedValueOnce({ data: { error: 'POP_SEM_RASCUNHO' }, error: null });
    await expect(descartarRascunho('pop-1', 'x')).rejects.toThrow('POP_SEM_RASCUNHO');
  });
});
