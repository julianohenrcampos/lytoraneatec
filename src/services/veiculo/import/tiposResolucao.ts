// Rodada 1.2.1 — Tipos de resolução de catálogo por linha e diffs de existentes.
// Zero mutations. Puro TS.

import type { CatalogoTipo, MatchTipoCatalogo, StatusResolucaoCatalogo } from './types';

export type DecisaoUsuarioCatalogo =
  | 'AGUARDANDO_REVISAO'
  | 'CONFIRMAR_SUGESTAO'
  | 'SELECIONAR_OUTRO'
  | 'DEIXAR_PENDENTE'
  | 'IGNORAR_CAMPO_OPCIONAL';

/** Tipo do cadastro-destino persistido junto à decisão (Rodada 1.2.1). */
export type TipoDestinoCadastro =
  | 'EMPRESA'
  | 'LOCADORA'
  | 'SUBCATEGORIA'
  | 'CENTRO_CUSTO'
  | 'FABRICANTE'
  | 'MODELO'
  | 'DEPARTAMENTO';

/** Deriva o tipo de cadastro-destino a partir do CatalogoTipo. */
export function tipoDestinoDeCatalogo(tipo: CatalogoTipo): TipoDestinoCadastro {
  switch (tipo) {
    case 'PROPRIETARIO_EMPRESA':
      return 'EMPRESA';
    case 'PROPRIETARIO_LOCADORA':
      return 'LOCADORA';
    case 'SUBCATEGORIA':
      return 'SUBCATEGORIA';
    case 'CENTRO_CUSTO':
      return 'CENTRO_CUSTO';
    case 'FABRICANTE':
      return 'FABRICANTE';
    case 'MODELO':
      return 'MODELO';
    case 'DEPARTAMENTO':
      return 'DEPARTAMENTO';
  }
}

export interface DecisaoUsuarioCatalogoItem {
  catalogo_tipo: CatalogoTipo;
  valor_normalizado: string;
  decisao: DecisaoUsuarioCatalogo;
  destino_id_selecionado?: string | null;
  destino_nome_selecionado?: string | null;
  /** Rodada 1.2.1 — tipo do cadastro-destino escolhido (EMPRESA/LOCADORA/etc.). */
  cadastro_destino_tipo?: TipoDestinoCadastro | null;
  /** Rodada 1.2.1 — quando a decisão é contextual por linha (placeholder/vazio). */
  linha_excel?: number | null;
}

/** Chave estável GLOBAL: `${tipo}::${valor_normalizado}` — usada quando o valor está resolvido/normalizado. */
export function chaveDecisaoUsuario(tipo: CatalogoTipo, valorNormalizado: string): string {
  return `${tipo}::${valorNormalizado}`;
}

/** Rodada 1.2.1 — Chave CONTEXTUAL por linha para placeholders / valores vazios. */
export function chaveDecisaoUsuarioLinha(tipo: CatalogoTipo, linhaExcel: number): string {
  return `${tipo}:LINHA:${linhaExcel}`;
}

export type CampoResolucao =
  | 'subcategoria'
  | 'proprietario'
  | 'centro_custo'
  | 'fabricante'
  | 'modelo'
  | 'departamento';

export interface ResolucaoCampo {
  catalogo_tipo: CatalogoTipo;
  valor_origem: string | null;
  match_tipo: MatchTipoCatalogo;
  status_resolucao: StatusResolucaoCatalogo;
  cadastro_destino_id: string | null;
  cadastro_destino_nome: string | null;
  cadastro_destino_tipo?: TipoDestinoCadastro | null;
  decisao_usuario: DecisaoUsuarioCatalogo;
  bloqueante: boolean;
  resolvido: boolean;
}

export type CatalogResolutionByLine = Record<CampoResolucao, ResolucaoCampo>;

export type OrigemResolucao = 'EXATO' | 'CONFIRMADO_USUARIO' | 'DIRETO_PLANILHA';

export interface CampoDiferente {
  campo: string;
  valor_atual: string | number | null;
  valor_planilha: string | number | null;
  valor_proposto: string | number | null;
  origem_resolucao: OrigemResolucao;
}

/** Rodada 1.2.1 — Snapshot informativo de VALOR (não gera diff, não afeta status). */
export interface ValorInformativoLinha {
  linha_excel: number;
  numero_frota_canonico: string | null;
  valor_origem: string | null;
  valor_parseado: number | null;
  mapeamento_destino: 'NAO_CONFIRMADO';
}

/** Campos considerados bloqueantes — nunca aceitam IGNORAR_CAMPO_OPCIONAL. */
export const CAMPOS_BLOQUEANTES_SET: readonly CampoResolucao[] = [
  'proprietario',
  'subcategoria',
  'centro_custo',
] as const;

export function isCampoBloqueante(c: CampoResolucao): boolean {
  return CAMPOS_BLOQUEANTES_SET.includes(c);
}

export function campoDoCatalogo(tipo: CatalogoTipo): CampoResolucao | null {
  switch (tipo) {
    case 'SUBCATEGORIA':
      return 'subcategoria';
    case 'PROPRIETARIO_EMPRESA':
    case 'PROPRIETARIO_LOCADORA':
      return 'proprietario';
    case 'CENTRO_CUSTO':
      return 'centro_custo';
    case 'FABRICANTE':
      return 'fabricante';
    case 'MODELO':
      return 'modelo';
    case 'DEPARTAMENTO':
      return 'departamento';
  }
}
