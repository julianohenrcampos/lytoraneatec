// Rodada 2A / 2A.2 — Execução da importação (apenas INSERIR + VALIDA).
// Zero business logic no frontend: o backend revalida tudo via RPC.
// Rodada 2A.2: numero_frota é armazenado com padding mínimo de 3 dígitos.

import { supabase } from '@/integrations/supabase/client';
import type { DecisaoLinha } from './types';
import { formatarNumeroFrota } from './splitCodigoAtivo';
import { parseMoedaBR } from '@/utils/parseMoedaBR';

export interface LinhaResultadoImportacao {
  linha_excel: number;
  /** Identidade canônica sem zeros à esquerda (usado para idempotência). */
  codigo_canonico: string;
  /** Código para exibição, com padding mínimo de 3 dígitos no número. */
  codigo_exibicao: string;
  status: 'SUCESSO' | 'ERRO' | 'JA_PROCESSADO';
  equipamento_id: string | null;
  mensagem: string | null;
  payload_gravado: Record<string, unknown> | null;
}

function formatarCodigoExibicao(codigoCanonico: string): string {
  const m = /^([A-Za-z]+)(\d+)$/.exec(codigoCanonico ?? '');
  if (!m) return codigoCanonico ?? '';
  const prefixo = m[1].toUpperCase();
  const numero = m[2].replace(/^0+/, '') || '0';
  const padded = numero.padStart(Math.max(3, numero.length), '0');
  return `${prefixo}${padded}`;
}

function classificarMensagemErro(msg: string | null | undefined, code?: string | null): string {
  const m = (msg ?? '').toString();
  if (code === '42703' || /does not exist/i.test(m) || /column .* does not exist/i.test(m)) {
    return `ERRO_SCHEMA_INTERNO: ${m}`;
  }
  return m || 'ERRO_INESPERADO';
}

export interface ResumoImportacao {
  selecionados: number;
  inseridos: number;
  ja_processados: number;
  erros: number;
}

export interface ProgressoImportacao {
  loteAtual: number;
  totalLotes: number;
  processadasLote: number;
  totalLote: number;
  processadasGeral: number;
  totalGeral: number;
  sucessos: number;
  ja_processados: number;
  erros: number;
  ultimaLinha?: LinhaResultadoImportacao;
}

export interface ExecutarImportacaoInput {
  decisoes: DecisaoLinha[];
  linhasSelecionadas: Set<number>;
  frotaIdPorPrefixo: Map<string, string>; // bd_frotas.codigo → bd_frotas.id
  arquivoSha256: string;
  arquivoNome: string;
  execucaoAnteriorId?: string | null;
  /** Tamanho de cada lote sequencial. Default 25. */
  batchSize?: number;
  onProgresso?: (p: ProgressoImportacao) => void;
}

export interface ExecutarImportacaoResult {
  execution_id: string;
  resultados: LinhaResultadoImportacao[];
  resumo: ResumoImportacao;
}

interface PayloadBase {
  linha_excel: number;
  codigo_canonico: string;
  payload: Record<string, unknown>;
}

export function montarPayloadInsercao(
  d: DecisaoLinha,
  frotaIdPorPrefixo: Map<string, string>,
): PayloadBase | { linha_excel: number; codigo_canonico: string; erro: string } {
  const codigo = d.linha.numero_frota_canonico ?? '';
  const linha_excel = d.linha.linha_excel;
  if (!codigo) return { linha_excel, codigo_canonico: codigo, erro: 'CODIGO_CANONICO_AUSENTE' };
  if (codigo.toUpperCase() === 'LYE246') return { linha_excel, codigo_canonico: codigo, erro: 'LYE246_BLOQUEADO' };
  if (d.acao_base !== 'INSERIR' || d.status_validacao !== 'VALIDA') {
    return { linha_excel, codigo_canonico: codigo, erro: 'LINHA_NAO_ELEGIVEL' };
  }

  const res = d.resolucao_catalogos;
  if (!res) return { linha_excel, codigo_canonico: codigo, erro: 'RESOLUCAO_AUSENTE' };

  const subcatId = res.subcategoria.cadastro_destino_id;
  const propId = res.proprietario.cadastro_destino_id;
  const propTipo = res.proprietario.cadastro_destino_tipo;
  const ccId = res.centro_custo.cadastro_destino_id;
  if (!subcatId) return { linha_excel, codigo_canonico: codigo, erro: 'SUBCATEGORIA_AUSENTE' };
  if (!propId || !propTipo) return { linha_excel, codigo_canonico: codigo, erro: 'PROPRIETARIO_AUSENTE' };
  if (!ccId) return { linha_excel, codigo_canonico: codigo, erro: 'CENTRO_CUSTO_AUSENTE' };

  const prefixo = (d.linha.numero_frota_prefixo ?? '').trim().toUpperCase();
  const frotaId = frotaIdPorPrefixo.get(prefixo);
  if (!frotaId) return { linha_excel, codigo_canonico: codigo, erro: 'FROTA_UUID_NAO_RESOLVIDA' };

  const numeroCanonico = (d.linha.numero_frota_numero ?? '').trim();
  if (!numeroCanonico) return { linha_excel, codigo_canonico: codigo, erro: 'NUMERO_FROTA_AUSENTE' };
  const numeroFrota = formatarNumeroFrota(numeroCanonico);

  const payload: Record<string, unknown> = {
    frota_id: frotaId,
    numero_frota: numeroFrota,
    subcategoria_ativo_id: subcatId,
    centro_custo_atual_id: ccId,
  };
  if (propTipo === 'EMPRESA') payload.empresa_id = propId;
  else if (propTipo === 'LOCADORA') payload.empresa_locadora_id = propId;
  else return { linha_excel, codigo_canonico: codigo, erro: 'PROPRIETARIO_TIPO_INVALIDO' };

  if (res.fabricante.resolvido && res.fabricante.cadastro_destino_id) {
    payload.fabricante_id = res.fabricante.cadastro_destino_id;
  }
  if (res.modelo.resolvido && res.modelo.cadastro_destino_id) {
    payload.modelo_id = res.modelo.cadastro_destino_id;
  }
  const ano = (d.linha.ano_fabricacao_raw ?? '').trim();
  if (/^\d{4}$/.test(ano)) payload.ano_fabricacao = ano;

  // Rodada 2A.3 — VALOR (informativo) alimenta aluguel quando parseável em BRL.
  const aluguel = parseMoedaBR((d.linha as unknown as { valor_raw?: unknown }).valor_raw ?? null);
  if (aluguel !== null) payload.aluguel = aluguel;

  return { linha_excel, codigo_canonico: codigo, payload };
}

export async function executarImportacao(input: ExecutarImportacaoInput): Promise<ExecutarImportacaoResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rpc = supabase.rpc.bind(supabase) as any;

  const openRes = await rpc('fn_importador_v2_abrir_execucao', {
    p_arquivo_sha256: input.arquivoSha256,
    p_arquivo_nome: input.arquivoNome,
    p_execucao_anterior_id: input.execucaoAnteriorId ?? null,
  });
  if (openRes.error || !openRes.data) throw new Error(openRes.error?.message ?? 'FALHA_ABRIR_EXECUCAO');
  const execution_id = openRes.data as string;

  const alvo = input.decisoes.filter(
    (d) =>
      d.acao_base === 'INSERIR' &&
      d.status_validacao === 'VALIDA' &&
      input.linhasSelecionadas.has(d.linha.linha_excel) &&
      d.linha.numero_frota_canonico &&
      d.linha.numero_frota_canonico.toUpperCase() !== 'LYE246',
  );

  const resultados: LinhaResultadoImportacao[] = [];
  const batchSize = Math.max(1, input.batchSize ?? 25);
  const totalLotes = Math.max(1, Math.ceil(alvo.length / batchSize));
  let processadasGeral = 0;
  let sucessos = 0;
  let jaProcessados = 0;
  let erros = 0;

  for (let li = 0; li < totalLotes; li += 1) {
    const inicio = li * batchSize;
    const fim = Math.min(alvo.length, inicio + batchSize);
    const lote = alvo.slice(inicio, fim);

    for (let i = 0; i < lote.length; i += 1) {
      const d = lote[i];
      let linhaResultado: LinhaResultadoImportacao;
      const base = montarPayloadInsercao(d, input.frotaIdPorPrefixo);
      const codigoExibicao = formatarCodigoExibicao(base.codigo_canonico);
      if ('erro' in base) {
        linhaResultado = {
          linha_excel: base.linha_excel,
          codigo_canonico: base.codigo_canonico,
          codigo_exibicao: codigoExibicao,
          status: 'ERRO',
          equipamento_id: null,
          mensagem: base.erro,
          payload_gravado: null,
        };
      } else {
        try {
          const call = await rpc('fn_importador_v2_inserir_novo_ativo', {
            p_execution_id: execution_id,
            p_arquivo_sha256: input.arquivoSha256,
            p_linha_excel: base.linha_excel,
            p_codigo_canonico: base.codigo_canonico,
            p_payload: base.payload,
          });
          if (call.error) {
            linhaResultado = {
              linha_excel: base.linha_excel,
              codigo_canonico: base.codigo_canonico,
              codigo_exibicao: codigoExibicao,
              status: 'ERRO',
              equipamento_id: null,
              mensagem: classificarMensagemErro(call.error.message, (call.error as { code?: string }).code),
              payload_gravado: base.payload,
            };
          } else {
            const r = (call.data ?? {}) as {
              status?: string;
              equipamento_id?: string;
              mensagem?: string;
              payload_gravado?: Record<string, unknown>;
            };
            const status: LinhaResultadoImportacao['status'] =
              r.status === 'SUCESSO' || r.status === 'JA_PROCESSADO' || r.status === 'ERRO' ? r.status : 'ERRO';
            linhaResultado = {
              linha_excel: base.linha_excel,
              codigo_canonico: base.codigo_canonico,
              codigo_exibicao: codigoExibicao,
              status,
              equipamento_id: r.equipamento_id ?? null,
              mensagem: r.mensagem ?? null,
              payload_gravado: r.payload_gravado ?? base.payload,
            };
          }
        } catch (err) {
          // Falha em uma linha nunca interrompe o lote.
          linhaResultado = {
            linha_excel: base.linha_excel,
            codigo_canonico: base.codigo_canonico,
            codigo_exibicao: codigoExibicao,
            status: 'ERRO',
            equipamento_id: null,
            mensagem: classificarMensagemErro(err instanceof Error ? err.message : String(err)),
            payload_gravado: base.payload,
          };
        }
      }


      resultados.push(linhaResultado);
      processadasGeral += 1;
      if (linhaResultado.status === 'SUCESSO') sucessos += 1;
      else if (linhaResultado.status === 'JA_PROCESSADO') jaProcessados += 1;
      else erros += 1;

      input.onProgresso?.({
        loteAtual: li + 1,
        totalLotes,
        processadasLote: i + 1,
        totalLote: lote.length,
        processadasGeral,
        totalGeral: alvo.length,
        sucessos,
        ja_processados: jaProcessados,
        erros,
        ultimaLinha: linhaResultado,
      });
    }
  }

  const resumo: ResumoImportacao = {
    selecionados: alvo.length,
    inseridos: sucessos,
    ja_processados: jaProcessados,
    erros,
  };

  await rpc('fn_importador_v2_encerrar_execucao', {
    p_execution_id: execution_id,
    p_resumo: resumo,
  });

  return { execution_id, resultados, resumo };
}

export async function fetchFrotaIdPorPrefixo(): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('bd_frotas')
      .select('id, codigo, ativo')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data as Array<{ id: string; codigo: string | null; ativo: boolean | null }>) {
      if (r.ativo === false) continue;
      const c = (r.codigo ?? '').trim().toUpperCase();
      if (c && !out.has(c)) out.set(c, r.id);
    }
    if (data.length < pageSize) break;
  }
  return out;
}
