// PR-1 V3 — Testes de schema + round-trip.

import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { SCHEMA_VERSION, ABA_EQUIPAMENTOS } from '../constants';
import {
  CAMPOS_ATUALIZAVEIS, GRUPOS_ATOMICOS,
} from '../equipamentosImportExportSchema';
import { equipamentoRowSchema } from '../zodSchema';
import { gerarModeloV3 } from '../gerarModeloXlsx';
import { gerarExportacaoV3 } from '../exportarEquipamentosXlsx';
import { parseWorkbookV3 } from '../parseWorkbookV3';
import { FIXTURE_EQUIPAMENTOS } from './fixtures/equipamentos-sample';

async function blobToArrayBuffer(b: Blob): Promise<ArrayBuffer> {
  return await b.arrayBuffer();
}

describe('V3 — schema + allowlists', () => {
  it('campos protegidos NÃO estão em CAMPOS_ATUALIZAVEIS', () => {
    for (const proibido of [
      'centro_custo_codigo', 'centro_custo_nome',
      'situacao_atual', 'status_cadastro_atual', 'status_disponibilidade_atual',
      'acao', 'equipamento_id_erp', 'updated_at_origem', 'campos_atualizar',
      'codigo_canonico', 'frota_codigo', 'numero_frota', 'codigo_exibicao',
    ]) {
      expect(CAMPOS_ATUALIZAVEIS).not.toContain(proibido);
    }
  });

  it('grupos atômicos declaram exatamente as chaves esperadas', () => {
    expect(GRUPOS_ATOMICOS.G_FROTA?.sort()).toEqual(['frota_codigo', 'numero_frota'].sort());
    expect(GRUPOS_ATOMICOS.G_PROPRIETARIO?.sort()).toEqual([
      'proprietario_regime', 'proprietario_cadastro_tipo', 'proprietario_id_erp', 'proprietario_nome',
    ].sort());
    expect(GRUPOS_ATOMICOS.G_FABRICANTE?.sort()).toEqual(['fabricante_id_erp', 'fabricante_nome'].sort());
    expect(GRUPOS_ATOMICOS.G_MODELO?.sort()).toEqual(['modelo_id_erp', 'modelo_nome'].sort());
    expect(GRUPOS_ATOMICOS.G_CAPACIDADE?.sort()).toEqual(['capacidade_valor', 'capacidade_unidade'].sort());
    expect(GRUPOS_ATOMICOS.G_SUBCATEGORIA?.sort()).toEqual(['subcategoria_id_erp', 'subcategoria_nome'].sort());
  });
});

describe('V3 — Zod discriminado', () => {
  it('INSERIR válido passa', () => {
    const r = equipamentoRowSchema.safeParse({
      acao: 'INSERIR',
      frota_codigo: 'LYE', numero_frota: '7',
      subcategoria_id_erp: '10000000-0000-0000-0000-000000000001',
      proprietario_regime: 'PROPRIO',
      proprietario_cadastro_tipo: 'EMPRESA',
      proprietario_id_erp: '30000000-0000-0000-0000-000000000001',
      centro_custo_codigo: 'CC-100',
    });
    expect(r.success).toBe(true);
  });

  it('INSERIR sem campo obrigatório falha', () => {
    const r = equipamentoRowSchema.safeParse({
      acao: 'INSERIR',
      frota_codigo: 'LYE',
      // sem numero_frota, subcategoria, proprietário, cc
    });
    expect(r.success).toBe(false);
  });

  it('ATUALIZAR exige gate updated_at_origem e campos_atualizar allowlisted', () => {
    const base = {
      acao: 'ATUALIZAR',
      equipamento_id_erp: '00000000-0000-0000-0000-000000000001',
      updated_at_origem: '2026-07-15T12:00:00.000Z',
      codigo_canonico: 'LYE1',
    };
    expect(equipamentoRowSchema.safeParse({ ...base, campos_atualizar: 'motor' }).success).toBe(true);
    // proibido: centro_custo_codigo é protegido em update
    expect(equipamentoRowSchema.safeParse({ ...base, campos_atualizar: 'centro_custo_codigo' }).success).toBe(false);
    // proibido: situacao_atual é somente leitura
    expect(equipamentoRowSchema.safeParse({ ...base, campos_atualizar: 'situacao_atual' }).success).toBe(false);
  });

  it('ATUALIZAR com token FABRICANTE sem id/nome falha; completo passa', () => {
    const base = {
      acao: 'ATUALIZAR',
      equipamento_id_erp: '00000000-0000-0000-0000-000000000001',
      updated_at_origem: '2026-07-15T12:00:00.000Z',
      codigo_canonico: 'LYE1',
    };
    expect(equipamentoRowSchema.safeParse({ ...base, campos_atualizar: 'FABRICANTE' }).success).toBe(false);
    expect(equipamentoRowSchema.safeParse({
      ...base, campos_atualizar: 'FABRICANTE',
      fabricante_id_erp: '40000000-0000-0000-0000-000000000001', fabricante_nome: 'Volvo',
    }).success).toBe(true);
  });

  it('SEM_ALTERACAO exige apenas identidade + gate', () => {
    const r = equipamentoRowSchema.safeParse({
      acao: 'SEM_ALTERACAO',
      equipamento_id_erp: '00000000-0000-0000-0000-000000000001',
      updated_at_origem: '2026-07-15T12:00:00.000Z',
      codigo_canonico: 'LYE1',
    });
    expect(r.success).toBe(true);
  });
});

describe('V3 — Modelo (template vazio) round-trip', () => {
  it('gera modelo, parseia sem linhas e com schema_version correto', async () => {
    const blob = gerarModeloV3({ gerado_por: 'test', layout: 'completo' });
    const buf = await blobToArrayBuffer(blob);
    const wb = XLSX.read(buf, { type: 'array' });
    expect(wb.SheetNames).toContain(ABA_EQUIPAMENTOS);
    const parsed = parseWorkbookV3(buf);
    expect(parsed.erros_globais).toEqual([]);
    expect(parsed.schema_version).toBe(SCHEMA_VERSION);
    expect(parsed.linhas.length).toBe(0);
    expect(parsed.linhas_invalidas.length).toBe(0);
    expect(parsed.metadados.tipo_arquivo).toBe('MODELO');
  });
});

describe('V3 — Exportação round-trip (SEM_ALTERACAO)', () => {
  it('exporta a fixture e reparseia sem alterações', async () => {
    const blob = gerarExportacaoV3({
      layout: 'completo',
      registros: FIXTURE_EQUIPAMENTOS,
      listas: [],
      gerado_por: 'test',
      arquivo_referencia_nome: 'fixture.xlsx',
      arquivo_referencia_sha256: 'x'.repeat(64),
    });
    const buf = await blobToArrayBuffer(blob);
    const parsed = parseWorkbookV3(buf);

    expect(parsed.erros_globais).toEqual([]);
    expect(parsed.linhas_invalidas).toEqual([]);
    expect(parsed.linhas.length).toBe(FIXTURE_EQUIPAMENTOS.length);

    // Todas ações são SEM_ALTERACAO por default
    for (const l of parsed.linhas) expect(l.parsed.acao).toBe('SEM_ALTERACAO');

    // situacao_atual preservada (protegida): registro com Ativo continua Ativo
    const lyE2 = parsed.linhas.find((l) => l.parsed.codigo_canonico === 'LYE2');
    expect(lyE2?.parsed.situacao_atual).toBe('Ativo');

    // Metadados essenciais
    expect(parsed.metadados.schema_version).toBe(SCHEMA_VERSION);
    expect(parsed.metadados.tipo_arquivo).toBe('EXPORTACAO');
    expect(parsed.metadados.total_registros).toBe(String(FIXTURE_EQUIPAMENTOS.length));
  });

  it('bloqueia arquivo com schema_version incompatível', async () => {
    // Gera modelo válido e adultera a aba METADADOS
    const blob = gerarModeloV3({ layout: 'completo' });
    const buf = await blobToArrayBuffer(blob);
    const wb = XLSX.read(buf, { type: 'array' });
    const meta = wb.Sheets['METADADOS'];
    XLSX.utils.sheet_add_aoa(meta, [['schema_version', 'V2_LEGADA']], { origin: 'A2' });
    const buf2 = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    const parsed = parseWorkbookV3(buf2);
    expect(parsed.erros_globais.some((e) => e.codigo === 'SCHEMA_VERSION_INCOMPATIVEL')).toBe(true);
  });

  it('rejeita cabeçalho fora de ordem', async () => {
    const blob = gerarModeloV3({ layout: 'completo' });
    const buf = await blobToArrayBuffer(blob);
    const wb = XLSX.read(buf, { type: 'array' });
    const eq = wb.Sheets['EQUIPAMENTOS'];
    // Troca a coluna A por um cabeçalho inválido
    XLSX.utils.sheet_add_aoa(eq, [['ACAO_ERRADA']], { origin: 'A1' });
    const buf2 = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    const parsed = parseWorkbookV3(buf2);
    expect(parsed.erros_globais.some((e) => e.codigo === 'CABECALHO_INVALIDO')).toBe(true);
  });
});
