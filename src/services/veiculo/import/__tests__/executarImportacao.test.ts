import { describe, it, expect, vi, beforeEach } from 'vitest';
import { montarPayloadInsercao } from '../executarImportacao';
import type { DecisaoLinha } from '../types';

function baseDecisao(over: Partial<DecisaoLinha> = {}, resOver: Partial<NonNullable<DecisaoLinha['resolucao_catalogos']>> = {}): DecisaoLinha {
  const res: NonNullable<DecisaoLinha['resolucao_catalogos']> = {
    subcategoria: {
      catalogo_tipo: 'SUBCATEGORIA', valor_origem: 'CAMINHAO', match_tipo: 'EXATO',
      status_resolucao: 'RESOLVIDO', cadastro_destino_id: 'sub-1', cadastro_destino_nome: 'Caminhão',
      cadastro_destino_tipo: 'SUBCATEGORIA', decisao_usuario: 'AGUARDANDO_REVISAO', bloqueante: true, resolvido: true,
    },
    proprietario: {
      catalogo_tipo: 'PROPRIETARIO_EMPRESA', valor_origem: 'LYT', match_tipo: 'EXATO',
      status_resolucao: 'RESOLVIDO', cadastro_destino_id: 'emp-1', cadastro_destino_nome: 'LYT',
      cadastro_destino_tipo: 'EMPRESA', decisao_usuario: 'AGUARDANDO_REVISAO', bloqueante: true, resolvido: true,
    },
    centro_custo: {
      catalogo_tipo: 'CENTRO_CUSTO', valor_origem: '0001', match_tipo: 'EXATO',
      status_resolucao: 'RESOLVIDO', cadastro_destino_id: 'cc-1', cadastro_destino_nome: 'CC 1',
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
    ...resOver,
  };
  const linha = {
    aba_origem: 'BASE',
    linha_excel: 42,
    item_origem_raw: 'x', item_origem_invalido: false,
    codigo_ativo_original: 'LYE1001', obra_codigo: '0001', obra_descricao: null,
    tipo_equipamento_raw: 'CAMINHAO', contrato: null, fabricante_raw: null, modelo_raw: null,
    ano_fabricacao_raw: '2020', empresa_raw: 'LYT', com_operador: null, valor_raw: '999',
    extras: {},
    numero_frota_prefixo: 'LYE',
    numero_frota_numero: '1001',
    numero_frota_canonico: 'LYE1001',
    regex_ok: true,
  };
  return {
    linha,
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
    resolucao_catalogos: res,
    pendencias_bloqueantes: [],
    alertas_catalogo: [],
    campos_diferentes: [],
    ...over,
  };
}

const frotaMap = new Map<string, string>([['LYE', 'frota-uuid-lye']]);

describe('montarPayloadInsercao — Rodada 2A', () => {
  it('bloqueia LYE246 mesmo se vier VALIDA', () => {
    const d = baseDecisao({});
    d.linha.numero_frota_canonico = 'LYE246';
    d.linha.numero_frota_numero = '246';
    const r = montarPayloadInsercao(d, frotaMap);
    expect('erro' in r && r.erro).toBe('LYE246_BLOQUEADO');
  });

  it('recusa linha não INSERIR+VALIDA', () => {
    const r = montarPayloadInsercao(baseDecisao({ acao_base: 'REVISAR' }), frotaMap);
    expect('erro' in r && r.erro).toBe('LINHA_NAO_ELEGIVEL');
    const r2 = montarPayloadInsercao(baseDecisao({ status_validacao: 'PENDENTE' }), frotaMap);
    expect('erro' in r2 && r2.erro).toBe('LINHA_NAO_ELEGIVEL');
  });

  it('exige frota UUID no mapa', () => {
    const r = montarPayloadInsercao(baseDecisao(), new Map());
    expect('erro' in r && r.erro).toBe('FROTA_UUID_NAO_RESOLVIDA');
  });

  it('gera payload apenas com campos permitidos (aluguel a partir de VALOR BRL)', () => {
    const r = montarPayloadInsercao(baseDecisao(), frotaMap);
    if (!('payload' in r)) throw new Error('payload esperado');
    const keys = Object.keys(r.payload);
    for (const proibido of ['placa','chassi','numero_serie','renavam','motor','imagem_url','departamento_id','linha_operacional_id','valor','valor_raw']) {
      expect(keys).not.toContain(proibido);
    }
    expect(r.payload.frota_id).toBe('frota-uuid-lye');
    expect(r.payload.numero_frota).toBe('1001');
    expect(r.payload.subcategoria_ativo_id).toBe('sub-1');
    expect(r.payload.centro_custo_atual_id).toBe('cc-1');
    expect(r.payload.empresa_id).toBe('emp-1');
    expect(r.payload.empresa_locadora_id).toBeUndefined();
    expect(r.payload.ano_fabricacao).toBe('2020');
    // valor_raw '999' → aluguel '999.00'
    expect(r.payload.aluguel).toBe('999.00');
  });



  it('roteia para empresa_locadora_id quando tipo=LOCADORA', () => {
    const r = montarPayloadInsercao(
      baseDecisao({}, {
        proprietario: {
          catalogo_tipo: 'PROPRIETARIO_LOCADORA', valor_origem: 'X', match_tipo: 'EXATO',
          status_resolucao: 'RESOLVIDO', cadastro_destino_id: 'loc-1', cadastro_destino_nome: 'Loc',
          cadastro_destino_tipo: 'LOCADORA', decisao_usuario: 'AGUARDANDO_REVISAO', bloqueante: true, resolvido: true,
        },
      }),
      frotaMap,
    );
    if (!('payload' in r)) throw new Error('payload esperado');
    expect(r.payload.empresa_locadora_id).toBe('loc-1');
    expect(r.payload.empresa_id).toBeUndefined();
  });

  it('recusa sem centro de custo resolvido', () => {
    const r = montarPayloadInsercao(
      baseDecisao({}, {
        centro_custo: {
          catalogo_tipo: 'CENTRO_CUSTO', valor_origem: '0001', match_tipo: 'SEM_MATCH',
          status_resolucao: 'NAO_RESOLVIDO', cadastro_destino_id: null, cadastro_destino_nome: null,
          cadastro_destino_tipo: null, decisao_usuario: 'AGUARDANDO_REVISAO', bloqueante: true, resolvido: false,
        },
      }),
      frotaMap,
    );
    expect('erro' in r && r.erro).toBe('CENTRO_CUSTO_AUSENTE');
  });

  it('omite ano quando fora do padrão de 4 dígitos', () => {
    const d = baseDecisao();
    d.linha.ano_fabricacao_raw = 'N/A';
    const r = montarPayloadInsercao(d, frotaMap);
    if (!('payload' in r)) throw new Error('payload esperado');
    expect(r.payload.ano_fabricacao).toBeUndefined();
  });
});
