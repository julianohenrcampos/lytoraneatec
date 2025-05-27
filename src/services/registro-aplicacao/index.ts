
// Export all registro aplicacao service functions
import { ListaProgramacaoEntrega } from "@/types/programacaoEntrega";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { registroAplicacaoSelectQuery } from "./baseService";

// Re-export individual functions
export { fetchRegistrosAplicacao } from "./fetchRegistrosAplicacao";
export { fetchEntregasEnviadas } from "./fetchEntregasEnviadas";
export { fetchRegistroAplicacaoById, fetchRegistroAplicacaoByListaEntregaId } from "./fetchRegistroAplicacao";
export { createRegistroAplicacao, updateRegistroAplicacao } from "./createUpdateRegistroAplicacao";
export { registroAplicacaoSelectQuery } from "./baseService";

// Export new services
export { getUserTeamId, getUserTeamInfo } from "../equipeService";
export { fetchLogradourosByRequisicao } from "../logradourosService";

// Export other functions
export const exportRegistrosAplicacaoToExcel = (entregas: any[]): void => {
  try {
    // Prepare data for export
    const exportData = entregas.map(entrega => ({
      'Centro de Custo': entrega.centro_custo_nome || entrega.logradouro,
      'Data': format(new Date(entrega.data_entrega), "dd/MM/yyyy"),
      'Caminhão': entrega.caminhao ? `${entrega.caminhao.placa} - ${entrega.caminhao.modelo}` : 'N/A',
      'Equipe': entrega.equipe?.nome_equipe || 'N/A',
      'Quantidade (t)': entrega.quantidade_massa,
      'Tipo de Lançamento': entrega.tipo_lancamento,
      'Status': entrega.status
    }));
    
    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Aplicações');
    
    // Generate filename with current date
    const fileName = `registro-aplicacao-${format(new Date(), 'dd-MM-yyyy')}.xlsx`;
    
    // Write to file and trigger download
    XLSX.writeFile(wb, fileName);
  } catch (error) {
    console.error("Error exporting registro aplicação data:", error);
    throw error;
  }
};
