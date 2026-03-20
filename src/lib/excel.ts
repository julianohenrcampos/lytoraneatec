
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

// ========== Funções anteriores simuladas ==========
export function parseCentroCustoExcel(file) {
  console.log("Simulando parseCentroCustoExcel...");
  return [];
}

export function generateCentroCustoTemplate() {
  console.log("Simulando generateCentroCustoTemplate...");
  return new Blob([], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

// ========== Funções - Parse e Template reais ==========
export function parseFuncoesExcel(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        
        // Filter out empty rows
        const filteredData = jsonData.filter((row: any) => {
          const nome = row["Nome Função"] || row["Nome da Função"] || row["Função"] || "";
          return nome.toString().trim() !== "";
        });
        
        resolve(filteredData);
      } catch (error) {
        reject(new Error("Erro ao ler o arquivo Excel. Verifique o formato."));
      }
    };
    reader.onerror = () => reject(new Error("Erro ao ler o arquivo."));
    reader.readAsArrayBuffer(file);
  });
}

export function generateFuncoesTemplate() {
  const templateData = [
    {
      "Nome Função": "Exemplo: Motorista",
      "Valor Diária (R$)": 150.00,
      "Diária Exclusiva (R$)": 200.00,
      "Valor Refeição (R$)": 35.00,
      "Salário Base (R$)": 2500.00
    }
  ];
  
  const worksheet = XLSX.utils.json_to_sheet(templateData);
  worksheet["!cols"] = [
    { wch: 30 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 }
  ];
  
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Funções");
  
  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
  saveAs(blob, "modelo_importacao_funcoes.xlsx");
}

export function downloadExcel(data, filename = "dados.xlsx") {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Dados");
  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
  saveAs(blob, filename);
}

export function parseExcelFile(file) {
  console.log("Simulando parseExcelFile...");
  return Promise.resolve([]);
}

// ========== Função nova do relatório de medição ==========
export function downloadRelatorioMedicaoExcel(reportData, manutencaoData, vehicleDetails, dateRange, tipoVeiculo) {
  const wb = XLSX.utils.book_new();
  const sheetData = [];
  const obrasUnicas = [...new Set(reportData.map(item => item.centro_custo))].join(" / ");

  sheetData.push(["CONSTRUTORA LITORÂNEA"]);
  sheetData.push(["RELATÓRIO DE MEDIÇÃO"]);
  sheetData.push(["CONTRATADA: ABRA INFRAESTRUTURA", "", "", "", "", "", "", `OBRA: ${obrasUnicas || "NÃO INFORMADO"}`]);
  sheetData.push(["", "", "", "", "", "", "", `Mês de Referência: ${new Date(dateRange.from).toLocaleDateString("pt-BR", { month: "long" }).toUpperCase()}`]);
  sheetData.push(["", "", "", "", "", "", "", `Período: ${new Date(dateRange.from).toLocaleDateString()} à ${new Date(dateRange.to).toLocaleDateString()}`]);
  sheetData.push(["", "", "", "", "", "", "", "PM nº: 9"]);
  sheetData.push([]);
  sheetData.push([""]);
  sheetData.push(["", "", "", "DESCRIÇÃO DOS SERVIÇOS", "", "", ""]);
  sheetData.push(["", "", "", "", "", "", ""]);
  sheetData.push(["", "", "", "", "", "", ""]);
  sheetData.push([
    "DESCRIÇÃO DOS SERVIÇOS", "TOTAL MENSAL (R$)", "QTD/DIA", "VALOR (R$)",
    "PRODUTIVIDADE", "ABASTECIMENTO", "MÉDIA ABAST.", "RASTREADOR"
  ]);

  for (const item of reportData) {
    sheetData.push([
      item.label,
      `R$ ${item.totalMensal?.toFixed(2) || "0,00"}`,
      item.qtdDia || item.diasTrabalhados || "",
      `R$ ${item.valor?.toFixed(2) || "0,00"}`,
      `${item.quilometragem?.toFixed(2) || item.produtividade?.toFixed(2) || 0} km`,
      `${item.abastecimento?.toFixed(2) || 0} L`,
      `${item.mediaAbastecimento?.toFixed(2) || 0} L/KM`,
      `${item.rastreador?.toFixed(2) || 0} km`
    ]);
  }

  sheetData.push([]);
  sheetData.push(["2. DESCONTOS/ACRÉSCIMOS"]);
  sheetData.push(["2.1 DESCONTO DE MANUTENÇÃO"]);
  sheetData.push(["VALOR MENSAL", "QTD/DIA", "VALOR (R$)"]);
  sheetData.push([
    `R$ ${manutencaoData?.valorMensal?.toFixed(2) || "0,00"}`,
    manutencaoData?.qtdDia || manutencaoData?.qtdHoras || 0,
    `R$ ${manutencaoData?.valor?.toFixed(2) || "0,00"}`
  ]);

  sheetData.push([]);
  sheetData.push(["Observações:"]);
  sheetData.push([""]);
  sheetData.push([]);

  const totalPeriodo = reportData.reduce((acc, curr) => acc + (curr.valor || 0), 0);
  sheetData.push(["", "", "", "", `TOTAL NO PERÍODO: R$ ${totalPeriodo.toFixed(2)}`]);
  sheetData.push([]);
  sheetData.push(["", "", "", "", "", "", ""]);
  sheetData.push(["", "", "", "", "", "", ""]);
  sheetData.push(["", "", "", "", "", "", ""]);
  sheetData.push(["", "", "", "", "", "", ""]);
  sheetData.push(["Medição e Controle", "", "", "Gestor de Contratos", "", "", "Contratada"]);

  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  XLSX.utils.book_append_sheet(wb, ws, "Relatório de Medição");

  const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], { type: "application/octet-stream" });

  const nomeObra = obrasUnicas.replace(/[^a-zA-Z0-9]/g, "_") || "relatorio";
  const nomeMes = new Date(dateRange.from).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }).toUpperCase().replace(/[^A-Z0-9]/g, "_");
  const nomeArquivo = `relatorio_medicao_${nomeObra}_${nomeMes}.xlsx`;

  saveAs(blob, nomeArquivo);
}

// ========== Download de licitações por perfil ==========
export function downloadLicitacoesPerfilExcel(licitacoes: any[], nomePerfil: string) {
  const dados = licitacoes.map(item => ({
    "Órgão": item.orgao_nome || "",
    "UF": item.uf || "",
    "Município": item.municipio_nome || "",
    "Objeto": item.objeto || "",
    "Valor Estimado": item.valor_total_estimado || 0,
    "Data Fim Propostas": item.data_fim_propostas 
      ? new Date(item.data_fim_propostas).toLocaleDateString("pt-BR") 
      : "",
    "Modalidade": item.modalidade_contratacao || "",
    "Prioridade": item.prioridade || "",
    "Participando": item.participando ? "Sim" : "Não",
    "Status": item.status_resultado || "aguardando",
    "Link PNCP": item.link_origem_pncp || ""
  }));

  const worksheet = XLSX.utils.json_to_sheet(dados);
  
  worksheet["!cols"] = [
    { wch: 40 },
    { wch: 5 },
    { wch: 20 },
    { wch: 60 },
    { wch: 15 },
    { wch: 15 },
    { wch: 25 },
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
    { wch: 50 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Licitações");
  
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buffer], { type: "application/octet-stream" });
  
  const nomeArquivo = `licitacoes_${nomePerfil.replace(/\s+/g, "_")}_${
    new Date().toISOString().split("T")[0]
  }.xlsx`;
  
  saveAs(blob, nomeArquivo);
}
