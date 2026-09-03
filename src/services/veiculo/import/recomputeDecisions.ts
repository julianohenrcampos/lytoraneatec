// Rodada 1.2.1 — Recálculo final das decisões após decisões manuais de catálogo.
// Zero mutations. Apenas cálculo puro.
// Microcorreções 1.2.1:
//  - VALOR/aluguel removido do diff (apenas informativo em valor_snapshot).
//  - IGNORAR_CAMPO_OPCIONAL recusado para campos bloqueantes.
//  - Placeholder/vazio usa chave contextual por linha (nunca propaga globalmente).
//  - Suporte a SELECIONAR_OUTRO com cadastro_destino_tipo.

import type {
  DecisaoLinha,
  MapaCatalogoLinha,
  CatalogoTipo,
  BancoFrotaProjecao,
  StatusValidacao,
  AcaoBase,
} from './types';
import type {
  CatalogResolutionByLine,
  ResolucaoCampo,
  CampoResolucao,
  DecisaoUsuarioCatalogoItem,
  CampoDiferente,
  ValorInformativoLinha,
} from './tiposResolucao';
import {
  chaveDecisaoUsuario,
  chaveDecisaoUsuarioLinha,
  tipoDestinoDeCatalogo,
  isCampoBloqueante,
} from './tiposResolucao';
import { toValorCatalogo } from './normalizarValorCatalogo';

const CAMPOS_BLOQUEANTES: CampoResolucao[] = ['proprietario', 'subcategoria', 'centro_custo'];
const CAMPOS_ALERTA: CampoResolucao[] = ['fabricante', 'modelo', 'departamento'];

interface CampoSpec {
  campo: CampoResolucao;
  tipo: CatalogoTipo;
  valorOrigem: (l: DecisaoLinha) => string | null;
}

const SPECS: CampoSpec[] = [
  { campo: 'subcategoria', tipo: 'SUBCATEGORIA', valorOrigem: (l) => l.linha.tipo_equipamento_raw },
  { campo: 'proprietario', tipo: 'PROPRIETARIO_EMPRESA', valorOrigem: (l) => l.linha.empresa_raw },
  { campo: 'centro_custo', tipo: 'CENTRO_CUSTO', valorOrigem: (l) => l.linha.obra_codigo },
  { campo: 'fabricante', tipo: 'FABRICANTE', valorOrigem: (l) => l.linha.fabricante_raw },
  { campo: 'modelo', tipo: 'MODELO', valorOrigem: (l) => l.linha.modelo_raw },
  { campo: 'departamento', tipo: 'DEPARTAMENTO', valorOrigem: (l) => null },
];

export interface RecomputeInput {
  decisoes: DecisaoLinha[];
  mapaCatalogo: MapaCatalogoLinha[];
  decisoesUsuarioCatalogo: Map<string, DecisaoUsuarioCatalogoItem>;
  bancoRows: BancoFrotaProjecao[];
}

export interface RecomputeOutput {
  decisoes: DecisaoLinha[];
  contagens: {
    inserir: number;
    ignorar: number;
    revisar: number;
    nao_determinada: number;
    validas: number;
    pendentes: number;
    bloqueadas: number;
  };
  invariantes: { ok: boolean; violacoes: string[] };
}

function indexMapa(mapa: MapaCatalogoLinha[]): Map<string, MapaCatalogoLinha> {
  const m = new Map<string, MapaCatalogoLinha>();
  for (const l of mapa) {
    if (l.status_resolucao === 'SEM_OCORRENCIA') continue;
    m.set(chaveDecisaoUsuario(l.catalogo_tipo, l.valor_normalizado), l);
  }
  return m;
}

function indexBanco(rows: BancoFrotaProjecao[]): Map<string, BancoFrotaProjecao> {
  const m = new Map<string, BancoFrotaProjecao>();
  for (const r of rows) m.set(r.id, r);
  return m;
}

/**
 * Rodada 1.2.1 — Lookup de decisão do usuário considerando:
 *  1) chave contextual por linha (placeholder/vazio) — precedência maior;
 *  2) chave global por valor normalizado.
 * Retorna undefined para campos bloqueantes com decisão IGNORAR_CAMPO_OPCIONAL (silenciosamente recusada).
 */
function lookupDecisao(
  tipo: CatalogoTipo,
  campo: CampoResolucao,
  valorNormalizado: string,
  linhaExcel: number,
  decisoesUser: Map<string, DecisaoUsuarioCatalogoItem>,
  opts: { contextoPlaceholderOuVazio: boolean },
): DecisaoUsuarioCatalogoItem | undefined {
  const perLinha = decisoesUser.get(chaveDecisaoUsuarioLinha(tipo, linhaExcel));
  // Placeholders/vazios: NUNCA aceitar chave global — evita propagação entre linhas.
  const global =
    !opts.contextoPlaceholderOuVazio && valorNormalizado !== ''
      ? decisoesUser.get(chaveDecisaoUsuario(tipo, valorNormalizado))
      : undefined;
  const escolhida = perLinha ?? global;
  if (!escolhida) return undefined;
  // Gate: campos bloqueantes NÃO aceitam IGNORAR_CAMPO_OPCIONAL.
  if (escolhida.decisao === 'IGNORAR_CAMPO_OPCIONAL' && isCampoBloqueante(campo)) {
    return undefined;
  }
  // SELECIONAR_OUTRO exige destino_id_selecionado + cadastro_destino_tipo.
  if (escolhida.decisao === 'SELECIONAR_OUTRO') {
    if (!escolhida.destino_id_selecionado || !escolhida.cadastro_destino_tipo) return undefined;
  }
  return escolhida;
}

function resolverCampo(
  spec: CampoSpec,
  linha: DecisaoLinha,
  mapaIdx: Map<string, MapaCatalogoLinha>,
  decisoesUser: Map<string, DecisaoUsuarioCatalogoItem>,
): ResolucaoCampo {
  const raw = spec.valorOrigem(linha);
  const valorCat = toValorCatalogo(raw);
  const bloqueante = CAMPOS_BLOQUEANTES.includes(spec.campo);
  const contextoPlaceholderOuVazio = valorCat.placeholder || (valorCat.normalizado === '' && raw === null);
  const decisao = lookupDecisao(
    spec.tipo,
    spec.campo,
    valorCat.normalizado,
    linha.linha.linha_excel,
    decisoesUser,
    { contextoPlaceholderOuVazio },
  );

  // Sem valor
  if (valorCat.normalizado === '' && !valorCat.placeholder && raw === null) {
    // Placeholder/vazio pode receber decisão contextual (SELECIONAR_OUTRO) por linha
    if (decisao?.decisao === 'SELECIONAR_OUTRO' && decisao.destino_id_selecionado) {
      return {
        catalogo_tipo: spec.tipo,
        valor_origem: null,
        match_tipo: 'EXATO',
        status_resolucao: 'RESOLVIDO',
        cadastro_destino_id: decisao.destino_id_selecionado,
        cadastro_destino_nome: decisao.destino_nome_selecionado ?? null,
        cadastro_destino_tipo: decisao.cadastro_destino_tipo ?? tipoDestinoDeCatalogo(spec.tipo),
        decisao_usuario: 'SELECIONAR_OUTRO',
        bloqueante,
        resolvido: true,
      };
    }
    if (decisao?.decisao === 'IGNORAR_CAMPO_OPCIONAL' && !bloqueante) {
      return {
        catalogo_tipo: spec.tipo,
        valor_origem: null,
        match_tipo: 'SEM_MATCH',
        status_resolucao: 'NAO_RESOLVIDO',
        cadastro_destino_id: null,
        cadastro_destino_nome: null,
        cadastro_destino_tipo: null,
        decisao_usuario: 'IGNORAR_CAMPO_OPCIONAL',
        bloqueante: false,
        resolvido: false,
      };
    }
    return {
      catalogo_tipo: spec.tipo,
      valor_origem: null,
      match_tipo: 'SEM_OCORRENCIA',
      status_resolucao: 'SEM_OCORRENCIA',
      cadastro_destino_id: null,
      cadastro_destino_nome: null,
      cadastro_destino_tipo: null,
      decisao_usuario: 'AGUARDANDO_REVISAO',
      bloqueante,
      resolvido: false,
    };
  }

  // Placeholder
  if (valorCat.placeholder) {
    if (decisao?.decisao === 'SELECIONAR_OUTRO' && decisao.destino_id_selecionado) {
      return {
        catalogo_tipo: spec.tipo,
        valor_origem: raw,
        match_tipo: 'EXATO',
        status_resolucao: 'RESOLVIDO',
        cadastro_destino_id: decisao.destino_id_selecionado,
        cadastro_destino_nome: decisao.destino_nome_selecionado ?? null,
        cadastro_destino_tipo: decisao.cadastro_destino_tipo ?? tipoDestinoDeCatalogo(spec.tipo),
        decisao_usuario: 'SELECIONAR_OUTRO',
        bloqueante,
        resolvido: true,
      };
    }
    if (decisao?.decisao === 'IGNORAR_CAMPO_OPCIONAL' && !bloqueante) {
      return {
        catalogo_tipo: spec.tipo,
        valor_origem: raw ?? null,
        match_tipo: 'SEM_MATCH',
        status_resolucao: 'NAO_RESOLVIDO',
        cadastro_destino_id: null,
        cadastro_destino_nome: null,
        cadastro_destino_tipo: null,
        decisao_usuario: 'IGNORAR_CAMPO_OPCIONAL',
        bloqueante: false,
        resolvido: false,
      };
    }
    return {
      catalogo_tipo: spec.tipo,
      valor_origem: raw ?? null,
      match_tipo: 'PLACEHOLDER',
      status_resolucao: 'PLACEHOLDER',
      cadastro_destino_id: null,
      cadastro_destino_nome: null,
      cadastro_destino_tipo: null,
      decisao_usuario: 'AGUARDANDO_REVISAO',
      bloqueante,
      resolvido: false,
    };
  }

  const mapaLinha = mapaIdx.get(chaveDecisaoUsuario(spec.tipo, valorCat.normalizado));

  // Decisão do usuário aplica
  if (decisao) {
    if (decisao.decisao === 'CONFIRMAR_SUGESTAO' && mapaLinha) {
      const primeiroId =
        (mapaLinha.candidatos_ids ?? '').split(',').filter(Boolean)[0] ?? null;
      const primeiroNome =
        (mapaLinha.candidatos_nomes ?? '').split(' | ').filter(Boolean)[0] ?? null;
      return {
        catalogo_tipo: spec.tipo,
        valor_origem: raw,
        match_tipo: 'EXATO',
        status_resolucao: 'RESOLVIDO',
        cadastro_destino_id: primeiroId,
        cadastro_destino_nome: primeiroNome,
        cadastro_destino_tipo: tipoDestinoDeCatalogo(spec.tipo),
        decisao_usuario: 'CONFIRMAR_SUGESTAO',
        bloqueante,
        resolvido: Boolean(primeiroId),
      };
    }
    if (decisao.decisao === 'SELECIONAR_OUTRO' && decisao.destino_id_selecionado) {
      return {
        catalogo_tipo: spec.tipo,
        valor_origem: raw,
        match_tipo: 'EXATO',
        status_resolucao: 'RESOLVIDO',
        cadastro_destino_id: decisao.destino_id_selecionado,
        cadastro_destino_nome: decisao.destino_nome_selecionado ?? null,
        cadastro_destino_tipo: decisao.cadastro_destino_tipo ?? tipoDestinoDeCatalogo(spec.tipo),
        decisao_usuario: 'SELECIONAR_OUTRO',
        bloqueante,
        resolvido: true,
      };
    }
    if (decisao.decisao === 'IGNORAR_CAMPO_OPCIONAL') {
      // já filtrado por lookupDecisao para bloqueantes — chega aqui só para opcionais
      return {
        catalogo_tipo: spec.tipo,
        valor_origem: raw,
        match_tipo: 'SEM_MATCH',
        status_resolucao: 'NAO_RESOLVIDO',
        cadastro_destino_id: null,
        cadastro_destino_nome: null,
        cadastro_destino_tipo: null,
        decisao_usuario: 'IGNORAR_CAMPO_OPCIONAL',
        bloqueante: false,
        resolvido: false,
      };
    }
    // DEIXAR_PENDENTE → cai no fluxo normal
  }

  if (!mapaLinha) {
    return {
      catalogo_tipo: spec.tipo,
      valor_origem: raw,
      match_tipo: 'SEM_MATCH',
      status_resolucao: 'NAO_RESOLVIDO',
      cadastro_destino_id: null,
      cadastro_destino_nome: null,
      cadastro_destino_tipo: null,
      decisao_usuario: 'AGUARDANDO_REVISAO',
      bloqueante,
      resolvido: false,
    };
  }

  const resolvido = mapaLinha.match_tipo === 'EXATO' && !!mapaLinha.cadastro_destino_id;
  return {
    catalogo_tipo: spec.tipo,
    valor_origem: raw,
    match_tipo: mapaLinha.match_tipo,
    status_resolucao: mapaLinha.status_resolucao,
    cadastro_destino_id: mapaLinha.cadastro_destino_id,
    cadastro_destino_nome: mapaLinha.cadastro_destino_nome,
    cadastro_destino_tipo: resolvido ? tipoDestinoDeCatalogo(spec.tipo) : null,
    decisao_usuario: 'AGUARDANDO_REVISAO',
    bloqueante,
    resolvido,
  };
}

function normalizarNumerico(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s === '') return null;
  const c = toValorCatalogo(s);
  if (c.placeholder) return null;
  const n = Number(s.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function diffCampo(
  campo: string,
  valorAtual: string | number | null,
  valorPlanilha: string | number | null,
  valorProposto: string | number | null,
  origem: CampoDiferente['origem_resolucao'],
): CampoDiferente | null {
  if (valorProposto === null) return null;
  if (valorAtual === null)
    return { campo, valor_atual: null, valor_planilha: valorPlanilha, valor_proposto: valorProposto, origem_resolucao: origem };
  if (String(valorAtual) === String(valorProposto)) return null;
  return { campo, valor_atual: valorAtual, valor_planilha: valorPlanilha, valor_proposto: valorProposto, origem_resolucao: origem };
}

function origemDe(resolvido: ResolucaoCampo): CampoDiferente['origem_resolucao'] {
  if (resolvido.decisao_usuario === 'CONFIRMAR_SUGESTAO' || resolvido.decisao_usuario === 'SELECIONAR_OUTRO')
    return 'CONFIRMADO_USUARIO';
  return 'EXATO';
}

function buildValorSnapshot(d: DecisaoLinha): ValorInformativoLinha {
  const parsed = normalizarNumerico(d.linha.valor_raw);
  return {
    linha_excel: d.linha.linha_excel,
    numero_frota_canonico: d.linha.numero_frota_canonico,
    valor_origem: d.linha.valor_raw,
    valor_parseado: parsed,
    mapeamento_destino: 'NAO_CONFIRMADO',
  };
}

export function recomputeDecisions(input: RecomputeInput): RecomputeOutput {
  const mapaIdx = indexMapa(input.mapaCatalogo);
  const bancoIdx = indexBanco(input.bancoRows);
  const violacoes: string[] = [];

  const decisoesOut: DecisaoLinha[] = input.decisoes.map((d) => {
    const identidadeBloqueada = d.status_validacao === 'BLOQUEADA' || d.acao_base === 'NAO_DETERMINADA';

    const resolucao: CatalogResolutionByLine = {
      subcategoria: resolverCampo(SPECS[0], d, mapaIdx, input.decisoesUsuarioCatalogo),
      proprietario: resolverCampo(SPECS[1], d, mapaIdx, input.decisoesUsuarioCatalogo),
      centro_custo: resolverCampo(SPECS[2], d, mapaIdx, input.decisoesUsuarioCatalogo),
      fabricante: resolverCampo(SPECS[3], d, mapaIdx, input.decisoesUsuarioCatalogo),
      modelo: resolverCampo(SPECS[4], d, mapaIdx, input.decisoesUsuarioCatalogo),
      departamento: resolverCampo(SPECS[5], d, mapaIdx, input.decisoesUsuarioCatalogo),
    };

    const valor_snapshot = buildValorSnapshot(d);

    if (identidadeBloqueada) {
      return {
        ...d,
        resolucao_catalogos: resolucao,
        pendencias_bloqueantes: ['IDENTIDADE_BLOQUEADA'],
        alertas_catalogo: [],
        campos_diferentes: [],
        valor_snapshot,
      };
    }

    const pend: string[] = [];
    const alertasCat: string[] = [];
    const campos_diferentes: CampoDiferente[] = [];

    for (const c of CAMPOS_ALERTA) {
      const r = resolucao[c];
      if (r.status_resolucao === 'NAO_RESOLVIDO' || r.status_resolucao === 'AMBIGUO') {
        alertasCat.push(`${c.toUpperCase()}_NAO_RESOLVIDO`);
      }
      if (r.status_resolucao === 'PLACEHOLDER') alertasCat.push('CATALOGO_PLACEHOLDER');
    }

    let acao_base: AcaoBase = d.acao_base;
    let status_validacao: StatusValidacao = 'PENDENTE';

    if (d.acao_base === 'INSERIR') {
      if (!resolucao.proprietario.resolvido && resolucao.proprietario.bloqueante) pend.push('PROPRIETARIO_NAO_RESOLVIDO');
      if (!resolucao.subcategoria.resolvido && resolucao.subcategoria.bloqueante) pend.push('SUBCATEGORIA_NAO_RESOLVIDA');
      if (!resolucao.centro_custo.resolvido && resolucao.centro_custo.bloqueante) pend.push('CENTRO_CUSTO_NAO_RESOLVIDO');
      status_validacao = pend.length === 0 ? 'VALIDA' : 'PENDENTE';
    } else if (d.acao_base === 'REVISAR') {
      const banco = d.banco_match_id ? bancoIdx.get(d.banco_match_id) : null;
      const cmp = banco?.comparaveis;
      if (cmp) {
        if (resolucao.subcategoria.resolvido) {
          const diff = diffCampo('subcategoria_ativo_id', cmp.subcategoria_ativo_id, resolucao.subcategoria.valor_origem, resolucao.subcategoria.cadastro_destino_id, origemDe(resolucao.subcategoria));
          if (diff) campos_diferentes.push(diff);
        }
        if (resolucao.proprietario.resolvido) {
          const diff = diffCampo('empresa_id', cmp.empresa_id, resolucao.proprietario.valor_origem, resolucao.proprietario.cadastro_destino_id, origemDe(resolucao.proprietario));
          if (diff) campos_diferentes.push(diff);
        }
        if (resolucao.fabricante.resolvido) {
          const diff = diffCampo('fabricante_id', cmp.fabricante_id, resolucao.fabricante.valor_origem, resolucao.fabricante.cadastro_destino_id, origemDe(resolucao.fabricante));
          if (diff) campos_diferentes.push(diff);
        }
        if (resolucao.modelo.resolvido) {
          const diff = diffCampo('modelo_id', cmp.modelo_id, resolucao.modelo.valor_origem, resolucao.modelo.cadastro_destino_id, origemDe(resolucao.modelo));
          if (diff) campos_diferentes.push(diff);
        }
        // Ano fabricação (numérico) — permanece
        const anoPlan = normalizarNumerico(d.linha.ano_fabricacao_raw);
        if (anoPlan !== null) {
          const anoAtual = normalizarNumerico(cmp.ano_fabricacao);
          const diff = diffCampo('ano_fabricacao', anoAtual, d.linha.ano_fabricacao_raw, anoPlan, 'DIRETO_PLANILHA');
          if (diff) campos_diferentes.push(diff);
        }
        // Rodada 1.2.1: VALOR/aluguel NÃO gera diff (semântica não confirmada).
        // Mantido apenas em valor_snapshot como informativo.
        if (resolucao.centro_custo.resolvido && cmp.centro_custo_atual_id && cmp.centro_custo_atual_id !== resolucao.centro_custo.cadastro_destino_id) {
          alertasCat.push('CENTRO_CUSTO_DIVERGENTE_INFORMATIVO');
        }
      }

      if (campos_diferentes.length === 0) {
        acao_base = 'IGNORAR';
        status_validacao = 'VALIDA';
      } else {
        acao_base = 'REVISAR';
        status_validacao = 'VALIDA';
      }
    } else {
      status_validacao = 'PENDENTE';
    }

    if (status_validacao === 'PENDENTE' && pend.length === 0) {
      violacoes.push(`linha ${d.linha.linha_excel}: PENDENTE sem pendencias_bloqueantes`);
    }
    if (acao_base === 'REVISAR' && campos_diferentes.length === 0) {
      violacoes.push(`linha ${d.linha.linha_excel}: REVISAR sem campos_diferentes`);
    }
    if (status_validacao === 'VALIDA' && pend.length > 0) {
      violacoes.push(`linha ${d.linha.linha_excel}: VALIDA com pendencias_bloqueantes`);
    }

    return {
      ...d,
      acao_base,
      status_validacao,
      resolucao_catalogos: resolucao,
      pendencias_bloqueantes: pend,
      alertas_catalogo: alertasCat,
      campos_diferentes,
      valor_snapshot,
    };
  });

  const contagens = {
    inserir: decisoesOut.filter((d) => d.acao_base === 'INSERIR').length,
    ignorar: decisoesOut.filter((d) => d.acao_base === 'IGNORAR').length,
    revisar: decisoesOut.filter((d) => d.acao_base === 'REVISAR').length,
    nao_determinada: decisoesOut.filter((d) => d.acao_base === 'NAO_DETERMINADA').length,
    validas: decisoesOut.filter((d) => d.status_validacao === 'VALIDA' || d.status_validacao === 'OK').length,
    pendentes: decisoesOut.filter((d) => d.status_validacao === 'PENDENTE').length,
    bloqueadas: decisoesOut.filter((d) => d.status_validacao === 'BLOQUEADA').length,
  };

  return { decisoes: decisoesOut, contagens, invariantes: { ok: violacoes.length === 0, violacoes } };
}
