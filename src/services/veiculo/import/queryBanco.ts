// Leituras READ-ONLY contra o banco para a Rodada 1. Nenhuma escrita.

import { supabase } from '@/integrations/supabase/client';
import { splitCodigoAtivo } from './splitCodigoAtivo';
import { normalizar } from './normalizarValorCatalogo';
import type { BancoFrotaProjecao } from './types';

export interface FetchProjecaoResult {
  rows: BancoFrotaProjecao[];
  totalCount: number | null;
}

async function fetchFrotasIdParaCodigo(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('bd_frotas')
      .select('id, codigo')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data as Array<{ id: string; codigo: string | null }>) {
      const c = (r.codigo ?? '').trim().toUpperCase();
      if (c) map.set(r.id, c);
    }
    if (data.length < pageSize) break;
  }
  return map;
}

export async function fetchProjecaoBancoFrotas(): Promise<FetchProjecaoResult> {
  const pageSize = 1000;
  const out: BancoFrotaProjecao[] = [];

  let totalCount: number | null = null;
  {
    const { count, error } = await supabase
      .from('bd_caminhoes_equipamentos')
      .select('id', { head: true, count: 'exact' });
    if (!error) totalCount = count ?? null;
  }

  // Rodada 2A.2: também resolve o prefixo via FK quando a coluna texto `frota` está nula.
  const frotaCodigoPorId = await fetchFrotasIdParaCodigo().catch(() => new Map<string, string>());

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('bd_caminhoes_equipamentos')
      .select(
        'id, frota, frota_id, numero_frota, subcategoria_ativo_id, fabricante_id, modelo_id, empresa_id, empresa_locadora_id, departamento_id, centro_custo_atual_id, ano_fabricacao, aluguel',
      )
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data as unknown as Array<Record<string, unknown>>) {
      const frotaTexto = (r.frota as string | null) ?? null;
      const frotaId = (r.frota_id as string | null) ?? null;
      const numeroTexto = (r.numero_frota as string | null) ?? null;
      const prefixoTexto = frotaTexto && frotaTexto.trim() !== ''
        ? frotaTexto.trim().toUpperCase()
        : (frotaId ? (frotaCodigoPorId.get(frotaId) ?? null) : null);
      let canonico: string | null = null;
      if (prefixoTexto && numeroTexto && numeroTexto.trim() !== '') {
        const numeroCan = numeroTexto.trim().replace(/\s+/g, '').replace(/^0+/, '') || '0';
        // Só considera se número é puramente numérico OU se já parseável pelo splitCodigoAtivo
        if (/^\d+$/.test(numeroTexto.trim())) {
          canonico = `${prefixoTexto}${numeroCan}`;
        } else {
          canonico =
            splitCodigoAtivo(`${prefixoTexto}${numeroTexto}`).canonico ??
            splitCodigoAtivo(numeroTexto).canonico ??
            null;
        }
      } else {
        const composed = [prefixoTexto, numeroTexto].filter(Boolean).join('');
        canonico =
          splitCodigoAtivo(composed).canonico ??
          splitCodigoAtivo(numeroTexto).canonico ??
          null;
      }
      out.push({
        id: r.id as string,
        frota_id_texto: prefixoTexto,
        numero_frota_texto: numeroTexto,
        numero_frota_canonico: canonico,
        comparaveis: {
          subcategoria_ativo_id: (r.subcategoria_ativo_id as string | null) ?? null,
          fabricante_id: (r.fabricante_id as string | null) ?? null,
          modelo_id: (r.modelo_id as string | null) ?? null,
          empresa_id: (r.empresa_id as string | null) ?? null,
          empresa_locadora_id: (r.empresa_locadora_id as string | null) ?? null,
          departamento_id: (r.departamento_id as string | null) ?? null,
          centro_custo_atual_id: (r.centro_custo_atual_id as string | null) ?? null,
          ano_fabricacao: (r.ano_fabricacao as string | null) ?? null,
          aluguel: (r.aluguel as string | null) ?? null,
        },
      });
    }
    if (data.length < pageSize) break;
  }
  return { rows: out, totalCount };
}

export interface BancoIndex {
  porCanonico: Map<string, BancoFrotaProjecao[]>;
  duplicidadesCanonicas: Array<{ canonico: string; ids: string[] }>;
}

export function indexarBanco(rows: BancoFrotaProjecao[]): BancoIndex {
  const porCanonico = new Map<string, BancoFrotaProjecao[]>();
  for (const r of rows) {
    if (!r.numero_frota_canonico) continue;
    const arr = porCanonico.get(r.numero_frota_canonico) ?? [];
    arr.push(r);
    porCanonico.set(r.numero_frota_canonico, arr);
  }
  const dups: Array<{ canonico: string; ids: string[] }> = [];
  for (const [k, arr] of porCanonico.entries()) {
    if (arr.length > 1) dups.push({ canonico: k, ids: arr.map((x) => x.id) });
  }
  dups.sort((a, b) => a.canonico.localeCompare(b.canonico));
  return { porCanonico, duplicidadesCanonicas: dups };
}

// ============ Prefixos oficiais de bd_frotas ============

export async function fetchPrefixosFrotas(): Promise<Set<string>> {
  const out = new Set<string>();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('bd_frotas')
      .select('codigo, ativo')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data as Array<{ codigo: string | null; ativo: boolean | null }>) {
      if (r.ativo === false) continue;
      const c = (r.codigo ?? '').trim().toUpperCase();
      if (c) out.add(c);
    }
    if (data.length < pageSize) break;
  }
  return out;
}

// ============ Catálogos (leitura-only para MAPA_CATALOGO) ============

export interface CatalogoRef {
  id: string;
  nome: string;
  nomeNormalizado: string;
}

interface CatalogoSpec {
  table:
    | 'bd_fabricantes'
    | 'bd_modelos'
    | 'bd_subcategorias_ativos'
    | 'bd_empresas'
    | 'bd_empresas_locadoras'
    | 'bd_centros_custo'
    | 'bd_departamentos';
  nomeFields: string[]; // colunas indexadas (múltiplas viram entradas separadas)
  ativoField?: 'ativo' | 'situacao';
  situacaoAtiva?: string; // valor considerado ativo em `situacao`
}

async function fetchCatalogo(spec: CatalogoSpec): Promise<CatalogoRef[]> {
  const out: CatalogoRef[] = [];
  const pageSize = 1000;
  const selectCols = ['id', ...spec.nomeFields, spec.ativoField].filter(Boolean).join(', ');
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(spec.table as never)
      .select(selectCols)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data as unknown as Array<Record<string, unknown>>) {
      if (spec.ativoField === 'ativo' && r.ativo === false) continue;
      if (spec.ativoField === 'situacao' && spec.situacaoAtiva) {
        const s = String(r.situacao ?? '').trim().toLowerCase();
        if (s && s !== spec.situacaoAtiva.toLowerCase()) continue;
      }
      for (const field of spec.nomeFields) {
        const nome = String(r[field] ?? '').trim();
        if (!nome) continue;
        out.push({ id: String(r.id), nome, nomeNormalizado: normalizar(nome) });
      }
    }
    if (data.length < pageSize) break;
  }
  return out;
}

export interface CatalogosBanco {
  fabricantes: CatalogoRef[];
  modelos: CatalogoRef[];
  subcategorias: CatalogoRef[];
  empresas: CatalogoRef[];
  locadoras: CatalogoRef[];
  centrosCusto: CatalogoRef[];
  departamentos: CatalogoRef[];
}

export async function fetchCatalogosParaMapa(): Promise<CatalogosBanco> {
  const [fabricantes, modelos, subcategorias, empresas, locadoras, centrosCusto, departamentos] =
    await Promise.all([
      fetchCatalogo({ table: 'bd_fabricantes', nomeFields: ['nome'], ativoField: 'ativo' }).catch(() => []),
      fetchCatalogo({ table: 'bd_modelos', nomeFields: ['nome_modelo'], ativoField: 'ativo' }).catch(() => []),
      fetchCatalogo({ table: 'bd_subcategorias_ativos', nomeFields: ['nome_subcategoria'], ativoField: 'ativo' }).catch(
        () => [],
      ),
      fetchCatalogo({
        table: 'bd_empresas',
        nomeFields: ['nome_empresa'],
        ativoField: 'situacao',
        situacaoAtiva: 'ativa',
      }).catch(() => []),
      fetchCatalogo({ table: 'bd_empresas_locadoras', nomeFields: ['nome_empresa'] }).catch(() => []),
      fetchCatalogo({
        table: 'bd_centros_custo',
        nomeFields: ['codigo_centro_custo', 'nome_centro_custo'],
      }).catch(() => []),
      fetchCatalogo({ table: 'bd_departamentos', nomeFields: ['nome_departamento'] }).catch(() => []),
    ]);
  return { fabricantes, modelos, subcategorias, empresas, locadoras, centrosCusto, departamentos };
}
