// PR-3.3 Fase C3 (Turn 2) — Testes do SHA lógico e do payload builder simplificado.

import { describe, it, expect } from 'vitest';
import { calcularArquivoSha256LogicoV3, type LinhaCruaSimplificada } from '../sha256LogicoV3';
import { montarPayloadRpcV3Simplificado } from '../montarPayloadRpcV3Simplificado';
import type { LinhaClassificadaSimplificada } from '../parseWorkbookV3Simplificado';
import type { ListasReferenciaV3 } from '../carregarListasReferenciaV3';

const linhaBase = (over: Partial<LinhaCruaSimplificada> = {}): LinhaCruaSimplificada => ({
  frota_codigo: 'CV', numero_frota: '10', subcategoria: 'Caminhão Basculante',
  linha_operacional: 'LO-1', proprietario: 'EMPRESA | Acme', centro_custo: 'CC-001',
  fabricante: 'Volvo', modelo: 'FH 540', ano_fabricacao: '2024', placa: 'ABC1D23',
  chassi: 'X9V123', numero_serie: '', renavam: '12345678901', motor: 'Volvo D13',
  cor: 'Branco', tipo_combustivel: 'Diesel S10', capacidade: '28 t', aluguel: '',
  departamento: 'Operações', observacoes: '',
  _controle_ref: 'uuid-1', equipamento_id_erp: 'uuid-1',
  updated_at_origem: '2026-01-01T00:00:00Z',
  ...over,
});

describe('sha256LogicoV3 — Turn 2 (updated_at_origem no SHA)', () => {
  it('mesmos dados visíveis + updated_at_origem diferente → SHA diferente', async () => {
    const a = await calcularArquivoSha256LogicoV3({ tipo_arquivo: 'EXPORTACAO', linhas: [linhaBase()] });
    const b = await calcularArquivoSha256LogicoV3({
      tipo_arquivo: 'EXPORTACAO',
      linhas: [linhaBase({ updated_at_origem: '2026-06-01T12:00:00Z' })],
    });
    expect(a).not.toEqual(b);
  });

  it('resave sem mudança real (reorder das linhas) mantém o SHA', async () => {
    const l1 = linhaBase({ _controle_ref: 'a', equipamento_id_erp: 'a' });
    const l2 = linhaBase({ frota_codigo: 'ES', numero_frota: '5', _controle_ref: 'b', equipamento_id_erp: 'b' });
    const a = await calcularArquivoSha256LogicoV3({ tipo_arquivo: 'EXPORTACAO', linhas: [l1, l2] });
    const b = await calcularArquivoSha256LogicoV3({ tipo_arquivo: 'EXPORTACAO', linhas: [l2, l1] });
    expect(a).toEqual(b);
  });

  it('alteração real de campo muda o SHA', async () => {
    const a = await calcularArquivoSha256LogicoV3({ tipo_arquivo: 'EXPORTACAO', linhas: [linhaBase()] });
    const b = await calcularArquivoSha256LogicoV3({
      tipo_arquivo: 'EXPORTACAO', linhas: [linhaBase({ cor: 'Vermelho' })],
    });
    expect(a).not.toEqual(b);
  });
});

// ─── Fixture mínima de listas para payload builder ──────────────────────────
const listasFixture: ListasReferenciaV3 = {
  itens: [
    { tipo_catalogo: 'SUBCATEGORIA', id_erp: 'sub-1', valor_exibicao: 'Caminhão Basculante',
      codigo: null, nome: 'Caminhão Basculante', parent_id_erp: 'cat-1',
      ativo: true, vinculado_atualmente: true, contexto: null },
    { tipo_catalogo: 'LINHA_OPERACIONAL', id_erp: 'lo-1', valor_exibicao: 'LO-1',
      codigo: 'LO-1', nome: 'Linha 1', parent_id_erp: null,
      ativo: true, vinculado_atualmente: true, contexto: null },
    { tipo_catalogo: 'PROPRIETARIO', id_erp: 'emp-1', valor_exibicao: 'EMPRESA | Acme',
      codigo: null, nome: 'Acme', parent_id_erp: null,
      ativo: true, vinculado_atualmente: true, contexto: 'EMPRESA' },
    { tipo_catalogo: 'PROPRIETARIO', id_erp: 'loc-1', valor_exibicao: 'LOCADORA | Locasa',
      codigo: null, nome: 'Locasa', parent_id_erp: null,
      ativo: true, vinculado_atualmente: true, contexto: 'LOCADORA' },
    { tipo_catalogo: 'CENTRO_CUSTO', id_erp: 'cc-1', valor_exibicao: 'CC-001',
      codigo: 'CC-001', nome: 'CC 001', parent_id_erp: null,
      ativo: true, vinculado_atualmente: true, contexto: null },
    { tipo_catalogo: 'FABRICANTE', id_erp: 'fab-1', valor_exibicao: 'Volvo',
      codigo: null, nome: 'Volvo', parent_id_erp: null,
      ativo: true, vinculado_atualmente: true, contexto: null },
    { tipo_catalogo: 'DEPARTAMENTO', id_erp: 'dep-1', valor_exibicao: 'Operações',
      codigo: null, nome: 'Operações', parent_id_erp: null,
      ativo: true, vinculado_atualmente: true, contexto: null },
    { tipo_catalogo: 'FROTA', id_erp: 'fr-1', valor_exibicao: 'CV',
      codigo: 'CV', nome: 'Caminhão Vazado', parent_id_erp: null,
      ativo: true, vinculado_atualmente: true, contexto: null },
  ],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  por_tipo: {} as any,
};

const mkLinha = (over: Partial<LinhaClassificadaSimplificada> = {}): LinhaClassificadaSimplificada => ({
  linha_excel: 5, acao: 'INSERIR', controle_ref: null,
  codigo_canonico: 'CV10', campos_atualizar: [],
  atual_canonico: {}, original_canonico: null, erros: [],
  raw: linhaBase({ _controle_ref: null as unknown as string }),
  ...over,
});

describe('montarPayloadRpcV3Simplificado', () => {
  it('INSERIR: monta payload completo com PROPRIETARIO EMPRESA + capacidade trio + modelo texto', () => {
    const linha = mkLinha();
    const { payload, erros } = montarPayloadRpcV3Simplificado(linha, { listas: listasFixture });
    expect(erros).toEqual([]);
    expect(payload).toBeTruthy();
    expect(payload!.acao).toBe('INSERIR');
    expect(payload!.frota_codigo).toBe('CV');
    expect(payload!.numero_frota).toBe('10');
    expect(payload!.codigo_canonico).toBe('CV10');
    expect(payload!.centro_custo_codigo).toBe('CC-001');
    expect(payload!.subcategoria_id_erp).toBe('sub-1');
    expect(payload!.linha_operacional_id_erp).toBe('lo-1');
    expect(payload!.proprietario_regime).toBe('PROPRIO');
    expect(payload!.proprietario_cadastro_tipo).toBe('EMPRESA');
    expect(payload!.proprietario_id_erp).toBe('emp-1');
    expect(payload!.proprietario_nome).toBe('Acme');
    expect(payload!.fabricante_id_erp).toBe('fab-1');
    expect(payload!.modelo).toBe('FH 540'); // texto livre
    expect(payload!.capacidade_valor).toBe('28');
    expect(payload!.capacidade_unidade).toBe('t');
    expect(payload!.capacidade).toBe('28 t');
    // Payload NUNCA envia modelo_id_erp/modelo_nome (contrato simplificado)
    expect((payload as unknown as Record<string, unknown>).modelo_id_erp).toBeUndefined();
    expect((payload as unknown as Record<string, unknown>).modelo_nome).toBeUndefined();
  });

  it('INSERIR: PROPRIETARIO LOCADORA marca cadastro_tipo=LOCADORA + regime=LOCADO', () => {
    const linha = mkLinha({
      raw: { ...linhaBase({ _controle_ref: null as unknown as string }), proprietario: 'LOCADORA | Locasa' },
    });
    const { payload, erros } = montarPayloadRpcV3Simplificado(linha, { listas: listasFixture });
    expect(erros).toEqual([]);
    expect(payload!.proprietario_regime).toBe('LOCADO');
    expect(payload!.proprietario_cadastro_tipo).toBe('LOCADORA');
    expect(payload!.proprietario_id_erp).toBe('loc-1');
  });

  it('ATUALIZAR: envia apenas tokens do diff automático', () => {
    const linha = mkLinha({
      acao: 'ATUALIZAR',
      controle_ref: 'uuid-1',
      campos_atualizar: ['COR', 'CAPACIDADE'],
      raw: linhaBase({ cor: 'Vermelho', capacidade: '30 t' }),
    });
    const { payload, erros } = montarPayloadRpcV3Simplificado(linha, { listas: listasFixture });
    expect(erros).toEqual([]);
    expect(payload!.acao).toBe('ATUALIZAR');
    expect(payload!.equipamento_id_erp).toBe('uuid-1');
    expect(payload!.updated_at_origem).toBe('2026-01-01T00:00:00Z');
    expect(payload!.codigo_canonico).toBe('CV10');
    expect(payload!.campos_atualizar).toBe('COR|CAPACIDADE');
    expect(payload!.cor).toBe('Vermelho');
    expect(payload!.capacidade_valor).toBe('30');
    expect(payload!.capacidade_unidade).toBe('t');
    // Campos NÃO tokenizados não vão no payload
    expect(payload!.modelo).toBeUndefined();
    expect(payload!.placa).toBeUndefined();
  });

  it('ATUALIZAR: MODELO token envia apenas modelo texto (não modelo_id_erp/nome)', () => {
    const linha = mkLinha({
      acao: 'ATUALIZAR', controle_ref: 'uuid-1',
      campos_atualizar: ['MODELO'],
      raw: linhaBase({ modelo: 'FH 620' }),
    });
    const { payload } = montarPayloadRpcV3Simplificado(linha, { listas: listasFixture });
    expect(payload!.modelo).toBe('FH 620');
    expect((payload as unknown as Record<string, unknown>).modelo_id_erp).toBeUndefined();
    expect((payload as unknown as Record<string, unknown>).modelo_nome).toBeUndefined();
  });

  it('ALUGUEL: normaliza R$ 14.000,00 → 14000.00', () => {
    const linha = mkLinha({
      acao: 'ATUALIZAR', controle_ref: 'uuid-1',
      campos_atualizar: ['ALUGUEL'],
      raw: linhaBase({ aluguel: 'R$ 14.000,00' }),
    });
    const { payload } = montarPayloadRpcV3Simplificado(linha, { listas: listasFixture });
    expect(payload!.aluguel).toBe('14000.00');
  });
});
