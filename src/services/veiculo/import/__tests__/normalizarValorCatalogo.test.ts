import { describe, it, expect } from 'vitest';
import { normalizar, toValorCatalogo, isPlaceholderValor } from '../normalizarValorCatalogo';

describe('normalizarValorCatalogo', () => {
  it('trim, uppercase, remove acentos e colapsa espaços', () => {
    expect(normalizar('  Retroescavadeira  ')).toBe('RETROESCAVADEIRA');
    expect(normalizar('Caminhão   Pipa')).toBe('CAMINHAO PIPA');
    expect(normalizar('Não Encontrado')).toBe('NAO ENCONTRADO');
  });

  it('normaliza pontuação e colapsa espaços', () => {
    expect(normalizar('BRITADOR / PENEIRA')).toBe('BRITADOR PENEIRA');
    expect(normalizar('LTDA.')).toBe('LTDA');
  });

  it('detecta placeholders', () => {
    expect(isPlaceholderValor('-')).toBe(true);
    expect(isPlaceholderValor('N/A')).toBe(true);
    expect(isPlaceholderValor('NÃO ENCONTRADO')).toBe(true);
    expect(isPlaceholderValor('NAO INFORMADO')).toBe(true);
    expect(isPlaceholderValor('S/N')).toBe(true);
    expect(isPlaceholderValor('0')).toBe(true);
    expect(isPlaceholderValor('')).toBe(true);
    expect(isPlaceholderValor(null)).toBe(true);
  });

  it('não trata valores reais como placeholder', () => {
    expect(isPlaceholderValor('LYTORANEA')).toBe(false);
    expect(isPlaceholderValor('CAMINHÃO PIPA')).toBe(false);
  });

  it('toValorCatalogo preserva valor original trimado', () => {
    const v = toValorCatalogo('  Terraplan  ');
    expect(v.valor).toBe('Terraplan');
    expect(v.normalizado).toBe('TERRAPLAN');
    expect(v.placeholder).toBe(false);
  });
});
