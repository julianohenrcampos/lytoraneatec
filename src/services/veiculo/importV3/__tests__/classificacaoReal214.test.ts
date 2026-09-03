// PR-3 V3 — Testes de classificação (parser → linhas classificadas).
import { describe, it, expect } from 'vitest';
import fixture from './fixtures/equipamentos-2026-07-17.fixture.json';
import { gerarExportacaoV3, type EquipamentoExportRegistro } from '../exportarEquipamentosXlsx';
import { parseWorkbookV3 } from '../parseWorkbookV3';
import { classificarLinhas } from '../classificarLinhas';

const REGISTROS = fixture as EquipamentoExportRegistro[];

describe('classificarLinhas — round-trip real 214', () => {
  it('produz 212 SEM_ALTERACAO + 2 BLOQUEADO, sem NOVO/UPDATE/ERRO', async () => {
    const blob = gerarExportacaoV3({ layout: 'completo',
      registros: REGISTROS, listas: [],
      gerado_por: 'classificacao-test',
      arquivo_referencia_nome: 'Equipamentos_2026-07-17.xlsx',
      arquivo_referencia_sha256: 'x'.repeat(64),
    });
    const parsed = parseWorkbookV3(await blob.arrayBuffer());
    const { linhas, resumo } = classificarLinhas('sha-test', parsed);

    expect(resumo.total).toBe(214);
    expect(resumo.sem_alteracao).toBe(212);
    expect(resumo.bloqueados).toBe(2);
    expect(resumo.novos_validos).toBe(0);
    expect(resumo.updates_validos).toBe(0);
    expect(resumo.erros).toBe(0);

    const chaves = new Set(linhas.map((l) => l.chave));
    expect(chaves.size).toBe(214); // sem colisão de chave lógica
    // Todas as linhas bloqueadas devem ser LYE246
    const bloqs = linhas.filter((l) => l.status_inicial === 'BLOQUEADO');
    expect(bloqs.length).toBe(2);
    expect(bloqs.every((b) => b.codigo_canonico === 'LYE246')).toBe(true);
  });
});
