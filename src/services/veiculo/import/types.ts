// Rodada 1.2 — Dry-Run. Nenhum tipo aqui participa de mutação.

import type { CatalogResolutionByLine, CampoDiferente, ValorInformativoLinha } from './tiposResolucao';

export type AcaoBase =
  | 'INSERIR'
  | 'IGNORAR'
  | 'REVISAR'
  | 'NAO_DETERMINADA'
  | 'NAO_APLICAVEL';

export type StatusValidacao =
  | 'VALIDA'
  | 'OK' // legado, equivalente a VALIDA
  | 'PENDENTE'
  | 'BLOQUEADA'
  | 'IGNORADA'
  | 'NAO_DETERMINADA';

export type OrigemFrotaMatch =
  | 'FROTA_ID'
  | 'TEXTO_LEGADO'
  | 'CANONICO'
  | 'SEM_MATCH'
  | 'NAO_APLICAVEL';

export type MotivoValidacao =
  | 'OK'
  | 'SEM_CODIGO_ATIVO'
  | 'ITEM_INVALIDO'
  | 'FORMATO_CODIGO_INVALIDO'
  | 'DUPLICIDADE_CANONICA_NO_ARQUIVO'
  | 'DUPLICIDADE_CANONICA_NO_BANCO'
  | 'FROTA_INCONSISTENTE_NO_BANCO'
  | 'POSSIVEL_COLISAO_LEGADA'
  | 'SUBCATEGORIA_NAO_RESOLVIDA'
  | 'EMPRESA_NAO_RESOLVIDA'
  | 'FROTA_NAO_RESOLVIDA'
  | 'FROTA_ID_AUSENTE_NO_CADASTRO'
  | 'ATIVO_NAO_ENCONTRADO_NO_BANCO';

export type AlertaLinha =
  | 'ITEM_ORIGEM_INVALIDO'
  | 'TIPO_EQUIPAMENTO_VAZIO'
  | 'EMPRESA_TEXTO_LEGADO'
  | 'VALOR_AUSENTE'
  | 'FROTA_ID_AUSENTE_NO_CADASTRO'
  | 'CAMPO_CATALOGO_AUSENTE';

export type PendenciaBloqueante =
  | 'PROPRIETARIO_NAO_RESOLVIDO'
  | 'SUBCATEGORIA_NAO_RESOLVIDA'
  | 'CENTRO_CUSTO_NAO_RESOLVIDO'
  | 'IDENTIDADE_BLOQUEADA';

export type AlertaCatalogo =
  | 'FABRICANTE_NAO_RESOLVIDO'
  | 'MODELO_NAO_RESOLVIDO'
  | 'DEPARTAMENTO_NAO_RESOLVIDO'
  | 'CATALOGO_PLACEHOLDER'
  | 'CENTRO_CUSTO_DIVERGENTE_INFORMATIVO';

export interface LinhaBrutaRomulo {
  aba_origem: string;
  linha_excel: number;
  item_origem_raw: string | null;
  item_origem_invalido: boolean;
  codigo_ativo_original: string | null;
  obra_codigo: string | null;
  obra_descricao: string | null;
  tipo_equipamento_raw: string | null;
  contrato: string | null;
  fabricante_raw: string | null;
  modelo_raw: string | null;
  ano_fabricacao_raw: string | null;
  empresa_raw: string | null;
  com_operador: string | null;
  valor_raw: string | null;
  extras: Record<string, unknown>;
}

export interface LinhaCanonica extends LinhaBrutaRomulo {
  numero_frota_prefixo: string | null;
  numero_frota_numero: string | null;
  numero_frota_canonico: string | null;
  regex_ok: boolean;
}

export interface DecisaoLinha {
  linha: LinhaCanonica;
  acao_base: AcaoBase;
  status_validacao: StatusValidacao;
  motivos: MotivoValidacao[];
  alertas: AlertaLinha[];
  origem_match: OrigemFrotaMatch;
  banco_match_id: string | null;
  banco_match_ids: string[];
  banco_frota_id_texto: string | null;
  banco_numero_frota_texto: string | null;
  frota_codigo_por_id: string | null;
  frota_texto_legado: string | null;
  // Preenchidos por recomputeDecisions (Rodada 1.2)
  resolucao_catalogos?: CatalogResolutionByLine;
  pendencias_bloqueantes?: string[];
  alertas_catalogo?: string[];
  campos_diferentes?: CampoDiferente[];
  /** Rodada 1.2.1 — VALOR/aluguel apenas informativo, nunca gera diff. */
  valor_snapshot?: ValorInformativoLinha;
}

export interface BancoComparaveis {
  subcategoria_ativo_id: string | null;
  fabricante_id: string | null;
  modelo_id: string | null;
  empresa_id: string | null;
  empresa_locadora_id: string | null;
  departamento_id: string | null;
  centro_custo_atual_id: string | null;
  ano_fabricacao: string | null;
  aluguel: string | null;
}

export interface BancoFrotaProjecao {
  id: string;
  frota_id_texto: string | null;
  numero_frota_texto: string | null;
  numero_frota_canonico: string | null;
  comparaveis?: BancoComparaveis;
}

export type CatalogoTipo =
  | 'FABRICANTE'
  | 'MODELO'
  | 'SUBCATEGORIA'
  | 'PROPRIETARIO_EMPRESA'
  | 'PROPRIETARIO_LOCADORA'
  | 'CENTRO_CUSTO'
  | 'DEPARTAMENTO';

export type StatusResolucaoCatalogo = 'RESOLVIDO' | 'NAO_RESOLVIDO' | 'AMBIGUO' | 'SEM_OCORRENCIA' | 'PLACEHOLDER';

export type MatchTipoCatalogo = 'EXATO' | 'ALIAS_SUGERIDO' | 'SEM_MATCH' | 'PLACEHOLDER' | 'AMBIGUO' | 'SEM_OCORRENCIA';

export interface MapaCatalogoLinha {
  catalogo_tipo: CatalogoTipo;
  valor_origem: string;
  valor_normalizado: string;
  ocorrencias: number;
  linhas_excel: string;
  status_resolucao: StatusResolucaoCatalogo;
  match_tipo: MatchTipoCatalogo;
  confianca: number; // 0..1
  cadastro_destino_id: string | null;
  cadastro_destino_nome: string | null;
  candidatos_ids: string; // csv
  candidatos_nomes: string; // csv
  decisao_usuario: 'AGUARDANDO_REVISAO';
}

export interface DatasetEvidencia {
  row_count: number;
  total_count_query: number | null;
  sha256: string;
}

export interface DryRunEscopo {
  executor_user_id: string | null;
  is_super_admin: boolean;
  acesso_global: boolean;
  equipamentos_snapshot_count: number;
  equipamentos_total_count: number | null;
  paridade_snapshot: boolean;
  escopo_resultado: 'GLOBAL' | 'PARCIAL' | 'INDETERMINADO';
}

export interface DryRunSnapshot {
  gerado_em_iso: string;
  arquivo_nome: string;
  arquivo_sha256: string;
  arquivo_bytes: number;
  aba: string;
  escopo: DryRunEscopo;
  contagens: {
    total_bruto: number;
    linhas_uteis: number;
    linhas_ignoradas: number;
    codigos_unicos_no_arquivo: number;
    duplicidades_no_arquivo: number;
    duplicidades_no_banco: number;
    matches_frota_id: number;
    matches_texto_legado: number;
    matches_canonico: number;
    sem_match: number;
    inserir: number;
    ignorar: number;
    revisar: number;
    nao_determinada: number;
    nao_aplicavel: number;
    validas: number;
    pendentes: number;
    bloqueadas: number;
    ignoradas_status: number;
    frota_inconsistente_no_banco: number;
    alertas_item_invalido: number;
    alertas_frota_id_ausente: number;
    alertas_catalogo_ausente: number;
    ativos_novos_com_frota_valida: number;
    pendencias_catalogo_unicas: number;
    matches_alias_sugerido: number;
    placeholders_catalogo: number;
  };
  banco: {
    total_registros_ativos: number;
    duplicidades_canonicas: Array<{ canonico: string; ids: string[] }>;
    prefixos_frotas: string[];
  };
  datasets: Record<string, DatasetEvidencia>;
  // Opção B: arrays completos incluídos para reprodutibilidade
  dados: {
    decisoes: unknown[];
    mapa_catalogo: unknown[];
    linhas_ignoradas: unknown[];
    duplicidades_no_arquivo: unknown[];
    duplicidades_no_banco: unknown[];
  };
  arquivos_gerados: {
    relatorio_xlsx: string | null;
    duplicidades_json: string | null;
    pendencias_catalogo_json: string | null;
  };
  // Reconciliação (asserts em runtime)
  reconciliacao?: {
    ok: boolean;
    inconsistencias: string[];
  };
}
