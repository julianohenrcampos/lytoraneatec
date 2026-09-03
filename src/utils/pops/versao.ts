// Regras puras de versionamento e apresentação do módulo POPs.
// Mantidas fora de componentes para permitir teste unitário determinístico.

import type { PopStatus, PopTipoIncremento } from '@/types/pops';
import { POPS_MAX_ARQUIVO_BYTES } from '@/types/pops';

export interface Versao {
  major: number;
  minor: number;
}

/** Formata a versão no padrão institucional vX.Y. */
export function formatVersao(major: number, minor: number): string {
  return `v${major}.${minor}`;
}

/**
 * Calcula a versão resultante da publicação de um rascunho.
 * - initial  → sempre v1.0 (primeira publicação do POP)
 * - minor    → incrementa apenas o minor
 * - major    → incrementa o major e zera o minor
 */
export function proximaVersao(
  atual: Versao,
  tipoIncremento: PopTipoIncremento,
): Versao {
  if (tipoIncremento === 'initial') return { major: 1, minor: 0 };
  if (tipoIncremento === 'major') return { major: atual.major + 1, minor: 0 };
  return { major: atual.major, minor: atual.minor + 1 };
}

/**
 * O código só é editável enquanto o POP nunca foi publicado
 * (status 'rascunho' e sem data de publicação).
 */
export function podeEditarCodigo(status: PopStatus, publicadoEm: string | null): boolean {
  return status === 'rascunho' && !publicadoEm;
}

/** Publicação exige arquivo PDF anexado ao rascunho. */
export function podePublicar(rascunhoArquivoPath: string | null | undefined): boolean {
  return Boolean(rascunhoArquivoPath);
}

/** Revisão só pode ser aberta para POP já publicado (ativo ou obsoleto). */
export function podeIniciarRevisao(status: PopStatus, temRascunho: boolean): boolean {
  if (temRascunho) return false;
  return status === 'ativo' || status === 'obsoleto';
}

export function statusLabel(status: PopStatus): string {
  switch (status) {
    case 'ativo':
      return 'Vigente';
    case 'obsoleto':
      return 'Obsoleto';
    default:
      return 'Em preparação';
  }
}

export function statusVariant(status: PopStatus): 'default' | 'secondary' | 'outline' {
  if (status === 'ativo') return 'default';
  if (status === 'obsoleto') return 'secondary';
  return 'outline';
}

export type ValidacaoArquivo = { ok: true } | { ok: false; motivo: string };

/** Validação client-side espelhando as travas do banco e da Edge Function. */
export function validarArquivoPop(file: { name: string; size: number; type: string }): ValidacaoArquivo {
  const nome = (file.name || '').trim();
  if (!nome) return { ok: false, motivo: 'Nome do arquivo inválido.' };
  if (!nome.toLowerCase().endsWith('.pdf')) {
    return { ok: false, motivo: 'Apenas arquivos PDF são aceitos.' };
  }
  if (file.type && file.type !== 'application/pdf') {
    return { ok: false, motivo: 'O arquivo precisa ser um PDF (application/pdf).' };
  }
  if (file.size < 1) return { ok: false, motivo: 'Arquivo vazio.' };
  if (file.size > POPS_MAX_ARQUIVO_BYTES) {
    return { ok: false, motivo: 'Arquivo excede o limite de 20 MB.' };
  }
  return { ok: true };
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
