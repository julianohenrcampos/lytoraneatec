import { describe, expect, it } from 'vitest';
import {
  formatVersao,
  podeEditarCodigo,
  podeIniciarRevisao,
  podePublicar,
  proximaVersao,
  statusLabel,
  validarArquivoPop,
  formatBytes,
} from '@/utils/pops/versao';

describe('POPs — versionamento', () => {
  it('primeira publicação sempre resulta em v1.0', () => {
    expect(proximaVersao({ major: 0, minor: 0 }, 'initial')).toEqual({ major: 1, minor: 0 });
    // mesmo que o registro traga valores residuais
    expect(proximaVersao({ major: 3, minor: 7 }, 'initial')).toEqual({ major: 1, minor: 0 });
  });

  it('revisão minor incrementa apenas o minor', () => {
    expect(proximaVersao({ major: 1, minor: 0 }, 'minor')).toEqual({ major: 1, minor: 1 });
    expect(proximaVersao({ major: 2, minor: 9 }, 'minor')).toEqual({ major: 2, minor: 10 });
  });

  it('revisão major incrementa o major e zera o minor', () => {
    expect(proximaVersao({ major: 1, minor: 4 }, 'major')).toEqual({ major: 2, minor: 0 });
  });

  it('formata a versão no padrão vX.Y', () => {
    expect(formatVersao(1, 0)).toBe('v1.0');
    expect(formatVersao(12, 3)).toBe('v12.3');
  });
});

describe('POPs — regras de edição e publicação', () => {
  it('código é editável apenas antes da primeira publicação', () => {
    expect(podeEditarCodigo('rascunho', null)).toBe(true);
    expect(podeEditarCodigo('rascunho', '2026-01-01T00:00:00Z')).toBe(false);
    expect(podeEditarCodigo('ativo', '2026-01-01T00:00:00Z')).toBe(false);
    expect(podeEditarCodigo('obsoleto', '2026-01-01T00:00:00Z')).toBe(false);
  });

  it('publicação exige arquivo anexado ao rascunho', () => {
    expect(podePublicar(null)).toBe(false);
    expect(podePublicar(undefined)).toBe(false);
    expect(podePublicar('uuid/hash.pdf')).toBe(true);
  });

  it('revisão só abre para POP publicado e sem rascunho aberto', () => {
    expect(podeIniciarRevisao('ativo', false)).toBe(true);
    expect(podeIniciarRevisao('obsoleto', false)).toBe(true);
    expect(podeIniciarRevisao('ativo', true)).toBe(false);
    expect(podeIniciarRevisao('rascunho', false)).toBe(false);
  });

  it('rótulos de situação refletem o modelo sem histórico', () => {
    expect(statusLabel('ativo')).toBe('Vigente');
    expect(statusLabel('obsoleto')).toBe('Obsoleto');
    expect(statusLabel('rascunho')).toBe('Em preparação');
  });
});

describe('POPs — validação de arquivo', () => {
  const pdf = (over: Partial<{ name: string; size: number; type: string }> = {}) => ({
    name: 'pop.pdf',
    size: 1024,
    type: 'application/pdf',
    ...over,
  });

  it('aceita PDF válido dentro de 20 MB', () => {
    expect(validarArquivoPop(pdf())).toEqual({ ok: true });
    expect(validarArquivoPop(pdf({ size: 20 * 1024 * 1024 }))).toEqual({ ok: true });
  });

  it('rejeita extensão e MIME não-PDF', () => {
    expect(validarArquivoPop(pdf({ name: 'pop.docx', type: '' })).ok).toBe(false);
    expect(validarArquivoPop(pdf({ type: 'image/png' })).ok).toBe(false);
  });

  it('rejeita arquivo vazio e acima de 20 MB', () => {
    expect(validarArquivoPop(pdf({ size: 0 })).ok).toBe(false);
    expect(validarArquivoPop(pdf({ size: 20 * 1024 * 1024 + 1 })).ok).toBe(false);
  });

  it('formata tamanhos legíveis', () => {
    expect(formatBytes(null)).toBe('—');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.00 MB');
  });
});
