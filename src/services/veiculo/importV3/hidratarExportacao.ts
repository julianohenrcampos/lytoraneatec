// PR-3 V3 — Hidratação de EXPORTACAO a partir do banco.
// Zero escrita. Puxa bd_caminhoes_equipamentos + catálogos e monta
// EquipamentoExportRegistro[] alinhado às 41 colunas do contrato.

import { supabase } from '@/integrations/supabase/client';
import type { EquipamentoExportRegistro } from './exportarEquipamentosXlsx';
import type { ListaLinha } from './workbook';

interface Caminhao {
  id: string; updated_at: string | null; frota: string | null; numero_frota: string | null;
  subcategoria_ativo_id: string | null; categoria_ativo_id: string | null;
  linha_operacional_id: string | null;
  empresa_id: string | null; empresa_locadora_id: string | null;
  centro_custo_atual_id: string | null;
  fabricante_id: string | null; modelo_id: string | null; departamento_id: string | null;
  motor: string | null; ano_fabricacao: string | null; placa: string | null;
  chassi: string | null; numero_serie: string | null; renavam: string | null; cor: string | null;
  tipo_combustivel: string | null; capacidade_valor: number | null; capacidade_unidade: string | null;
  aluguel: string | null; observacoes: string | null;
  situacao: string | null; status_cadastro: string | null; status_disponibilidade: string | null;
}

interface CatalogoMap {
  subcategorias: Map<string, { nome: string; categoria_id: string | null }>;
  categorias: Map<string, string>;
  linhas_op: Map<string, string>;
  empresas: Map<string, string>;
  locadoras: Map<string, string>;
  centros: Map<string, { codigo: string; nome: string }>;
  fabricantes: Map<string, string>;
  modelos: Map<string, { nome: string; fabricante_id: string | null }>;
  departamentos: Map<string, string>;
  frotas: Map<string, string>; // codigo → id
}

function formatarExibicao(prefixo: string, numero: string): string {
  const num = (numero ?? '').replace(/^0+/, '') || '0';
  const padded = num.padStart(Math.max(3, num.length), '0');
  return `${prefixo}${padded}`;
}

async function paginado<T>(builder: () => any, tam = 1000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += tam) {
    const { data, error } = await builder().range(from, from + tam - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    out.push(...(data as T[]));
    if (data.length < tam) break;
  }
  return out;
}

async function carregarCatalogos(): Promise<CatalogoMap> {
  const [subs, cats, linhas, emps, locs, ccs, fabs, mods, deps, frotas] = await Promise.all([
    paginado<{ id: string; nome_subcategoria: string; categoria_id: string | null }>(() =>
      supabase.from('bd_subcategorias_ativos').select('id, nome_subcategoria, categoria_id')),
    paginado<{ id: string; nome_categoria: string }>(() =>
      supabase.from('bd_categorias_ativos').select('id, nome_categoria')),
    paginado<{ id: string; codigo: string }>(() =>
      supabase.from('bd_linhas_operacionais').select('id, codigo')),
    paginado<{ id: string; nome_empresa: string }>(() =>
      supabase.from('bd_empresas').select('id, nome_empresa')),
    paginado<{ id: string; nome_empresa: string }>(() =>
      supabase.from('bd_empresas_locadoras').select('id, nome_empresa')),
    paginado<{ id: string; codigo_centro_custo: string; nome_centro_custo: string }>(() =>
      supabase.from('bd_centros_custo').select('id, codigo_centro_custo, nome_centro_custo')),
    paginado<{ id: string; nome: string }>(() =>
      supabase.from('bd_fabricantes').select('id, nome')),
    paginado<{ id: string; nome_modelo: string; fabricante_id: string | null }>(() =>
      supabase.from('bd_modelos').select('id, nome_modelo, fabricante_id')),
    paginado<{ id: string; nome_departamento: string | null }>(() =>
      supabase.from('bd_departamentos').select('id, nome_departamento')),
    paginado<{ id: string; codigo: string }>(() =>
      supabase.from('bd_frotas').select('id, codigo')),
  ]);

  const cat: CatalogoMap = {
    subcategorias: new Map(subs.map((s) => [s.id, { nome: s.nome_subcategoria, categoria_id: s.categoria_id }])),
    categorias: new Map(cats.map((c) => [c.id, c.nome_categoria])),
    linhas_op: new Map(linhas.map((l) => [l.id, l.codigo])),
    empresas: new Map(emps.map((e) => [e.id, e.nome_empresa])),
    locadoras: new Map(locs.map((l) => [l.id, l.nome_empresa])),
    centros: new Map(ccs.map((c) => [c.id, { codigo: c.codigo_centro_custo, nome: c.nome_centro_custo }])),
    fabricantes: new Map(fabs.map((f) => [f.id, f.nome])),
    modelos: new Map(mods.map((m) => [m.id, { nome: m.nome_modelo, fabricante_id: m.fabricante_id }])),
    departamentos: new Map(deps.map((d) => [d.id, d.nome_departamento ?? ''])),
    frotas: new Map(frotas.map((f) => [(f.codigo ?? '').toUpperCase(), f.id])),
  };
  return cat;
}

function montarListas(cat: CatalogoMap, ativos: Caminhao[]): ListaLinha[] {
  const lista: ListaLinha[] = [];
  const empty = { tipo_destino: null, parent_id_erp: null, parent_codigo: null, parent_nome: null, ativo: true, contexto: null };
  for (const [id, nome] of cat.categorias) lista.push({ tipo_catalogo: 'CATEGORIA', id_erp: id, codigo: null, nome, ...empty });
  for (const [id, s] of cat.subcategorias) lista.push({ tipo_catalogo: 'SUBCATEGORIA', id_erp: id, codigo: null, nome: s.nome, ...empty, parent_id_erp: s.categoria_id, parent_nome: s.categoria_id ? cat.categorias.get(s.categoria_id) ?? null : null });
  for (const [id, cod] of cat.linhas_op) lista.push({ tipo_catalogo: 'LINHA_OPERACIONAL', id_erp: id, codigo: cod, nome: cod, ...empty });
  for (const [id, nome] of cat.fabricantes) lista.push({ tipo_catalogo: 'FABRICANTE', id_erp: id, codigo: null, nome, ...empty });
  for (const [id, m] of cat.modelos) lista.push({ tipo_catalogo: 'MODELO', id_erp: id, codigo: null, nome: m.nome, ...empty, parent_id_erp: m.fabricante_id, parent_nome: m.fabricante_id ? cat.fabricantes.get(m.fabricante_id) ?? null : null });
  for (const [id, nome] of cat.empresas) lista.push({ tipo_catalogo: 'PROPRIETARIO', id_erp: id, codigo: null, nome, ...empty, tipo_destino: 'EMPRESA' });
  for (const [id, nome] of cat.locadoras) lista.push({ tipo_catalogo: 'PROPRIETARIO', id_erp: id, codigo: null, nome, ...empty, tipo_destino: 'LOCADORA' });
  for (const [id, c] of cat.centros) lista.push({ tipo_catalogo: 'CENTRO_CUSTO', id_erp: id, codigo: c.codigo, nome: c.nome, ...empty });
  for (const [id, nome] of cat.departamentos) lista.push({ tipo_catalogo: 'DEPARTAMENTO', id_erp: id, codigo: null, nome, ...empty });
  for (const [codigo, id] of cat.frotas) lista.push({ tipo_catalogo: 'FROTA', id_erp: id, codigo, nome: codigo, ...empty });
  // ATIVO_EXISTENTE — snapshot para validação cruzada fabricante↔modelo.
  for (const a of ativos) {
    const codCanon = `${(a.frota ?? '').toUpperCase()}${(a.numero_frota ?? '').replace(/^0+/, '') || '0'}`;
    const ctx = `fab_id:${a.fabricante_id ?? ''}|mod_id:${a.modelo_id ?? ''}`;
    lista.push({ tipo_catalogo: 'ATIVO_EXISTENTE', id_erp: a.id, codigo: codCanon, nome: codCanon, ...empty, contexto: ctx });
  }
  return lista;
}

function toRegistro(a: Caminhao, cat: CatalogoMap): EquipamentoExportRegistro {
  const prefixo = (a.frota ?? '').toUpperCase();
  const numero = (a.numero_frota ?? '').replace(/^0+/, '') || '0';
  const canonico = `${prefixo}${numero}`;
  const sub = a.subcategoria_ativo_id ? cat.subcategorias.get(a.subcategoria_ativo_id) : null;
  const catId = sub?.categoria_id ?? a.categoria_ativo_id ?? null;
  const catNome = catId ? cat.categorias.get(catId) ?? null : null;
  const propTipo: 'EMPRESA' | 'LOCADORA' | null =
    a.empresa_locadora_id ? 'LOCADORA' : (a.empresa_id ? 'EMPRESA' : null);
  const propId = a.empresa_locadora_id ?? a.empresa_id ?? null;
  const propNome = propId ? (propTipo === 'LOCADORA' ? cat.locadoras.get(propId) : cat.empresas.get(propId)) ?? null : null;
  const cc = a.centro_custo_atual_id ? cat.centros.get(a.centro_custo_atual_id) : null;
  const mod = a.modelo_id ? cat.modelos.get(a.modelo_id) : null;

  return {
    equipamento_id_erp: a.id,
    updated_at_origem: a.updated_at ?? new Date(0).toISOString(),
    codigo_canonico: canonico,
    codigo_exibicao: formatarExibicao(prefixo, numero),
    frota_codigo: prefixo,
    numero_frota: numero,
    subcategoria_id_erp: a.subcategoria_ativo_id ?? '',
    subcategoria_nome: sub?.nome ?? '',
    categoria_id_erp: catId ?? '',
    categoria_nome: catNome ?? '',
    linha_operacional_id_erp: a.linha_operacional_id ?? '',
    linha_operacional_codigo: a.linha_operacional_id ? cat.linhas_op.get(a.linha_operacional_id) ?? '' : '',
    proprietario_regime: propTipo === 'LOCADORA' ? 'LOCADO' : (propTipo === 'EMPRESA' ? 'PROPRIO' : ''),
    proprietario_cadastro_tipo: propTipo ?? '',
    proprietario_id_erp: propId ?? '',
    proprietario_nome: propNome ?? '',
    centro_custo_codigo: cc?.codigo ?? '',
    centro_custo_nome: cc?.nome ?? '',
    fabricante_id_erp: a.fabricante_id ?? '',
    fabricante_nome: a.fabricante_id ? cat.fabricantes.get(a.fabricante_id) ?? '' : '',
    modelo_id_erp: a.modelo_id ?? '',
    modelo_nome: mod?.nome ?? '',
    motor: a.motor ?? '',
    ano_fabricacao: a.ano_fabricacao ?? '',
    placa: a.placa ?? '',
    chassi: a.chassi ?? '',
    numero_serie: a.numero_serie ?? '',
    renavam: a.renavam ?? '',
    cor: a.cor ?? '',
    tipo_combustivel: a.tipo_combustivel ?? '',
    capacidade_valor: a.capacidade_valor ?? '',
    capacidade_unidade: a.capacidade_unidade ?? '',
    aluguel: a.aluguel ?? '',
    departamento_id_erp: a.departamento_id ?? '',
    departamento_nome: a.departamento_id ? cat.departamentos.get(a.departamento_id) ?? '' : '',
    observacoes: a.observacoes ?? '',
    situacao_atual: a.situacao ?? '',
    status_cadastro_atual: a.status_cadastro ?? '',
    status_disponibilidade_atual: a.status_disponibilidade ?? '',
  };
}

export interface HidratarExportacaoResult {
  registros: EquipamentoExportRegistro[];
  listas: ListaLinha[];
  total: number;
}

export async function hidratarExportacaoV3(): Promise<HidratarExportacaoResult> {
  const cat = await carregarCatalogos();
  const ativos = await paginado<Caminhao>(() =>
    supabase.from('bd_caminhoes_equipamentos').select(
      'id, updated_at, frota, numero_frota, subcategoria_ativo_id, categoria_ativo_id, ' +
      'linha_operacional_id, empresa_id, empresa_locadora_id, centro_custo_atual_id, ' +
      'fabricante_id, modelo_id, departamento_id, motor, ano_fabricacao, placa, chassi, ' +
      'numero_serie, renavam, cor, tipo_combustivel, capacidade_valor, capacidade_unidade, ' +
      'aluguel, observacoes, situacao, status_cadastro, status_disponibilidade')
      .order('frota', { ascending: true })
      .order('numero_frota', { ascending: true }),
  );
  const registros = ativos.map((a) => toRegistro(a, cat));
  const listas = montarListas(cat, ativos);
  return { registros, listas, total: registros.length };
}
