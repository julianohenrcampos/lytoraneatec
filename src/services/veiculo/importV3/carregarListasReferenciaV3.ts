// PR-3.3 Fase C — Carregador da aba `_LISTAS` do XLSX V3 simplificado.
//
// Modos:
//   'MODELO'     → apenas referências ativas (novo cadastro).
//   'EXPORTACAO' → ativas + inativas atualmente vinculadas aos ativos exportados.
//
// Cada item carrega `ativo` e `vinculado_atualmente` para permitir as regras:
//   - inativo vinculado permanece SEM_ALTERACAO;
//   - inativo NUNCA pode ser escolhido para novo vínculo (INSERIR/ATUALIZAR).
//
// Fontes reais no banco (auditadas):
//   FROTA              → bd_frotas.codigo
//   SUBCATEGORIA       → bd_subcategorias_ativos.nome_subcategoria (parent = categoria_id)
//   LINHA_OPERACIONAL  → bd_linhas_operacionais.codigo
//   CENTRO_CUSTO       → bd_centros_custo.codigo_centro_custo
//   FABRICANTE         → bd_fabricantes.nome
//   DEPARTAMENTO       → bd_departamentos.nome_departamento
//   PROPRIETARIO       → união bd_empresas (contexto=EMPRESA) + bd_empresas_locadoras (LOCADORA)
//
// bd_modelos NÃO é consultada (modelo é texto livre — PR-3.3 Fase A).

import { supabase } from '@/integrations/supabase/client';

export type TipoCatalogoV3 =
  | 'FROTA'
  | 'SUBCATEGORIA'
  | 'LINHA_OPERACIONAL'
  | 'CENTRO_CUSTO'
  | 'FABRICANTE'
  | 'DEPARTAMENTO'
  | 'PROPRIETARIO';

export type ContextoProprietario = 'EMPRESA' | 'LOCADORA' | null;

export interface ItemListaV3 {
  tipo_catalogo: TipoCatalogoV3;
  id_erp: string;
  valor_exibicao: string;   // string única exibida no dropdown do Excel
  codigo: string | null;
  nome: string | null;
  parent_id_erp: string | null;
  ativo: boolean;
  vinculado_atualmente: boolean;
  contexto: ContextoProprietario;
}

export type ModoListasV3 = 'MODELO' | 'EXPORTACAO';

export interface CarregarListasInput {
  modo: ModoListasV3;
  /** IDs relacionais atualmente usados nos ativos exportados (modo EXPORTACAO). */
  vinculados?: {
    frota?: string[];
    subcategoria?: string[];
    linha_operacional?: string[];
    centro_custo?: string[];
    fabricante?: string[];
    departamento?: string[];
    empresa?: string[];
    empresa_locadora?: string[];
  };
}

export interface ListasReferenciaV3 {
  itens: ItemListaV3[];
  por_tipo: Record<TipoCatalogoV3, ItemListaV3[]>;
}

function empty(): ListasReferenciaV3 {
  const por_tipo = {
    FROTA: [], SUBCATEGORIA: [], LINHA_OPERACIONAL: [], CENTRO_CUSTO: [],
    FABRICANTE: [], DEPARTAMENTO: [], PROPRIETARIO: [],
  } as Record<TipoCatalogoV3, ItemListaV3[]>;
  return { itens: [], por_tipo };
}

function assertOk<T>(label: string, res: { data: T | null; error: unknown }): T {
  if (res.error) {
    throw new Error(`Falha ao carregar catálogo ${label}: ${(res.error as { message?: string }).message ?? String(res.error)}`);
  }
  return (res.data ?? []) as T;
}

function inSet(id: string | null | undefined, set: Set<string> | undefined): boolean {
  if (!id || !set) return false;
  return set.has(id);
}

export async function carregarListasReferenciaV3(input: CarregarListasInput): Promise<ListasReferenciaV3> {
  const modo = input.modo;
  const vinc = input.vinculados ?? {};
  const vSet = {
    frota: vinc.frota ? new Set(vinc.frota) : undefined,
    subcategoria: vinc.subcategoria ? new Set(vinc.subcategoria) : undefined,
    linha_operacional: vinc.linha_operacional ? new Set(vinc.linha_operacional) : undefined,
    centro_custo: vinc.centro_custo ? new Set(vinc.centro_custo) : undefined,
    fabricante: vinc.fabricante ? new Set(vinc.fabricante) : undefined,
    departamento: vinc.departamento ? new Set(vinc.departamento) : undefined,
    empresa: vinc.empresa ? new Set(vinc.empresa) : undefined,
    empresa_locadora: vinc.empresa_locadora ? new Set(vinc.empresa_locadora) : undefined,
  };

  // Consulta em paralelo — sem depender de tabela `bd_modelos`.
  const [
    frotasRes,
    subsRes,
    linhasRes,
    ccsRes,
    fabsRes,
    depsRes,
    empresasRes,
    locadorasRes,
  ] = await Promise.all([
    supabase.from('bd_frotas').select('id, codigo, nome, ativo'),
    supabase.from('bd_subcategorias_ativos').select('id, nome_subcategoria, categoria_id, ativo'),
    supabase.from('bd_linhas_operacionais').select('id, codigo, nome, ativo'),
    supabase.from('bd_centros_custo').select('id, codigo_centro_custo, nome_centro_custo, ativo'),
    supabase.from('bd_fabricantes').select('id, nome, ativo'),
    supabase.from('bd_departamentos').select('id, nome_departamento, ativo'),
    supabase.from('bd_empresas').select('id, nome_empresa, ativa'),
    supabase.from('bd_empresas_locadoras').select('id, nome_empresa_locadora, ativa'),
  ]);

  const frotas = assertOk('FROTA', frotasRes as never) as Array<{ id: string; codigo: string; nome: string | null; ativo: boolean }>;
  const subs = assertOk('SUBCATEGORIA', subsRes as never) as Array<{ id: string; nome_subcategoria: string; categoria_id: string | null; ativo: boolean }>;
  const linhas = assertOk('LINHA_OPERACIONAL', linhasRes as never) as Array<{ id: string; codigo: string | null; nome: string | null; ativo: boolean }>;
  const ccs = assertOk('CENTRO_CUSTO', ccsRes as never) as Array<{ id: string; codigo_centro_custo: string; nome_centro_custo: string | null; ativo: boolean }>;
  const fabs = assertOk('FABRICANTE', fabsRes as never) as Array<{ id: string; nome: string; ativo: boolean }>;
  const deps = assertOk('DEPARTAMENTO', depsRes as never) as Array<{ id: string; nome_departamento: string; ativo: boolean }>;
  const empresas = assertOk('EMPRESA', empresasRes as never) as Array<{ id: string; nome_empresa: string; ativa: boolean }>;
  const locadoras = assertOk('LOCADORA', locadorasRes as never) as Array<{ id: string; nome_empresa_locadora: string; ativa: boolean }>;

  const out: ItemListaV3[] = [];
  const incluir = (i: ItemListaV3, vinculadoSet?: Set<string>): void => {
    const vinculado = inSet(i.id_erp, vinculadoSet);
    // MODELO: apenas ativos. EXPORTACAO: ativos + inativos vinculados.
    if (modo === 'MODELO') {
      if (!i.ativo) return;
    } else {
      if (!i.ativo && !vinculado) return;
    }
    out.push({ ...i, vinculado_atualmente: vinculado });
  };

  frotas.forEach((r) => incluir({
    tipo_catalogo: 'FROTA', id_erp: r.id,
    valor_exibicao: r.codigo,
    codigo: r.codigo, nome: r.nome, parent_id_erp: null,
    ativo: !!r.ativo, vinculado_atualmente: false, contexto: null,
  }, vSet.frota));

  subs.forEach((r) => incluir({
    tipo_catalogo: 'SUBCATEGORIA', id_erp: r.id,
    valor_exibicao: r.nome_subcategoria,
    codigo: null, nome: r.nome_subcategoria, parent_id_erp: r.categoria_id,
    ativo: !!r.ativo, vinculado_atualmente: false, contexto: null,
  }, vSet.subcategoria));

  linhas.forEach((r) => incluir({
    tipo_catalogo: 'LINHA_OPERACIONAL', id_erp: r.id,
    valor_exibicao: r.codigo ?? r.nome ?? '',
    codigo: r.codigo, nome: r.nome, parent_id_erp: null,
    ativo: !!r.ativo, vinculado_atualmente: false, contexto: null,
  }, vSet.linha_operacional));

  ccs.forEach((r) => incluir({
    tipo_catalogo: 'CENTRO_CUSTO', id_erp: r.id,
    valor_exibicao: r.codigo_centro_custo,
    codigo: r.codigo_centro_custo, nome: r.nome_centro_custo, parent_id_erp: null,
    ativo: !!r.ativo, vinculado_atualmente: false, contexto: null,
  }, vSet.centro_custo));

  fabs.forEach((r) => incluir({
    tipo_catalogo: 'FABRICANTE', id_erp: r.id,
    valor_exibicao: r.nome,
    codigo: null, nome: r.nome, parent_id_erp: null,
    ativo: !!r.ativo, vinculado_atualmente: false, contexto: null,
  }, vSet.fabricante));

  deps.forEach((r) => incluir({
    tipo_catalogo: 'DEPARTAMENTO', id_erp: r.id,
    valor_exibicao: r.nome_departamento,
    codigo: null, nome: r.nome_departamento, parent_id_erp: null,
    ativo: !!r.ativo, vinculado_atualmente: false, contexto: null,
  }, vSet.departamento));

  // PROPRIETÁRIO — desambiguação por prefixo "EMPRESA | " / "LOCADORA | ".
  // Se houver colisão de nome mesmo com prefixo, sufixa id curto.
  const nomesUsados = new Map<string, number>();
  const rotular = (base: string, id: string): string => {
    const count = (nomesUsados.get(base) ?? 0) + 1;
    nomesUsados.set(base, count);
    return count === 1 ? base : `${base} (${id.slice(0, 6)})`;
  };

  empresas.forEach((r) => {
    const base = `EMPRESA | ${r.nome_empresa}`;
    incluir({
      tipo_catalogo: 'PROPRIETARIO', id_erp: r.id,
      valor_exibicao: rotular(base, r.id),
      codigo: null, nome: r.nome_empresa, parent_id_erp: null,
      ativo: !!r.ativa, vinculado_atualmente: false, contexto: 'EMPRESA',
    }, vSet.empresa);
  });
  locadoras.forEach((r) => {
    const base = `LOCADORA | ${r.nome_empresa_locadora}`;
    incluir({
      tipo_catalogo: 'PROPRIETARIO', id_erp: r.id,
      valor_exibicao: rotular(base, r.id),
      codigo: null, nome: r.nome_empresa_locadora, parent_id_erp: null,
      ativo: !!r.ativa, vinculado_atualmente: false, contexto: 'LOCADORA',
    }, vSet.empresa_locadora);
  });

  const por_tipo = empty().por_tipo;
  for (const it of out) por_tipo[it.tipo_catalogo].push(it);
  return { itens: out, por_tipo };
}
