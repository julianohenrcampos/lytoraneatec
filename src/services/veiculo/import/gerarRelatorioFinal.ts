// Rodada 2A.5 — Relatório Final da Importação com múltiplas abas.
import * as XLSX from 'xlsx';
import type { LinhaConsolidada, StatusConsolidadoImportacao } from './statusConsolidado';
import type { LinhaResultadoImportacao } from './executarImportacao';

export interface ExecucaoRegistro {
  execution_id: string;
  execucao_anterior_id: string | null;
  iniciada_em: string;
  encerrada_em: string | null;
  selecionadas: number;
  sucessos: number;
  ja_processados: number;
  erros: number;
}

export interface GerarRelatorioFinalInput {
  arquivo_sha256: string;
  arquivo_nome: string;
  linhas: LinhaConsolidada[];
  execucoes: ExecucaoRegistro[];
}

const NAO_CADASTRADOS: StatusConsolidadoImportacao[] = [
  'ERRO', 'PENDENTE_CATALOGO', 'BLOQUEADA', 'EXISTENTE_REVISAR', 'EXISTENTE_IGNORAR', 'ELEGIVEL_NAO_ENVIADO',
];

function flat(l: LinhaConsolidada) {
  return {
    aba_origem: l.aba_origem,
    linha_excel: l.linha_excel,
    codigo_ativo_original: l.codigo_ativo_original,
    codigo_ativo_exibicao: l.codigo_ativo_exibicao,
    codigo_ativo_canonico: l.codigo_ativo_canonico,
    acao_base: l.acao_base,
    status_validacao: l.status_validacao,
    status_consolidado: l.status_consolidado,
    execution_id_ultima_tentativa: l.execution_id_ultima_tentativa ?? '',
    numero_tentativas: l.numero_tentativas,
    equipamento_id: l.equipamento_id ?? '',
    codigo_erro: l.codigo_erro ?? '',
    mensagem: l.mensagem ?? '',
    pendencias_bloqueantes: l.pendencias_bloqueantes.join(','),
    campos_nao_resolvidos: l.campos_nao_resolvidos.join(','),
    proprietario_origem: l.proprietario_origem ?? '',
    subcategoria_origem: l.subcategoria_origem ?? '',
    centro_custo_origem: l.centro_custo_origem ?? '',
    fabricante_origem: l.fabricante_origem ?? '',
    modelo_origem: l.modelo_origem ?? '',
    valor_aluguel_origem: l.valor_aluguel_origem ?? '',
    motivo_nao_cadastrado: l.motivo_nao_cadastrado ?? '',
  };
}

export function gerarRelatorioFinalXlsx(input: GerarRelatorioFinalInput): Blob {
  const wb = XLSX.utils.book_new();

  const contagens: Record<string, number> = {};
  for (const l of input.linhas) contagens[l.status_consolidado] = (contagens[l.status_consolidado] ?? 0) + 1;

  const resumo = [
    { chave: 'arquivo_nome', valor: input.arquivo_nome },
    { chave: 'arquivo_sha256', valor: input.arquivo_sha256 },
    { chave: 'total_linhas', valor: input.linhas.length },
    ...Object.entries(contagens).map(([k, v]) => ({ chave: k, valor: v })),
    { chave: 'total_execucoes', valor: input.execucoes.length },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumo), 'RESUMO');

  const todas = input.linhas.map(flat);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(todas), 'TODAS_AS_LINHAS');

  const filtrar = (fn: (l: LinhaConsolidada) => boolean) =>
    XLSX.utils.json_to_sheet(input.linhas.filter(fn).map(flat));

  XLSX.utils.book_append_sheet(wb, filtrar((l) => l.status_consolidado === 'SUCESSO'), 'IMPORTADOS');
  XLSX.utils.book_append_sheet(wb, filtrar((l) => l.status_consolidado === 'JA_PROCESSADO'), 'JA_PROCESSADOS');
  XLSX.utils.book_append_sheet(wb, filtrar((l) => l.status_consolidado === 'ERRO'), 'ERROS');
  XLSX.utils.book_append_sheet(wb, filtrar((l) => NAO_CADASTRADOS.includes(l.status_consolidado)), 'NAO_CADASTRADOS');
  XLSX.utils.book_append_sheet(wb, filtrar((l) => l.status_consolidado === 'PENDENTE_CATALOGO'), 'PENDENTES_CATALOGO');
  XLSX.utils.book_append_sheet(wb, filtrar((l) => l.status_consolidado === 'BLOQUEADA'), 'BLOQUEADAS');
  XLSX.utils.book_append_sheet(wb, filtrar((l) => l.status_consolidado === 'EXISTENTE_REVISAR'), 'EXISTENTES_REVISAR');
  XLSX.utils.book_append_sheet(wb, filtrar((l) => l.status_consolidado === 'EXISTENTE_IGNORAR'), 'EXISTENTES_IGNORAR');

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(input.execucoes), 'EXECUCOES');

  const array = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return new Blob([array], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function gerarRelatorioFinalJson(input: GerarRelatorioFinalInput): Blob {
  return new Blob([JSON.stringify(input, null, 2)], { type: 'application/json' });
}

export function gerarSomenteErrosXlsx(linhas: LinhaConsolidada[]): Blob {
  const wb = XLSX.utils.book_new();
  const rows = linhas.filter((l) => l.status_consolidado === 'ERRO').map(flat);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'ERROS');
  const array = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return new Blob([array], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function gerarHistoricoExecucoesJson(input: GerarRelatorioFinalInput, resultados: LinhaResultadoImportacao[]): Blob {
  return new Blob([JSON.stringify({ execucoes: input.execucoes, resultados }, null, 2)], { type: 'application/json' });
}
