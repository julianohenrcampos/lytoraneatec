// PR-3.3 Fase C3 — Hidratação da EXPORTACAO no layout simplificado.
//
// Zero escrita. Puxa bd_caminhoes_equipamentos + catálogos e devolve:
//   - registros: RegistroExportacaoSimplificado[] (20 visíveis + _controle_ref + snapshot)
//   - listas:    ListasReferenciaV3 no modo EXPORTACAO (ativos + inativos vinculados)
//
// _controle_ref = equipamento.id (UUID). snapshot canônico calculado pelo mesmo
// pipeline do parser para que o diff no re-import seja estável (idempotência).

import { supabase } from '@/integrations/supabase/client';
import type { RegistroExportacaoSimplificado } from './gerarWorkbookV3Simplificado';
import { montarSnapshotCanonicoJson } from './gerarWorkbookV3Simplificado';
import {
  carregarListasReferenciaV3, type ListasReferenciaV3,
} from './carregarListasReferenciaV3';

interface Caminhao {
  id: string; updated_at: string | null;
  frota: string | null; numero_frota: string | null;
  subcategoria_ativo_id: string | null; linha_operacional_id: string | null;
  empresa_id: string | null; empresa_locadora_id: string | null;
  centro_custo_atual_id: string | null;
  fabricante_id: string | null; departamento_id: string | null;
  modelo: string | null;
  motor: string | null; ano_fabricacao: string | null; placa: string | null;
  chassi: string | null; numero_serie: string | null; renavam: string | null; cor: string | null;
  tipo_combustivel: string | null;
  capacidade_valor: number | null; capacidade_unidade: string | null;
  aluguel: string | null; observacoes: string | null;
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

function numeroSemZeros(v: string | null): string {
  const s = (v ?? '').replace(/^0+/, '');
  return s || '0';
}

function capacidadeExibicao(valor: number | null, unidade: string | null): string {
  if (valor === null || valor === undefined) return '';
  const u = (unidade ?? '').trim();
  return u ? `${valor} ${u}` : String(valor);
}

export interface HidratarExportacaoSimplificadoResult {
  registros: RegistroExportacaoSimplificado[];
  listas: ListasReferenciaV3;
  total: number;
}

export async function hidratarExportacaoV3Simplificado(): Promise<HidratarExportacaoSimplificadoResult> {
  // 1) Carrega ativos + catálogos em paralelo.
  const [ativos, subs, linhas, ccs, fabs, deps, empresas, locadoras, frotas] = await Promise.all([
    paginado<Caminhao>(() =>
      supabase.from('bd_caminhoes_equipamentos').select(
        'id, updated_at, frota, numero_frota, subcategoria_ativo_id, linha_operacional_id, ' +
        'empresa_id, empresa_locadora_id, centro_custo_atual_id, fabricante_id, departamento_id, ' +
        'modelo, motor, ano_fabricacao, placa, chassi, numero_serie, renavam, cor, ' +
        'tipo_combustivel, capacidade_valor, capacidade_unidade, aluguel, observacoes')
        .order('frota', { ascending: true })
        .order('numero_frota', { ascending: true })),
    paginado<{ id: string; nome_subcategoria: string }>(() =>
      supabase.from('bd_subcategorias_ativos').select('id, nome_subcategoria')),
    paginado<{ id: string; codigo: string | null; nome: string | null }>(() =>
      supabase.from('bd_linhas_operacionais').select('id, codigo, nome')),
    paginado<{ id: string; codigo_centro_custo: string }>(() =>
      supabase.from('bd_centros_custo').select('id, codigo_centro_custo')),
    paginado<{ id: string; nome: string }>(() =>
      supabase.from('bd_fabricantes').select('id, nome')),
    paginado<{ id: string; nome_departamento: string }>(() =>
      supabase.from('bd_departamentos').select('id, nome_departamento')),
    paginado<{ id: string; nome_empresa: string }>(() =>
      supabase.from('bd_empresas').select('id, nome_empresa')),
    paginado<{ id: string; nome_empresa: string }>(() =>
      supabase.from('bd_empresas_locadoras').select('id, nome_empresa')),
    paginado<{ id: string; codigo: string }>(() =>
      supabase.from('bd_frotas').select('id, codigo')),
  ]);

  // Frota id → codigo (para preencher coluna frota_codigo do simplificado).
  const frotaIdParaCodigo = new Map(frotas.map((f) => [f.id, f.codigo]));

  // Mapas ID → label exibido.
  const mSub = new Map(subs.map((s) => [s.id, s.nome_subcategoria]));
  const mLinha = new Map(linhas.map((l) => [l.id, l.codigo ?? l.nome ?? '']));
  const mCc = new Map(ccs.map((c) => [c.id, c.codigo_centro_custo]));
  const mFab = new Map(fabs.map((f) => [f.id, f.nome]));
  const mDep = new Map(deps.map((d) => [d.id, d.nome_departamento]));
  const mEmp = new Map(empresas.map((e) => [e.id, e.nome_empresa]));
  const mLoc = new Map(locadoras.map((l) => [l.id, l.nome_empresa]));

  // 2) Vinculados atuais → informa modo EXPORTACAO das listas (mantém inativos vinculados).
  const uniq = (xs: Array<string | null | undefined>) =>
    Array.from(new Set(xs.filter((x): x is string => !!x)));
  const vinculados = {
    frota: uniq(ativos.map((a) => (a.frota ? frotas.find((f) => f.codigo === a.frota)?.id : null))),
    subcategoria: uniq(ativos.map((a) => a.subcategoria_ativo_id)),
    linha_operacional: uniq(ativos.map((a) => a.linha_operacional_id)),
    centro_custo: uniq(ativos.map((a) => a.centro_custo_atual_id)),
    fabricante: uniq(ativos.map((a) => a.fabricante_id)),
    departamento: uniq(ativos.map((a) => a.departamento_id)),
    empresa: uniq(ativos.map((a) => a.empresa_id)),
    empresa_locadora: uniq(ativos.map((a) => a.empresa_locadora_id)),
  };
  const listas = await carregarListasReferenciaV3({ modo: 'EXPORTACAO', vinculados });

  // Precomputa mapa PROPRIETARIO id_erp+contexto → valor_exibicao (para bater com dropdown).
  const propExib = new Map<string, string>();
  for (const it of listas.por_tipo.PROPRIETARIO) {
    propExib.set(`${it.contexto}:${it.id_erp}`, it.valor_exibicao);
  }

  // 3) Monta registros.
  const registros: RegistroExportacaoSimplificado[] = ativos.map((a) => {
    const frota_codigo = (a.frota ?? '').toUpperCase();
    const numero_frota = numeroSemZeros(a.numero_frota);
    const codigo_canonico = frota_codigo ? `${frota_codigo}${numero_frota}` : '';
    const propKey = a.empresa_locadora_id
      ? `LOCADORA:${a.empresa_locadora_id}`
      : (a.empresa_id ? `EMPRESA:${a.empresa_id}` : null);
    const proprietario = propKey ? (propExib.get(propKey)
      ?? (a.empresa_locadora_id
        ? `LOCADORA | ${mLoc.get(a.empresa_locadora_id) ?? ''}`
        : `EMPRESA | ${mEmp.get(a.empresa_id ?? '') ?? ''}`)) : '';

    const linhaCrua = {
      frota_codigo,
      numero_frota,
      subcategoria: a.subcategoria_ativo_id ? mSub.get(a.subcategoria_ativo_id) ?? '' : '',
      linha_operacional: a.linha_operacional_id ? mLinha.get(a.linha_operacional_id) ?? '' : '',
      proprietario,
      centro_custo: a.centro_custo_atual_id ? mCc.get(a.centro_custo_atual_id) ?? '' : '',
      fabricante: a.fabricante_id ? mFab.get(a.fabricante_id) ?? '' : '',
      modelo: a.modelo ?? '',
      ano_fabricacao: a.ano_fabricacao ?? '',
      placa: a.placa ?? '',
      chassi: a.chassi ?? '',
      numero_serie: a.numero_serie ?? '',
      renavam: a.renavam ?? '',
      motor: a.motor ?? '',
      cor: a.cor ?? '',
      tipo_combustivel: a.tipo_combustivel ?? '',
      capacidade: capacidadeExibicao(a.capacidade_valor, a.capacidade_unidade),
      aluguel: a.aluguel ?? '',
      departamento: a.departamento_id ? mDep.get(a.departamento_id) ?? '' : '',
      observacoes: a.observacoes ?? '',
    };

    return {
      _controle_ref: a.id,
      equipamento_id_erp: a.id,
      updated_at_origem: a.updated_at ?? new Date(0).toISOString(),
      codigo_canonico,
      snapshot_original_json: montarSnapshotCanonicoJson(linhaCrua),
      ...linhaCrua,
    };
  });

  return { registros, listas, total: registros.length };
}
