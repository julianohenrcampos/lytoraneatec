import * as XLSX from 'xlsx';
import { format } from 'date-fns';

export const downloadExcel = (data: Record<string, any[]> | any[], fileName: string) => {
  try {
    // Create a workbook
    const wb = XLSX.utils.book_new();
    
    if (Array.isArray(data)) {
      // Se for um array simples, criar uma única planilha
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, "Dados");
    } else {
      // Se for um objeto com múltiplas planilhas
      Object.entries(data).forEach(([sheetName, sheetData]) => {
        const ws = XLSX.utils.json_to_sheet(sheetData);
        
        // Configurar largura das colunas
        const columnWidths = Object.keys(sheetData[0] || {}).map(() => ({ wch: 20 }));
        ws['!cols'] = columnWidths;
        
        // Sanitizar nome da planilha para evitar caracteres especiais
        const sanitizedSheetName = sheetName.replace(/[\\/:*?"<>|]/g, '_').substring(0, 31);
        
        XLSX.utils.book_append_sheet(wb, ws, sanitizedSheetName);
      });
    }
    
    // Generate a download
    XLSX.writeFile(wb, `${fileName}.xlsx`);
    
    return true;
  } catch (error) {
    console.error("Error generating Excel file:", error);
    throw error;
  }
};

export const parseExcelFile = (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        
        // Get the first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        resolve(jsonData);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = (error) => {
      reject(error);
    };
    
    reader.readAsBinaryString(file);
  });
};

// Function to parse the specific Excel format for center of costs
export const parseCentroCustoExcel = (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        
        // Get the first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON preserving the exact format from the Excel file
        const options = { 
          header: ["codigo", "nome", "razao_social", "cnpj", "telefone", "situacao"],
          range: 1 // Skip the header row
        };
        
        const rawData = XLSX.utils.sheet_to_json(worksheet, options);
        
        // Transform into the format we need for the database
        const formattedData = rawData.map(item => {
          // Type assertion to access properties
          const row = item as Record<string, any>;
          
          return {
            codigo_centro_custo: row.codigo ? row.codigo.toString() : '',
            nome_centro_custo: row.nome || '',
            cnpj_vinculado: row.cnpj || null,
            telefone: row.telefone || null,
            situacao: (row.situacao === 'Inativo' ? 'Inativo' : 'Ativo') as 'Ativo' | 'Inativo'
          };
        });
        
        // Filter out empty rows (where codigo_centro_custo is empty)
        const validData = formattedData.filter(item => item.codigo_centro_custo && item.nome_centro_custo);
        
        resolve(validData);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = (error) => {
      reject(error);
    };
    
    reader.readAsBinaryString(file);
  });
};

// Function to generate a template Excel file for Centro de Custo
export const generateCentroCustoTemplate = () => {
  // Create headers
  const headers = ["Código", "Nome", "Razão Social", "CNPJ", "Telefone", "Situação"];
  
  // Create example data
  const example1 = ["A001", "NOME DO CENTRO DE CUSTO", "RAZÃO SOCIAL", "00.000.000/0001-00", "(00) 0000-0000", "Ativo"];
  const example2 = ["A002", "OUTRO CENTRO DE CUSTO", "OUTRA RAZÃO SOCIAL", "11.111.111/0001-11", "(11) 1111-1111", "Ativo"];
  
  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet([headers, example1, example2]);
  
  // Set column widths
  const wscols = [
    { wch: 10 }, // Código
    { wch: 40 }, // Nome
    { wch: 40 }, // Razão Social
    { wch: 20 }, // CNPJ
    { wch: 15 }, // Telefone
    { wch: 10 }  // Situação
  ];
  
  ws['!cols'] = wscols;
  
  // Create workbook and add the worksheet
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Centros de Custo");
  
  // Generate file download
  XLSX.writeFile(wb, "modelo_centros_custo.xlsx");
};

// Function to parse the specific Excel format for Funções 
export const parseFuncoesExcel = (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        
        // Get the first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Try to determine which format the file is in
        const sampleData = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 0, defval: '' });
        const headers = sampleData[0] as string[];
        
        let formattedData = [];
        
        // If there's a "Função" header or something similar
        if (headers.some(h => h.toLowerCase().includes('funç') || h.toLowerCase().includes('func'))) {
          // Format with the existing "Função" header
          const rawData = XLSX.utils.sheet_to_json(worksheet);
          
          formattedData = rawData.map(row => {
            // Find the function name field regardless of exact header name
            const functionKey = Object.keys(row).find(key => 
              key.toLowerCase().includes('funç') || key.toLowerCase().includes('func')
            );
            
            const functionName = functionKey ? (row as any)[functionKey] : null;
            
            if (functionName) {
              return {
                "Nome da Função": functionName.toString().trim()
              };
            }
            return null;
          }).filter(Boolean);
        } else {
          // If the first column is just function names without a header
          // or has a different header than expected
          const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 1 }); // Skip header row
          
          formattedData = rawData.map(row => {
            // Assume the first column contains the function name
            const functionName = row[0];
            
            if (functionName && typeof functionName === 'string') {
              return {
                "Nome da Função": functionName.trim()
              };
            }
            return null;
          }).filter(Boolean);
        }
        
        resolve(formattedData);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = (error) => {
      reject(error);
    };
    
    reader.readAsBinaryString(file);
  });
};

// Function to generate a template Excel file for Funções
export const generateFuncoesTemplate = () => {
  // Create headers (just one column)
  const headers = ["Função"];
  
  // Create example data
  const example1 = ["AJUDANTE DE ASFALTO"];
  const example2 = ["ENCARREGADO DE OBRAS"];
  const example3 = ["MOTORISTA"];
  
  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet([headers, example1, example2, example3]);
  
  // Set column width
  const wscols = [
    { wch: 40 }, // Função
  ];
  
  ws['!cols'] = wscols;
  
  // Create workbook and add the worksheet
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Funções");
  
  // Generate file download
  XLSX.writeFile(wb, "modelo_funcoes.xlsx");
};

// Nova função específica para relatório de medição
export const downloadRelatorioMedicaoExcel = (
  reportData: any[],
  manutencaoData: any,
  selectedVehicleDetails: any,
  dateRange: { from: Date; to: Date },
  tipoVeiculo: string
) => {
  try {
    console.log("Iniciando exportação Excel...");
    console.log("Dados recebidos:", { 
      reportDataLength: reportData?.length || 0,
      manutencaoData: !!manutencaoData,
      selectedVehicleDetails: !!selectedVehicleDetails,
      dateRange: !!dateRange,
      tipoVeiculo 
    });

    // Validações de segurança
    if (!reportData || !Array.isArray(reportData) || reportData.length === 0) {
      throw new Error("Dados do relatório não encontrados ou vazios");
    }

    if (!selectedVehicleDetails) {
      throw new Error("Detalhes do veículo não encontrados");
    }

    if (!dateRange || !dateRange.from || !dateRange.to) {
      throw new Error("Período de datas não definido corretamente");
    }

    if (!tipoVeiculo) {
      throw new Error("Tipo de veículo não definido");
    }

    // Aba 1: Resumo do Relatório
    const resumoSheet = [{
      'Tipo de Veículo': selectedVehicleDetails.tipo_veiculo || 'N/A',
      'Identificação': selectedVehicleDetails.label || 'N/A',
      'Período Inicial': format(dateRange.from, 'dd/MM/yyyy'),
      'Período Final': format(dateRange.to, 'dd/MM/yyyy'),
      'Total de Registros': reportData.length,
      'Valor Aluguel Mensal': `R$ ${(selectedVehicleDetails.aluguel || 0).toFixed(2).replace('.', ',')}`,
      'Data/Hora Geração': format(new Date(), 'dd/MM/yyyy HH:mm:ss')
    }];

    console.log("Resumo sheet criado:", resumoSheet);

    // Aba 2: Dados Detalhados dos Serviços
    const servicosSheet = reportData.map((item, index) => {
      const baseData = {
        'Item': index + 1,
        'Descrição dos Serviços': item.label || 'N/A',
        'Centro de Custo': item.centro_custo || 'N/A',
        'Tipo de Veículo': item.tipo_veiculo || 'N/A',
        'Dias Trabalhados': item.diasTrabalhados || 0,
        'Total Mensal (R$)': (item.totalMensal || 0).toFixed(2).replace('.', ','),
        'Abastecimento': (item.abastecimento || 0).toFixed(2).replace('.', ','),
        'Média Abastecimento': (item.mediaAbastecimento || 0).toFixed(2).replace('.', ','),
        'Rastreador': (item.rastreador || 0).toFixed(2).replace('.', ','),
      };

      if (tipoVeiculo === "Equipamento") {
        const equipmentItem = item as any;
        return {
          ...baseData,
          'Quantidade Horas': equipmentItem.quantidadeHoras || 0,
          'Valor Unitário Hora (R$)': (equipmentItem.valorUnitarioHora || 0).toFixed(2).replace('.', ','),
          'Horas Disponíveis': (equipmentItem.horasDisponiveis || 0).toFixed(2).replace('.', ','),
          'Valor Período (R$)': (equipmentItem.valorPeriodo || 0).toFixed(2).replace('.', ','),
          'Produtividade (H)': (equipmentItem.produtividade || 0).toFixed(2).replace('.', ','),
        };
      } else {
        const truckItem = item as any;
        return {
          ...baseData,
          'QTD/DIA': truckItem.qtdDia || 0,
          'Valor (R$)': (truckItem.valor || 0).toFixed(2).replace('.', ','),
          'Quilometragem (KM)': (truckItem.quilometragem || 0).toFixed(2).replace('.', ','),
        };
      }
    });

    console.log("Serviços sheet criado:", servicosSheet.length, "itens");

    // Aba 3: Dados de Manutenção/Descontos
    const manutencaoSheet = [];
    if (manutencaoData && typeof manutencaoData === 'object') {
      if (tipoVeiculo === "Equipamento") {
        manutencaoSheet.push({
          'Tipo': 'Desconto de Manutenção - Equipamento',
          'Valor Unitário (R$/h)': (manutencaoData.valorUnitario || 0).toFixed(2).replace('.', ','),
          'Quantidade Horas': manutencaoData.qtdHoras || 0,
          'Valor Total (R$)': (manutencaoData.valor || 0).toFixed(2).replace('.', ',')
        });
      } else {
        manutencaoSheet.push({
          'Tipo': 'Desconto de Manutenção - Caminhão',
          'Valor Mensal (R$)': (manutencaoData.valorMensal || 0).toFixed(2).replace('.', ','),
          'Quantidade Dias': manutencaoData.qtdDia || 0,
          'Valor Total (R$)': (manutencaoData.valor || 0).toFixed(2).replace('.', ',')
        });
      }
    } else {
      manutencaoSheet.push({
        'Tipo': 'Nenhum desconto de manutenção',
        'Observação': 'Não foram encontrados registros de manutenção no período'
      });
    }

    console.log("Manutenção sheet criado:", manutencaoSheet);

    // Aba 4: Totais e Cálculos
    const totalServicos = reportData.reduce((acc, item) => {
      if (tipoVeiculo === "Equipamento") {
        return acc + (item.valorPeriodo || 0);
      } else {
        return acc + (item.valor || 0);
      }
    }, 0);

    const totalDescontos = manutencaoData ? (manutencaoData.valor || 0) : 0;
    const totalPeriodo = totalServicos - totalDescontos;

    const totaisSheet = [{
      'Descrição': 'Total dos Serviços',
      'Valor (R$)': totalServicos.toFixed(2).replace('.', ',')
    }, {
      'Descrição': 'Total dos Descontos',
      'Valor (R$)': totalDescontos.toFixed(2).replace('.', ',')
    }, {
      'Descrição': 'TOTAL NO PERÍODO',
      'Valor (R$)': totalPeriodo.toFixed(2).replace('.', ',')
    }];

    console.log("Totais sheet criado:", totaisSheet);

    // Validar se todas as sheets têm dados
    if (!resumoSheet.length || !servicosSheet.length || !totaisSheet.length) {
      throw new Error("Erro ao criar dados das planilhas");
    }

    const workbookData = {
      'Resumo': resumoSheet,
      'Servicos Detalhados': servicosSheet,  // Removido caracteres especiais
      'Manutencao_Descontos': manutencaoSheet,  // Removido caracteres especiais  
      'Totais': totaisSheet
    };
    
    // Criar nome do arquivo seguro - sanitizar completamente
    const vehicleLabel = (selectedVehicleDetails.label || 'Veiculo')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .substring(0, 50); // Limitar tamanho
    
    const safeDate = format(new Date(), 'dd-MM-yyyy_HH-mm');
    const fileName = `Relatorio_Medicao_${vehicleLabel}_${safeDate}`;
    
    console.log("Arquivo será salvo como:", fileName);
    console.log("Dados do workbook:", Object.keys(workbookData));

    // Usar a função downloadExcel existente
    downloadExcel(workbookData, fileName);
    
    console.log("Exportação Excel concluída com sucesso!");
    return true;
  } catch (error) {
    console.error("Erro detalhado na exportação Excel:", error);
    console.error("Stack trace:", error instanceof Error ? error.stack : 'Stack não disponível');
    throw new Error(`Erro ao exportar relatório para Excel: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
};
