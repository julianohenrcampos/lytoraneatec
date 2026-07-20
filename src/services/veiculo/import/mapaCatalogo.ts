import type { DecisaoLinha, CatalogoTipo, MapaCatalogoLinha, MatchTipoCatalogo } from './types';
import type { CatalogosBanco, CatalogoRef } from './queryBanco';
import { toValorCatalogo, normalizar } from './normalizarValorCatalogo';

const TIPOS_MINIMOS: CatalogoTipo[] = [
  'FABRICANTE',
  'MODELO',
  'SUBCATEGORIA',
  'PROPRIETARIO_EMPRESA',
  'PROPRIETARIO_LOCADORA',
  'CENTRO_CUSTO',
  'DEPARTAMENTO',
];

interface Ocorrencia {
  origem: string;
  normalizado: string;
  ocorrencias: number;
  linhasExcel: number[];
}

function agregarValores(
  decisoes: DecisaoLinha[],
  campo: (d: DecisaoLinha) => string | null,
): { validos: Map<string, Ocorrencia>; placeholders: Ocorrencia[] } {
  const validos = new Map<string, Ocorrencia>();
  const placeholders: Ocorrencia[] = [];
  for (const d of decisoes) {
    const raw = campo(d);
    const v = toValorCatalogo(raw);
    if (v.valor === null && !v.placeholder) continue; // vazio absoluto
    if (v.placeholder) {
      // placeholder — não entra em MAPA_CATALOGO como cadastro a criar
      placeholders.push({
        origem: String(raw ?? '').trim(),
        normalizado: v.normalizado,
        ocorrencias: 1,
        linhasExcel: [d.linha.linha_excel],
      });
      continue;
    }
    const key = v.normalizado;
    const cur = validos.get(key) ?? { origem: v.valor!, normalizado: key, ocorrencias: 0, linhasExcel: [] };
    cur.ocorrencias += 1;
    cur.linhasExcel.push(d.linha.linha_excel);
    if (cur.origem.length < v.valor!.length) cur.origem = v.valor!;
    validos.set(key, cur);
  }
  return { validos, placeholders };
}

interface ResolucaoResultado {
  match_tipo: MatchTipoCatalogo;
  id: string | null;
  nome: string | null;
  candidatos_ids: string[];
  candidatos_nomes: string[];
  confianca: number;
}

function resolver(ref: CatalogoRef[], normalizado: string): ResolucaoResultado {
  // Camada A — exato normalizado
  const hitsExatos = ref.filter((r) => r.nomeNormalizado === normalizado);
  if (hitsExatos.length === 1) {
    return {
      match_tipo: 'EXATO',
      id: hitsExatos[0].id,
      nome: hitsExatos[0].nome,
      candidatos_ids: [hitsExatos[0].id],
      candidatos_nomes: [hitsExatos[0].nome],
      confianca: 1,
    };
  }
  if (hitsExatos.length > 1) {
    const ids = Array.from(new Set(hitsExatos.map((h) => h.id)));
    const nomes = Array.from(new Set(hitsExatos.map((h) => h.nome)));
    return {
      match_tipo: 'AMBIGUO',
      id: null,
      nome: null,
      candidatos_ids: ids,
      candidatos_nomes: nomes,
      confianca: 0.5,
    };
  }
  // Camada B — substring bidirecional (sugestão, não vincula)
  const sugestoes = ref.filter(
    (r) => r.nomeNormalizado.includes(normalizado) || normalizado.includes(r.nomeNormalizado),
  );
  if (sugestoes.length >= 1 && sugestoes.length <= 3) {
    const ids = Array.from(new Set(sugestoes.map((s) => s.id)));
    const nomes = Array.from(new Set(sugestoes.map((s) => s.nome)));
    return {
      match_tipo: 'ALIAS_SUGERIDO',
      id: null,
      nome: null,
      candidatos_ids: ids,
      candidatos_nomes: nomes,
      confianca: 0.6,
    };
  }
  return { match_tipo: 'SEM_MATCH', id: null, nome: null, candidatos_ids: [], candidatos_nomes: [], confianca: 0 };
}

function linhasToStr(l: number[]): string {
  const sorted = [...l].sort((a, b) => a - b);
  if (sorted.length <= 20) return sorted.join(',');
  return sorted.slice(0, 20).join(',') + `,…(+${sorted.length - 20})`;
}

export function construirMapaCatalogo(
  decisoes: DecisaoLinha[],
  catalogos: CatalogosBanco,
): MapaCatalogoLinha[] {
  const out: MapaCatalogoLinha[] = [];

  const buckets: Record<CatalogoTipo, { agr: ReturnType<typeof agregarValores>; ref: CatalogoRef[] }> = {
    FABRICANTE: { agr: agregarValores(decisoes, (d) => d.linha.fabricante_raw), ref: catalogos.fabricantes },
    MODELO: { agr: agregarValores(decisoes, (d) => d.linha.modelo_raw), ref: catalogos.modelos },
    SUBCATEGORIA: { agr: agregarValores(decisoes, (d) => d.linha.tipo_equipamento_raw), ref: catalogos.subcategorias },
    PROPRIETARIO_EMPRESA: { agr: agregarValores(decisoes, (d) => d.linha.empresa_raw), ref: catalogos.empresas },
    PROPRIETARIO_LOCADORA: {
      agr: { validos: new Map(), placeholders: [] },
      ref: catalogos.locadoras,
    },
    CENTRO_CUSTO: { agr: agregarValores(decisoes, (d) => d.linha.obra_codigo), ref: catalogos.centrosCusto },
    DEPARTAMENTO: { agr: { validos: new Map(), placeholders: [] }, ref: catalogos.departamentos },
  };

  for (const tipo of TIPOS_MINIMOS) {
    const { agr, ref } = buckets[tipo];
    if (agr.validos.size === 0 && agr.placeholders.length === 0) {
      out.push({
        catalogo_tipo: tipo,
        valor_origem: '',
        valor_normalizado: '',
        ocorrencias: 0,
        linhas_excel: '',
        status_resolucao: 'SEM_OCORRENCIA',
        match_tipo: 'SEM_OCORRENCIA',
        confianca: 0,
        cadastro_destino_id: null,
        cadastro_destino_nome: null,
        candidatos_ids: '',
        candidatos_nomes: '',
        decisao_usuario: 'AGUARDANDO_REVISAO',
      });
      continue;
    }
    for (const [normalizado, occ] of agr.validos.entries()) {
      const res = resolver(ref, normalizado);
      const status =
        res.match_tipo === 'EXATO'
          ? 'RESOLVIDO'
          : res.match_tipo === 'ALIAS_SUGERIDO'
            ? 'NAO_RESOLVIDO'
            : res.match_tipo === 'AMBIGUO'
              ? 'AMBIGUO'
              : 'NAO_RESOLVIDO';
      out.push({
        catalogo_tipo: tipo,
        valor_origem: occ.origem,
        valor_normalizado: normalizado,
        ocorrencias: occ.ocorrencias,
        linhas_excel: linhasToStr(occ.linhasExcel),
        status_resolucao: status,
        match_tipo: res.match_tipo,
        confianca: res.confianca,
        cadastro_destino_id: res.id,
        cadastro_destino_nome: res.nome,
        candidatos_ids: res.candidatos_ids.join(','),
        candidatos_nomes: res.candidatos_nomes.join(' | '),
        decisao_usuario: 'AGUARDANDO_REVISAO',
      });
    }
    // Agregar placeholders em UMA linha por tipo, se houver
    if (agr.placeholders.length > 0) {
      const linhasAll = agr.placeholders.flatMap((p) => p.linhasExcel);
      out.push({
        catalogo_tipo: tipo,
        valor_origem: '(placeholders)',
        valor_normalizado: '',
        ocorrencias: agr.placeholders.length,
        linhas_excel: linhasToStr(linhasAll),
        status_resolucao: 'PLACEHOLDER',
        match_tipo: 'PLACEHOLDER',
        confianca: 0,
        cadastro_destino_id: null,
        cadastro_destino_nome: null,
        candidatos_ids: '',
        candidatos_nomes: '',
        decisao_usuario: 'AGUARDANDO_REVISAO',
      });
    }
  }

  return out;
}

export function contarPendenciasCatalogo(mapa: MapaCatalogoLinha[]): number {
  return mapa.filter(
    (m) => m.status_resolucao === 'NAO_RESOLVIDO' || m.status_resolucao === 'AMBIGUO',
  ).length;
}

export function contarPlaceholders(mapa: MapaCatalogoLinha[]): number {
  return mapa
    .filter((m) => m.status_resolucao === 'PLACEHOLDER')
    .reduce((acc, m) => acc + m.ocorrencias, 0);
}

export function contarAliasSugeridos(mapa: MapaCatalogoLinha[]): number {
  return mapa.filter((m) => m.match_tipo === 'ALIAS_SUGERIDO').length;
}

// Helper reexport
export { normalizar };
