import { supabase } from "@/integrations/supabase/client";
import { Funcao, FuncaoFormData, FuncaoFilter } from "@/types/funcao";
import * as XLSX from "xlsx";

// Fetch functions with filters
export const fetchFuncoes = async (filters: FuncaoFilter = {}): Promise<Funcao[]> => {
  let query = supabase
    .from("bd_funcoes")
    .select("*");
  
  if (filters.nome_funcao) {
    query = query.ilike("nome_funcao", `%${filters.nome_funcao}%`);
  }
  
  const { data, error } = await query.order("nome_funcao", { ascending: true });
  
  if (error) {
    console.error("Error fetching funções:", error);
    throw new Error(`Erro ao buscar funções: ${error.message}`);
  }
  
  return data as Funcao[];
};

// Check if a function already exists (for validation)
export const checkFuncaoExists = async (
  nome: string,
  id?: string
): Promise<boolean> => {
  const { data, error } = await supabase
    .from("bd_funcoes")
    .select("id")
    .eq("nome_funcao", nome)
    .maybeSingle();

  if (error) {
    console.error("Error checking função:", error);
    throw new Error(`Erro ao verificar função: ${error.message}`);
  }

  if (data && data.id !== id) {
    return true;
  }

  return false;
};

// Create a new function
export const createFuncao = async (data: FuncaoFormData): Promise<Funcao> => {
  const normalizedData = { ...data, nome_funcao: data.nome_funcao.toUpperCase().trim() };
  const { data: newData, error } = await supabase
    .from("bd_funcoes")
    .insert(normalizedData)
    .select()
    .single();
  
  if (error) {
    console.error("Error creating função:", error);
    throw new Error(`Erro ao criar função: ${error.message}`);
  }
  
  return newData as Funcao;
};

// Update an existing function
export const updateFuncao = async (id: string, data: FuncaoFormData): Promise<Funcao> => {
  const normalizedData = { ...data, nome_funcao: data.nome_funcao.toUpperCase().trim() };
  const { data: updatedData, error } = await supabase
    .from("bd_funcoes")
    .update(normalizedData)
    .eq("id", id)
    .select()
    .single();
  
  if (error) {
    console.error("Error updating função:", error);
    throw new Error(`Erro ao atualizar função: ${error.message}`);
  }
  
  return updatedData as Funcao;
};

// Check if function is in use by employees
export const checkFuncaoInUse = async (id: string): Promise<{ inUse: boolean; count: number; employees: string[] }> => {
  const { data, error } = await supabase
    .from("bd_funcionarios")
    .select("id, nome_completo")
    .eq("funcao_id", id);

  if (error) {
    console.error("Error checking função usage:", error);
    throw new Error(`Erro ao verificar uso da função: ${error.message}`);
  }

  return {
    inUse: data && data.length > 0,
    count: data ? data.length : 0,
    employees: data ? data.map(emp => emp.nome_completo) : []
  };
};

// Delete a function
export const deleteFuncao = async (id: string): Promise<void> => {
  const usage = await checkFuncaoInUse(id);
  
  if (usage.inUse) {
    throw new Error(`Não é possível excluir esta função pois existem ${usage.count} funcionário(s) vinculado(s): ${usage.employees.slice(0, 3).join(', ')}${usage.count > 3 ? ' e outros...' : ''}`);
  }

  const { error } = await supabase
    .from("bd_funcoes")
    .delete()
    .eq("id", id);
  
  if (error) {
    console.error("Error deleting função:", error);
    
    if (error.code === '23503' || error.message.includes('foreign key')) {
      throw new Error('Não é possível excluir esta função pois existem funcionários vinculados a ela. Primeiro remova ou transfira os funcionários para outras funções.');
    }
    
    throw new Error(`Erro ao excluir função: ${error.message}`);
  }
};

// Export data to Excel
export const exportToExcel = (data: Funcao[]): void => {
  const formattedData = data.map((item) => ({
    "Nome Função": item.nome_funcao,
    "Valor Diária (R$)": item.valor_diaria ?? 0,
    "Diária Exclusiva (R$)": item.valor_diaria_exclusiva ?? 0,
    "Valor Refeição (R$)": item.valor_refeicao ?? 0,
    "Salário Base (R$)": item.salario_base ?? 0
  }));
  
  const worksheet = XLSX.utils.json_to_sheet(formattedData);
  
  worksheet["!cols"] = [
    { wch: 30 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 }
  ];
  
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Funções");
  
  XLSX.writeFile(workbook, "funcoes_sistema.xlsx");
};

// Helper to parse monetary value from import
const parseMonetaryValue = (value: any): number => {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;
  const cleanValue = value.toString().replace(/[R$\s.]/g, '').replace(',', '.');
  return parseFloat(cleanValue) || 0;
};

// Process imported data with delta update logic
export const processImportData = async (data: any[]): Promise<{ 
  created: string[]; 
  updated: string[]; 
  unchanged: string[];
  errors: string[];
  // Keep backward compat
  success: string[];
}> => {
  const results = {
    created: [] as string[],
    updated: [] as string[],
    unchanged: [] as string[],
    errors: [] as string[],
    success: [] as string[]
  };
  
  for (const row of data) {
    try {
      const funcaoNome = (row["Nome Função"] || row["Nome da Função"] || row["Função"] || "").toString().toUpperCase().trim();
      
      if (!funcaoNome) {
        results.errors.push(`Linha com dados incompletos: ${JSON.stringify(row)}`);
        continue;
      }
      
      const valorDiaria = parseMonetaryValue(row["Valor Diária (R$)"] || row["Valor Diária"] || row["Valor da Diária"] || 0);
      const valorDiariaExclusiva = parseMonetaryValue(row["Diária Exclusiva (R$)"] || row["Diária Exclusiva"] || row["Valor Diária Exclusiva"] || 0);
      const valorRefeicao = parseMonetaryValue(row["Valor Refeição (R$)"] || row["Valor Refeição"] || row["Valor Refeicao"] || 0);
      const salarioBase = parseMonetaryValue(row["Salário Base (R$)"] || row["Salário Base"] || row["Salario Base"] || 0);
      
      // Check if function exists
      const { data: existing, error: searchError } = await supabase
        .from("bd_funcoes")
        .select("*")
        .ilike("nome_funcao", funcaoNome)
        .maybeSingle();
      
      if (searchError) {
        results.errors.push(`Erro ao buscar ${funcaoNome}: ${searchError.message}`);
        continue;
      }
      
      if (existing) {
        // Delta update: compare field by field
        const updates: Record<string, number> = {};
        
        if (valorDiaria !== (existing.valor_diaria ?? 0)) updates.valor_diaria = valorDiaria;
        if (valorDiariaExclusiva !== (existing.valor_diaria_exclusiva ?? 0)) updates.valor_diaria_exclusiva = valorDiariaExclusiva;
        if (valorRefeicao !== (existing.valor_refeicao ?? 0)) updates.valor_refeicao = valorRefeicao;
        if (salarioBase !== (existing.salario_base ?? 0)) updates.salario_base = salarioBase;
        
        if (Object.keys(updates).length > 0) {
          const { error: updateError } = await supabase
            .from("bd_funcoes")
            .update(updates)
            .eq("id", existing.id);
          
          if (updateError) {
            results.errors.push(`Erro ao atualizar ${funcaoNome}: ${updateError.message}`);
          } else {
            const changedFields = Object.keys(updates).join(', ');
            results.updated.push(`${funcaoNome} (${changedFields})`);
            results.success.push(`${funcaoNome} (atualizada)`);
          }
        } else {
          results.unchanged.push(funcaoNome);
        }
      } else {
        // Insert new
        const funcaoData: FuncaoFormData = {
          nome_funcao: funcaoNome,
          valor_diaria: valorDiaria,
          valor_diaria_exclusiva: valorDiariaExclusiva,
          valor_refeicao: valorRefeicao,
          salario_base: salarioBase
        };
        
        await createFuncao(funcaoData);
        results.created.push(funcaoNome);
        results.success.push(`${funcaoNome} (criada)`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      const funcaoNome = row["Nome Função"] || row["Nome da Função"] || row["Função"] || "Desconhecido";
      results.errors.push(`Erro ao processar ${funcaoNome}: ${errorMessage}`);
    }
  }
  
  return results;
};
