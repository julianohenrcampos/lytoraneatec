import { parseWorkbookRomulo, type ParseWorkbookResult } from './parseWorkbook';
import {
  fetchProjecaoBancoFrotas,
  indexarBanco,
  fetchCatalogosParaMapa,
  fetchPrefixosFrotas,
} from './queryBanco';
import type { BancoIndex } from './queryBanco';
import { preValidate } from './preValidate';
import { gerarRelatorioXlsx } from './gerarRelatorioXlsx';
import {
  construirMapaCatalogo,
  contarPendenciasCatalogo,
  contarPlaceholders,
  contarAliasSugeridos,
} from './mapaCatalogo';
import { recomputeDecisions } from './recomputeDecisions';
import type { DecisaoUsuarioCatalogoItem } from './tiposResolucao';
import { supabase } from '@/integrations/supabase/client';
import type {
  DryRunSnapshot,
  DryRunEscopo,
  MapaCatalogoLinha,
  DatasetEvidencia,
  DecisaoLinha,
  BancoFrotaProjecao,
} from './types';

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256OfJson(obj: unknown): Promise<string> {
  const enc = new TextEncoder();
  const buf = enc.encode(JSON.stringify(obj));
  return sha256Hex(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

async function coletarEscopo(
  equipamentosSnapshotCount: number,
  equipamentosTotalCount: number | null,
): Promise<DryRunEscopo> {
  let executor_user_id: string | null = null;
  let is_super_admin = false;
  let acesso_global = false;
  try {
    const { data: userRes } = await supabase.auth.getUser();
    executor_user_id = userRes?.user?.id ?? null;
    if (executor_user_id) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('acesso_global, funcao_sistema')
        .eq('id', executor_user_id)
        .maybeSingle();
      acesso_global = Boolean(prof?.acesso_global);
      const { data: isAdm } = await supabase.rpc('check_is_super_admin', { user_id: executor_user_id });
      is_super_admin = Boolean(isAdm) || String(prof?.funcao_sistema ?? '').toLowerCase() === 'superadm';
    }
  } catch {
    // silencioso
  }
  const paridade = equipamentosTotalCount !== null && equipamentosSnapshotCount === equipamentosTotalCount;
  let escopo_resultado: DryRunEscopo['escopo_resultado'] = 'INDETERMINADO';
  if (equipamentosTotalCount !== null) {
    if (paridade && is_super_admin && acesso_global) escopo_resultado = 'GLOBAL';
    else escopo_resultado = 'PARCIAL';
  }
  return {
    executor_user_id,
    is_super_admin,
    acesso_global,
    equipamentos_snapshot_count: equipamentosSnapshotCount,
    equipamentos_total_count: equipamentosTotalCount,
    paridade_snapshot: paridade,
    escopo_resultado,
  };
}

export interface DryRunContext {
  parse: ParseWorkbookResult;
  bancoRows: BancoFrotaProjecao[];
  banco: BancoIndex;
  frotasPorPrefixo: Set<string>;
  duplicidadesNoArquivo: Array<{ canonico: string; linhas_excel: number[] }>;
  mapaCatalogo: MapaCatalogoLinha[];
  decisoesPre: DecisaoLinha[];
  arquivoNome: string;
  arquivoSha256: string;
  arquivoBytes: number;
  equipamentosTotalCount: number | null;
}

export interface DryRunResult {
  snapshot: DryRunSnapshot;
  relatorio: Blob;
  duplicidadesJson: Blob;
  pendenciasCatalogoJson: Blob;
  mapaCatalogo: MapaCatalogoLinha[];
  contexto: DryRunContext;
  decisoesFinal: DecisaoLinha[];
}

/** Rodada 1.2 — pipeline: parse → banco → mapa → recompute (com decisões opcionais) → xlsx */
export async function executarDryRun(
  file: File,
  decisoesUsuarioCatalogo: Map<string, DecisaoUsuarioCatalogoItem> = new Map(),
  contextoReuso?: DryRunContext,
): Promise<DryRunResult> {
  let ctx: DryRunContext;
  if (contextoReuso) {
    ctx = contextoReuso;
  } else {
    const buffer = await file.arrayBuffer();
    const sha = await sha256Hex(buffer);
    const parse = parseWorkbookRomulo(buffer, file.name);
    const { rows: bancoRows, totalCount } = await fetchProjecaoBancoFrotas();
    const banco = indexarBanco(bancoRows);
    const frotasPorPrefixo = await fetchPrefixosFrotas().catch(() => new Set<string>());
    const { decisoes: decisoesPre, duplicidadesNoArquivo } = preValidate({
      linhas: parse.linhas,
      banco,
      frotasPorPrefixo,
    });
    const catalogos = await fetchCatalogosParaMapa();
    const mapaCatalogo = construirMapaCatalogo(decisoesPre, catalogos);
    ctx = {
      parse,
      bancoRows,
      banco,
      frotasPorPrefixo,
      duplicidadesNoArquivo,
      mapaCatalogo,
      decisoesPre,
      arquivoNome: file.name,
      arquivoSha256: sha,
      arquivoBytes: buffer.byteLength,
      equipamentosTotalCount: totalCount,
    };
  }

  // Recompute — sempre roda (com ou sem decisões do usuário)
  const rec = recomputeDecisions({
    decisoes: ctx.decisoesPre,
    mapaCatalogo: ctx.mapaCatalogo,
    decisoesUsuarioCatalogo,
    bancoRows: ctx.bancoRows,
  });
  const decisoes = rec.decisoes;

  const codigosUnicos = new Set(ctx.parse.linhas.map((l) => l.numero_frota_canonico!).filter(Boolean));
  const count = (fn: (d: DecisaoLinha) => boolean) => decisoes.filter(fn).length;

  const contagens = {
    total_bruto: ctx.parse.totalBruto,
    linhas_uteis: ctx.parse.linhas.length,
    linhas_ignoradas: ctx.parse.ignoradas.length,
    codigos_unicos_no_arquivo: codigosUnicos.size,
    duplicidades_no_arquivo: ctx.duplicidadesNoArquivo.length,
    duplicidades_no_banco: ctx.banco.duplicidadesCanonicas.length,
    matches_frota_id: count((d) => d.origem_match === 'FROTA_ID'),
    matches_texto_legado: count((d) => d.origem_match === 'TEXTO_LEGADO'),
    matches_canonico: count((d) => d.origem_match === 'CANONICO'),
    sem_match: count((d) => d.origem_match === 'SEM_MATCH'),
    inserir: rec.contagens.inserir,
    ignorar: rec.contagens.ignorar,
    revisar: rec.contagens.revisar,
    nao_determinada: rec.contagens.nao_determinada,
    nao_aplicavel: ctx.parse.ignoradas.length,
    validas: rec.contagens.validas,
    pendentes: rec.contagens.pendentes,
    bloqueadas: rec.contagens.bloqueadas,
    ignoradas_status: ctx.parse.ignoradas.length,
    frota_inconsistente_no_banco: count((d) => d.motivos.includes('FROTA_INCONSISTENTE_NO_BANCO')),
    alertas_item_invalido: count((d) => d.alertas.includes('ITEM_ORIGEM_INVALIDO')),
    alertas_frota_id_ausente: count((d) => d.alertas.includes('FROTA_ID_AUSENTE_NO_CADASTRO')),
    alertas_catalogo_ausente: count((d) => d.alertas.includes('CAMPO_CATALOGO_AUSENTE')),
    ativos_novos_com_frota_valida: count(
      (d) => d.acao_base === 'INSERIR' && d.motivos.includes('ATIVO_NAO_ENCONTRADO_NO_BANCO'),
    ),
    pendencias_catalogo_unicas: contarPendenciasCatalogo(ctx.mapaCatalogo),
    matches_alias_sugerido: contarAliasSugeridos(ctx.mapaCatalogo),
    placeholders_catalogo: contarPlaceholders(ctx.mapaCatalogo),
  };

  // Reconciliação obrigatória
  const inconsist: string[] = [];
  const linhasUteis = contagens.linhas_uteis;
  if (contagens.inserir + contagens.ignorar + contagens.revisar + contagens.nao_determinada !== linhasUteis) {
    inconsist.push('SOMA_ACAO_BASE != linhas_uteis');
  }
  if (contagens.validas + contagens.pendentes + contagens.bloqueadas !== linhasUteis) {
    inconsist.push('SOMA_STATUS != linhas_uteis');
  }
  if (!rec.invariantes.ok) inconsist.push(...rec.invariantes.violacoes.slice(0, 10));

  const escopo = await coletarEscopo(ctx.bancoRows.length, ctx.equipamentosTotalCount);

  const datasets: Record<string, DatasetEvidencia> = {
    equipamentos_projecao: {
      row_count: ctx.bancoRows.length,
      total_count_query: ctx.equipamentosTotalCount,
      sha256: await sha256OfJson(ctx.bancoRows.map((r) => ({ id: r.id, canonico: r.numero_frota_canonico }))),
    },
    decisoes: {
      row_count: decisoes.length,
      total_count_query: decisoes.length,
      sha256: await sha256OfJson(decisoes),
    },
    mapa_catalogo: {
      row_count: ctx.mapaCatalogo.length,
      total_count_query: ctx.mapaCatalogo.length,
      sha256: await sha256OfJson(ctx.mapaCatalogo),
    },
    ignoradas: {
      row_count: ctx.parse.ignoradas.length,
      total_count_query: ctx.parse.ignoradas.length,
      sha256: await sha256OfJson(ctx.parse.ignoradas),
    },
  };

  const snapshot: DryRunSnapshot = {
    gerado_em_iso: new Date().toISOString(),
    arquivo_nome: ctx.arquivoNome,
    arquivo_sha256: ctx.arquivoSha256,
    arquivo_bytes: ctx.arquivoBytes,
    aba: ctx.parse.aba,
    escopo,
    contagens,
    banco: {
      total_registros_ativos: ctx.bancoRows.length,
      duplicidades_canonicas: ctx.banco.duplicidadesCanonicas,
      prefixos_frotas: Array.from(ctx.frotasPorPrefixo).sort(),
    },
    datasets,
    dados: {
      decisoes,
      mapa_catalogo: ctx.mapaCatalogo,
      linhas_ignoradas: ctx.parse.ignoradas,
      duplicidades_no_arquivo: ctx.duplicidadesNoArquivo,
      duplicidades_no_banco: ctx.banco.duplicidadesCanonicas,
    },
    arquivos_gerados: {
      relatorio_xlsx: null,
      duplicidades_json: null,
      pendencias_catalogo_json: null,
    },
    reconciliacao: { ok: inconsist.length === 0, inconsistencias: inconsist },
  };

  const relatorio = gerarRelatorioXlsx({
    parse: ctx.parse,
    decisoes,
    banco: ctx.banco,
    snapshot,
    duplicidadesNoArquivo: ctx.duplicidadesNoArquivo,
    mapaCatalogo: ctx.mapaCatalogo,
  });

  const frotaInconsistente = decisoes
    .filter((d) => d.motivos.includes('FROTA_INCONSISTENTE_NO_BANCO'))
    .map((d) => ({
      linha_excel: d.linha.linha_excel,
      numero_frota_original: d.linha.codigo_ativo_original,
      numero_frota_canonico: d.linha.numero_frota_canonico,
      id_existente: d.banco_match_id,
      frota_id: d.banco_frota_id_texto,
      frota_codigo_por_id: d.frota_codigo_por_id,
      frota_texto_legado: d.frota_texto_legado,
    }));

  const duplicidadesJson = new Blob(
    [
      JSON.stringify(
        {
          duplicidades_no_arquivo: ctx.duplicidadesNoArquivo,
          duplicidades_no_banco: ctx.banco.duplicidadesCanonicas,
          frota_inconsistente_no_banco: frotaInconsistente,
        },
        null,
        2,
      ),
    ],
    { type: 'application/json' },
  );

  // PENDENCIAS_CATALOGO agora é linha-a-linha (não agregado por catálogo)
  const pendenciasLinhas = decisoes
    .filter((d) => d.status_validacao === 'PENDENTE' && (d.pendencias_bloqueantes ?? []).length > 0)
    .map((d) => ({
      linha_excel: d.linha.linha_excel,
      numero_frota_canonico: d.linha.numero_frota_canonico,
      acao_base: d.acao_base,
      pendencias_bloqueantes: d.pendencias_bloqueantes,
      alertas_catalogo: d.alertas_catalogo,
      subcategoria: d.resolucao_catalogos?.subcategoria,
      proprietario: d.resolucao_catalogos?.proprietario,
      centro_custo: d.resolucao_catalogos?.centro_custo,
    }));
  const pendenciasCatalogoJson = new Blob([JSON.stringify(pendenciasLinhas, null, 2)], {
    type: 'application/json',
  });

  return {
    snapshot,
    relatorio,
    duplicidadesJson,
    pendenciasCatalogoJson,
    mapaCatalogo: ctx.mapaCatalogo,
    contexto: ctx,
    decisoesFinal: decisoes,
  };
}
