/**
 * Testes do adapter de `convocados_pre` — Fase 1A.
 *
 * Cobertura:
 *  - Leitura de jsonb vazio/inválido sem quebrar.
 *  - Round-trip funcional: ler → gravar → ler novamente preserva a view.
 *  - Preservação de campos extras desconhecidos (garantia para PDFs/relatórios
 *    legados que possam depender de chaves não previstas no contrato).
 *  - Coerção segura de números vindos como string.
 *  - Índice por data cobre todo o período da solicitação semanal.
 *  - Mensagem de bloqueio é a constante padrão.
 */

import { describe, it, expect } from 'vitest';
import {
  lerConvocadosPre,
  gravarConvocadosPre,
  funcionarioAprovadoNaData,
  mensagemBloqueioParaData,
  derivarFuncionariosPlanos,
} from '@/lib/diarias/convocadosPreAdapter';
import { MENSAGEM_BLOQUEIO_APROVACAO_LOTE, type LotesDiariaView } from '@/types/diarias/lotes';

const PERIODO = { inicio: '2026-05-04', fim: '2026-05-10' };

const CONVOCADO_BASE = {
  funcionario_id: 'fid-1',
  funcao_id: 'func-1',
  nome_funcionario: 'MARCOS DINIZ LEITE',
  nome_funcao: 'OPERADOR DE PATROL',
  cpf: '123.456.789-00',
  matricula: '0001',
  valor_diaria: 200,
  valor_diaria_exclusiva: 250,
  valor_refeicao: 36,
};

describe('convocadosPreAdapter — leitura', () => {
  it('aceita null/undefined sem lançar e devolve view com lote legado vazio cobrindo o período', () => {
    const view = lerConvocadosPre(null, PERIODO);
    expect(view.lotes).toHaveLength(1);
    expect(view.lotes[0].origem).toBe('legado');
    expect(view.lotes[0].funcionarios).toEqual([]);
    expect(view.lotes[0].datas).toHaveLength(7);
    expect(view.lotes[0].datas[0]).toBe('2026-05-04');
    expect(view.lotes[0].datas[6]).toBe('2026-05-10');
    expect(view.periodo).toEqual(PERIODO);
  });

  it('aceita objeto não-array sem quebrar (devolve lote vazio)', () => {
    const view = lerConvocadosPre({ qualquer: 'coisa' }, PERIODO);
    expect(view.lotes[0].funcionarios).toEqual([]);
  });

  it('lê 1 funcionário e popula índice por data', () => {
    const view = lerConvocadosPre([CONVOCADO_BASE], PERIODO);
    expect(view.lotes[0].funcionarios).toHaveLength(1);
    expect(view.lotes[0].funcionarios[0].funcionario_id).toBe('fid-1');
    expect(view.funcionariosPorData.get('2026-05-09')).toHaveLength(1);
    expect(view.funcionariosPorData.get('2026-05-09')?.[0].funcionario_id).toBe('fid-1');
  });

  it('coerge números vindos como string e trata valor_diaria_exclusiva ausente', () => {
    const view = lerConvocadosPre(
      [
        {
          funcionario_id: 'fid-2',
          funcao_id: 'func-2',
          nome_funcionario: 'X',
          nome_funcao: 'Y',
          valor_diaria: '150',
          valor_refeicao: '28',
          // valor_diaria_exclusiva ausente
        },
      ],
      PERIODO,
    );
    const f = view.lotes[0].funcionarios[0];
    expect(f.valor_diaria).toBe(150);
    expect(f.valor_refeicao).toBe(28);
    expect(f.valor_diaria_exclusiva).toBeNull();
    expect(f.cpf).toBeNull();
    expect(f.matricula).toBeNull();
  });

  it('descarta itens sem funcionario_id ou funcao_id sem derrubar a leitura inteira', () => {
    const view = lerConvocadosPre(
      [
        CONVOCADO_BASE,
        { funcionario_id: '', funcao_id: 'x' },
        { funcionario_id: 'y', funcao_id: '' },
        'string-invalida',
        null,
      ],
      PERIODO,
    );
    expect(view.lotes[0].funcionarios).toHaveLength(1);
    expect(view.lotes[0].funcionarios[0].funcionario_id).toBe('fid-1');
  });

  it('preserva campos extras desconhecidos (snapshot/PDF legado)', () => {
    const raw = [
      {
        ...CONVOCADO_BASE,
        // campos não previstos no contrato — devem ser preservados
        observacao_legada: 'OBS LIVRE',
        codigo_externo: 42,
        flags: { ferias: false, sso: true },
      },
    ];
    const view = lerConvocadosPre(raw, PERIODO);
    const f = view.lotes[0].funcionarios[0];
    expect(f.extras).toBeDefined();
    expect(f.extras?.observacao_legada).toBe('OBS LIVRE');
    expect(f.extras?.codigo_externo).toBe(42);
    expect(f.extras?.flags).toEqual({ ferias: false, sso: true });
  });
});

describe('convocadosPreAdapter — gravação e round-trip', () => {
  it('round-trip funcional preserva a view (lendo o output da gravação)', () => {
    const view1 = lerConvocadosPre([CONVOCADO_BASE], PERIODO);
    const jsonb = gravarConvocadosPre(view1);
    const view2 = lerConvocadosPre(jsonb, PERIODO);

    expect(view2.lotes[0].funcionarios).toEqual(view1.lotes[0].funcionarios);
    expect(view2.funcionariosPorData.get('2026-05-09')).toEqual(
      view1.funcionariosPorData.get('2026-05-09'),
    );
  });

  it('round-trip preserva campos extras desconhecidos', () => {
    const raw = [
      {
        ...CONVOCADO_BASE,
        observacao_legada: 'OBS LIVRE',
        codigo_externo: 42,
      },
    ];
    const view1 = lerConvocadosPre(raw, PERIODO);
    const jsonb = gravarConvocadosPre(view1) as Array<Record<string, unknown>>;

    expect(jsonb[0].observacao_legada).toBe('OBS LIVRE');
    expect(jsonb[0].codigo_externo).toBe(42);

    const view2 = lerConvocadosPre(jsonb, PERIODO);
    expect(view2.lotes[0].funcionarios[0].extras).toEqual({
      observacao_legada: 'OBS LIVRE',
      codigo_externo: 42,
    });
  });

  it('gravação achata múltiplos lotes deduplicando por funcionario_id', () => {
    const view1 = lerConvocadosPre([CONVOCADO_BASE], PERIODO);
    // Simula múltiplos lotes apontando para o mesmo funcionário
    const view = {
      ...view1,
      lotes: [view1.lotes[0], view1.lotes[0]],
    };
    const jsonb = gravarConvocadosPre(view) as unknown[];
    expect(jsonb).toHaveLength(1);
  });

  it('gravação devolve null/[] coerentes para view vazia', () => {
    const view = lerConvocadosPre([], PERIODO);
    const jsonb = gravarConvocadosPre(view);
    expect(Array.isArray(jsonb)).toBe(true);
    expect((jsonb as unknown[]).length).toBe(0);
  });
});

describe('convocadosPreAdapter — utilidades', () => {
  it('funcionarioAprovadoNaData true para qualquer data do período no lote legado', () => {
    const view = lerConvocadosPre([CONVOCADO_BASE], PERIODO);
    expect(funcionarioAprovadoNaData(view, 'fid-1', '2026-05-04')).toBe(true);
    expect(funcionarioAprovadoNaData(view, 'fid-1', '2026-05-10')).toBe(true);
    expect(funcionarioAprovadoNaData(view, 'fid-1', '2026-05-09')).toBe(true);
  });

  it('funcionarioAprovadoNaData false para data fora do período ou funcionário não convocado', () => {
    const view = lerConvocadosPre([CONVOCADO_BASE], PERIODO);
    expect(funcionarioAprovadoNaData(view, 'fid-1', '2026-05-11')).toBe(false);
    expect(funcionarioAprovadoNaData(view, 'fid-2', '2026-05-09')).toBe(false);
  });

  it('mensagemBloqueioParaData retorna a constante padrão', () => {
    expect(mensagemBloqueioParaData('fid-1', '2026-05-09')).toBe(
      MENSAGEM_BLOQUEIO_APROVACAO_LOTE,
    );
  });

  describe('derivarFuncionariosPlanos', () => {
    it('retorna lista vazia quando não há lotes', () => {
      const view: LotesDiariaView = {
        lotes: [],
        funcionariosPorData: new Map(),
        periodo: PERIODO,
      };
      expect(derivarFuncionariosPlanos(view)).toEqual([]);
    });

    it('preserva contagem equivalente ao array legado', () => {
      const raw = [
        CONVOCADO_BASE,
        { ...CONVOCADO_BASE, funcionario_id: 'fid-2', funcao_id: 'func-2' },
      ];
      const view = lerConvocadosPre(raw, PERIODO);
      expect(derivarFuncionariosPlanos(view).length).toBe(raw.length);
    });

    it('deduplica por funcionario_id entre múltiplos lotes', () => {
      const view = lerConvocadosPre([CONVOCADO_BASE], PERIODO);
      const extraLote = {
        id: 'lote-extra',
        datas: ['2026-05-09'],
        origem: 'explicito' as const,
        funcionarios: [
          { ...CONVOCADO_BASE },
          { ...CONVOCADO_BASE, funcionario_id: 'fid-3', funcao_id: 'func-3' },
        ],
      };
      const viewMulti: LotesDiariaView = {
        ...view,
        lotes: [...view.lotes, extraLote],
      };
      const planos = derivarFuncionariosPlanos(viewMulti);
      expect(planos.map((c) => c.funcionario_id)).toEqual(['fid-1', 'fid-3']);
    });
  });
});
