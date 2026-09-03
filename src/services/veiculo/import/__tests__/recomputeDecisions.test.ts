import { describe, it, expect } from 'vitest';
import { recomputeDecisions } from '../recomputeDecisions';
import { construirMapaCatalogo } from '../mapaCatalogo';
import type { DecisaoLinha, LinhaCanonica, BancoFrotaProjecao } from '../types';
import type { CatalogosBanco, CatalogoRef } from '../queryBanco';
import type { DecisaoUsuarioCatalogoItem } from '../tiposResolucao';
import { chaveDecisaoUsuario } from '../tiposResolucao';
import { normalizar } from '../normalizarValorCatalogo';

function mkRef(id: string, nome: string): CatalogoRef {
  return { id, nome, nomeNormalizado: normalizar(nome) };
}

const CATALOGOS: CatalogosBanco = {
  fabricantes: [mkRef('f1', 'CATERPILLAR')],
  modelos: [mkRef('m1', 'CAT 320D')],
  subcategorias: [mkRef('s1', 'RETROESCAVADEIRA')],
  empresas: [mkRef('e1', 'TERRAPLAN'), mkRef('e3', 'CONSTRUTORA ABRA INFRAESTRUTURA LTDA')],
  locadoras: [],
  centrosCusto: [mkRef('cc1', 'A107')],
  departamentos: [],
};

function mkLinha(over: Partial<LinhaCanonica> = {}): LinhaCanonica {
  return {
    aba_origem: 'BASE ROMULO',
    linha_excel: 10,
    item_origem_raw: '1',
    item_origem_invalido: false,
    codigo_ativo_original: 'LYE001',
    obra_codigo: 'A107',
    obra_descricao: null,
    tipo_equipamento_raw: 'RETROESCAVADEIRA',
    contrato: null,
    fabricante_raw: 'CATERPILLAR',
    modelo_raw: 'CAT 320D',
    ano_fabricacao_raw: null,
    empresa_raw: 'TERRAPLAN',
    com_operador: null,
    valor_raw: '1000',
    extras: {},
    numero_frota_prefixo: 'LYE',
    numero_frota_numero: '1',
    numero_frota_canonico: 'LYE1',
    regex_ok: true,
    ...over,
  };
}

function mkDec(acao: DecisaoLinha['acao_base'], over: Partial<LinhaCanonica> = {}, extra: Partial<DecisaoLinha> = {}): DecisaoLinha {
  return {
    linha: mkLinha(over),
    acao_base: acao,
    status_validacao: acao === 'NAO_DETERMINADA' ? 'BLOQUEADA' : 'PENDENTE',
    motivos: [],
    alertas: [],
    origem_match: 'SEM_MATCH',
    banco_match_id: null,
    banco_match_ids: [],
    banco_frota_id_texto: null,
    banco_numero_frota_texto: null,
    frota_codigo_por_id: null,
    frota_texto_legado: null,
    ...extra,
  };
}

function run(decisoes: DecisaoLinha[], user: Map<string, DecisaoUsuarioCatalogoItem> = new Map(), bancoRows: BancoFrotaProjecao[] = []) {
  const mapa = construirMapaCatalogo(decisoes, CATALOGOS);
  return recomputeDecisions({ decisoes, mapaCatalogo: mapa, decisoesUsuarioCatalogo: user, bancoRows });
}

describe('recomputeDecisions — Rodada 1.2', () => {
  it('nova com proprietário/sub/CC EXATOS → VALIDA', () => {
    const r = run([mkDec('INSERIR')]);
    expect(r.decisoes[0].status_validacao).toBe('VALIDA');
    expect(r.decisoes[0].pendencias_bloqueantes).toEqual([]);
  });

  it('nova com alias não confirmado → PENDENTE com pendência do campo', () => {
    const r = run([mkDec('INSERIR', { empresa_raw: 'ABRA INFRAESTRUTURA' })]);
    expect(r.decisoes[0].status_validacao).toBe('PENDENTE');
    expect(r.decisoes[0].pendencias_bloqueantes).toContain('PROPRIETARIO_NAO_RESOLVIDO');
  });

  it('alias confirmado via decisão do usuário → VALIDA', () => {
    const dec = [mkDec('INSERIR', { empresa_raw: 'ABRA INFRAESTRUTURA' })];
    const key = chaveDecisaoUsuario('PROPRIETARIO_EMPRESA', normalizar('ABRA INFRAESTRUTURA'));
    const user = new Map<string, DecisaoUsuarioCatalogoItem>([
      [key, { catalogo_tipo: 'PROPRIETARIO_EMPRESA', valor_normalizado: normalizar('ABRA INFRAESTRUTURA'), decisao: 'CONFIRMAR_SUGESTAO', destino_id_selecionado: 'e3' }],
    ]);
    const r = run(dec, user);
    expect(r.decisoes[0].status_validacao).toBe('VALIDA');
    expect(r.decisoes[0].pendencias_bloqueantes).toEqual([]);
  });

  it('fabricante/modelo não resolvidos → apenas alertas, não muda status', () => {
    const r = run([mkDec('INSERIR', { fabricante_raw: 'MARCA_X', modelo_raw: 'MOD_Z' })]);
    expect(r.decisoes[0].status_validacao).toBe('VALIDA');
    expect(r.decisoes[0].alertas_catalogo).toContain('FABRICANTE_NAO_RESOLVIDO');
    expect(r.decisoes[0].alertas_catalogo).toContain('MODELO_NAO_RESOLVIDO');
  });

  it('existente sem diferença → IGNORAR + VALIDA + campos_diferentes=[]', () => {
    const banco: BancoFrotaProjecao[] = [{
      id: 'b1', frota_id_texto: 'LYE', numero_frota_texto: '1', numero_frota_canonico: 'LYE1',
      comparaveis: { subcategoria_ativo_id: 's1', fabricante_id: 'f1', modelo_id: 'm1', empresa_id: 'e1', empresa_locadora_id: null, departamento_id: null, centro_custo_atual_id: 'cc1', ano_fabricacao: null, aluguel: '1000' },
    }];
    const dec = mkDec('REVISAR', {}, { banco_match_id: 'b1', origem_match: 'FROTA_ID' });
    const r = run([dec], new Map(), banco);
    expect(r.decisoes[0].acao_base).toBe('IGNORAR');
    expect(r.decisoes[0].status_validacao).toBe('VALIDA');
    expect(r.decisoes[0].campos_diferentes).toEqual([]);
  });

  it('existente com placeholder na planilha → IGNORAR, preserva atual', () => {
    const banco: BancoFrotaProjecao[] = [{
      id: 'b1', frota_id_texto: 'LYE', numero_frota_texto: '1', numero_frota_canonico: 'LYE1',
      comparaveis: { subcategoria_ativo_id: 's1', fabricante_id: 'f1', modelo_id: 'm1', empresa_id: 'e1', empresa_locadora_id: null, departamento_id: null, centro_custo_atual_id: 'cc1', ano_fabricacao: '2020', aluguel: '1000' },
    }];
    const dec = mkDec('REVISAR', { ano_fabricacao_raw: '-', valor_raw: 'N/A' }, { banco_match_id: 'b1' });
    const r = run([dec], new Map(), banco);
    expect(r.decisoes[0].acao_base).toBe('IGNORAR');
    expect(r.decisoes[0].campos_diferentes).toEqual([]);
  });

  it('existente com diff numérico real de ano_fabricacao → REVISAR + campos_diferentes preenchido', () => {
    const banco: BancoFrotaProjecao[] = [{
      id: 'b1', frota_id_texto: 'LYE', numero_frota_texto: '1', numero_frota_canonico: 'LYE1',
      comparaveis: { subcategoria_ativo_id: 's1', fabricante_id: 'f1', modelo_id: 'm1', empresa_id: 'e1', empresa_locadora_id: null, departamento_id: null, centro_custo_atual_id: 'cc1', ano_fabricacao: '2019', aluguel: '900' },
    }];
    const dec = mkDec('REVISAR', { ano_fabricacao_raw: '2020', valor_raw: '1200' }, { banco_match_id: 'b1' });
    const r = run([dec], new Map(), banco);
    expect(r.decisoes[0].acao_base).toBe('REVISAR');
    expect(r.decisoes[0].status_validacao).toBe('VALIDA');
    // Rodada 1.2.1: aluguel NÃO gera diff; apenas ano_fabricacao.
    const campos = r.decisoes[0].campos_diferentes ?? [];
    expect(campos.find((c) => c.campo === 'ano_fabricacao')).toBeTruthy();
    expect(campos.find((c) => c.campo === 'aluguel')).toBeFalsy();
  });

  it('invariante: PENDENTE ⇒ pendencias_bloqueantes>0 (violado sinaliza)', () => {
    const r = run([mkDec('INSERIR', { empresa_raw: null, tipo_equipamento_raw: null, obra_codigo: null })]);
    expect(r.decisoes[0].status_validacao).toBe('PENDENTE');
    expect(r.decisoes[0].pendencias_bloqueantes!.length).toBeGreaterThan(0);
    expect(r.invariantes.ok).toBe(true);
  });

  it('LYE246 duplicada permanece BLOQUEADA após recompute', () => {
    const dec = mkDec('NAO_DETERMINADA', { numero_frota_canonico: 'LYE246' }, { status_validacao: 'BLOQUEADA', motivos: ['DUPLICIDADE_CANONICA_NO_BANCO'], banco_match_ids: ['a', 'b'] });
    const r = run([dec]);
    expect(r.decisoes[0].status_validacao).toBe('BLOQUEADA');
    expect(r.decisoes[0].acao_base).toBe('NAO_DETERMINADA');
    expect(r.decisoes[0].pendencias_bloqueantes).toContain('IDENTIDADE_BLOQUEADA');
  });

  it('reconciliação: contagens somam corretamente', () => {
    const banco: BancoFrotaProjecao[] = [{
      id: 'b1', frota_id_texto: 'LYE', numero_frota_texto: '1', numero_frota_canonico: 'LYE1',
      comparaveis: { subcategoria_ativo_id: 's1', fabricante_id: 'f1', modelo_id: 'm1', empresa_id: 'e1', empresa_locadora_id: null, departamento_id: null, centro_custo_atual_id: 'cc1', ano_fabricacao: null, aluguel: '1000' },
    }];
    const decs = [
      mkDec('INSERIR'),
      mkDec('INSERIR', { empresa_raw: 'ABRA INFRAESTRUTURA' }),
      mkDec('REVISAR', {}, { banco_match_id: 'b1' }),
      mkDec('NAO_DETERMINADA', {}, { status_validacao: 'BLOQUEADA' }),
    ];
    const r = run(decs, new Map(), banco);
    const total = r.contagens.inserir + r.contagens.ignorar + r.contagens.revisar + r.contagens.nao_determinada;
    expect(total).toBe(4);
    expect(r.contagens.validas + r.contagens.pendentes + r.contagens.bloqueadas).toBe(4);
  });
});
