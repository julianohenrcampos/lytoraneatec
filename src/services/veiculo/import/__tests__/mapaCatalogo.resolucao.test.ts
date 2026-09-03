import { describe, it, expect } from 'vitest';
import { construirMapaCatalogo } from '../mapaCatalogo';
import type { DecisaoLinha, LinhaCanonica } from '../types';
import type { CatalogosBanco, CatalogoRef } from '../queryBanco';
import { normalizar } from '../normalizarValorCatalogo';

function mkRef(id: string, nome: string): CatalogoRef {
  return { id, nome, nomeNormalizado: normalizar(nome) };
}

function mkDec(overrides: Partial<LinhaCanonica>): DecisaoLinha {
  const linha: LinhaCanonica = {
    aba_origem: 'BASE ROMULO',
    linha_excel: 10,
    item_origem_raw: '1',
    item_origem_invalido: false,
    codigo_ativo_original: 'LYE1',
    obra_codigo: null,
    obra_descricao: null,
    tipo_equipamento_raw: null,
    contrato: null,
    fabricante_raw: null,
    modelo_raw: null,
    ano_fabricacao_raw: null,
    empresa_raw: null,
    com_operador: null,
    valor_raw: null,
    extras: {},
    numero_frota_prefixo: 'LYE',
    numero_frota_numero: '1',
    numero_frota_canonico: 'LYE1',
    regex_ok: true,
    ...overrides,
  };
  return {
    linha,
    acao_base: 'INSERIR',
    status_validacao: 'PENDENTE',
    motivos: [],
    alertas: [],
    origem_match: 'SEM_MATCH',
    banco_match_id: null,
    banco_match_ids: [],
    banco_frota_id_texto: null,
    banco_numero_frota_texto: null,
    frota_codigo_por_id: null,
    frota_texto_legado: null,
  };
}

const catalogosBase: CatalogosBanco = {
  fabricantes: [mkRef('f1', 'CATERPILLAR')],
  modelos: [mkRef('m1', 'CAT 320D')],
  subcategorias: [
    mkRef('s1', 'RETROESCAVADEIRA'),
    mkRef('s2', 'CAMINHÃO PIPA'),
    mkRef('s3', 'BRITADOR / PENEIRA'),
  ],
  empresas: [
    mkRef('e1', 'TERRAPLAN'),
    mkRef('e2', 'CONSTRUTORA LYTORANEA SA'),
    mkRef('e3', 'CONSTRUTORA ABRA INFRAESTRUTURA LTDA'),
    mkRef('e4', 'FABIANO DO NASCIMENTO NEGRÃO'),
  ],
  locadoras: [],
  centrosCusto: [mkRef('cc1', 'A107')],
  departamentos: [],
};

describe('mapaCatalogo — resolução por coluna real', () => {
  it('RETROESCAVADEIRA resolve exato por nome_subcategoria', () => {
    const dec = [mkDec({ tipo_equipamento_raw: 'Retroescavadeira' })];
    const mapa = construirMapaCatalogo(dec, catalogosBase);
    const linha = mapa.find((m) => m.catalogo_tipo === 'SUBCATEGORIA' && m.valor_normalizado === 'RETROESCAVADEIRA');
    expect(linha?.match_tipo).toBe('EXATO');
    expect(linha?.cadastro_destino_id).toBe('s1');
  });

  it('CAMINHÃO PIPA resolve exato mesmo com acento', () => {
    const dec = [mkDec({ tipo_equipamento_raw: 'CAMINHAO PIPA' })];
    const mapa = construirMapaCatalogo(dec, catalogosBase);
    const linha = mapa.find((m) => m.catalogo_tipo === 'SUBCATEGORIA' && m.valor_normalizado === 'CAMINHAO PIPA');
    expect(linha?.match_tipo).toBe('EXATO');
    expect(linha?.cadastro_destino_id).toBe('s2');
  });

  it('BRITADOR / PENEIRA resolve exato normalizando pontuação', () => {
    const dec = [mkDec({ tipo_equipamento_raw: 'BRITADOR/PENEIRA' })];
    const mapa = construirMapaCatalogo(dec, catalogosBase);
    const linha = mapa.find((m) => m.catalogo_tipo === 'SUBCATEGORIA' && m.valor_normalizado === 'BRITADOR PENEIRA');
    expect(linha?.match_tipo).toBe('EXATO');
    expect(linha?.cadastro_destino_id).toBe('s3');
  });

  it('TERRAPLAN resolve exato por nome_empresa', () => {
    const dec = [mkDec({ empresa_raw: 'Terraplan' })];
    const mapa = construirMapaCatalogo(dec, catalogosBase);
    const linha = mapa.find((m) => m.catalogo_tipo === 'PROPRIETARIO_EMPRESA' && m.valor_normalizado === 'TERRAPLAN');
    expect(linha?.match_tipo).toBe('EXATO');
    expect(linha?.cadastro_destino_id).toBe('e1');
  });

  it('FABIANO DO NASCIMENTO NEGRÃO resolve exato', () => {
    const dec = [mkDec({ empresa_raw: 'FABIANO DO NASCIMENTO NEGRAO' })];
    const mapa = construirMapaCatalogo(dec, catalogosBase);
    const linha = mapa.find((m) => m.valor_normalizado === 'FABIANO DO NASCIMENTO NEGRAO');
    expect(linha?.match_tipo).toBe('EXATO');
    expect(linha?.cadastro_destino_id).toBe('e4');
  });

  it('ABRA INFRAESTRUTURA vira ALIAS_SUGERIDO (não vincula automaticamente)', () => {
    const dec = [mkDec({ empresa_raw: 'ABRA INFRAESTRUTURA' })];
    const mapa = construirMapaCatalogo(dec, catalogosBase);
    const linha = mapa.find((m) => m.valor_normalizado === 'ABRA INFRAESTRUTURA');
    expect(linha?.match_tipo).toBe('ALIAS_SUGERIDO');
    expect(linha?.cadastro_destino_id).toBeNull();
    expect(linha?.candidatos_ids).toContain('e3');
  });

  it('placeholder "-" e "NÃO ENCONTRADO" não geram cadastro em MAPA_CATALOGO', () => {
    const dec = [
      mkDec({ empresa_raw: '-' }),
      mkDec({ empresa_raw: 'NÃO ENCONTRADO' }),
    ];
    const mapa = construirMapaCatalogo(dec, catalogosBase);
    const cadastros = mapa.filter(
      (m) => m.catalogo_tipo === 'PROPRIETARIO_EMPRESA' && m.match_tipo !== 'PLACEHOLDER' && m.status_resolucao !== 'SEM_OCORRENCIA',
    );
    expect(cadastros).toHaveLength(0);
    const placeholder = mapa.find(
      (m) => m.catalogo_tipo === 'PROPRIETARIO_EMPRESA' && m.match_tipo === 'PLACEHOLDER',
    );
    expect(placeholder?.ocorrencias).toBe(2);
  });
});
