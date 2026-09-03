import { describe, it, expect } from 'vitest';
import { splitCodigoAtivo, isFimMarker } from '../splitCodigoAtivo';

describe('splitCodigoAtivo', () => {
  it('normaliza prefixo maiúsculo e remove zeros à esquerda', () => {
    const r = splitCodigoAtivo(' lyc0086 ');
    expect(r.ok).toBe(true);
    expect(r.prefixo).toBe('LYC');
    expect(r.numero).toBe('86');
    expect(r.canonico).toBe('LYC86');
  });
  it('aceita 2 letras', () => {
    expect(splitCodigoAtivo('LC12').canonico).toBe('LC12');
  });
  it('aceita 4 letras', () => {
    expect(splitCodigoAtivo('LYCA1').canonico).toBe('LYCA1');
  });
  it('rejeita quando faltar dígitos', () => {
    expect(splitCodigoAtivo('LYC').ok).toBe(false);
  });
  it('rejeita quando tiver mais de 4 letras', () => {
    expect(splitCodigoAtivo('LYCABC1').ok).toBe(false);
  });
  it('rejeita quando tiver mais de 6 dígitos', () => {
    expect(splitCodigoAtivo('LYC1234567').ok).toBe(false);
  });
  it('rejeita entrada vazia', () => {
    expect(splitCodigoAtivo(null).ok).toBe(false);
    expect(splitCodigoAtivo('').ok).toBe(false);
    expect(splitCodigoAtivo('   ').ok).toBe(false);
  });
  it('reconhece marker fim', () => {
    expect(isFimMarker('fim')).toBe(true);
    expect(isFimMarker(' FIM ')).toBe(true);
    expect(isFimMarker('LYC1')).toBe(false);
  });
  it('canonicaliza os 13 códigos com ITEM=#REF!', () => {
    for (const c of ['LOC146','LOK422','LYC152','LYC086','LOK630','LOC186','LOK295','LOC145','LOK495','LYE169','LYE121','LOK493','LYE197']) {
      expect(splitCodigoAtivo(c).ok).toBe(true);
    }
  });
});
