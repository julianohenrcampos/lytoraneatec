// PR-1 V3 — Gerar arquivo MODELO (template vazio).
// Puro. Não fala com o banco.

import { TIPO_ARQUIVO_MODELO } from './constants';
import {
  montarAbaEquipamentosVazia, montarWorkbookV3, workbookToBlob,
  LAYOUT_PADRAO,
  type ListaLinha, type MetadadosV3, type LayoutV3,
} from './workbook';

export interface GerarModeloInput {
  gerado_por?: string | null;
  ambiente_origem?: string | null;
  projeto_supabase_ref?: string | null;
  /** Enums e catálogos estáticos que ajudam o usuário a preencher. Opcional. */
  listas_referencia?: ListaLinha[];
  observacoes?: string | null;
  /** PR-3.3 Fase B — default 'simplificado' (20 colunas + abas internas ocultas). */
  layout?: LayoutV3;
}

export function gerarModeloV3(input: GerarModeloInput = {}): Blob {
  const layout: LayoutV3 = input.layout ?? LAYOUT_PADRAO;
  const listas = input.listas_referencia ?? [];
  const metadados: MetadadosV3 = {
    tipo_arquivo: TIPO_ARQUIVO_MODELO,
    gerado_em_iso: new Date().toISOString(),
    gerado_por: input.gerado_por ?? null,
    ambiente_origem: input.ambiente_origem ?? null,
    projeto_supabase_ref: input.projeto_supabase_ref ?? null,
    arquivo_referencia_nome: null,
    arquivo_referencia_sha256: null,
    total_registros: 0,
    filtros_aplicados: null,
    total_listas: listas.length,
    observacoes: input.observacoes
      ?? (layout === 'simplificado'
        ? 'Modelo em branco (layout simplificado — 20 colunas). Preencha a aba EQUIPAMENTOS.'
        : 'Modelo em branco. Preencha a aba EQUIPAMENTOS.'),
  };
  const wb = montarWorkbookV3({
    equipamentos: montarAbaEquipamentosVazia(layout),
    listas,
    metadados,
    layout,
  });
  return workbookToBlob(wb);
}
