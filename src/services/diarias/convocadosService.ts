import { supabase } from "@/integrations/supabase/client";
import type { 
  DiariaConvocado, 
  ConvocadoFormData,
  StatusPresenca 
} from "@/types/diarias";

// =====================================================
// CRUD - CONVOCADOS (Funcionários na Diária)
// =====================================================

export async function getConvocadosByConvocacao(convocacaoId: string): Promise<DiariaConvocado[]> {
  const { data, error } = await supabase
    .from('bd_diaria_convocados')
    .select(`
      *,
      bd_funcionarios (
        id,
        nome_completo,
        cpf,
        imagem
      ),
      bd_funcoes (
        id,
        nome_funcao,
        valor_diaria,
        valor_diaria_exclusiva
      )
    `)
    .eq('convocacao_id', convocacaoId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Erro ao buscar convocados:', error);
    throw new Error(error.message);
  }

  return (data || []) as DiariaConvocado[];
}

export async function getConvocadoById(id: string): Promise<DiariaConvocado | null> {
  const { data, error } = await supabase
    .from('bd_diaria_convocados')
    .select(`
      *,
      bd_funcionarios (
        id,
        nome_completo,
        cpf,
        imagem
      ),
      bd_funcoes (
        id,
        nome_funcao,
        valor_diaria,
        valor_diaria_exclusiva
      ),
      bd_diaria_convocacoes (
        id,
        data,
        status,
        criado_por,
        bd_centros_custo (
          id,
          nome_centro_custo
        )
      )
    `)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Erro ao buscar convocado:', error);
    throw new Error(error.message);
  }

  return data as DiariaConvocado;
}

/**
 * Adiciona um funcionário à convocação com snapshot do valor da diária.
 * O valor é buscado automaticamente da função do funcionário.
 */
export async function addConvocado(
  convocacaoId: string, 
  funcionarioId: string,
  usarDiariaExclusiva: boolean = true // Por padrão usa valor de fim de semana/feriado
): Promise<DiariaConvocado> {
  // 1. Buscar dados do funcionário e sua função
  const { data: funcionario, error: funcError } = await supabase
    .from('bd_funcionarios')
    .select(`
      id,
      nome_completo,
      funcao_id,
      bd_funcoes (
        id,
        nome_funcao,
        valor_diaria,
        valor_diaria_exclusiva
      )
    `)
    .eq('id', funcionarioId)
    .single();

  if (funcError || !funcionario) {
    throw new Error('Funcionário não encontrado.');
  }

  if (!funcionario.funcao_id || !funcionario.bd_funcoes) {
    throw new Error(`Funcionário "${funcionario.nome_completo}" não possui função definida.`);
  }

  // 2. Determinar valor da diária (usa exclusiva para fins de semana/feriados)
  const valorDiaria = usarDiariaExclusiva 
    ? (funcionario.bd_funcoes.valor_diaria_exclusiva || funcionario.bd_funcoes.valor_diaria || 0)
    : (funcionario.bd_funcoes.valor_diaria || 0);

  if (valorDiaria === 0) {
    throw new Error(`Função "${funcionario.bd_funcoes.nome_funcao}" não possui valor de diária definido.`);
  }

  // 3. Verificar duplicidade
  const { data: existente } = await supabase
    .from('bd_diaria_convocados')
    .select('id')
    .eq('convocacao_id', convocacaoId)
    .eq('funcionario_id', funcionarioId)
    .single();

  if (existente) {
    throw new Error(`Funcionário "${funcionario.nome_completo}" já está na convocação.`);
  }

  // 4. Inserir convocado com snapshot do valor
  const { data, error } = await supabase
    .from('bd_diaria_convocados')
    .insert({
      convocacao_id: convocacaoId,
      funcionario_id: funcionarioId,
      funcao_id: funcionario.funcao_id,
      valor_diaria_aplicada: valorDiaria,
      presenca_status: 'pendente'
    })
    .select(`
      *,
      bd_funcionarios (
        id,
        nome_completo,
        cpf,
        imagem
      ),
      bd_funcoes (
        id,
        nome_funcao,
        valor_diaria,
        valor_diaria_exclusiva
      )
    `)
    .single();

  if (error) {
    console.error('Erro ao adicionar convocado:', error);
    throw new Error(error.message);
  }

  return data as DiariaConvocado;
}

export async function removeConvocado(id: string): Promise<void> {
  const { error } = await supabase
    .from('bd_diaria_convocados')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Erro ao remover convocado:', error);
    throw new Error(error.message);
  }
}

export async function updateConvocadoHorarios(
  id: string, 
  horarios: {
    hora_entrada?: string;
    hora_saida?: string;
    intervalo_inicio?: string;
    intervalo_fim?: string;
  }
): Promise<DiariaConvocado> {
  const { data, error } = await supabase
    .from('bd_diaria_convocados')
    .update({
      ...horarios,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select(`
      *,
      bd_funcionarios (
        id,
        nome_completo
      ),
      bd_funcoes (
        id,
        nome_funcao
      )
    `)
    .single();

  if (error) {
    console.error('Erro ao atualizar horários:', error);
    throw new Error(error.message);
  }

  return data as DiariaConvocado;
}

// =====================================================
// PRESENÇA
// =====================================================

export async function confirmarPresenca(
  id: string,
  status: StatusPresenca,
  horarios?: {
    hora_entrada?: string;
    hora_saida?: string;
    intervalo_inicio?: string;
    intervalo_fim?: string;
  }
): Promise<DiariaConvocado> {
  const { data: userData } = await supabase.auth.getUser();

  const updateData: any = {
    presenca_status: status,
    confirmado_por: userData?.user?.id,
    confirmado_em: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (horarios) {
    Object.assign(updateData, horarios);
  }

  // Se marcando como presente e não tem hora de entrada, usar hora atual
  if (status === 'presente' && !horarios?.hora_entrada) {
    const now = new Date();
    updateData.hora_entrada = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }

  const { data, error } = await supabase
    .from('bd_diaria_convocados')
    .update(updateData)
    .eq('id', id)
    .select(`
      *,
      bd_funcionarios (
        id,
        nome_completo
      ),
      bd_funcoes (
        id,
        nome_funcao
      )
    `)
    .single();

  if (error) {
    console.error('Erro ao confirmar presença:', error);
    throw new Error(error.message);
  }

  return data as DiariaConvocado;
}

// =====================================================
// CONSULTAS PARA PRESENÇA EM CAMPO
// =====================================================

export async function getConvocadosParaPresenca(
  data?: string,
  centroCustoId?: string,
  convocacaoId?: string
): Promise<DiariaConvocado[]> {
  let query = supabase
    .from('bd_diaria_convocados')
    .select(`
      *,
      bd_funcionarios (
        id,
        nome_completo,
        cpf,
        imagem
      ),
      bd_funcoes (
        id,
        nome_funcao
      ),
      bd_diaria_convocacoes!inner (
        id,
        data,
        status,
        criado_por,
        centro_custo_id,
        bd_centros_custo (
          id,
          nome_centro_custo
        )
      )
    `)
    // Apenas convocações aprovadas ou em execução permitem confirmar presença
    .in('bd_diaria_convocacoes.status', ['aprovada', 'executando']);

  if (data) {
    query = query.eq('bd_diaria_convocacoes.data', data);
  }
  if (centroCustoId) {
    query = query.eq('bd_diaria_convocacoes.centro_custo_id', centroCustoId);
  }
  if (convocacaoId) {
    query = query.eq('convocacao_id', convocacaoId);
  }

  const { data: convocados, error } = await query.order('created_at', { ascending: true });

  if (error) {
    console.error('Erro ao buscar convocados para presença:', error);
    throw new Error(error.message);
  }

  return (convocados || []) as DiariaConvocado[];
}

// =====================================================
// ESTATÍSTICAS
// =====================================================

export async function getConvocadosStats(convocacaoId: string): Promise<{
  total: number;
  presentes: number;
  ausentes: number;
  pendentes: number;
  valorTotal: number;
  valorPresentes: number;
}> {
  const convocados = await getConvocadosByConvocacao(convocacaoId);
  
  const presentes = convocados.filter(c => c.presenca_status === 'presente');
  const ausentes = convocados.filter(c => c.presenca_status === 'ausente');
  const pendentes = convocados.filter(c => c.presenca_status === 'pendente');

  return {
    total: convocados.length,
    presentes: presentes.length,
    ausentes: ausentes.length,
    pendentes: pendentes.length,
    valorTotal: convocados.reduce((acc, c) => acc + c.valor_diaria_aplicada, 0),
    valorPresentes: presentes.reduce((acc, c) => acc + c.valor_diaria_aplicada, 0)
  };
}
