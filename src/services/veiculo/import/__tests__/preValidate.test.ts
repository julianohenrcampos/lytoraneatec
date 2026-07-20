import { describe, it, expect } from 'vitest';
import { preValidate } from '../preValidate';
import { indexarBanco } from '../queryBanco';
import { splitCodigoAtivo } from '../splitCodigoAtivo';
import type { LinhaCanonica } from '../types';

function mkLinha(overrides: {
  codigo: string;
  linha_excel: number;
  item?: string | null;
  tipo?: string | null;
  empresa?: string | null;
}): LinhaCanonica {
  const s = splitCodigoAtivo(overrides.codigo);
  const item = overrides.item ?? '1';
  const itemInvalido = item === null || item === '#REF!' || !/^\d+$/.test(item);
  return {
    aba_origem: 'BASE ROMULO',
    linha_excel: overrides.linha_excel,
    item_origem_raw: item,
    item_origem_invalido: itemInvalido,
    codigo_ativo_original: s.original,
    obra_codigo: 'A107',
    obra_descricao: null,
    tipo_equipamento_raw: overrides.tipo === undefined ? 'ESCAVADEIRA' : overrides.tipo,
    contrato: null,
    fabricante_raw: null,
    modelo_raw: null,
    ano_fabricacao_raw: null,
    empresa_raw: overrides.empresa === undefined ? 'LYTORANEA' : overrides.empresa,
    com_operador: null,
    valor_raw: '1000',
    extras: {},
    numero_frota_prefixo: s.prefixo,
    numero_frota_numero: s.numero,
    numero_frota_canonico: s.canonico,
    regex_ok: s.ok,
  };
}

describe('preValidate — regras oficiais Rodada 1 (corrigidas)', () => {
  it('ITEM=#REF! + FROTA=LOC146 sem match → INSERIR + PENDENTE + alerta ITEM_ORIGEM_INVALIDO', () => {
    const { decisoes } = preValidate({ linhas: [mkLinha({ codigo: 'LOC146', linha_excel: 651, item: '#REF!' })], banco: indexarBanco([]) });
    expect(decisoes[0].alertas).toContain('ITEM_ORIGEM_INVALIDO');
    expect(decisoes[0].acao_base).toBe('INSERIR');
    expect(decisoes[0].status_validacao).toBe('PENDENTE');
  });

  it('tipo vazio → PENDENTE + SUBCATEGORIA_NAO_RESOLVIDA', () => {
    const { decisoes } = preValidate({ linhas: [mkLinha({ codigo: 'LYE197', linha_excel: 664, item: '#REF!', tipo: null })], banco: indexarBanco([]) });
    expect(decisoes[0].status_validacao).toBe('PENDENTE');
    expect(decisoes[0].motivos).toContain('SUBCATEGORIA_NAO_RESOLVIDA');
    expect(decisoes[0].alertas).toContain('TIPO_EQUIPAMENTO_VAZIO');
  });

  it('duplicidade canônica no banco → NAO_DETERMINADA + BLOQUEADA com todos os IDs', () => {
    const banco = indexarBanco([
      { id: 'a', frota_id_texto: 'LYE', numero_frota_texto: '246', numero_frota_canonico: 'LYE246' },
      { id: 'b', frota_id_texto: 'LYE', numero_frota_texto: '246', numero_frota_canonico: 'LYE246' },
    ]);
    const { decisoes } = preValidate({ linhas: [mkLinha({ codigo: 'LYE246', linha_excel: 100 })], banco });
    expect(decisoes[0].acao_base).toBe('NAO_DETERMINADA');
    expect(decisoes[0].status_validacao).toBe('BLOQUEADA');
    expect(decisoes[0].motivos).toContain('DUPLICIDADE_CANONICA_NO_BANCO');
    expect(decisoes[0].motivos).toContain('POSSIVEL_COLISAO_LEGADA');
    expect(decisoes[0].banco_match_ids).toEqual(['a', 'b']);
  });

  it('duplicidade canônica no arquivo → NAO_DETERMINADA + BLOQUEADA em todas as linhas', () => {
    const linhas = [
      mkLinha({ codigo: 'LYC10', linha_excel: 10 }),
      mkLinha({ codigo: 'LYC010', linha_excel: 20 }),
    ];
    const { decisoes, duplicidadesNoArquivo } = preValidate({ linhas, banco: indexarBanco([]) });
    expect(duplicidadesNoArquivo).toHaveLength(1);
    expect(duplicidadesNoArquivo[0].canonico).toBe('LYC10');
    expect(decisoes.every((d) => d.acao_base === 'NAO_DETERMINADA')).toBe(true);
    expect(decisoes.every((d) => d.status_validacao === 'BLOQUEADA')).toBe(true);
  });

  it('match único → REVISAR (Rodada 1 não emite ATUALIZAR) + origem FROTA_ID', () => {
    const banco = indexarBanco([
      { id: 'x', frota_id_texto: 'LYE', numero_frota_texto: '100', numero_frota_canonico: 'LYE100' },
    ]);
    const { decisoes } = preValidate({ linhas: [mkLinha({ codigo: 'LYE100', linha_excel: 50 })], banco });
    expect(decisoes[0].acao_base).toBe('REVISAR');
    expect(decisoes[0].origem_match).toBe('FROTA_ID');
    expect(decisoes[0].banco_match_id).toBe('x');
    expect(decisoes[0].frota_codigo_por_id).toBe('LYE100');
  });

  it('FROTA_INCONSISTENTE_NO_BANCO → NAO_DETERMINADA + BLOQUEADA', () => {
    const banco = indexarBanco([
      { id: 'y', frota_id_texto: 'LOK', numero_frota_texto: '100', numero_frota_canonico: 'LYE100' },
    ]);
    const { decisoes } = preValidate({ linhas: [mkLinha({ codigo: 'LYE100', linha_excel: 51 })], banco });
    expect(decisoes[0].motivos).toContain('FROTA_INCONSISTENTE_NO_BANCO');
    expect(decisoes[0].acao_base).toBe('NAO_DETERMINADA');
    expect(decisoes[0].status_validacao).toBe('BLOQUEADA');
    expect(decisoes[0].frota_codigo_por_id).toBe('LOK100');
    expect(decisoes[0].frota_texto_legado).toBe('LOK');
  });

  it('frota_id ausente no cadastro → alerta FROTA_ID_AUSENTE_NO_CADASTRO + REVISAR', () => {
    const banco = indexarBanco([
      { id: 'z', frota_id_texto: null, numero_frota_texto: 'LYE100', numero_frota_canonico: 'LYE100' },
    ]);
    const { decisoes } = preValidate({ linhas: [mkLinha({ codigo: 'LYE100', linha_excel: 52 })], banco });
    expect(decisoes[0].alertas).toContain('FROTA_ID_AUSENTE_NO_CADASTRO');
    expect(decisoes[0].acao_base).toBe('REVISAR');
  });
});
