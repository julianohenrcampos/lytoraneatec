import { describe, it, expect } from 'vitest';
import { preValidate } from '../preValidate';
import { indexarBanco } from '../queryBanco';
import { splitCodigoAtivo } from '../splitCodigoAtivo';
import type { LinhaCanonica } from '../types';

function mkLinha(codigo: string, linha_excel = 10): LinhaCanonica {
  const s = splitCodigoAtivo(codigo);
  return {
    aba_origem: 'BASE ROMULO',
    linha_excel,
    item_origem_raw: '1',
    item_origem_invalido: false,
    codigo_ativo_original: s.original,
    obra_codigo: 'A107',
    obra_descricao: null,
    tipo_equipamento_raw: 'ESCAVADEIRA',
    contrato: null,
    fabricante_raw: null,
    modelo_raw: null,
    ano_fabricacao_raw: null,
    empresa_raw: 'LYTORANEA',
    com_operador: null,
    valor_raw: '1000',
    extras: {},
    numero_frota_prefixo: s.prefixo,
    numero_frota_numero: s.numero,
    numero_frota_canonico: s.canonico,
    regex_ok: s.ok,
  };
}

describe('preValidate — FROTA_NAO_RESOLVIDA depende de bd_frotas', () => {
  it('prefixo válido em bd_frotas + sem match do ativo → INSERIR + ATIVO_NAO_ENCONTRADO_NO_BANCO (sem FROTA_NAO_RESOLVIDA)', () => {
    const { decisoes } = preValidate({
      linhas: [mkLinha('LOC146')],
      banco: indexarBanco([]),
      frotasPorPrefixo: new Set(['LOC', 'LOK', 'LYC', 'LYE', 'LYU']),
    });
    expect(decisoes[0].acao_base).toBe('INSERIR');
    expect(decisoes[0].motivos).toContain('ATIVO_NAO_ENCONTRADO_NO_BANCO');
    expect(decisoes[0].motivos).not.toContain('FROTA_NAO_RESOLVIDA');
  });

  it('prefixo ausente em bd_frotas → FROTA_NAO_RESOLVIDA', () => {
    const { decisoes } = preValidate({
      linhas: [mkLinha('ZZZ999')],
      banco: indexarBanco([]),
      frotasPorPrefixo: new Set(['LOC', 'LYE']),
    });
    expect(decisoes[0].motivos).toContain('FROTA_NAO_RESOLVIDA');
    expect(decisoes[0].motivos).not.toContain('ATIVO_NAO_ENCONTRADO_NO_BANCO');
  });

  it('LYE246 duplicado no banco → NAO_DETERMINADA + BLOQUEADA com 2 ids', () => {
    const banco = indexarBanco([
      { id: 'a', frota_id_texto: 'LYE', numero_frota_texto: '246', numero_frota_canonico: 'LYE246' },
      { id: 'b', frota_id_texto: 'LYE', numero_frota_texto: '246', numero_frota_canonico: 'LYE246' },
    ]);
    const { decisoes } = preValidate({
      linhas: [mkLinha('LYE246')],
      banco,
      frotasPorPrefixo: new Set(['LYE']),
    });
    expect(decisoes[0].acao_base).toBe('NAO_DETERMINADA');
    expect(decisoes[0].status_validacao).toBe('BLOQUEADA');
    expect(decisoes[0].banco_match_ids).toEqual(['a', 'b']);
  });
});
