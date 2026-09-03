// PR-1 V3 — Builder puro de EXPORTACAO.
// PR-3.3 Fase B — layout 'simplificado' (20 colunas) é o novo padrão.
// Recebe registros já hidratados (querybuilder responsabilidade do PR-3/orquestrador).
// Toda linha exportada nasce como SEM_ALTERACAO com equipamento_id_erp + updated_at_origem
// + codigo_canonico preenchidos. Nenhum efeito colateral. Nenhuma escrita.

import * as XLSX from 'xlsx';
import { TIPO_ARQUIVO_EXPORTACAO } from './constants';
import {
  CABECALHOS_EQUIPAMENTOS, COLUNAS_EQUIPAMENTOS,
} from './equipamentosImportExportSchema';
import {
  CABECALHOS_EQUIPAMENTOS_SIMPLIFICADO, COLUNAS_EQUIPAMENTOS_SIMPLIFICADO,
} from './equipamentosSchemaSimplificado';
import {
  montarWorkbookV3, workbookToBlob,
  LAYOUT_PADRAO,
  type ListaLinha, type MetadadosV3, type LayoutV3,
} from './workbook';

/** Registro hidratado que o exportador consome. Chaves = ColunaSpec.chave.
 *  Aceita chaves do layout completo (41) e/ou do simplificado (20 — inclui `modelo`). */
export type EquipamentoExportRegistro = Partial<Record<string, string | number | null>> & {
  equipamento_id_erp: string;
  updated_at_origem: string;
  /** Obrigatório no layout completo; opcional no simplificado (usa codigo_exibicao). */
  codigo_canonico?: string;
};

function celula(v: string | number | null | undefined): string | number {
  if (v === null || v === undefined) return '';
  return v;
}

export function montarAbaEquipamentosExport(
  registros: EquipamentoExportRegistro[],
  layout: LayoutV3 = LAYOUT_PADRAO,
): XLSX.WorkSheet {
  if (layout === 'simplificado') {
    const linhas: (string | number)[][] = [[...CABECALHOS_EQUIPAMENTOS_SIMPLIFICADO]];
    for (const r of registros) {
      const row: (string | number)[] = [];
      for (const c of COLUNAS_EQUIPAMENTOS_SIMPLIFICADO) {
        if (c.chave === 'acao') { row.push('SEM_ALTERACAO'); continue; }
        row.push(celula((r as Record<string, string | number | null | undefined>)[c.chave]));
      }
      linhas.push(row);
    }
    return XLSX.utils.aoa_to_sheet(linhas);
  }

  const linhas: (string | number)[][] = [[...CABECALHOS_EQUIPAMENTOS]];
  for (const r of registros) {
    const row: (string | number)[] = [];
    for (const c of COLUNAS_EQUIPAMENTOS) {
      if (c.chave === 'acao') { row.push('SEM_ALTERACAO'); continue; }
      if (c.chave === 'campos_atualizar') { row.push(''); continue; }
      row.push(celula((r as Record<string, string | number | null | undefined>)[c.chave]));
    }
    linhas.push(row);
  }
  return XLSX.utils.aoa_to_sheet(linhas);
}

export interface GerarExportacaoInput {
  registros: EquipamentoExportRegistro[];
  listas: ListaLinha[];
  gerado_por?: string | null;
  ambiente_origem?: string | null;
  projeto_supabase_ref?: string | null;
  arquivo_referencia_nome?: string | null;
  arquivo_referencia_sha256?: string | null;
  filtros_aplicados?: string | null;
  observacoes?: string | null;
  /** PR-3.3 Fase B — default 'simplificado'. */
  layout?: LayoutV3;
}

export function gerarExportacaoV3(input: GerarExportacaoInput): Blob {
  const layout: LayoutV3 = input.layout ?? LAYOUT_PADRAO;
  const metadados: MetadadosV3 = {
    tipo_arquivo: TIPO_ARQUIVO_EXPORTACAO,
    gerado_em_iso: new Date().toISOString(),
    gerado_por: input.gerado_por ?? null,
    ambiente_origem: input.ambiente_origem ?? null,
    projeto_supabase_ref: input.projeto_supabase_ref ?? null,
    arquivo_referencia_nome: input.arquivo_referencia_nome ?? null,
    arquivo_referencia_sha256: input.arquivo_referencia_sha256 ?? null,
    total_registros: input.registros.length,
    filtros_aplicados: input.filtros_aplicados ?? null,
    total_listas: input.listas.length,
    observacoes: input.observacoes ?? null,
  };
  const wb = montarWorkbookV3({
    equipamentos: montarAbaEquipamentosExport(input.registros, layout),
    listas: input.listas,
    metadados,
    layout,
  });
  return workbookToBlob(wb);
}
