// Rodada 2A.5 — Status consolidado por linha, chave lógica e classificação.
import type { DecisaoLinha } from './types';
import type { LinhaResultadoImportacao } from './executarImportacao';

export type StatusConsolidadoImportacao =
  | 'ELEGIVEL_NAO_ENVIADO'
  | 'PROCESSANDO'
  | 'SUCESSO'
  | 'JA_PROCESSADO'
  | 'ERRO'
  | 'PENDENTE_CATALOGO'
  | 'BLOQUEADA'
  | 'EXISTENTE_REVISAR'
  | 'EXISTENTE_IGNORAR'
  | 'NAO_APLICAVEL';

export interface LinhaConsolidada {
  chave: string;
  linha_excel: number;
  aba_origem: string;
  codigo_ativo_original: string | null;
  codigo_ativo_canonico: string;
  codigo_ativo_exibicao: string;
  acao_base: DecisaoLinha['acao_base'];
  status_validacao: DecisaoLinha['status_validacao'];
  status_consolidado: StatusConsolidadoImportacao;
  execution_id_ultima_tentativa: string | null;
  numero_tentativas: number;
  equipamento_id: string | null;
  codigo_erro: string | null;
  mensagem: string | null;
  pendencias_bloqueantes: string[];
  campos_nao_resolvidos: string[];
  proprietario_origem: string | null;
  subcategoria_origem: string | null;
  centro_custo_origem: string | null;
  fabricante_origem: string | null;
  modelo_origem: string | null;
  valor_aluguel_origem: string | null;
  motivo_nao_cadastrado: MotivoNaoCadastrado | null;
  decisao: DecisaoLinha;
  historico: LinhaResultadoImportacao[];
}

export type MotivoNaoCadastrado =
  | 'ERRO_RPC'
  | 'ERRO_SCHEMA_INTERNO'
  | 'CANONICO_JA_EXISTE'
  | 'CANONICO_AMBIGUO_NO_BANCO'
  | 'IDENTIDADE_LEGADA'
  | 'PENDENCIA_PROPRIETARIO'
  | 'PENDENCIA_SUBCATEGORIA'
  | 'PENDENCIA_CENTRO_CUSTO'
  | 'BLOQUEADA'
  | 'EXISTENTE_REVISAR'
  | 'EXISTENTE_IGNORAR'
  | 'NAO_SELECIONADA'
  | 'EXECUCAO_INTERROMPIDA';

export interface StatusPersistidoLinha {
  linha_excel: number;
  codigo_ativo_canonico: string;
  status: 'SUCESSO' | 'JA_PROCESSADO' | 'ERRO' | string;
  equipamento_id: string | null;
  execution_id: string | null;
  mensagem: string | null;
  numero_tentativas: number;
}

export function chaveLinhaImportacao(input: {
  arquivo_sha256: string;
  linha_excel: number;
  codigo_ativo_canonico: string | null | undefined;
}): string {
  return `${input.arquivo_sha256}::${input.linha_excel}::${(input.codigo_ativo_canonico ?? '').toUpperCase()}`;
}

export function formatarCodigoExibicao(codigoCanonico: string): string {
  const m = /^([A-Za-z]+)(\d+)$/.exec(codigoCanonico ?? '');
  if (!m) return codigoCanonico ?? '';
  const prefixo = m[1].toUpperCase();
  const numero = m[2].replace(/^0+/, '') || '0';
  const padded = numero.padStart(Math.max(3, numero.length), '0');
  return `${prefixo}${padded}`;
}

function extrairCodigoErro(msg: string | null | undefined): string | null {
  if (!msg) return null;
  const m = /^([A-Z_]{3,})\b/.exec(msg.trim());
  return m ? m[1] : null;
}

function classificarMotivo(
  decisao: DecisaoLinha,
  status: StatusConsolidadoImportacao,
  ultimaMensagem: string | null,
): MotivoNaoCadastrado | null {
  if (status === 'SUCESSO' || status === 'JA_PROCESSADO' || status === 'ELEGIVEL_NAO_ENVIADO' || status === 'PROCESSANDO') return null;
  if (status === 'EXISTENTE_REVISAR') return 'EXISTENTE_REVISAR';
  if (status === 'EXISTENTE_IGNORAR') return 'EXISTENTE_IGNORAR';
  if (status === 'BLOQUEADA') return 'BLOQUEADA';
  if (status === 'PENDENTE_CATALOGO') {
    const pend = decisao.pendencias_bloqueantes ?? [];
    if (pend.includes('PROPRIETARIO_NAO_RESOLVIDO')) return 'PENDENCIA_PROPRIETARIO';
    if (pend.includes('SUBCATEGORIA_NAO_RESOLVIDA')) return 'PENDENCIA_SUBCATEGORIA';
    if (pend.includes('CENTRO_CUSTO_NAO_RESOLVIDO')) return 'PENDENCIA_CENTRO_CUSTO';
    return 'PENDENCIA_PROPRIETARIO';
  }
  if (status === 'ERRO') {
    const code = extrairCodigoErro(ultimaMensagem);
    if (code === 'ERRO_SCHEMA_INTERNO') return 'ERRO_SCHEMA_INTERNO';
    if (code === 'CANONICO_JA_EXISTE') return 'CANONICO_JA_EXISTE';
    if (code === 'CANONICO_AMBIGUO_NO_BANCO') return 'CANONICO_AMBIGUO_NO_BANCO';
    if (code === 'LYE246_BLOQUEADO' || code === 'IDENTIDADE_LEGADA') return 'IDENTIDADE_LEGADA';
    return 'ERRO_RPC';
  }
  return null;
}

function camposNaoResolvidos(d: DecisaoLinha): string[] {
  const out: string[] = [];
  const r = d.resolucao_catalogos;
  if (!r) return ['RESOLUCAO_AUSENTE'];
  if (!r.subcategoria.cadastro_destino_id) out.push('subcategoria');
  if (!r.proprietario.cadastro_destino_id) out.push('proprietario');
  if (!r.centro_custo.cadastro_destino_id) out.push('centro_custo');
  if (!r.fabricante.resolvido) out.push('fabricante');
  if (!r.modelo.resolvido) out.push('modelo');
  return out;
}

export interface ConsolidarInput {
  arquivoSha256: string;
  decisoes: DecisaoLinha[];
  /** Resultados de todas as execuções da sessão, em ordem. */
  resultadosAcumulados: LinhaResultadoImportacao[];
  /** Status persistido no banco (recuperado por SHA-256) — sobrescreve local se mais recente. */
  persistido?: StatusPersistidoLinha[];
  /** Linhas atualmente em processamento. */
  processando?: Set<string>;
}

export function consolidarStatusPorLinha(input: ConsolidarInput): LinhaConsolidada[] {
  const { arquivoSha256, decisoes, resultadosAcumulados, persistido = [], processando = new Set() } = input;

  // Histórico por chave (linha_excel + código canônico) — todos os resultados de execução na sessão.
  const historicoPorChave = new Map<string, LinhaResultadoImportacao[]>();
  for (const r of resultadosAcumulados) {
    const k = chaveLinhaImportacao({
      arquivo_sha256: arquivoSha256,
      linha_excel: r.linha_excel,
      codigo_ativo_canonico: r.codigo_canonico,
    });
    const arr = historicoPorChave.get(k) ?? [];
    arr.push(r);
    historicoPorChave.set(k, arr);
  }

  const persistidoPorChave = new Map<string, StatusPersistidoLinha>();
  for (const p of persistido) {
    const k = chaveLinhaImportacao({
      arquivo_sha256: arquivoSha256,
      linha_excel: p.linha_excel,
      codigo_ativo_canonico: p.codigo_ativo_canonico,
    });
    persistidoPorChave.set(k, p);
  }

  return decisoes.map((d) => {
    const canonico = (d.linha.numero_frota_canonico ?? '').toUpperCase();
    const chave = chaveLinhaImportacao({
      arquivo_sha256: arquivoSha256,
      linha_excel: d.linha.linha_excel,
      codigo_ativo_canonico: canonico,
    });
    const hist = historicoPorChave.get(chave) ?? [];
    const persist = persistidoPorChave.get(chave);
    const ultimoLocal = hist.length > 0 ? hist[hist.length - 1] : null;

    // Prefere persistido se existir. Ambos convergem em ERRO/SUCESSO/JA_PROCESSADO.
    let statusRaw: string | null = null;
    let execUltima: string | null = null;
    let equipamentoId: string | null = null;
    let mensagem: string | null = null;
    let numeroTentativas = hist.length;
    if (persist) {
      statusRaw = persist.status;
      execUltima = persist.execution_id;
      equipamentoId = persist.equipamento_id;
      mensagem = persist.mensagem;
      numeroTentativas = Math.max(numeroTentativas, persist.numero_tentativas);
    }
    if (ultimoLocal) {
      // Local mais recente que persistido: assume local.
      statusRaw = ultimoLocal.status;
      execUltima = null; // controlado pelo caller se necessário
      equipamentoId = ultimoLocal.equipamento_id;
      mensagem = ultimoLocal.mensagem;
    }

    let status: StatusConsolidadoImportacao;
    if (processando.has(chave)) status = 'PROCESSANDO';
    else if (statusRaw === 'SUCESSO') status = 'SUCESSO';
    else if (statusRaw === 'JA_PROCESSADO') status = 'JA_PROCESSADO';
    else if (statusRaw === 'ERRO') status = 'ERRO';
    else if (d.status_validacao === 'BLOQUEADA') status = 'BLOQUEADA';
    else if (d.acao_base === 'REVISAR') status = 'EXISTENTE_REVISAR';
    else if (d.acao_base === 'IGNORAR') status = 'EXISTENTE_IGNORAR';
    else if (d.acao_base === 'NAO_APLICAVEL') status = 'NAO_APLICAVEL';
    else if (d.acao_base === 'INSERIR' && d.status_validacao === 'PENDENTE') status = 'PENDENTE_CATALOGO';
    else if (d.acao_base === 'INSERIR' && (d.status_validacao === 'VALIDA' || d.status_validacao === 'OK'))
      status = 'ELEGIVEL_NAO_ENVIADO';
    else status = 'NAO_APLICAVEL';

    const motivo = classificarMotivo(d, status, mensagem);
    const res = d.resolucao_catalogos;

    return {
      chave,
      linha_excel: d.linha.linha_excel,
      aba_origem: d.linha.aba_origem,
      codigo_ativo_original: d.linha.codigo_ativo_original,
      codigo_ativo_canonico: canonico,
      codigo_ativo_exibicao: formatarCodigoExibicao(canonico),
      acao_base: d.acao_base,
      status_validacao: d.status_validacao,
      status_consolidado: status,
      execution_id_ultima_tentativa: execUltima,
      numero_tentativas: numeroTentativas,
      equipamento_id: equipamentoId,
      codigo_erro: extrairCodigoErro(mensagem),
      mensagem,
      pendencias_bloqueantes: d.pendencias_bloqueantes ?? [],
      campos_nao_resolvidos: camposNaoResolvidos(d),
      proprietario_origem: res?.proprietario.valor_origem ?? d.linha.empresa_raw ?? null,
      subcategoria_origem: res?.subcategoria.valor_origem ?? d.linha.tipo_equipamento_raw ?? null,
      centro_custo_origem: res?.centro_custo.valor_origem ?? d.linha.obra_codigo ?? null,
      fabricante_origem: res?.fabricante.valor_origem ?? d.linha.fabricante_raw ?? null,
      modelo_origem: res?.modelo.valor_origem ?? d.linha.modelo_raw ?? null,
      valor_aluguel_origem: d.linha.valor_raw ?? null,
      motivo_nao_cadastrado: motivo,
      decisao: d,
      historico: hist,
    };
  });
}

export function contagensConsolidadas(linhas: LinhaConsolidada[]) {
  const c: Record<StatusConsolidadoImportacao, number> = {
    ELEGIVEL_NAO_ENVIADO: 0,
    PROCESSANDO: 0,
    SUCESSO: 0,
    JA_PROCESSADO: 0,
    ERRO: 0,
    PENDENTE_CATALOGO: 0,
    BLOQUEADA: 0,
    EXISTENTE_REVISAR: 0,
    EXISTENTE_IGNORAR: 0,
    NAO_APLICAVEL: 0,
  };
  for (const l of linhas) c[l.status_consolidado] += 1;
  return c;
}
