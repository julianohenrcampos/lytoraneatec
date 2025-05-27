import * as XLSX from 'xlsx';

export const downloadExcel = (data: any[], fileName: string) => {
  try {
    // Create a workbook
    const wb = XLSX.utils.book_new();
    
    // Convert the data to a worksheet
    const ws = XLSX.utils.json_to_sheet(data);
    
    // Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    
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
