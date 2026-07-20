// PR-1.1 V3 — Round-trip com os 214 registros reais do arquivo
// Equipamentos_2026-07-17.xlsx exportado pelo ERP.
// Determinístico: fixture gerado offline com UUIDs SHA-256 estáveis.

import { describe, it, expect } from 'vitest';
import fixture from './fixtures/equipamentos-2026-07-17.fixture.json';
import { gerarExportacaoV3, type EquipamentoExportRegistro } from '../exportarEquipamentosXlsx';
import { parseWorkbookV3 } from '../parseWorkbookV3';

const REGISTROS = fixture as EquipamentoExportRegistro[];

async function blobBuf(b: Blob) { return await b.arrayBuffer(); }

describe('V3 — round-trip real 214 (Equipamentos_2026-07-17.xlsx)', () => {
  it('carrega 214 registros do fixture, com duplicidade LYE246', () => {
    expect(REGISTROS.length).toBe(214);
    const dup = REGISTROS.filter((r) => r.codigo_canonico === 'LYE246');
    expect(dup.length).toBe(2);
    // Nominal: as duas linhas têm subcategorias diferentes
    const subs = dup.map((r) => r.subcategoria_nome).sort();
    expect(subs).toEqual(['ROLINHO TAPA BURACO', 'ROLO COMPACTADOR TANDEM']);
  });

  it('exporta EXPORTACAO V3, reparseia e produz 212 válidas + 2 bloqueadas por duplicidade', async () => {
    const blob = gerarExportacaoV3({ layout: 'completo',
      registros: REGISTROS, listas: [],
      gerado_por: 'roundTripReal214',
      arquivo_referencia_nome: 'Equipamentos_2026-07-17.xlsx',
      arquivo_referencia_sha256: 'r'.repeat(64),
    });
    const parsed = parseWorkbookV3(await blobBuf(blob));

    expect(parsed.erros_globais).toEqual([]);
    expect(parsed.linhas_invalidas).toEqual([]);
    expect(parsed.linhas.length).toBe(212);
    expect(parsed.linhas_bloqueadas.length).toBe(2);

    for (const l of parsed.linhas) expect(l.parsed.acao).toBe('SEM_ALTERACAO');
    for (const b of parsed.linhas_bloqueadas) {
      expect(b.codigo).toBe('BLOQUEADA_DUPLICIDADE_CANONICA');
      expect(b.parsed?.codigo_canonico).toBe('LYE246');
    }

    // Nenhum INSERT/UPDATE emergiu do round-trip
    const acoes = parsed.linhas.map((l) => l.parsed.acao);
    expect(acoes.every((a) => a === 'SEM_ALTERACAO')).toBe(true);

    // Nenhuma das duas linhas LYE246 é escolhida
    const canonicosValidos = new Set(parsed.linhas.map((l) => l.parsed.codigo_canonico));
    expect(canonicosValidos.has('LYE246')).toBe(false);
  });
});
