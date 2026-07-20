import type {
  DecisaoLinha,
  LinhaCanonica,
  MotivoValidacao,
  AlertaLinha,
  StatusValidacao,
  AcaoBase,
  OrigemFrotaMatch,
} from './types';
import type { BancoIndex } from './queryBanco';
import { toValorCatalogo } from './normalizarValorCatalogo';

/**
 * AUDITORIA DE CAMPOS BLOQUEANTES (via information_schema, Rodada 1.1):
 * Todos os *_id (subcategoria/fabricante/modelo/empresa/empresa_locadora/
 * centro_custo_atual/departamento/linha_operacional) em bd_caminhoes_equipamentos
 * são NULLABLE. Único NOT NULL sem default humano é `centro_custo_atual_origem`
 * (default via trigger). Portanto, catálogo não resolvido gera PENDENTE — nunca BLOQUEADA.
 * BLOQUEADA fica reservada para duplicidade canônica (arquivo/banco) e FROTA_INCONSISTENTE_NO_BANCO.
 */

export interface PreValidateInput {
  linhas: LinhaCanonica[];
  banco: BancoIndex;
  /** Conjunto de prefixos oficiais de bd_frotas (uppercase). Se undefined, não valida prefixo. */
  frotasPorPrefixo?: Set<string>;
}

export interface PreValidateOutput {
  decisoes: DecisaoLinha[];
  duplicidadesNoArquivo: Array<{ canonico: string; linhas_excel: number[] }>;
}

function reconstruirCodigoBanco(frota: string | null, numero: string | null): string | null {
  const f = (frota ?? '').trim();
  const n = (numero ?? '').trim();
  if (!f && !n) return null;
  return `${f}${n}`;
}

export function preValidate({ linhas, banco, frotasPorPrefixo }: PreValidateInput): PreValidateOutput {
  const porCanonicoArquivo = new Map<string, LinhaCanonica[]>();
  for (const l of linhas) {
    if (!l.numero_frota_canonico) continue;
    const arr = porCanonicoArquivo.get(l.numero_frota_canonico) ?? [];
    arr.push(l);
    porCanonicoArquivo.set(l.numero_frota_canonico, arr);
  }
  const duplicidadesNoArquivo = Array.from(porCanonicoArquivo.entries())
    .filter(([, arr]) => arr.length > 1)
    .map(([canonico, arr]) => ({
      canonico,
      linhas_excel: arr.map((x) => x.linha_excel).sort((a, b) => a - b),
    }))
    .sort((a, b) => a.canonico.localeCompare(b.canonico));
  const setDupArquivo = new Set(duplicidadesNoArquivo.map((d) => d.canonico));

  const decisoes: DecisaoLinha[] = [];

  for (const linha of linhas) {
    const motivos: MotivoValidacao[] = [];
    const alertas: AlertaLinha[] = [];
    let acao_base: AcaoBase = 'INSERIR';
    let status_validacao: StatusValidacao = 'OK';
    let origem_match: OrigemFrotaMatch = 'SEM_MATCH';
    let banco_match_id: string | null = null;
    let banco_match_ids: string[] = [];
    let banco_frota_id_texto: string | null = null;
    let banco_numero_frota_texto: string | null = null;
    let frota_codigo_por_id: string | null = null;

    if (linha.item_origem_invalido) alertas.push('ITEM_ORIGEM_INVALIDO');
    if (!linha.tipo_equipamento_raw) alertas.push('TIPO_EQUIPAMENTO_VAZIO');
    if (!linha.empresa_raw) alertas.push('EMPRESA_TEXTO_LEGADO');
    if (!linha.valor_raw) alertas.push('VALOR_AUSENTE');

    // Placeholders de catálogo → alerta CAMPO_CATALOGO_AUSENTE (não bloqueiam)
    const camposComPlaceholder = [
      linha.fabricante_raw,
      linha.modelo_raw,
      linha.tipo_equipamento_raw,
      linha.empresa_raw,
      linha.obra_codigo,
    ].some((v) => {
      const info = toValorCatalogo(v);
      return v !== null && v !== undefined && String(v).trim() !== '' && info.placeholder;
    });
    if (camposComPlaceholder) alertas.push('CAMPO_CATALOGO_AUSENTE');

    const canonico = linha.numero_frota_canonico!;

    // 1) Duplicidade canônica no arquivo → NAO_DETERMINADA + BLOQUEADA
    let bloqueado = false;
    if (linha.numero_frota_canonico && setDupArquivo.has(linha.numero_frota_canonico)) {
      motivos.push('DUPLICIDADE_CANONICA_NO_ARQUIVO');
      acao_base = 'NAO_DETERMINADA';
      status_validacao = 'BLOQUEADA';
      bloqueado = true;
    }

    const hitBanco = banco.porCanonico.get(canonico) ?? [];

    if (hitBanco.length === 0) {
      // SEM MATCH — candidato a INSERIR
      if (!bloqueado) {
        acao_base = 'INSERIR';
        status_validacao = 'PENDENTE';
      }
      origem_match = 'SEM_MATCH';

      const prefixo = linha.numero_frota_prefixo ?? '';
      const prefixoConhecido =
        frotasPorPrefixo === undefined ? true : Boolean(prefixo) && frotasPorPrefixo.has(prefixo);
      if (!prefixoConhecido) {
        motivos.push('FROTA_NAO_RESOLVIDA');
      } else {
        motivos.push('ATIVO_NAO_ENCONTRADO_NO_BANCO');
      }
    } else if (hitBanco.length === 1) {
      const hit = hitBanco[0];
      banco_match_id = hit.id;
      banco_match_ids = [hit.id];
      banco_frota_id_texto = hit.frota_id_texto;
      banco_numero_frota_texto = hit.numero_frota_texto;
      frota_codigo_por_id = reconstruirCodigoBanco(hit.frota_id_texto, hit.numero_frota_texto);
      origem_match = hit.frota_id_texto ? 'FROTA_ID' : 'CANONICO';

      const prefixoLinha = linha.numero_frota_prefixo;
      const prefixoBanco = (hit.frota_id_texto ?? '').trim().toUpperCase() || null;

      if (prefixoBanco && prefixoLinha && prefixoBanco !== prefixoLinha) {
        motivos.push('FROTA_INCONSISTENTE_NO_BANCO');
        if (!bloqueado) {
          acao_base = 'NAO_DETERMINADA';
          status_validacao = 'BLOQUEADA';
        }
      } else if (!prefixoBanco) {
        alertas.push('FROTA_ID_AUSENTE_NO_CADASTRO');
        motivos.push('FROTA_ID_AUSENTE_NO_CADASTRO');
        if (!bloqueado) {
          acao_base = 'REVISAR';
          status_validacao = 'PENDENTE';
        }
      } else {
        if (!bloqueado) {
          acao_base = 'REVISAR';
          status_validacao = 'PENDENTE';
        }
      }
    } else {
      motivos.push('DUPLICIDADE_CANONICA_NO_BANCO');
      motivos.push('POSSIVEL_COLISAO_LEGADA');
      acao_base = 'NAO_DETERMINADA';
      status_validacao = 'BLOQUEADA';
      banco_match_ids = hitBanco.map((h) => h.id);
      banco_match_id = null;
    }

    // Pendências de catálogo (informativas — só marcam PENDENTE se não bloqueado)
    if (!linha.tipo_equipamento_raw && status_validacao !== 'BLOQUEADA') {
      motivos.push('SUBCATEGORIA_NAO_RESOLVIDA');
      if (status_validacao === 'OK') status_validacao = 'PENDENTE';
    }
    if (!linha.empresa_raw && status_validacao !== 'BLOQUEADA') {
      motivos.push('EMPRESA_NAO_RESOLVIDA');
      if (status_validacao === 'OK') status_validacao = 'PENDENTE';
    }

    if (motivos.length === 0) motivos.push('OK');

    decisoes.push({
      linha,
      acao_base,
      status_validacao,
      motivos,
      alertas,
      origem_match,
      banco_match_id,
      banco_match_ids,
      banco_frota_id_texto,
      banco_numero_frota_texto,
      frota_codigo_por_id,
      frota_texto_legado: banco_frota_id_texto,
    });
  }

  return { decisoes, duplicidadesNoArquivo };
}
