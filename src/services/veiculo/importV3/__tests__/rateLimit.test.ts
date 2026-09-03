// PR-3.1 — Rate limit por timestamps: ≤5 chamadas/s, intervalo efetivo ≈200 ms.
import { describe, it, expect, vi } from 'vitest';
import { executarImportacaoV3, type RpcDispatcher } from '../executarImportacaoV3';
import type { LinhaClassificada } from '../classificarLinhas';

function mkLinha(i: number): LinhaClassificada {
  return {
    chave: `sha::${i + 2}::LYE${i}`, linha_excel: i + 2,
    codigo_canonico: `LYE${String(i).padStart(3, '0')}`,
    codigo_exibicao: `LYE${String(i).padStart(3, '0')}`,
    frota_codigo: 'LYE', numero_frota: String(i),
    centro_custo_codigo: '', subcategoria_nome: '',
    acao_arquivo: 'INSERIR', status_inicial: 'NOVO_VALIDO',
    campos_atualizar: '', mensagem: '',
    parsed: { acao: 'INSERIR', codigo_canonico: `LYE${i}` } as never, raw: {},
  };
}

describe('executarImportacaoV3 — rate limit (5 chamadas/s, ~200 ms)', () => {
  it('intervalo entre chamadas ≥ 200 ms e nenhuma rajada acima de 5/seg', async () => {
    const timestamps: number[] = [];
    const disp: RpcDispatcher = {
      abrirExecucao: vi.fn(async () => 'exec-rate'),
      encerrarExecucao: vi.fn(async () => {}),
      chamar: vi.fn(async () => {
        timestamps.push(Date.now());
        return { data: { status: 'SUCESSO' }, error: null };
      }),
    };
    const N = 8; // suficiente para observar 2+ segundos
    const linhas = Array.from({ length: N }, (_, i) => mkLinha(i));

    await executarImportacaoV3({
      linhas, arquivoSha256: 'sha-rate', arquivoNome: 'rl.xlsx',
      batchSize: 25, intervaloMs: 200, dispatcher: disp,
    });

    expect(timestamps.length).toBe(N);

    // Intervalos consecutivos ≥ ~200 ms (tolerância 10 ms).
    for (let i = 1; i < timestamps.length; i += 1) {
      const delta = timestamps[i] - timestamps[i - 1];
      expect(delta).toBeGreaterThanOrEqual(190);
    }

    // Nenhuma janela de 1 s contém mais de 5 chamadas.
    let maxJanela = 0;
    for (let i = 0; i < timestamps.length; i += 1) {
      let c = 0;
      for (let j = i; j < timestamps.length && timestamps[j] - timestamps[i] < 1000; j += 1) c += 1;
      maxJanela = Math.max(maxJanela, c);
    }
    expect(maxJanela).toBeLessThanOrEqual(5);
  }, 10_000);
});
