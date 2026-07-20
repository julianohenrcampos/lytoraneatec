// PR-3 V3 — Relatório XLSX acumulado. Contempla todas as execuções acumuladas
// da sessão + linhas ainda não processadas. Zero dependência de RPC.

import * as XLSX from 'xlsx';
import type { LinhaClassificada, StatusResultado } from './classificarLinhas';
import type { ResultadoLinhaV3 } from './executarImportacaoV3';

export interface ExecucaoResumo {
  execution_id: string;
  tentativa: number;
  iniciada_em: string;
  encerrada_em: string | null;
  total: number;
  inseridas: number;
  atualizadas: number;
  ja_processadas: number;
  ja_existentes: number;
  conflitos: number;
  erros: number;
}

export interface GerarRelatorioV3Input {
  arquivoNome: string;
  arquivoSha256: string;
  linhas: LinhaClassificada[];
  resultados: ResultadoLinhaV3[]; // acumulados
  execucoes: ExecucaoResumo[];
  geradoPor?: string | null;
}

function statusFinalPorChave(resultados: ResultadoLinhaV3[]): Map<string, ResultadoLinhaV3> {
  const map = new Map<string, ResultadoLinhaV3>();
  for (const r of resultados) map.set(r.chave, r); // o último sobrescreve, mantendo o mais recente
  return map;
}

const HEADER = ['arquivo', 'linha_excel', 'codigo_exibicao', 'codigo_canonico', 'acao', 'status_inicial',
  'status_final', 'execution_id', 'tentativa', 'equipamento_id', 'campos_atualizar',
  'codigo_resultado', 'mensagem', 'timestamp'];

function rowFor(arquivo: string, l: LinhaClassificada, r: ResultadoLinhaV3 | null): (string | number)[] {
  return [
    arquivo, l.linha_excel, l.codigo_exibicao, l.codigo_canonico, l.acao_arquivo, l.status_inicial,
    r?.status_final ?? mapaStatusInicialParaFinal(l),
    r?.execution_id ?? '', r?.tentativa ?? '', r?.equipamento_id ?? '', l.campos_atualizar,
    r?.codigo_resultado ?? '', r?.mensagem ?? l.mensagem, r?.timestamp_iso ?? '',
  ];
}

function mapaStatusInicialParaFinal(l: LinhaClassificada): StatusResultado {
  if (l.status_inicial === 'SEM_ALTERACAO') return 'SEM_ALTERACAO';
  if (l.status_inicial === 'BLOQUEADO') return 'BLOQUEADO';
  if (l.status_inicial === 'ERRO') return 'ERRO_PARSER';
  return 'NAO_PROCESSADO';
}

function abaLinhas(linhas: LinhaClassificada[], arquivo: string, byKey: Map<string, ResultadoLinhaV3>): (string | number)[][] {
  const rows: (string | number)[][] = [HEADER];
  for (const l of linhas) rows.push(rowFor(arquivo, l, byKey.get(l.chave) ?? null));
  return rows;
}

export function gerarRelatorioV3Xlsx(input: GerarRelatorioV3Input): Blob {
  const byKey = statusFinalPorChave(input.resultados);
  const wb = XLSX.utils.book_new();

  // ─── RESUMO ─────────────────────────────────────────────────────────────
  const totalArquivo = input.linhas.length;
  const novos = input.linhas.filter((l) => l.status_inicial === 'NOVO_VALIDO').length;
  const updates = input.linhas.filter((l) => l.status_inicial === 'UPDATE_VALIDO').length;
  const semAlt = input.linhas.filter((l) => l.status_inicial === 'SEM_ALTERACAO').length;
  const bloq = input.linhas.filter((l) => l.status_inicial === 'BLOQUEADO').length;
  const errosParser = input.linhas.filter((l) => l.status_inicial === 'ERRO').length;
  const contar = (s: StatusResultado) => Array.from(byKey.values()).filter((r) => r.status_final === s).length;
  const suc_ins = contar('SUCESSO_INSERT');
  const suc_upd = contar('SUCESSO_UPDATE');
  const ja_proc = contar('JA_PROCESSADO');
  const ja_exist = contar('JA_EXISTENTE');
  const confl = contar('CONFLITO');
  const errosRpc = contar('ERRO');
  const naoProc = novos + updates - suc_ins - suc_upd - ja_proc - ja_exist - confl - errosRpc;

  const resumo: (string | number)[][] = [
    ['arquivo', input.arquivoNome],
    ['arquivo_sha256', input.arquivoSha256],
    ['gerado_em_iso', new Date().toISOString()],
    ['gerado_por', input.geradoPor ?? ''],
    [],
    ['METRICA', 'VALOR'],
    ['total_arquivo', totalArquivo],
    ['novos_validos', novos],
    ['updates_validos', updates],
    ['sem_alteracao', semAlt],
    ['bloqueados', bloq],
    ['erros_parser', errosParser],
    ['sucessos_insert', suc_ins],
    ['sucessos_update', suc_upd],
    ['ja_processados', ja_proc],
    ['ja_existentes', ja_exist],
    ['conflitos', confl],
    ['erros_rpc', errosRpc],
    ['nao_processados', Math.max(0, naoProc)],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumo), 'RESUMO');

  const filtrar = (fn: (l: LinhaClassificada, r: ResultadoLinhaV3 | null) => boolean) =>
    input.linhas.filter((l) => fn(l, byKey.get(l.chave) ?? null));

  const emit = (nome: string, linhas: LinhaClassificada[]) => {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(abaLinhas(linhas, input.arquivoNome, byKey)), nome);
  };

  emit('IMPORTADOS', filtrar((_, r) => r?.status_final === 'SUCESSO_INSERT'));
  emit('ATUALIZADOS', filtrar((_, r) => r?.status_final === 'SUCESSO_UPDATE'));
  emit('SEM_ALTERACAO', filtrar((l, r) => l.status_inicial === 'SEM_ALTERACAO' || r?.status_final === 'SEM_ALTERACAO'));
  emit('JA_PROCESSADOS', filtrar((_, r) => r?.status_final === 'JA_PROCESSADO'));
  emit('JA_EXISTENTES', filtrar((_, r) => r?.status_final === 'JA_EXISTENTE'));
  emit('BLOQUEADOS', filtrar((l) => l.status_inicial === 'BLOQUEADO'));
  emit('CONFLITOS', filtrar((_, r) => r?.status_final === 'CONFLITO'));
  emit('ERROS', filtrar((l, r) => r?.status_final === 'ERRO' || l.status_inicial === 'ERRO'));
  emit(
    'NAO_PROCESSADOS',
    filtrar((l, r) => (l.status_inicial === 'NOVO_VALIDO' || l.status_inicial === 'UPDATE_VALIDO') && !r),
  );

  // ─── EXECUCOES ─────────────────────────────────────────────────────────
  const execRows: (string | number)[][] = [[
    'execution_id', 'tentativa', 'iniciada_em', 'encerrada_em', 'total',
    'inseridas', 'atualizadas', 'ja_processadas', 'ja_existentes', 'conflitos', 'erros',
  ]];
  for (const e of input.execucoes) {
    execRows.push([e.execution_id, e.tentativa, e.iniciada_em, e.encerrada_em ?? '',
      e.total, e.inseridas, e.atualizadas, e.ja_processadas, e.ja_existentes, e.conflitos, e.erros]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(execRows), 'EXECUCOES');

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function baixarBlob(blob: Blob, nome: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click();
  a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
}
