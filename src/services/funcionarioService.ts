
import { supabase } from "@/integrations/supabase/client";
import { Funcionario, FuncionarioFormData, FuncionarioFilter } from "@/types/funcionario";
import { addDays } from "date-fns";

// Helper to build base filters on query
const applyFilters = (query: any, filters: FuncionarioFilter) => {
  if (filters.nome_completo) {
    query = query.ilike("nome_completo", `%${filters.nome_completo}%`);
  }

  if (filters.cpf) {
    query = query.ilike("cpf", `%${filters.cpf.replace(/\D/g, '')}%`);
  }

  if (filters.matricula) {
    query = query.ilike("matricula", `%${filters.matricula}%`);
  }

  if (filters.data_admissao_inicio) {
    query = query.gte("data_admissao", filters.data_admissao_inicio);
  }

  if (filters.data_admissao_fim) {
    query = query.lte("data_admissao", filters.data_admissao_fim);
  }

  if (filters.funcao_id) {
    if (filters.funcao_id === "sem_funcao") {
      query = query.is("funcao_id", null);
    } else {
      query = query.eq("funcao_id", filters.funcao_id);
    }
  }

  if (filters.departamento_id) {
    if (filters.departamento_id === "sem_valor") {
      query = query.is("departamento_id", null);
    } else {
      query = query.eq("departamento_id", filters.departamento_id);
    }
  }

  if (filters.centro_custo_id) {
    if (filters.centro_custo_id === "sem_valor") {
      query = query.is("centro_custo_id", null);
    } else {
      query = query.eq("centro_custo_id", filters.centro_custo_id);
    }
  }

  if (filters.centro_custo_ids && filters.centro_custo_ids.length > 0) {
    query = query.in("centro_custo_id", filters.centro_custo_ids);
  }

  if (filters.empresa_id) {
    if (filters.empresa_id === "sem_valor") {
      query = query.is("empresa_id", null);
    } else {
      query = query.eq("empresa_id", filters.empresa_id);
    }
  }

  if (filters.equipe_id) {
    if (filters.equipe_id === "sem_valor") {
      query = query.is("equipe_id", null);
    } else {
      query = query.eq("equipe_id", filters.equipe_id);
    }
  }

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  return query;
};

// Fallback: load catalogs separately and merge with funcionarios
const fetchFuncionariosFallback = async (filters: FuncionarioFilter): Promise<Funcionario[]> => {
  console.log("🔄 Usando fallback para carregar funcionários...");
  
  // 1. Load base funcionarios without embeds
  let query = supabase
    .from("bd_funcionarios")
    .select("id, nome_completo, cpf, data_nascimento, email, endereco_completo, escolaridade, genero, funcao_id, departamento_id, centro_custo_id, empresa_id, equipe_id, data_admissao, data_ferias, data_demissao, status, salario_base, insalubridade, periculosidade, gratificacao, adicional_noturno, custo_passagem, refeicao, diarias, observacoes, banco, agencia, conta_corrente, chave_pix, imagem, matricula, created_at, updated_at");
  
  query = applyFilters(query, filters);
  
  const { data: funcionariosBase, error: baseError } = await query;
  
  if (baseError) {
    console.error("❌ Fallback também falhou:", baseError);
    throw new Error(`Erro ao carregar funcionários: ${baseError.message}. Código: ${baseError.code || 'N/A'}. Detalhes: ${baseError.details || baseError.hint || 'N/A'}`);
  }
  
  if (!funcionariosBase || funcionariosBase.length === 0) {
    return [];
  }
  
  // 2. Collect unique IDs for related tables
  const funcaoIds = [...new Set(funcionariosBase.map(f => f.funcao_id).filter(Boolean))];
  const departamentoIds = [...new Set(funcionariosBase.map(f => f.departamento_id).filter(Boolean))];
  const centroCustoIds = [...new Set(funcionariosBase.map(f => f.centro_custo_id).filter(Boolean))];
  const empresaIds = [...new Set(funcionariosBase.map(f => f.empresa_id).filter(Boolean))];
  const equipeIds = [...new Set(funcionariosBase.map(f => f.equipe_id).filter(Boolean))];
  
  // 3. Load catalogs in parallel
  const [funcoesRes, departamentosRes, centrosCustoRes, empresasRes, equipesRes] = await Promise.all([
    funcaoIds.length > 0 
      ? supabase.from("bd_funcoes").select("id, nome_funcao").in("id", funcaoIds)
      : { data: [], error: null },
    departamentoIds.length > 0 
      ? supabase.from("bd_departamentos").select("id, nome_departamento").in("id", departamentoIds)
      : { data: [], error: null },
    centroCustoIds.length > 0 
      ? supabase.from("bd_centros_custo").select("id, codigo_centro_custo, nome_centro_custo").in("id", centroCustoIds)
      : { data: [], error: null },
    empresaIds.length > 0 
      ? supabase.from("bd_empresas").select("id, nome_empresa").in("id", empresaIds)
      : { data: [], error: null },
    equipeIds.length > 0 
      ? supabase.from("bd_equipes").select("id, nome_equipe").in("id", equipeIds)
      : { data: [], error: null },
  ]);
  
  // Build lookup maps
  const funcoesMap = new Map((funcoesRes.data || []).map(f => [f.id, f]));
  const departamentosMap = new Map((departamentosRes.data || []).map(d => [d.id, d]));
  const centrosCustoMap = new Map((centrosCustoRes.data || []).map(c => [c.id, c]));
  const empresasMap = new Map((empresasRes.data || []).map(e => [e.id, e]));
  const equipesMap = new Map((equipesRes.data || []).map(eq => [eq.id, eq]));
  
  // 4. Merge data
  const funcionariosCompletos = funcionariosBase.map(func => ({
    ...func,
    bd_funcoes: func.funcao_id ? funcoesMap.get(func.funcao_id) || null : null,
    bd_departamentos: func.departamento_id ? departamentosMap.get(func.departamento_id) || null : null,
    bd_centros_custo: func.centro_custo_id ? centrosCustoMap.get(func.centro_custo_id) || null : null,
    bd_empresas: func.empresa_id ? empresasMap.get(func.empresa_id) || null : null,
    bd_equipes: func.equipe_id ? equipesMap.get(func.equipe_id) || null : null,
  }));
  
  console.log("✅ Fallback carregou", funcionariosCompletos.length, "funcionários");
  return funcionariosCompletos as unknown as Funcionario[];
};

// Function to fetch funcionarios with filters
export const fetchFuncionarios = async (filters: FuncionarioFilter = {}): Promise<Funcionario[]> => {
  try {
    // First attempt: use explicit FK-based embeds for robustness
    let query = supabase
      .from("bd_funcionarios")
      .select(`
        id, nome_completo, cpf, data_nascimento, email, endereco_completo, escolaridade, genero,
        funcao_id, departamento_id, centro_custo_id, empresa_id, equipe_id,
        data_admissao, data_ferias, data_demissao, status,
        salario_base, insalubridade, periculosidade, gratificacao, adicional_noturno,
        custo_passagem, refeicao, diarias, observacoes,
        banco, agencia, conta_corrente, chave_pix, imagem, matricula, created_at, updated_at,
        bd_funcoes!bd_funcionarios_funcao_id_fkey ( id, nome_funcao ),
        bd_departamentos!bd_funcionarios_departamento_id_fkey ( id, nome_departamento ),
        bd_centros_custo!bd_funcionarios_centro_custo_id_fkey ( id, codigo_centro_custo, nome_centro_custo ),
        bd_empresas!bd_funcionarios_empresa_id_fkey ( id, nome_empresa )
      `);

    query = applyFilters(query, filters);

    const { data, error } = await query;

    if (error) {
      // Log full error for diagnosis
      console.error("❌ Erro na query principal de funcionários:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      
      // Try fallback approach
      console.warn("⚠️ Tentando fallback sem embeds...");
      return await fetchFuncionariosFallback(filters);
    }
    
    // Load equipes separately to avoid multiple FK conflict
    const funcionariosComEquipes = await Promise.all(
      (data || []).map(async (funcionario) => {
        if (funcionario.equipe_id) {
          const { data: equipe } = await supabase
            .from("bd_equipes")
            .select("id, nome_equipe")
            .eq("id", funcionario.equipe_id)
            .maybeSingle();
          
          return {
            ...funcionario,
            bd_equipes: equipe
          };
        }
        return funcionario;
      })
    );
    
    return funcionariosComEquipes as unknown as Funcionario[];
  } catch (error: any) {
    console.error("❌ Erro ao carregar funcionários:", {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
      stack: error?.stack,
    });
    
    // Throw with detailed message
    const errorMessage = error?.message || "Erro desconhecido";
    const errorCode = error?.code ? ` (Código: ${error.code})` : "";
    const errorHint = error?.hint ? `. Dica: ${error.hint}` : "";
    const errorDetails = error?.details ? `. Detalhes: ${error.details}` : "";
    
    throw new Error(`${errorMessage}${errorCode}${errorHint}${errorDetails}`);
  }
};

// Function to get funcionario by ID
export const getFuncionarioById = async (id: string): Promise<Funcionario> => {
  try {
    const { data, error } = await supabase
      .from("bd_funcionarios")
      .select(`
        *,
        bd_funcoes (*),
        bd_departamentos (*),
        bd_centros_custo (*),
        bd_empresas (*)
      `)
      .eq("id", id)
      .single();

    if (error) throw new Error(error.message);
    
    // Buscar a equipe separadamente para evitar conflito de relacionamentos múltiplos
    let funcionarioComEquipe = data;
    if (data.equipe_id) {
      const { data: equipe } = await supabase
        .from("bd_equipes")
        .select("*")
        .eq("id", data.equipe_id)
        .single();
      
      funcionarioComEquipe = {
        ...data,
        bd_equipes: equipe
      } as any;
    }
    
    return funcionarioComEquipe as unknown as Funcionario;
  } catch (error) {
    console.error(`Error fetching funcionario with id ${id}:`, error);
    throw error;
  }
};

// Helper function to normalize email (matching DB function)
const normalizeEmail = (email?: string | null): string | null => {
  if (!email || typeof email !== 'string' || email.trim() === '') {
    return null;
  }
  return email.toLowerCase().trim();
};

// Helper function to normalize text (matching DB function for names)
const normalizeText = (text?: string | null): string | null => {
  if (!text || typeof text !== 'string' || text.trim() === '') {
    return null;
  }
  // Basic normalization - removes accents and converts to lowercase
  return text.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
};

// Helper function to check for duplicate email using the normalized database function
const checkEmailDuplicate = async (email: string, excludeId?: string): Promise<boolean> => {
  if (!email || email.trim() === '') return false;

  try {
    const { data, error } = await (supabase as any)
      .rpc('check_email_duplicate_normalized', {
        p_email: email,
        p_exclude_id: excludeId || null
      });

    if (error) {
      console.error("Erro ao verificar duplicidade de email:", error);
      throw new Error("Erro ao verificar duplicidade de email");
    }

    return data === true;
  } catch (error) {
    console.error("Erro na função de verificação de email:", error);
    return false;
  }
};

// Helper function to sanitize date fields and UUID references
const sanitizeFormData = (data: FuncionarioFormData) => {
  const sanitizedData = { ...data };
  
  // Force nome_completo to uppercase
  if (sanitizedData.nome_completo) {
    sanitizedData.nome_completo = sanitizedData.nome_completo.toUpperCase().trim();
  }
  
  // Preserve CPF format (legacy records may already store masked CPF)
  // to avoid forcing value changes during updates that can trigger duplicate conflicts.
  if (typeof sanitizedData.cpf === 'string') {
    sanitizedData.cpf = sanitizedData.cpf.trim();
  }
  
  // Normalize email
  if (sanitizedData.email) {
    sanitizedData.email = normalizeEmail(sanitizedData.email);
  }
  
  // Convert empty strings to null for date fields
  if (sanitizedData.data_nascimento === "") sanitizedData.data_nascimento = null;
  if (sanitizedData.data_admissao === "") sanitizedData.data_admissao = null;
  if (sanitizedData.data_ferias === "") sanitizedData.data_ferias = null;
  if (sanitizedData.data_demissao === "") sanitizedData.data_demissao = null;
  
  // Convert empty strings to null for UUID references
  if (sanitizedData.funcao_id === "") sanitizedData.funcao_id = null;
  if (sanitizedData.departamento_id === "") sanitizedData.departamento_id = null;
  if (sanitizedData.centro_custo_id === "") sanitizedData.centro_custo_id = null;
  if (sanitizedData.empresa_id === "") sanitizedData.empresa_id = null;
  if (sanitizedData.equipe_id === "") sanitizedData.equipe_id = null;
  
  return sanitizedData;
};

// Function to create new funcionario
export const createFuncionario = async (data: FuncionarioFormData): Promise<Funcionario> => {
  try {
    // Sanitize form data (convert empty strings to null)
    const sanitizedData = sanitizeFormData(data);
    
    // Check for email duplicates before creating
    if (sanitizedData.email) {
      const isDuplicateEmail = await checkEmailDuplicate(sanitizedData.email);
      if (isDuplicateEmail) {
        throw new Error(`Já existe um funcionário ativo com o email "${sanitizedData.email}". Verifique duplicidade.`);
      }
    }
    
    // Calculate data_ferias if data_admissao is provided
    let funcionarioData = { ...sanitizedData };
    if (funcionarioData.data_admissao) {
      const admissionDate = new Date(funcionarioData.data_admissao);
      const feriasDays = 365; // 1 year for vacation
      const feriasDate = addDays(admissionDate, feriasDays);
      funcionarioData.data_ferias = feriasDate.toISOString().split("T")[0];
    }

    // Set status based on admission and dismissal dates
    if (!funcionarioData.status) {
      if (!funcionarioData.data_demissao) {
        funcionarioData.status = "Ativo";
      } else {
        const today = new Date();
        const dismissalDate = new Date(funcionarioData.data_demissao);
        funcionarioData.status = dismissalDate > today ? "Aviso Prévio" : "Inativo";
      }
    }

    // Log the data being sent to the database for debugging
    console.log("Creating funcionario with data:", funcionarioData);

    // Separar INSERT do SELECT para evitar conflito RLS no RETURNING
    // AdmSSO pode inserir em qualquer departamento, mas só pode visualizar o seu
    const { error: insertError } = await supabase
      .from("bd_funcionarios")
      .insert(funcionarioData as any);

    if (insertError) {
      console.error("Database INSERT error:", insertError);
      
      // Extrair mensagem amigável de erros de duplicação
      if (insertError.message.includes('Já existe um funcionário')) {
        throw new Error(insertError.message);
      } else if (insertError.message.includes('duplicate key') || insertError.code === '23505') {
        throw new Error('Já existe um funcionário com este CPF ou email. Verifique os dados.');
      }
      
      throw new Error(`Erro ao criar funcionário: ${insertError.message}`);
    }

    // INSERT bem-sucedido — tentar buscar o registro criado
    // Pode falhar por RLS departamental (AdmSSO inserindo em outro departamento)
    const { data: newFuncionario } = await supabase
      .from("bd_funcionarios")
      .select()
      .eq('cpf', funcionarioData.cpf)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (newFuncionario) {
      return newFuncionario as unknown as Funcionario;
    }

    // Fallback: registro criado com sucesso mas não visível por RLS
    console.warn("⚠️ Funcionário criado com sucesso, mas sem permissão para visualizar (RLS departamental)");
    return {
      ...funcionarioData,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as unknown as Funcionario;
  } catch (error) {
    console.error("Error creating funcionario:", error);
    throw error;
  }
};

// Function to update funcionario
export const updateFuncionario = async (id: string, data: FuncionarioFormData): Promise<Funcionario> => {
  try {
    // Sanitize form data (convert empty strings to null)
    const sanitizedData = sanitizeFormData(data);
    
    // Check for email duplicates before updating (excluding the current record)
    if (sanitizedData.email) {
      const isDuplicateEmail = await checkEmailDuplicate(sanitizedData.email, id);
      if (isDuplicateEmail) {
        throw new Error(`Já existe um funcionário ativo com o email "${sanitizedData.email}". Verifique duplicidade.`);
      }
    }
    
    // Calculate data_ferias if data_admissao is provided and different from existing
    let funcionarioData = { ...sanitizedData };
    if (funcionarioData.data_admissao) {
      const admissionDate = new Date(funcionarioData.data_admissao);
      const feriasDays = 365; // 1 year for vacation
      const feriasDate = addDays(admissionDate, feriasDays);
      funcionarioData.data_ferias = feriasDate.toISOString().split("T")[0];
    }

    // Set status based on admission and dismissal dates
    if (!funcionarioData.status) {
      if (!funcionarioData.data_demissao) {
        funcionarioData.status = "Ativo";
      } else {
        const today = new Date();
        const dismissalDate = new Date(funcionarioData.data_demissao);
        funcionarioData.status = dismissalDate > today ? "Aviso Prévio" : "Inativo";
      }
    }

    // Log the data being sent to the database for debugging
    console.log("Updating funcionario with data:", funcionarioData);

    const { data: updatedFuncionario, error } = await supabase
      .from("bd_funcionarios")
      .update(funcionarioData as any)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Database error:", error);
      
      // Extrair mensagem amigável de erros de duplicação
      if (error.message.includes('Já existe um funcionário')) {
        throw new Error(error.message);
      } else if (error.message.includes('duplicate key') || error.code === '23505') {
        throw new Error('Já existe um funcionário com este CPF ou email. Verifique os dados.');
      }
      
      throw new Error(`Erro ao atualizar funcionário: ${error.message}`);
    }
    
    return updatedFuncionario as unknown as Funcionario;
  } catch (error) {
    console.error(`Error updating funcionario with id ${id}:`, error);
    throw error;
  }
};

// Function to check if a funcionario has references in other tables
export const checkFuncionarioReferences = async (id: string): Promise<{ hasReferences: boolean; referencedIn: string[] }> => {
  try {
    console.log("🔍 Verificando referências do funcionário:", id);
    
    const references: string[] = [];
    
    // Check references in bd_registro_apontamento_cam_equipa
    const { count: apontamentosCount, error: apontamentosError } = await supabase
      .from("bd_registro_apontamento_cam_equipa")
      .select("id", { count: "exact", head: true })
      .eq("operador_id", id);
    
    if (apontamentosError) {
      console.error("❌ Erro ao verificar apontamentos:", apontamentosError);
      throw apontamentosError;
    }
    if (apontamentosCount && apontamentosCount > 0) {
      references.push("Registros de Apontamento de Caminhões/Equipamentos");
      console.log("⚠️ Encontradas referências em apontamentos:", apontamentosCount);
    }
    
    // Check references in bd_equipes (for encarregado_id and apontador_id)
    const { count: equipesEncarregadoCount, error: equipesEncarregadoError } = await supabase
      .from("bd_equipes")
      .select("id", { count: "exact", head: true })
      .eq("encarregado_id", id);
    
    if (equipesEncarregadoError) {
      console.error("❌ Erro ao verificar equipes (encarregado):", equipesEncarregadoError);
      throw equipesEncarregadoError;
    }
    if (equipesEncarregadoCount && equipesEncarregadoCount > 0) {
      references.push("Equipes (como Encarregado)");
      console.log("⚠️ Encontradas referências em equipes como encarregado:", equipesEncarregadoCount);
    }
    
    const { count: equipesApontadorCount, error: equipesApontadorError } = await supabase
      .from("bd_equipes")
      .select("id", { count: "exact", head: true })
      .eq("apontador_id", id);
    
    if (equipesApontadorError) {
      console.error("❌ Erro ao verificar equipes (apontador):", equipesApontadorError);
      throw equipesApontadorError;
    }
    if (equipesApontadorCount && equipesApontadorCount > 0) {
      references.push("Equipes (como Apontador)");
      console.log("⚠️ Encontradas referências em equipes como apontador:", equipesApontadorCount);
    }
    
    // Check references in bd_avaliacao_equipe
    const { count: avaliacaoCount, error: avaliacaoError } = await (supabase as any)
      .from("bd_avaliacao_equipe")
      .select("id", { count: "exact", head: true })
      .eq("colaborador_id", id);
    
    if (avaliacaoError) {
      console.error("❌ Erro ao verificar avaliações:", avaliacaoError);
      throw avaliacaoError;
    }
    if (avaliacaoCount && avaliacaoCount > 0) {
      references.push("Avaliações de Equipe");
      console.log("⚠️ Encontradas referências em avaliações:", avaliacaoCount);
    }
    
    console.log("✅ Verificação de referências concluída:", { hasReferences: references.length > 0, referencedIn: references });
    
    return {
      hasReferences: references.length > 0,
      referencedIn: references
    };
  } catch (error) {
    console.error("❌ Erro ao verificar referências do funcionário:", error);
    throw new Error("Não foi possível verificar referências do funcionário");
  }
};

// Function to delete funcionario with SuperAdmin bypass
export const deleteFuncionarioWithBypass = async (id: string): Promise<void> => {
  try {
    console.log("🗑️ Tentando excluir funcionário com bypass SuperAdmin:", id);
    
    const { data, error } = await (supabase as any).rpc('delete_funcionario_with_admin_bypass', {
      funcionario_id: id
    });

    if (error) {
      console.error("❌ Erro ao excluir funcionário com bypass:", error);
      throw new Error(error.message);
    }
    
    if (data === false) {
      console.error("❌ Usuário não tem permissão para bypass");
      throw new Error("Usuário não tem permissão para forçar exclusão");
    }
    
    console.log("✅ Funcionário excluído com bypass SuperAdmin:", id);
  } catch (error) {
    console.error(`❌ Erro ao excluir funcionário com bypass ${id}:`, error);
    throw error;
  }
};

// Function to delete funcionario (standard)
export const deleteFuncionario = async (id: string): Promise<void> => {
  try {
    console.log("🗑️ Tentando excluir funcionário:", id);
    
    const { error } = await supabase
      .from("bd_funcionarios")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("❌ Erro ao excluir funcionário:", error);
      throw new Error(error.message);
    }
    
    console.log("✅ Funcionário excluído com sucesso:", id);
  } catch (error) {
    console.error(`❌ Erro ao excluir funcionário com id ${id}:`, error);
    throw error;
  }
};

// Function to debug user authentication
export const debugUserAuth = async (): Promise<any> => {
  try {
    const { data, error } = await (supabase as any).rpc('debug_user_authentication');
    
    if (error) {
      console.error("❌ Erro ao fazer debug de autenticação:", error);
      throw error;
    }
    
    console.log("🔐 Debug de autenticação:", data);
    return data;
  } catch (error) {
    console.error("❌ Erro no debug de autenticação:", error);
    throw error;
  }
};

// Function to process import data
export const processImportData = async (
  importData: any[]
): Promise<{ success: number; errors: any[] }> => {
  const results = {
    success: 0,
    errors: [] as any[],
  };

  try {
    console.log("Iniciando importação de funcionários, total:", importData.length);
    
    for (const item of importData) {
      try {
        // Transform imported data to match our model
        const funcionarioData: FuncionarioFormData = {
          nome_completo: item["Nome Completo"] || item.nome_completo || "",
          cpf: item.CPF || item.cpf || "",
          matricula: item['Matrícula'] || item.matricula || null,
          data_nascimento: formatExcelDate(item["Data de Nascimento"] || item.data_nascimento),
          email: item.Email || item.email || null,
          endereco_completo: item['Endereço Completo'] || item['Endereço'] || item.endereco_completo || null,
          escolaridade: item.Escolaridade || item.escolaridade || null,
          genero: item['Gênero'] || item.genero || null,
          
          // Buscar IDs com base nos nomes
          funcao_id: await getFuncaoIdByName(item['Função'] || item.funcao),
          departamento_id: await getDepartamentoIdByName(item.Departamento || item.departamento),
          centro_custo_id: await getCentroCustoIdByName(item["Centro de Custo"] || item.centro_custo),
          empresa_id: await getEmpresaIdByName(item.Empresa || item.empresa),
          equipe_id: await getEquipeIdByName(item.Equipe || item.equipe),
          
          data_admissao: formatExcelDate(item["Data de Admissão"] || item.data_admissao),
          data_ferias: formatExcelDate(item["Data de Férias"] || item.data_ferias),
          data_demissao: formatExcelDate(item["Data de Demissão"] || item.data_demissao),
          status: item.Status || item.status || "Ativo",
          
          // Dados financeiros
          salario_base: parseNumericField(item["Salário Base"] || item.salario_base),
          insalubridade: parseNumericField(item.Insalubridade || item.insalubridade),
          periculosidade: parseNumericField(item.Periculosidade || item.periculosidade),
          gratificacao: parseNumericField(item['Gratificação'] || item.gratificacao),
          adicional_noturno: parseNumericField(item['Adicional Noturno'] || item.adicional_noturno),
          custo_passagem: parseNumericField(item["Custo Passagem"] || item.custo_passagem),
          refeicao: parseNumericField(item['Refeição'] || item.refeicao),
          diarias: parseNumericField(item['Diárias'] || item.diarias),
          
          // Dados bancários
          banco: item.Banco || item.banco || null,
          agencia: item['Agência'] || item.agencia || null,
          conta_corrente: item['Conta Corrente'] || item.conta_corrente || null,
          chave_pix: item['Chave PIX'] || item.chave_pix || null,
          observacoes: item['Observações'] || item.observacoes || null,
        };

        console.log("Dados processados:", funcionarioData);

        // Sanitize the data before inserting
        const sanitizedData = sanitizeFormData(funcionarioData);

        // Calculate data_ferias if data_admissao is provided
        if (sanitizedData.data_admissao) {
          const admissionDate = new Date(sanitizedData.data_admissao);
          const feriasDays = 365; // 1 year for vacation
          const feriasDate = addDays(admissionDate, feriasDays);
          sanitizedData.data_ferias = feriasDate.toISOString().split('T')[0];
        }

        console.log("Processando funcionário:", sanitizedData.nome_completo);
        
        // Logging para debug
        console.log("Dados a inserir:", JSON.stringify(sanitizedData));

        // Verifica duplicado por email primeiro (preferência), depois CPF
        let existingFuncionario = null;
        let updateCriteria = {};
        
        if (sanitizedData.email) {
          const normalizedEmail = normalizeEmail(sanitizedData.email);
          const { data: emailCheck, error: emailError } = await supabase
            .from("bd_funcionarios")
            .select("id, email, cpf, nome_completo")
            .filter('email', 'ilike', normalizedEmail)
            .neq('status', 'Inativo')
            .maybeSingle();
            
          if (emailError) {
            throw new Error(`Erro ao verificar email: ${emailError.message}`);
          }
          
          if (emailCheck) {
            existingFuncionario = emailCheck;
            updateCriteria = { email: normalizedEmail };
            console.log(`Funcionário encontrado por email: ${emailCheck.nome_completo}`);
          }
        }
        
        // Se não encontrou por email e tem CPF, verifica por CPF
        if (!existingFuncionario && sanitizedData.cpf) {
          const { data: cpfCheck, error: cpfError } = await supabase
            .from("bd_funcionarios")
            .select("id, email, cpf, nome_completo")
            .eq("cpf", sanitizedData.cpf)
            .neq('status', 'Inativo')
            .maybeSingle();
            
          if (cpfError) {
            throw new Error(`Erro ao verificar CPF: ${cpfError.message}`);
          }
          
          if (cpfCheck) {
            existingFuncionario = cpfCheck;
            updateCriteria = { cpf: sanitizedData.cpf };
            console.log(`Funcionário encontrado por CPF: ${cpfCheck.nome_completo}`);
          }
        }
        
        if (existingFuncionario) {
          // Atualiza funcionário existente
          const { data: updatedData, error: updateError } = await supabase
            .from("bd_funcionarios")
            .update(sanitizedData as any)
            .eq("id", existingFuncionario.id)
            .select();
            
          if (updateError) {
            console.error("Erro ao atualizar funcionário:", updateError);
            // Se foi erro de email duplicado, tenta sem o email
            if (updateError.message.includes("email")) {
              const dataWithoutEmail = { ...sanitizedData };
              delete dataWithoutEmail.email;
              
              const { data: retryData, error: retryError } = await supabase
                .from("bd_funcionarios")
                .update(dataWithoutEmail as any)
                .eq("id", existingFuncionario.id)
                .select();
                
              if (retryError) {
                throw new Error(`Erro ao atualizar funcionário (retry): ${retryError.message}`);
              }
              console.log("Funcionário atualizado sem email (conflito resolvido):", retryData);
            } else {
              throw new Error(`Erro ao atualizar funcionário: ${updateError.message}`);
            }
          } else {
            console.log("Funcionário atualizado com sucesso:", updatedData);
          }
          
          results.success++;
        } else {
          // Create the funcionario
          const { data, error } = await supabase
            .from("bd_funcionarios")
            .insert(sanitizedData as any)
            .select();

          if (error) {
            console.error("Erro na inserção:", error);
            // Se foi erro de email duplicado, tenta sem o email
            if (error.message.includes("email")) {
              const dataWithoutEmail = { ...sanitizedData };
              delete dataWithoutEmail.email;
              
              const { data: retryData, error: retryError } = await supabase
                .from("bd_funcionarios")
                .insert(dataWithoutEmail as any)
                .select();
                
              if (retryError) {
                throw new Error(`Erro ao inserir funcionário (retry): ${retryError.message}`);
              }
              console.log("Funcionário inserido sem email (conflito resolvido):", retryData);
            } else {
              throw new Error(`Erro ao inserir funcionário: ${error.message}`);
            }
          } else {
            console.log("Funcionário inserido com sucesso:", data);
          }

          results.success++;
        }
      } catch (error: any) {
        console.error("Erro ao processar item:", item, error);
        results.errors.push({
          item,
          error: error.message || "Erro desconhecido",
        });
      }
    }

    return results;
  } catch (error) {
    console.error("Erro ao processar dados da importação:", error);
    throw error;
  }
};

// Helper functions for import process
async function getFuncaoIdByName(funcaoName: string | undefined | null): Promise<string | undefined> {
  if (!funcaoName) return undefined;
  
  console.log("Buscando função:", funcaoName);
  
  const { data } = await supabase
    .from('bd_funcoes')
    .select('id')
    .ilike('nome_funcao', funcaoName)
    .limit(1);
    
  console.log("Resultado da busca de função:", data);
  return data && data.length > 0 ? data[0].id : undefined;
}

async function getDepartamentoIdByName(departamentoName: string | undefined | null): Promise<string | undefined> {
  if (!departamentoName) return undefined;
  
  console.log("Buscando departamento:", departamentoName);
  
  const { data } = await supabase
    .from('bd_departamentos')
    .select('id')
    .ilike('nome_departamento', departamentoName)
    .limit(1);
    
  console.log("Resultado da busca de departamento:", data);
  return data && data.length > 0 ? data[0].id : undefined;
}

async function getCentroCustoIdByName(centroCustoName: string | undefined | null): Promise<string | undefined> {
  if (!centroCustoName) return undefined;
  
  console.log("Buscando centro de custo:", centroCustoName);
  
  // First try to match by exact name
  let { data } = await supabase
    .from('bd_centros_custo')
    .select('id')
    .ilike('nome_centro_custo', centroCustoName)
    .limit(1);
  
  if (!data || data.length === 0) {
    // If no exact match, try to match with the code+name format
    // (e.g., "L473 - PAVIBRAS CONSORCIO RIO METROPOLE")
    const parts = centroCustoName.split(' - ');
    if (parts.length > 1) {
      // Try to match by code
      const codeSearch = await supabase
        .from('bd_centros_custo')
        .select('id')
        .ilike('codigo_centro_custo', parts[0])
        .limit(1);
      
      if (codeSearch.data && codeSearch.data.length > 0) {
        data = codeSearch.data;
      } else {
        // Try to match by name part
        const nameSearch = await supabase
          .from('bd_centros_custo')
          .select('id')
          .ilike('nome_centro_custo', `%${parts[1]}%`)
          .limit(1);
        
        if (nameSearch.data && nameSearch.data.length > 0) {
          data = nameSearch.data;
        }
      }
    }
  }
    
  console.log("Resultado da busca de centro de custo:", data);
  return data && data.length > 0 ? data[0].id : undefined;
}

async function getEmpresaIdByName(empresaName: string | undefined | null): Promise<string | undefined> {
  if (!empresaName) return undefined;
  
  console.log("Buscando empresa:", empresaName);
  
  const { data } = await supabase
    .from('bd_empresas')
    .select('id')
    .ilike('nome_empresa', empresaName)
    .limit(1);
    
  console.log("Resultado da busca de empresa:", data);
  return data && data.length > 0 ? data[0].id : undefined;
}

async function getEquipeIdByName(equipeName: string | undefined | null): Promise<string | undefined> {
  if (!equipeName) return undefined;
  
  console.log("Buscando equipe:", equipeName);
  
  const { data } = await supabase
    .from('bd_equipes')
    .select('id')
    .ilike('nome_equipe', equipeName)
    .limit(1);
    
  console.log("Resultado da busca de equipe:", data);
  return data && data.length > 0 ? data[0].id : undefined;
}

function parseNumericField(value: any): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  
  // Se for string, tenta converter para número
  if (typeof value === 'string') {
    // Remove R$ e qualquer caracter não numérico, exceto pontos e vírgulas
    const cleanedValue = value.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
    return cleanedValue ? parseFloat(cleanedValue) : undefined;
  }
  
  // Se já for número, retorna direto
  if (typeof value === 'number') {
    return value;
  }
  
  return undefined;
}

// Function to properly format Excel dates
function formatExcelDate(value: any): string | null {
  if (!value) return null;
  
  // If it's a number, treat it as an Excel date
  if (typeof value === 'number') {
    console.log("Convertendo data do Excel:", value);
    try {
      // Excel uses a date system based on January 1, 1900
      // Excel has a leap year bug where it thinks 1900 was a leap year
      // For dates after February 28, 1900, we need to subtract 1 day
      
      // Create a Date object from the Excel serial number
      // Excel date 1 = January 1, 1900
      const excelEpoch = new Date(Date.UTC(1900, 0, 1));
      let days = value - 1; // Subtract 1 because Excel day 1 is January 1, 1900
      
      // If date is after the fictional February 29, 1900, subtract a day
      if (value > 60) {
        days -= 1;
      }
      
      // Add the days to the epoch
      const milliseconds = days * 24 * 60 * 60 * 1000;
      const date = new Date(excelEpoch.getTime() + milliseconds);
      
      // Format as YYYY-MM-DD
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      const formattedDate = `${year}-${month}-${day}`;
      
      console.log("Data convertida:", formattedDate);
      return formattedDate;
    } catch (e) {
      console.error("Erro ao converter data do Excel:", e);
      return null;
    }
  }
  
  // If it's a string in the format DD/MM/YYYY
  if (typeof value === 'string' && value.includes('/')) {
    try {
      const parts = value.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        
        const date = new Date(year, month, day);
        const formattedDate = date.toISOString().split('T')[0];
        console.log("Data convertida de string:", formattedDate);
        return formattedDate;
      }
    } catch (e) {
      console.error("Erro ao converter data de string:", e);
    }
  }
  
  // If it's already in ISO format or another valid format
  if (typeof value === 'string') {
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch (e) {
      console.error("Erro ao validar formato de data:", e);
    }
  }
  
  // Return original value if it's already a string
  return typeof value === 'string' ? value : null;
}
