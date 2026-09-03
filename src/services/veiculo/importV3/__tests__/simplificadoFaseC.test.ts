// PR-3.3 Fase C — Testes de fundação: contrato de 20 colunas, allowlist token/payload,
// normalizadores canônicos (capacidade, aluguel), SHA-256 lógico estável.
// Cobertura de gerador/parser/RPCs virá em turnos subsequentes.

import { describe, it, expect } from 'vitest';
import {
  COLUNAS_EQUIPAMENTOS_SIMPLIFICADO,
  COLUNAS_VISIVEIS_SIMPLIFICADO,
  CABECALHOS_VISIVEIS_SIMPLIFICADO,
  TOTAL_COLUNAS_EQUIPAMENTOS_SIMPLIFICADO,
  TOTAL_COLUNAS_FISICAS_SIMPLIFICADO,
  CHAVE_CONTROLE_REF,
} from '../equipamentosSchemaSimplificado';
import {
  TOKENS_ALLOWLIST,
  TOKEN_TO_PAYLOAD,
  parseCamposAtualizarV3,
  serializarTokensV3,
} from '../tokenPayloadMap';
import { parseCapacidade, chaveCapacidadeCanonica } from '../capacidadeCanonica';
import { parseAluguel, chaveAluguelCanonico, formatarAluguelBR } from '../aluguelCanonico';
import { calcularArquivoSha256LogicoV3, calcularCodigoCanonico } from '../sha256LogicoV3';

describe('PR-3.3 Fase C — schema simplificado (20 visíveis + 1 técnica oculta)', () => {
  it('20 colunas visíveis + 1 técnica oculta (21 físicas)', () => {
    expect(COLUNAS_VISIVEIS_SIMPLIFICADO).toHaveLength(TOTAL_COLUNAS_EQUIPAMENTOS_SIMPLIFICADO);
    expect(TOTAL_COLUNAS_EQUIPAMENTOS_SIMPLIFICADO).toBe(20);
    expect(COLUNAS_EQUIPAMENTOS_SIMPLIFICADO).toHaveLength(TOTAL_COLUNAS_FISICAS_SIMPLIFICADO);
    expect(TOTAL_COLUNAS_FISICAS_SIMPLIFICADO).toBe(21);
  });

  it('ordem exata das 20 colunas visíveis', () => {
    expect(CABECALHOS_VISIVEIS_SIMPLIFICADO).toEqual([
      'frota_codigo', 'numero_frota', 'subcategoria', 'linha_operacional',
      'proprietario', 'centro_custo', 'fabricante', 'modelo', 'ano_fabricacao',
      'placa', 'chassi', 'numero_serie', 'renavam', 'motor', 'cor',
      'tipo_combustivel', 'capacidade', 'aluguel', 'departamento', 'observacoes',
    ]);
  });

  it('coluna oculta é _controle_ref e a última físicamente', () => {
    const oculta = COLUNAS_EQUIPAMENTOS_SIMPLIFICADO.filter((c) => !c.visivel);
    expect(oculta).toHaveLength(1);
    expect(oculta[0].chave).toBe(CHAVE_CONTROLE_REF);
    expect(COLUNAS_EQUIPAMENTOS_SIMPLIFICADO.at(-1)?.chave).toBe(CHAVE_CONTROLE_REF);
  });

  it('não expõe nenhuma coluna técnica de controle interno do ERP', () => {
    const proibidos = new Set([
      'acao', 'equipamento_id_erp', 'updated_at_origem', 'campos_atualizar',
      'codigo_exibicao', 'codigo_canonico', 'categoria_nome', 'proprietario_regime',
      'situacao_atual', 'status_cadastro_atual', 'status_disponibilidade_atual',
      'modelo_id_erp', 'subcategoria_id_erp', 'proprietario_id_erp',
      'categoria_id_erp', 'linha_operacional_id_erp', 'departamento_id_erp',
      'fabricante_id_erp', 'capacidade_valor', 'capacidade_unidade',
    ]);
    const visiveisChaves = new Set(COLUNAS_VISIVEIS_SIMPLIFICADO.map((c) => c.chave));
    for (const p of proibidos) expect(visiveisChaves.has(p)).toBe(false);
  });
});

describe('PR-3.3 Fase C — Token × Payload allowlist', () => {
  it('rejeita nomes físicos como token', () => {
    for (const fisico of ['modelo', 'modelo_id', 'departamento_id', 'numero_serie', 'centro_custo', 'frota_codigo']) {
      const r = parseCamposAtualizarV3(fisico);
      expect(r.erro).toBeTruthy();
      expect(r.tokens).toHaveLength(0);
    }
  });

  it('rejeita token em minúsculas', () => {
    const r = parseCamposAtualizarV3('modelo');
    expect(r.erro).toBeTruthy();
  });

  it('aceita tokens da allowlist e retorna payload resolvido', () => {
    const r = parseCamposAtualizarV3('MODELO|ALUGUEL');
    expect(r.erro).toBeNull();
    expect(r.tokens).toEqual(['MODELO', 'ALUGUEL']);
    expect(r.payload_chaves.sort()).toEqual(['aluguel', 'modelo'].sort());
  });

  it('PROPRIETARIO exige proprietario_cadastro_tipo no payload', () => {
    expect(TOKEN_TO_PAYLOAD.PROPRIETARIO).toContain('proprietario_cadastro_tipo');
    expect(TOKEN_TO_PAYLOAD.PROPRIETARIO).toContain('proprietario_regime');
    expect(TOKEN_TO_PAYLOAD.PROPRIETARIO).toContain('proprietario_id_erp');
  });

  it('CAPACIDADE grava as 3 colunas reais atomicamente', () => {
    expect(TOKEN_TO_PAYLOAD.CAPACIDADE).toEqual(['capacidade', 'capacidade_valor', 'capacidade_unidade']);
  });

  it('MODELO nunca inclui modelo_id no payload', () => {
    expect(TOKEN_TO_PAYLOAD.MODELO).toEqual(['modelo']);
  });

  it('dedup e reserialização em ordem estável', () => {
    const r = parseCamposAtualizarV3('ALUGUEL|MODELO|MODELO');
    expect(r.erro).toBeNull();
    expect(r.tokens).toEqual(['ALUGUEL', 'MODELO']);
    expect(serializarTokensV3(r.tokens)).toBe('MODELO|ALUGUEL');
  });

  it('allowlist tem exatamente 17 tokens documentados', () => {
    expect(TOKENS_ALLOWLIST).toHaveLength(17);
  });
});

describe('PR-3.3 Fase C — capacidade canônica', () => {
  it('reconhece aliases: t/ton/tonelada → t', () => {
    expect(parseCapacidade('28 t').unidade).toBe('t');
    expect(parseCapacidade('28t').unidade).toBe('t');
    expect(parseCapacidade('28 ton').unidade).toBe('t');
    expect(parseCapacidade('28 tonelada').unidade).toBe('t');
  });

  it('formatos equivalentes têm mesma chave canônica', () => {
    const a = chaveCapacidadeCanonica('28 t');
    const b = chaveCapacidadeCanonica('28t');
    const c = chaveCapacidadeCanonica('28 ton');
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('m3 e m³ são equivalentes', () => {
    expect(chaveCapacidadeCanonica('1.3 m3')).toBe(chaveCapacidadeCanonica('1,3 m³'));
  });

  it('unidade desconhecida → CAPACIDADE_UNIDADE_INVALIDA', () => {
    expect(parseCapacidade('28 xyz').erro).toBe('CAPACIDADE_UNIDADE_INVALIDA');
  });

  it('vazio é vazio, sem erro', () => {
    expect(parseCapacidade('').erro).toBeNull();
    expect(parseCapacidade(null).valor).toBeNull();
  });
});

describe('PR-3.3 Fase C — aluguel canônico', () => {
  it('formatos equivalentes têm mesma chave canônica', () => {
    const a = chaveAluguelCanonico('R$ 1.234,56');
    const b = chaveAluguelCanonico('1.234,56');
    const c = chaveAluguelCanonico('1234.56');
    expect(a).toBe('1234.56');
    expect(b).toBe('1234.56');
    expect(c).toBe('1234.56');
  });

  it('valor real diferente muda a chave', () => {
    expect(chaveAluguelCanonico('1234.56')).not.toBe(chaveAluguelCanonico('1234.57'));
  });

  it('vazio é null', () => {
    expect(parseAluguel('').texto).toBeNull();
    expect(parseAluguel(null).texto).toBeNull();
  });

  it('formatação PT-BR', () => {
    const s = formatarAluguelBR('1234.56');
    expect(s).toContain('1.234,56');
  });
});

describe('PR-3.3 Fase C — SHA-256 lógico', () => {
  const baseLinha = {
    frota_codigo: 'RE', numero_frota: '1', subcategoria: 'BASCULANTE',
    linha_operacional: 'LO-1', proprietario: 'EMPRESA | LYT', centro_custo: 'CC-1000',
    fabricante: 'VOLVO', modelo: 'FMX 500', ano_fabricacao: '2024',
    placa: 'ABC1D23', chassi: '', numero_serie: '', renavam: '',
    motor: '', cor: 'BRANCO', tipo_combustivel: 'Diesel',
    capacidade: '28 t', aluguel: 'R$ 1.234,56', departamento: '', observacoes: '',
    _controle_ref: 'aaaa-1111',
  };

  it('mesmo conteúdo em ordens diferentes → mesmo SHA', async () => {
    const l1 = { ...baseLinha, _controle_ref: 'a' };
    const l2 = { ...baseLinha, frota_codigo: 'BA', numero_frota: '2', _controle_ref: 'b' };
    const sha_ab = await calcularArquivoSha256LogicoV3({ tipo_arquivo: 'EXPORTACAO', linhas: [l1, l2] });
    const sha_ba = await calcularArquivoSha256LogicoV3({ tipo_arquivo: 'EXPORTACAO', linhas: [l2, l1] });
    expect(sha_ab).toBe(sha_ba);
  });

  it('formatação equivalente de aluguel/capacidade não altera SHA', async () => {
    const l1 = { ...baseLinha };
    const l2 = { ...baseLinha, aluguel: '1234.56', capacidade: '28t' };
    const sha1 = await calcularArquivoSha256LogicoV3({ tipo_arquivo: 'EXPORTACAO', linhas: [l1] });
    const sha2 = await calcularArquivoSha256LogicoV3({ tipo_arquivo: 'EXPORTACAO', linhas: [l2] });
    expect(sha1).toBe(sha2);
  });

  it('valor real diferente altera SHA', async () => {
    const l1 = { ...baseLinha };
    const l2 = { ...baseLinha, modelo: 'FMX 540' };
    const sha1 = await calcularArquivoSha256LogicoV3({ tipo_arquivo: 'EXPORTACAO', linhas: [l1] });
    const sha2 = await calcularArquivoSha256LogicoV3({ tipo_arquivo: 'EXPORTACAO', linhas: [l2] });
    expect(sha1).not.toBe(sha2);
  });

  it('adicionar ativo altera SHA', async () => {
    const l2 = { ...baseLinha, _controle_ref: 'b', frota_codigo: 'BA', numero_frota: '2' };
    const sha1 = await calcularArquivoSha256LogicoV3({ tipo_arquivo: 'EXPORTACAO', linhas: [baseLinha] });
    const sha2 = await calcularArquivoSha256LogicoV3({ tipo_arquivo: 'EXPORTACAO', linhas: [baseLinha, l2] });
    expect(sha1).not.toBe(sha2);
  });

  it('codigo_canonico: RE + 001 → RE1', () => {
    expect(calcularCodigoCanonico({ frota_codigo: 're', numero_frota: '001' })).toBe('RE1');
  });
});
