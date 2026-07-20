import { describe, it, expect } from 'vitest';
import { splitCodigoAtivo, formatarNumeroFrota } from '../splitCodigoAtivo';
import { montarPayloadInsercao } from '../executarImportacao';
import type { DecisaoLinha } from '../types';

describe('Rodada 2A.2 — padding mínimo de 3 dígitos', () => {
  it('formatarNumeroFrota aplica lpad 3 preservando valores maiores', () => {
    expect(formatarNumeroFrota('7')).toBe('007');
    expect(formatarNumeroFrota('24')).toBe('024');
    expect(formatarNumeroFrota('63')).toBe('063');
    expect(formatarNumeroFrota('171')).toBe('171');
    expect(formatarNumeroFrota('910')).toBe('910');
    expect(formatarNumeroFrota('1234')).toBe('1234');
    expect(formatarNumeroFrota('0')).toBe('000');
  });

  it('splitCodigoAtivo produz canonico (sem zeros) e canonicoExibicao (com padding 3)', () => {
    const r = splitCodigoAtivo('LOC063');
    expect(r.ok).toBe(true);
    expect(r.numero).toBe('63');
    expect(r.numeroFormatado).toBe('063');
    expect(r.canonico).toBe('LOC63');
    expect(r.canonicoExibicao).toBe('LOC063');
  });

  it('LOC63, LOC063 e LOC0063 têm a mesma chave canônica', () => {
    expect(splitCodigoAtivo('LOC63').canonico).toBe('LOC63');
    expect(splitCodigoAtivo('LOC063').canonico).toBe('LOC63');
    expect(splitCodigoAtivo('LOC0063').canonico).toBe('LOC63');
  });

  it('LOC63 e LOC063 têm a mesma exibição LOC063', () => {
    expect(splitCodigoAtivo('LOC63').canonicoExibicao).toBe('LOC063');
    expect(splitCodigoAtivo('LOC063').canonicoExibicao).toBe('LOC063');
    expect(splitCodigoAtivo('LOC0063').canonicoExibicao).toBe('LOC063');
  });

  it('montarPayloadInsercao envia numero_frota com padding 3', () => {
    const decisao = baseDecisao({ prefixo: 'LOC', numeroCanonico: '63' });
    const frotaMap = new Map([['LOC', 'frota-loc-uuid']]);
    const r = montarPayloadInsercao(decisao, frotaMap);
    if (!('payload' in r)) throw new Error('payload esperado');
    expect(r.payload.numero_frota).toBe('063');
  });

  it('montarPayloadInsercao mantém 4 dígitos quando o número já for >=3', () => {
    const decisao = baseDecisao({ prefixo: 'LYE', numeroCanonico: '1234' });
    const frotaMap = new Map([['LYE', 'frota-lye-uuid']]);
    const r = montarPayloadInsercao(decisao, frotaMap);
    if (!('payload' in r)) throw new Error('payload esperado');
    expect(r.payload.numero_frota).toBe('1234');
  });

  it('montarPayloadInsercao formata 7 → 007', () => {
    const decisao = baseDecisao({ prefixo: 'LYC', numeroCanonico: '7' });
    const frotaMap = new Map([['LYC', 'frota-lyc-uuid']]);
    const r = montarPayloadInsercao(decisao, frotaMap);
    if (!('payload' in r)) throw new Error('payload esperado');
    expect(r.payload.numero_frota).toBe('007');
  });
});

function baseDecisao(over: { prefixo: string; numeroCanonico: string }): DecisaoLinha {
  const canonico = `${over.prefixo}${over.numeroCanonico}`;
  return {
    linha: {
      aba_origem: 'BASE',
      linha_excel: 10,
      item_origem_raw: '1',
      item_origem_invalido: false,
      codigo_ativo_original: canonico,
      obra_codigo: '0001',
      obra_descricao: null,
      tipo_equipamento_raw: 'CAMINHAO',
      contrato: null,
      fabricante_raw: null,
      modelo_raw: null,
      ano_fabricacao_raw: '2020',
      empresa_raw: 'X',
      com_operador: null,
      valor_raw: '999',
      extras: {},
      numero_frota_prefixo: over.prefixo,
      numero_frota_numero: over.numeroCanonico,
      numero_frota_canonico: canonico,
      regex_ok: true,
    },
    acao_base: 'INSERIR',
    status_validacao: 'VALIDA',
    motivos: [],
    alertas: [],
    origem_match: 'SEM_MATCH',
    banco_match_id: null,
    banco_match_ids: [],
    banco_frota_id_texto: null,
    banco_numero_frota_texto: null,
    frota_codigo_por_id: null,
    frota_texto_legado: null,
    resolucao_catalogos: {
      subcategoria: {
        catalogo_tipo: 'SUBCATEGORIA', valor_origem: 'X', match_tipo: 'EXATO',
        status_resolucao: 'RESOLVIDO', cadastro_destino_id: 'sub-1', cadastro_destino_nome: 'X',
        cadastro_destino_tipo: 'SUBCATEGORIA', decisao_usuario: 'AGUARDANDO_REVISAO', bloqueante: true, resolvido: true,
      },
      proprietario: {
        catalogo_tipo: 'PROPRIETARIO_EMPRESA', valor_origem: 'X', match_tipo: 'EXATO',
        status_resolucao: 'RESOLVIDO', cadastro_destino_id: 'emp-1', cadastro_destino_nome: 'X',
        cadastro_destino_tipo: 'EMPRESA', decisao_usuario: 'AGUARDANDO_REVISAO', bloqueante: true, resolvido: true,
      },
      centro_custo: {
        catalogo_tipo: 'CENTRO_CUSTO', valor_origem: '0001', match_tipo: 'EXATO',
        status_resolucao: 'RESOLVIDO', cadastro_destino_id: 'cc-1', cadastro_destino_nome: 'CC1',
        cadastro_destino_tipo: 'CENTRO_CUSTO', decisao_usuario: 'AGUARDANDO_REVISAO', bloqueante: true, resolvido: true,
      },
      fabricante: {
        catalogo_tipo: 'FABRICANTE', valor_origem: null, match_tipo: 'SEM_OCORRENCIA',
        status_resolucao: 'SEM_OCORRENCIA', cadastro_destino_id: null, cadastro_destino_nome: null,
        cadastro_destino_tipo: null, decisao_usuario: 'AGUARDANDO_REVISAO', bloqueante: false, resolvido: false,
      },
      modelo: {
        catalogo_tipo: 'MODELO', valor_origem: null, match_tipo: 'SEM_OCORRENCIA',
        status_resolucao: 'SEM_OCORRENCIA', cadastro_destino_id: null, cadastro_destino_nome: null,
        cadastro_destino_tipo: null, decisao_usuario: 'AGUARDANDO_REVISAO', bloqueante: false, resolvido: false,
      },
      departamento: {
        catalogo_tipo: 'DEPARTAMENTO', valor_origem: null, match_tipo: 'SEM_OCORRENCIA',
        status_resolucao: 'SEM_OCORRENCIA', cadastro_destino_id: null, cadastro_destino_nome: null,
        cadastro_destino_tipo: null, decisao_usuario: 'AGUARDANDO_REVISAO', bloqueante: false, resolvido: false,
      },
    },
    pendencias_bloqueantes: [],
    alertas_catalogo: [],
    campos_diferentes: [],
  };
}
