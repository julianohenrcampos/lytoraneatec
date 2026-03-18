
import { downloadExcel, parseExcelFile } from "@/lib/excel";
import { supabase } from "@/integrations/supabase/client";
import { Veiculo, VeiculoFormData, ImportResult } from "./types";

export const exportVeiculos = async (veiculos: Veiculo[]) => {
  const data = veiculos.map(veiculo => ({
    'Placa': veiculo.placa || 'N/A',
    'Categoria': veiculo.nome_categoria || 'N/A',
    'Subcategoria': veiculo.nome_subcategoria || 'N/A',
    'Frota': veiculo.frota || 'N/A',
    'Número Frota': veiculo.numero_frota || 'N/A',
    'Fabricante': veiculo.fabricante || 'N/A',
    'Cor': veiculo.cor || 'N/A',
    'Departamento': veiculo.nome_departamento || 'N/A',
    'Empresa': veiculo.nome_empresa || 'N/A',
    'Motor': veiculo.motor || 'N/A',
    'Ano de Fabricação': veiculo.ano_fabricacao || 'N/A',
    'Tipo de Combustível': veiculo.tipo_combustivel || 'N/A',
    'Status IPVA': veiculo.status_ipva || 'N/A',
    'Situação': veiculo.situacao || 'N/A',
    'Capacidade': veiculo.capacidade || 'N/A',
    'Aluguel': veiculo.aluguel || 'N/A',
    'Observações': veiculo.observacoes || 'N/A',
    'Número de Série': veiculo.numero_serie || 'N/A',
    'Chassi': veiculo.chassi || 'N/A',
    'Informações Complementares': veiculo.informacoes_complementares || 'N/A',
    'Status Cadastro': veiculo.status_cadastro || 'N/A',
    'Status Disponibilidade': veiculo.status_disponibilidade || 'N/A',
    'Proprietário Tipo': veiculo.proprietario_tipo || 'N/A',
    'Tipo Ativo': veiculo.tipo_ativo || 'N/A',
    'Empresa Locadora': veiculo.nome_empresa_locadora || 'N/A',
  }));

  return downloadExcel(data, 'Veiculos_Equipamentos.xlsx');
};

export const importVeiculos = async (veiculos: VeiculoFormData[] | File): Promise<ImportResult> => {
  try {
    if (veiculos instanceof File) {
      try {
        console.log("Processing Excel file import");
        const jsonData = await parseExcelFile(veiculos);
        console.log("Parsed Excel data:", jsonData);
        
        const mappedVeiculos = jsonData.map((row: any) => ({
          frota: row.Frota || row.frota || null,
          numero_frota: row["Numero frota"] || row["Número frota"] || row["Número Frota"] || row.numero_frota || null,
          departamento_id: null,
          placa: row.Placa || row.placa || null,
          fabricante: row.Fabricante || row.fabricante || row.Marca || row.marca || null,
          cor: row.Cor || row.cor || null,
          motor: row.Motor || row.motor || null,
          ano_fabricacao: row["Ano de Fabricação"] || row["Ano de Fabricacao"] || row.ano_fabricacao || null,
          tipo_combustivel: row["Tipo de Combustível"] || row["Tipo de Combustivel"] || row.tipo_combustivel || null,
          status_ipva: row["Status IPVA"] || row.status_ipva || null,
          situacao: row.Situação || row.Situacao || row.situacao || null,
          capacidade: row.Capacidade || row.capacidade || null,
          aluguel: row.Aluguel || row.aluguel || null,
          observacoes: row.Observações || row.Observacoes || row.observacoes || null,
          empresa_id: null,
          imagem_url: null,
          categoria_ativo_id: null,
          subcategoria_ativo_id: null,
          numero_serie: row["Número de Série"] || row["Numero de Serie"] || row.numero_serie || null,
          chassi: row.Chassi || row.chassi || null,
          informacoes_complementares: row["Informações Complementares"] || row["Informacoes Complementares"] || row.informacoes_complementares || null,
          status_cadastro: row["Status Cadastro"] || row.status_cadastro || 'ativo',
          status_disponibilidade: row["Status Disponibilidade"] || row.status_disponibilidade || 'disponivel',
          proprietario_tipo: row["Proprietário Tipo"] || row["Proprietario Tipo"] || row.proprietario_tipo || 'proprio',
          tipo_ativo: row["Tipo Ativo"] || row.tipo_ativo || 'proprio',
          empresa_locadora_id: null,
        }));

        console.log("Mapped vehicles:", mappedVeiculos);

        // Resolve relationships by name
        for (const veiculo of mappedVeiculos) {
          const rowData = jsonData.find((r: any) => {
            const rowPlaca = r.Placa || r.placa;
            const rowSerie = r["Número de Série"] || r["Numero de Serie"] || r.numero_serie;
            if (veiculo.placa && rowPlaca === veiculo.placa) return true;
            if (veiculo.numero_serie && rowSerie === veiculo.numero_serie) return true;
            return false;
          });
          
          if (!rowData) continue;

          // Resolve Departamento
          const deptName = rowData.Departamento || rowData.departamento;
          if (deptName) {
            try {
              const { data: deptData } = await supabase
                .from("bd_departamentos")
                .select("id")
                .ilike("nome_departamento", deptName)
                .maybeSingle();
              if (deptData) veiculo.departamento_id = deptData.id;
            } catch (err) {
              console.error("Error finding department:", err);
            }
          }
          
          // Resolve Empresa
          const empresaNome = rowData.Empresa || rowData.empresa;
          if (empresaNome) {
            try {
              const { data: empresaData } = await supabase
                .from("bd_empresas")
                .select("id")
                .ilike("nome_empresa", empresaNome)
                .maybeSingle();
              if (empresaData) veiculo.empresa_id = empresaData.id;
            } catch (err) {
              console.error("Error finding company:", err);
            }
          }

          // Resolve Categoria
          const catName = rowData.Categoria || rowData.categoria;
          if (catName) {
            try {
              const { data: catData } = await supabase
                .from("bd_categorias_ativos")
                .select("id")
                .ilike("nome_categoria", catName)
                .maybeSingle();
              if (catData) {
                veiculo.categoria_ativo_id = catData.id;

                // Resolve Subcategoria
                const subName = rowData.Subcategoria || rowData.subcategoria;
                if (subName) {
                  const { data: subData } = await supabase
                    .from("bd_subcategorias_ativos")
                    .select("id")
                    .ilike("nome_subcategoria", subName)
                    .eq("categoria_id", catData.id)
                    .maybeSingle();
                  if (subData) veiculo.subcategoria_ativo_id = subData.id;
                }
              }
            } catch (err) {
              console.error("Error finding categoria:", err);
            }
          }

          // Resolve Empresa Locadora
          const locName = rowData["Empresa Locadora"] || rowData.empresa_locadora;
          if (locName) {
            try {
              const { data: locData } = await supabase
                .from("bd_empresas_locadoras")
                .select("id")
                .ilike("nome_empresa", locName)
                .maybeSingle();
              if (locData) veiculo.empresa_locadora_id = locData.id;
            } catch (err) {
              console.error("Error finding empresa locadora:", err);
            }
          }
        }

        return processImportVeiculos(mappedVeiculos);
      } catch (error) {
        console.error("Error parsing Excel file:", error);
        return { 
          success: [], 
          errors: [{ message: "Erro ao processar arquivo Excel" }] 
        };
      }
    } else {
      console.log("Processing direct data import");
      return processImportVeiculos(veiculos);
    }
  } catch (error: any) {
    console.error("Error importing veiculos:", error);
    return { 
      success: [], 
      errors: [{ message: error.message || "Erro ao importar veículos" }]
    };
  }
};

const processImportVeiculos = async (veiculos: VeiculoFormData[]): Promise<ImportResult> => {
  try {
    console.log("Processing import vehicles, count:", veiculos.length);
    
    const validVeiculos = veiculos.filter(v => {
      const isValid = v.categoria_ativo_id || v.placa || v.numero_serie || v.chassi;
      if (!isValid) console.log("Invalid entry:", v);
      return isValid;
    });
    
    console.log("Valid vehicles count:", validVeiculos.length);
    
    if (validVeiculos.length === 0) {
      return { 
        success: [], 
        errors: [{ message: "Nenhum veículo válido encontrado para importação. É necessário ao menos Placa, Número de Série, Chassi ou Categoria." }] 
      };
    }

    const processedVeiculos = validVeiculos.map(v => ({
      ...v,
      departamento_id: (v.departamento_id === "" || v.departamento_id === "_none") ? null : v.departamento_id,
      empresa_id: (v.empresa_id === "" || v.empresa_id === "_none") ? null : v.empresa_id
    }));

    console.log("Inserting vehicles into database...");
    const { data, error } = await supabase
      .from("bd_caminhoes_equipamentos")
      .insert(processedVeiculos)
      .select();

    if (error) {
      console.error("Database insertion error:", error);
      return { success: [], errors: [{ message: error.message }] };
    }

    console.log("Successfully imported vehicles:", data?.length);
    return { 
      success: data as Veiculo[], 
      errors: []
    };
  } catch (error: any) {
    console.error("Error processing vehicle import:", error);
    return { 
      success: [], 
      errors: [{ message: error.message || "Erro ao processar importação de veículos" }] 
    };
  }
};
