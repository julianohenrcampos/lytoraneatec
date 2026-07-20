import * as XLSX from 'xlsx';
import type { DecisaoLinha, DryRunSnapshot, MapaCatalogoLinha, CatalogoTipo } from './types';
import type { ParseWorkbookResult } from './parseWorkbook';
import type { BancoIndex } from './queryBanco';

export interface GerarRelatorioInput {
  parse: ParseWorkbookResult;
  decisoes: DecisaoLinha[];
  banco: BancoIndex;
  snapshot: DryRunSnapshot;
  duplicidadesNoArquivo: Array<{ canonico: string; linhas_excel: number[] }>;
  mapaCatalogo: MapaCatalogoLinha[];
}

function flat(d: DecisaoLinha) {
  return {
    aba_origem: d.linha.aba_origem,
    linha_excel: d.linha.linha_excel,
    codigo_ativo_original: d.linha.codigo_ativo_original,
    numero_frota_prefixo: d.linha.numero_frota_prefixo,
    numero_frota_numero: d.linha.numero_frota_numero,
    numero_frota_canonico: d.linha.numero_frota_canonico,
    obra_codigo: d.linha.obra_codigo,
    tipo_equipamento_raw: d.linha.tipo_equipamento_raw,
    fabricante_raw: d.linha.fabricante_raw,
    modelo_raw: d.linha.modelo_raw,
    empresa_raw: d.linha.empresa_raw,
    valor_raw: d.linha.valor_raw,
    ano_fabricacao_raw: d.linha.ano_fabricacao_raw,
    acao_base: d.acao_base,
    status_validacao: d.status_validacao,
    origem_match: d.origem_match,
    id_existente: d.banco_match_id,
    ids_existentes: d.banco_match_ids.join(','),
    frota_id: d.banco_frota_id_texto,
    frota_codigo_por_id: d.frota_codigo_por_id,
    frota_texto_legado: d.frota_texto_legado,
    motivos: d.motivos.join(','),
    alertas: d.alertas.join(','),
    pendencias_bloqueantes: (d.pendencias_bloqueantes ?? []).join(','),
    alertas_catalogo: (d.alertas_catalogo ?? []).join(','),
    item_origem_raw: d.linha.item_origem_raw,
    item_origem_invalido: d.linha.item_origem_invalido,
  };
}

export function gerarRelatorioXlsx(input: GerarRelatorioInput): Blob {
  const wb = XLSX.utils.book_new();

  const c = input.snapshot.contagens;
  const e = input.snapshot.escopo;
  const rec = input.snapshot.reconciliacao;
  const resumo: Array<Array<string | number>> = [
    ['ARQUIVO', input.snapshot.arquivo_nome],
    ['SHA-256', input.snapshot.arquivo_sha256],
    ['BYTES', input.snapshot.arquivo_bytes],
    ['GERADO_EM', input.snapshot.gerado_em_iso],
    ['ABA', input.parse.aba],
    [],
    ['-- ESCOPO --'],
    ['executor_user_id', e.executor_user_id ?? ''],
    ['is_super_admin', String(e.is_super_admin)],
    ['acesso_global', String(e.acesso_global)],
    ['equipamentos_snapshot_count', e.equipamentos_snapshot_count],
    ['equipamentos_total_count', e.equipamentos_total_count ?? ''],
    ['paridade_snapshot', String(e.paridade_snapshot)],
    ['escopo_resultado', e.escopo_resultado],
    [],
    ['-- CONTAGENS --'],
    ['total_bruto', c.total_bruto],
    ['linhas_uteis', c.linhas_uteis],
    ['linhas_ignoradas', c.linhas_ignoradas],
    ['codigos_unicos_no_arquivo', c.codigos_unicos_no_arquivo],
    ['duplicidades_no_arquivo', c.duplicidades_no_arquivo],
    ['duplicidades_no_banco', c.duplicidades_no_banco],
    ['matches_frota_id', c.matches_frota_id],
    ['matches_canonico', c.matches_canonico],
    ['sem_match', c.sem_match],
    ['ativos_novos_com_frota_valida', c.ativos_novos_com_frota_valida],
    ['INSERIR', c.inserir],
    ['IGNORAR', c.ignorar],
    ['REVISAR', c.revisar],
    ['NAO_DETERMINADA', c.nao_determinada],
    ['NAO_APLICAVEL', c.nao_aplicavel],
    ['VALIDAS', c.validas],
    ['PENDENTES', c.pendentes],
    ['BLOQUEADAS', c.bloqueadas],
    ['frota_inconsistente_no_banco', c.frota_inconsistente_no_banco],
    ['alertas_item_invalido', c.alertas_item_invalido],
    ['alertas_frota_id_ausente', c.alertas_frota_id_ausente],
    ['alertas_catalogo_ausente', c.alertas_catalogo_ausente],
    ['pendencias_catalogo_unicas', c.pendencias_catalogo_unicas],
    ['matches_alias_sugerido', c.matches_alias_sugerido],
    ['placeholders_catalogo', c.placeholders_catalogo],
    [],
    ['-- RECONCILIAÇÃO --'],
    ['reconciliacao_ok', rec ? String(rec.ok) : ''],
    ['inconsistencias', rec ? rec.inconsistencias.join(' | ') : ''],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumo), 'RESUMO');

  const rows = input.decisoes.map(flat);

  // NOVOS = acao_base=INSERIR
  const novos = rows.filter((r) => r.acao_base === 'INSERIR');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(novos.length ? novos : [{}]), 'NOVOS');

  // EXISTENTES_SEM_DIFERENCA = IGNORAR
  const existentesSemDif = rows.filter((r) => r.acao_base === 'IGNORAR');
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(existentesSemDif.length ? existentesSemDif : [{}]),
    'EXISTENTES_SEM_DIFERENCA',
  );

  // EXISTENTES_PARA_REVISAO = REVISAR (com campos_diferentes explodidos por linha)
  const existentesRev: Array<Record<string, unknown>> = [];
  for (const d of input.decisoes) {
    if (d.acao_base !== 'REVISAR') continue;
    const base = flat(d);
    const diffs = d.campos_diferentes ?? [];
    if (diffs.length === 0) {
      existentesRev.push({ ...base, campo: '', valor_atual: '', valor_planilha: '', valor_proposto: '', origem_resolucao: '' });
    } else {
      for (const diff of diffs) {
        existentesRev.push({
          ...base,
          campo: diff.campo,
          valor_atual: diff.valor_atual,
          valor_planilha: diff.valor_planilha,
          valor_proposto: diff.valor_proposto,
          origem_resolucao: diff.origem_resolucao,
        });
      }
    }
  }
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(existentesRev.length ? existentesRev : [{}]),
    'EXISTENTES_PARA_REVISAO',
  );

  // PENDENCIAS_CATALOGO = 1 linha por linha PENDENTE (obrigatório = c.pendentes)
  const pendLinhas = input.decisoes
    .filter((d) => d.status_validacao === 'PENDENTE' && (d.pendencias_bloqueantes ?? []).length > 0)
    .map(flat);
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(pendLinhas.length ? pendLinhas : [{}]),
    'PENDENCIAS_CATALOGO',
  );

  // MAPA_CATALOGO detalhado + resumo por tipo
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(input.mapaCatalogo), 'MAPA_CATALOGO');

  const tipos: CatalogoTipo[] = [
    'FABRICANTE',
    'MODELO',
    'SUBCATEGORIA',
    'PROPRIETARIO_EMPRESA',
    'PROPRIETARIO_LOCADORA',
    'CENTRO_CUSTO',
    'DEPARTAMENTO',
  ];
  const resumoCatalogo = tipos.map((tipo) => {
    const linhasTipo = input.mapaCatalogo.filter((m) => m.catalogo_tipo === tipo);
    return {
      catalogo_tipo: tipo,
      total_unicos: linhasTipo.filter((m) => m.status_resolucao !== 'SEM_OCORRENCIA' && m.status_resolucao !== 'PLACEHOLDER').length,
      ocorrencias: linhasTipo.reduce((a, m) => a + m.ocorrencias, 0),
      resolvidos_exato: linhasTipo.filter((m) => m.match_tipo === 'EXATO').length,
      aliases_sugeridos: linhasTipo.filter((m) => m.match_tipo === 'ALIAS_SUGERIDO').length,
      ambiguos: linhasTipo.filter((m) => m.match_tipo === 'AMBIGUO').length,
      nao_resolvidos: linhasTipo.filter((m) => m.match_tipo === 'SEM_MATCH').length,
      placeholders: linhasTipo
        .filter((m) => m.match_tipo === 'PLACEHOLDER')
        .reduce((a, m) => a + m.ocorrencias, 0),
    };
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumoCatalogo), 'MAPA_CATALOGO_RESUMO');

  // DUPLICIDADES_COMPOSTAS
  const dupComp: Array<Record<string, unknown>> = [];
  for (const d of input.duplicidadesNoArquivo) {
    dupComp.push({ escopo: 'ARQUIVO', canonico: d.canonico, linhas_excel: d.linhas_excel.join(','), ids_existentes: '' });
  }
  for (const d of input.banco.duplicidadesCanonicas) {
    dupComp.push({ escopo: 'BANCO', canonico: d.canonico, linhas_excel: '', ids_existentes: d.ids.join(',') });
  }
  for (const r of rows.filter((r) => r.motivos.includes('FROTA_INCONSISTENTE_NO_BANCO'))) {
    dupComp.push({
      escopo: 'FROTA_INCONSISTENTE_NO_BANCO',
      canonico: r.numero_frota_canonico,
      linhas_excel: String(r.linha_excel),
      ids_existentes: r.id_existente,
      frota_id: r.frota_id,
      frota_codigo_por_id: r.frota_codigo_por_id,
      frota_texto_legado: r.frota_texto_legado,
      numero_frota_original: r.codigo_ativo_original,
    });
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dupComp.length ? dupComp : [{}]), 'DUPLICIDADES_COMPOSTAS');

  const bloq = rows.filter((r) => r.status_validacao === 'BLOQUEADA');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bloq.length ? bloq : [{}]), 'BLOQUEADAS');

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      input.parse.ignoradas.length
        ? input.parse.ignoradas.map((i) => ({
            linha_excel: i.linha_excel,
            motivo: i.motivo,
            codigo_ativo_original: i.codigo_ativo_original,
            acao_base: 'NAO_APLICAVEL',
            status_validacao: 'IGNORADA',
          }))
        : [{}],
    ),
    'IGNORADAS',
  );

  const alertasCatalogo = rows.filter((r) => r.alertas.split(',').includes('CAMPO_CATALOGO_AUSENTE'));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(alertasCatalogo.length ? alertasCatalogo : [{}]),
    'ALERTAS_CATALOGO_AUSENTE',
  );

  // VALOR_INFORMATIVO — Rodada 1.2.1: valor da planilha registrado sem gerar diff.
  const valorInformativo = input.decisoes
    .map((d) => d.valor_snapshot)
    .filter((v): v is NonNullable<typeof v> => !!v && (v.valor_origem !== null || v.valor_parseado !== null));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(valorInformativo.length ? valorInformativo : [{}]),
    'VALOR_INFORMATIVO',
  );

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{}]), 'LINHAS_UTEIS');

  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
