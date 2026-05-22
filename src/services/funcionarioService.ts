
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

// Function to fetch funcionarios via RPC fn_rh_funcionarios_listar
// - SECURITY DEFINER no banco: bypassa RLS pesada e aplica escopo internamente
// - Retorno mínimo (sem campos financeiros/bancários/endereço/email/data_nascimento)
// - CPF mascarado para todos os perfis
// - Embeds já vêm no payload (sem N+1)
export const fetchFuncionarios = async (filters: FuncionarioFilter = {}): Promise<Funcionario[]> => {
  try {
    const cpfDigits = filters.cpf ? filters.cpf.replace(/\D/g, '') : null;

    const { data, error } = await (supabase as any).rpc('fn_rh_funcionarios_listar', {
      p_search: filters.nome_completo?.trim() || null,
      p_cpf: cpfDigits || null,
      p_matricula: filters.matricula?.trim() || null,
      p_status: filters.status || null,
      p_funcao_id: filters.funcao_id && filters.funcao_id !== 'sem_funcao' ? filters.funcao_id : null,
      p_departamento_id: filters.departamento_id && filters.departamento_id !== 'sem_valor' ? filters.departamento_id : null,
      p_centro_custo_id: filters.centro_custo_id && filters.centro_custo_id !== 'sem_valor' ? filters.centro_custo_id : null,
      p_empresa_id: filters.empresa_id && filters.empresa_id !== 'sem_valor' ? filters.empresa_id : null,
      p_equipe_id: filters.equipe_id && filters.equipe_id !== 'sem_valor' ? filters.equipe_id : null,
      p_data_admissao_inicio: filters.data_admissao_inicio || null,
      p_data_admissao_fim: filters.data_admissao_fim || null,
      p_page: 1,
      p_page_size: 2000,
    });

    if (error) {
      console.error('❌ Erro na RPC fn_rh_funcionarios_listar:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      throw new Error(
        `Erro ao carregar funcionários: ${error.message}. Código: ${error.code || 'N/A'}. Detalhes: ${error.details || error.hint || 'N/A'}`,
      );
    }

    // RPC retorna 1 linha { rows: jsonb[], total_count: bigint }
    const row = Array.isArray(data) ? data[0] : data;
    const rows = (row?.rows as unknown[]) || [];
    return rows as unknown as Funcionario[];
  } catch (error: any) {
    console.error('❌ Erro ao carregar funcionários:', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
    });
    throw error instanceof Error ? error : new Error(String(error));
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

// Function to create new funcionario — uses RPC create_funcionario exclusively
// (allowlist + permission check + duplicate check server-side)
export const createFuncionario = async (data: FuncionarioFormData): Promise<Funcionario> => {
  try {
    // Validate CPF before proceeding
    if (!data.cpf || data.cpf.trim() === '') {
      throw new Error('CPF é obrigatório. Preencha o campo CPF antes de salvar.');
    }

    // Sanitize form data (uppercase nome, trim CPF, normalize email, '' -> null)
    const sanitizedData = sanitizeFormData(data);

    console.log('🚀 USING RPC create_funcionario');

    const { data: newFuncionario, error } = await supabase.rpc('create_funcionario', {
      p_dados: sanitizedData as any,
    });

    if (error) {
      console.error('RPC create_funcionario error:', error);
      const msg = error.message || '';
      if (msg.includes('Já existe um funcionário') || msg.toLowerCase().includes('duplicate') || (error as any).code === '23505') {
        throw new Error('Já existe um funcionário com este CPF ou email. Verifique os dados.');
      }
      if (msg.toLowerCase().includes('permiss')) {
        throw new Error('Permissão negada para criar funcionário.');
      }
      throw new Error(`Erro ao criar funcionário: ${msg}`);
    }

    return newFuncionario as unknown as Funcionario;
  } catch (error) {
    console.error('Error creating funcionario:', error);
    throw error;
  }
};

// Function to update funcionario — Phase 1-FE: payload diff to avoid trigger storms
const EDITABLE_COLUMNS = [
  'nome_completo','cpf','data_nascimento','email','endereco_completo','escolaridade','genero',
  'funcao_id','departamento_id','centro_custo_id','empresa_id','equipe_id',
  'data_admissao','data_ferias','data_demissao','status','tipo_escala',
  'salario_base','insalubridade','periculosidade','gratificacao','adicional_noturno',
  'custo_passagem','refeicao','diarias','observacoes',
  'banco','agencia','conta_corrente','chave_pix','imagem','matricula',
] as const;

const NUMERIC_COLUMNS = new Set([
  'salario_base','insalubridade','periculosidade','gratificacao','adicional_noturno',
  'custo_passagem','refeicao','diarias',
]);

const normalizeForDiff = (value: any, key: string): any => {
  if (value === undefined || value === null || value === '') return null;
  if (NUMERIC_COLUMNS.has(key)) {
    const n = Number(value);
    return isNaN(n) ? 0 : n;
  }
  return value;
};

export const updateFuncionario = async (id: string, data: FuncionarioFormData): Promise<Funcionario> => {
  try {
    // 1) Sanitize incoming form data (uppercase nome, trim CPF, normalize email, '' -> null)
    const sanitizedData = sanitizeFormData(data);

    // 2) Fetch current row (lean SELECT) to compute diff and decide recalculations
    const { data: current, error: fetchErr } = await supabase
      .from("bd_funcionarios")
      .select(EDITABLE_COLUMNS.join(','))
      .eq("id", id)
      .single();

    if (fetchErr || !current) {
      throw new Error(`Erro ao carregar funcionário atual: ${fetchErr?.message || 'registro não encontrado'}`);
    }

    const currentRow = current as unknown as Record<string, any>;

    // 3) Recalculate data_ferias ONLY if data_admissao actually changed
    const newAdmissao = sanitizedData.data_admissao ?? null;
    const oldAdmissao = currentRow.data_admissao ?? null;
    if (newAdmissao && newAdmissao !== oldAdmissao) {
      const admissionDate = new Date(newAdmissao);
      const feriasDate = addDays(admissionDate, 365);
      sanitizedData.data_ferias = feriasDate.toISOString().split("T")[0];
    } else {
      // Don't push data_ferias unless admissao changed
      delete (sanitizedData as any).data_ferias;
    }

    // 4) Recalculate status ONLY when status missing AND data_demissao changed; otherwise preserve current
    if (!sanitizedData.status) {
      const newDemissao = sanitizedData.data_demissao ?? null;
      const oldDemissao = currentRow.data_demissao ?? null;
      if (newDemissao !== oldDemissao) {
        if (!newDemissao) {
          sanitizedData.status = "Ativo";
        } else {
          const today = new Date();
          const dismissalDate = new Date(newDemissao);
          sanitizedData.status = dismissalDate > today ? "Aviso Prévio" : "Inativo";
        }
      } else {
        // Status not provided and demissao not changed → don't touch it
        delete (sanitizedData as any).status;
      }
    }

    // 5) Build diff: only fields that actually changed
    const diff: Record<string, any> = {};
    for (const key of EDITABLE_COLUMNS) {
      if (!(key in sanitizedData)) continue;
      const newVal = normalizeForDiff((sanitizedData as any)[key], key);
      const oldVal = normalizeForDiff(currentRow[key], key);
      if (newVal !== oldVal) {
        diff[key] = (sanitizedData as any)[key];
      }
    }

    // 6) No changes → skip UPDATE entirely (avoid trigger cascade)
    if (Object.keys(diff).length === 0) {
      const noChange = { ...currentRow, id, __noChange: true } as any;
      return noChange as Funcionario;
    }

    // 7) Email duplicate check ONLY if email changed
    if ('email' in diff && diff.email) {
      const isDuplicateEmail = await checkEmailDuplicate(diff.email, id);
      if (isDuplicateEmail) {
        throw new Error(`Já existe um funcionário ativo com o email "${diff.email}". Verifique duplicidade.`);
      }
    }

    console.log("Updating funcionario (diff only):", Object.keys(diff));

    const { data: updatedFuncionario, error } = await supabase
      .from("bd_funcionarios")
      .update(diff as any)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Database error:", error);
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

// Inativa o funcionário (soft delete). Preserva histórico, vínculos e auditoria.
// Substitui o antigo fluxo de DELETE físico — nesta rodada não há exclusão definitiva,
// nem para SuperAdm.
export const inativarFuncionario = async (id: string): Promise<void> => {
  try {
    console.log("⏸️ Inativando funcionário:", id);

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // Lê data_demissao atual para preservar se já houver
    const { data: existing, error: readError } = await supabase
      .from("bd_funcionarios")
      .select("data_demissao")
      .eq("id", id)
      .maybeSingle();

    if (readError) {
      console.error("❌ Erro ao ler funcionário antes de inativar:", readError);
      throw new Error(readError.message);
    }

    const dataDemissao = existing?.data_demissao || today;

    const { error } = await supabase
      .from("bd_funcionarios")
      .update({ status: "Inativo", data_demissao: dataDemissao })
      .eq("id", id);

    if (error) {
      console.error("❌ Erro ao inativar funcionário:", error);
      throw new Error(error.message);
    }

    console.log("✅ Funcionário inativado com sucesso:", id);
  } catch (error) {
    console.error(`❌ Erro ao inativar funcionário com id ${id}:`, error);
    throw error;
  }
};

// Debug user authentication. A RPC `debug_user_authentication` não existe no banco,
// então retornamos as informações disponíveis via supabase.auth (sessão + user).
// Mantido para compatibilidade com painéis de debug existentes.
export const debugUserAuth = async (): Promise<any> => {
  try {
    const [{ data: userData }, { data: sessionData }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.auth.getSession(),
    ]);

    const info = {
      authenticated: !!userData?.user,
      user_id: userData?.user?.id ?? null,
      email: userData?.user?.email ?? null,
      role: userData?.user?.role ?? null,
      session_expires_at: sessionData?.session?.expires_at ?? null,
    };

    console.log("🔐 Debug de autenticação:", info);
    return info;
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
          tipo_escala: (item['Tipo de Escala'] || item.tipo_escala || 'normal') === '12x36' ? '12x36' : 'normal',
          
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
          // Create the funcionario via RPC (allowlist + permission + duplicate check)
          console.log('🚀 USING RPC create_funcionario (import)');
          const { error } = await supabase.rpc('create_funcionario', {
            p_dados: sanitizedData as any,
          });

          if (error) {
            console.error("Erro na inserção (RPC):", error);
            // Se foi erro de email duplicado, tenta sem o email — também via RPC
            if (error.message?.includes("email")) {
              const dataWithoutEmail = { ...sanitizedData };
              delete dataWithoutEmail.email;

              const { error: retryError } = await supabase.rpc('create_funcionario', {
                p_dados: dataWithoutEmail as any,
              });

              if (retryError) {
                throw new Error(`Erro ao inserir funcionário (retry RPC): ${retryError.message}`);
              }
              console.log("Funcionário inserido sem email (conflito resolvido) via RPC");
            } else {
              throw new Error(`Erro ao inserir funcionário: ${error.message}`);
            }
          } else {
            console.log("Funcionário inserido com sucesso via RPC");
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
