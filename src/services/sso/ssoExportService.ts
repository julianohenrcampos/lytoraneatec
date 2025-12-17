import { supabase } from '@/integrations/supabase/client';

export interface ChecklistExportRow {
  tecnico: string;
  gerente: string;
  engenheiro: string;
  contrato: string;
  obraNome: string;
  etapa1_data: string | null;
  etapa1_nota: number | null;
  etapa2_data: string | null;
  etapa2_nota: number | null;
  etapa3_data: string | null;
  etapa3_nota: number | null;
}

export interface ExportSummary {
  totalCanteiros: number;
  canteirosAtendidos: number;
  parametros: {
    ate50: number;
    de51a75: number;
    de76a100: number;
  };
}

export interface ChecklistExportData {
  rows: ChecklistExportRow[];
  summary: ExportSummary;
}

export const ssoExportService = {
  async getExportData(): Promise<ChecklistExportData> {
    // Buscar todos os checklists com dados da obra
    const { data: checklists, error } = await supabase
      .from('bd_sso_checklists')
      .select(`
        id,
        obra_id,
        gerente_regional,
        engenheiro_obra,
        tecnico_seguranca,
        data_inspecao,
        nota_real,
        bd_centros_custo(id, nome_centro_custo, codigo_centro_custo)
      `)
      .order('data_inspecao', { ascending: true });

    if (error) throw error;

    // Agrupar checklists por obra
    const obraMap = new Map<string, typeof checklists>();
    
    for (const checklist of checklists || []) {
      const obraId = checklist.obra_id;
      if (!obraMap.has(obraId)) {
        obraMap.set(obraId, []);
      }
      obraMap.get(obraId)!.push(checklist);
    }

    // Transformar em rows de exportação
    const rows: ChecklistExportRow[] = [];
    let totalNotas: number[] = [];

    for (const [obraId, obraChecklists] of obraMap) {
      // Ordenar por data para determinar etapas (1ª, 2ª, 3ª)
      const sorted = obraChecklists.sort((a, b) => 
        new Date(a.data_inspecao).getTime() - new Date(b.data_inspecao).getTime()
      );

      const obra = sorted[0]?.bd_centros_custo as { 
        id: string; 
        nome_centro_custo: string; 
        codigo_centro_custo: string;
      } | null;

      const row: ChecklistExportRow = {
        tecnico: sorted[0]?.tecnico_seguranca || '',
        gerente: sorted[0]?.gerente_regional || '',
        engenheiro: sorted[0]?.engenheiro_obra || '',
        contrato: obra?.codigo_centro_custo || '',
        obraNome: obra?.nome_centro_custo || '',
        etapa1_data: null,
        etapa1_nota: null,
        etapa2_data: null,
        etapa2_nota: null,
        etapa3_data: null,
        etapa3_nota: null,
      };

      // Preencher etapas
      if (sorted[0]) {
        row.etapa1_data = sorted[0].data_inspecao;
        row.etapa1_nota = sorted[0].nota_real;
        if (sorted[0].nota_real !== null) totalNotas.push(sorted[0].nota_real);
      }
      if (sorted[1]) {
        row.etapa2_data = sorted[1].data_inspecao;
        row.etapa2_nota = sorted[1].nota_real;
        if (sorted[1].nota_real !== null) totalNotas.push(sorted[1].nota_real);
      }
      if (sorted[2]) {
        row.etapa3_data = sorted[2].data_inspecao;
        row.etapa3_nota = sorted[2].nota_real;
        if (sorted[2].nota_real !== null) totalNotas.push(sorted[2].nota_real);
      }

      rows.push(row);
    }

    // Calcular resumo
    const summary: ExportSummary = {
      totalCanteiros: rows.length,
      canteirosAtendidos: rows.filter(r => 
        r.etapa1_nota !== null || r.etapa2_nota !== null || r.etapa3_nota !== null
      ).length,
      parametros: {
        ate50: totalNotas.filter(n => n <= 50).length,
        de51a75: totalNotas.filter(n => n > 50 && n <= 75).length,
        de76a100: totalNotas.filter(n => n > 75).length,
      }
    };

    return { rows, summary };
  }
};
