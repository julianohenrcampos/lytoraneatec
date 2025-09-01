import { supabase } from "@/integrations/supabase/client";

export interface Caminhao {
  id: string;
  placa?: string;
  modelo?: string;
  situacao?: string;
  tipo_veiculo?: string;
  frota?: string;
  numero_frota?: string;
}

export interface ApontamentoCaminhao {
  id: string;
  data: string;
  operador_id: string | null;
  caminhao_equipamento_id: string | null;
  centro_custo_id: string | null;
  horimetro_inicial: number | null;
  hora_inicial: string | null;
  horimetro_final: number | null;
  hora_final: string | null;
  abastecimento: number | null;
  situacao: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
  
  // Join fields
  nome_operador?: string;
  veiculo_identificacao?: string;
  nome_centro_custo?: string;
}

export interface ApontamentoInspecao {
  id: string;
  apontamento_caminhao_equipamento_id: string;
  nivel_oleo: string | null;
  nivel_agua: string | null;
  nivel_combustivel: string | null;
  drenagem_tanque_ar: string | null;
  material_rodante: string | null;
  cinto_seguranca: string | null;
  material_desgaste: string | null;
  estado_implementos: string | null;
  tacografo: string | null;
  limpeza_interna: string | null;
  sistema_eletrico: string | null;
  documentacao: string | null;
  engate_reboque: string | null;
  estado_equipamentos: string | null;
  inspecao_veicular: string | null;
  material_amarracao: string | null;
  anotacoes: string | null;
  fotos_avarias: string[] | null;
  created_at?: string;
  updated_at?: string;
}

export interface ApontamentoFilterParams {
  data_inicio?: string;
  data_fim?: string;
  caminhao_equipamento_id?: string;
  operador_id?: string;
  centro_custo_id?: string;
}

export const fetchApontamentos = async (
  filters: ApontamentoFilterParams = {}
): Promise<ApontamentoCaminhao[]> => {
  try {
    let query = supabase
      .from('bd_registro_apontamento_cam_equipa')
      .select(`
        *,
        operador:operador_id(id, nome_completo),
        veiculo:caminhao_equipamento_id(id, placa, modelo, frota, tipo_veiculo, numero_frota),
        centro_custo:centro_custo_id(id, nome_centro_custo, codigo_centro_custo)
      `)
      .order('data', { ascending: false })
      .order('created_at', { ascending: false });

    if (filters.data_inicio && filters.data_fim) {
      query = query.gte('data', filters.data_inicio).lte('data', filters.data_fim);
    } else if (filters.data_inicio) {
      query = query.gte('data', filters.data_inicio);
    } else if (filters.data_fim) {
      query = query.lte('data', filters.data_fim);
    }

    if (filters.caminhao_equipamento_id) {
      query = query.eq('caminhao_equipamento_id', filters.caminhao_equipamento_id);
    }

    if (filters.operador_id) {
      query = query.eq('operador_id', filters.operador_id);
    }

    if (filters.centro_custo_id) {
      query = query.eq('centro_custo_id', filters.centro_custo_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao buscar apontamentos:', error);
      throw error;
    }

    return data.map(item => {
      const apontamento: ApontamentoCaminhao = {
        ...item,
        nome_operador: item.operador?.nome_completo || 'Não informado',
        veiculo_identificacao: formatarIdentificacaoVeiculo(item),
        nome_centro_custo: item.centro_custo?.codigo_centro_custo || 'Não informado',
      };
      return apontamento;
    });
  } catch (error) {
    console.error('Erro ao buscar apontamentos:', error);
    throw new Error('Falha ao buscar dados de apontamentos');
  }
};

const formatarIdentificacaoVeiculo = (item: any): string => {
  if (!item.veiculo) return 'Não informado';
  
  const frota = item.veiculo.frota || '';
  const numeroFrota = item.veiculo.numero_frota || '';
  const placa = item.veiculo.placa || '';
  const modelo = item.veiculo.modelo || '';
  const tipo = item.veiculo.tipo_veiculo || '';
  
  if (frota && placa) {
    return `${frota}${numeroFrota} - ${placa} ${modelo ? `(${modelo})` : ''}`;
  } else if (tipo && modelo) {
    return `${tipo} - ${modelo}`;
  } else {
    return placa || modelo || tipo || 'Veículo sem identificação';
  }
};

export const fetchApontamentoById = async (id: string): Promise<{apontamento: ApontamentoCaminhao, inspecao: ApontamentoInspecao | null}> => {
  try {
    const { data: apontamento, error: apontamentoError } = await supabase
      .from('bd_registro_apontamento_cam_equipa')
      .select(`
        *,
        operador:operador_id(id, nome_completo),
        veiculo:caminhao_equipamento_id(id, placa, modelo, frota, tipo_veiculo, situacao),
        centro_custo:centro_custo_id(id, nome_centro_custo, codigo_centro_custo)
      `)
      .eq('id', id)
      .single();

    if (apontamentoError) {
      console.error('Erro ao buscar apontamento:', apontamentoError);
      throw apontamentoError;
    }

    const { data: inspecao, error: inspecaoError } = await supabase
      .from('bd_registro_apontamento_inspecao')
      .select('*')
      .eq('apontamento_caminhao_equipamento_id', id)
      .maybeSingle();

    if (inspecaoError) {
      console.error('Erro ao buscar inspeção:', inspecaoError);
      throw inspecaoError;
    }

    const formattedApontamento: ApontamentoCaminhao = {
      ...apontamento,
      nome_operador: apontamento.operador?.nome_completo || 'Não informado',
      veiculo_identificacao: formatarIdentificacaoVeiculo(apontamento),
      nome_centro_custo: apontamento.centro_custo?.codigo_centro_custo || 'Não informado',
    };

    return {
      apontamento: formattedApontamento,
      inspecao: inspecao as unknown as ApontamentoInspecao
    };
  } catch (error) {
    console.error('Erro ao buscar detalhes do apontamento:', error);
    throw new Error('Falha ao buscar detalhes do apontamento');
  }
};

async function checkUserInFuncionarios(userId: string | null): Promise<boolean> {
  if (!userId) return false;
  
  try {
    const { data, error } = await supabase
      .from('bd_funcionarios')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
      
    if (error) throw error;
    return !!data;
  } catch (error) {
    console.error('Error checking if user exists in funcionarios:', error);
    return false;
  }
}

export const createApontamento = async (
  apontamento: Omit<ApontamentoCaminhao, 'id'>, 
  inspecao?: Omit<ApontamentoInspecao, 'id' | 'apontamento_caminhao_equipamento_id'>,
  userEmail?: string | null
): Promise<string> => {
  try {
    console.log("=== INÍCIO CRIAÇÃO APONTAMENTO ===");
    console.log("Dados recebidos:", apontamento);
    console.log("Email do usuário:", userEmail);
    
    if (!apontamento.caminhao_equipamento_id) {
      throw new Error('Caminhão/Equipamento é obrigatório');
    }
    
    const operadorId = apontamento.operador_id;
    if (!operadorId) {
      throw new Error('ID do operador é obrigatório');
    }
    
    console.log("Validando operador informado...");
    // Nova validação simples: operador precisa existir em bd_funcionarios
    const { data: operadorExiste, error: operadorCheckError } = await supabase
      .from('bd_funcionarios')
      .select('id')
      .eq('id', operadorId)
      .maybeSingle();

    if (operadorCheckError) {
      console.error("Erro ao validar operador:", operadorCheckError);
      throw new Error('Erro ao validar o operador. Tente novamente.');
    }

    if (!operadorExiste) {
      console.warn("Operador não encontrado em bd_funcionarios:", operadorId);
      throw new Error('Operador selecionado não está cadastrado como funcionário. Selecione um operador válido ou vincule seu usuário a um funcionário.');
    }
    
    console.log("Inserindo apontamento na base de dados...");
    const { data, error: apontamentoError } = await supabase
      .from('bd_registro_apontamento_cam_equipa')
      .insert({
        data: apontamento.data,
        operador_id: operadorId,
        caminhao_equipamento_id: apontamento.caminhao_equipamento_id,
        centro_custo_id: apontamento.centro_custo_id,
        horimetro_inicial: apontamento.horimetro_inicial,
        hora_inicial: apontamento.hora_inicial,
        horimetro_final: apontamento.horimetro_final,
        hora_final: apontamento.hora_final,
        abastecimento: apontamento.abastecimento,
        situacao: apontamento.situacao
      })
      .select('id')
      .single();

    if (apontamentoError) {
      console.error('Erro ao criar apontamento:', apontamentoError);
      
      if (apontamentoError.code === '23503') {
        if (apontamentoError.details?.includes('operador_id')) {
          throw new Error('Operador não encontrado no sistema. Verifique se o operador selecionado é um funcionário válido.');
        } else if (apontamentoError.details?.includes('caminhao_equipamento_id')) {
          throw new Error('Veículo selecionado não encontrado no sistema');
        } else if (apontamentoError.details?.includes('centro_custo_id')) {
          throw new Error('Centro de custo selecionado não encontrado no sistema');
        }
        throw new Error('Erro de referência: Verifique se todos os dados selecionados existem no sistema');
      } else if (apontamentoError.code === '23505') {
        throw new Error('Já existe um apontamento para este veículo na data selecionada');
      } else {
        throw new Error(`Erro ao salvar apontamento: ${apontamentoError.message}`);
      }
    }

    const apontamentoId = data.id;
    console.log("Apontamento criado com sucesso. ID:", apontamentoId);

    if (inspecao) {
      console.log("Inserindo dados de inspeção...");
      const { error: inspecaoError } = await supabase
        .from('bd_registro_apontamento_inspecao')
        .insert({
          ...inspecao,
          apontamento_caminhao_equipamento_id: apontamentoId
        });

      if (inspecaoError) {
        console.error('Erro ao criar inspeção:', inspecaoError);
        console.warn('Apontamento salvo, mas houve erro ao salvar inspeção');
      } else {
        console.log("Inspeção salva com sucesso");
      }
    }

    console.log("=== APONTAMENTO CRIADO COM SUCESSO ===");
    return apontamentoId;
  } catch (error) {
    console.error('=== ERRO NA CRIAÇÃO DO APONTAMENTO ===');
    console.error('Detalhes do erro:', error);
    
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Falha inesperada ao criar apontamento');
  }
};

export const updateApontamento = async (
  id: string,
  apontamento: Partial<ApontamentoCaminhao>,
  inspecao?: Partial<ApontamentoInspecao>
): Promise<void> => {
  try {
    console.log("Updating apontamento with ID:", id);
    console.log("Apontamento data:", apontamento);
    
    const { operador_id, ...updateData } = apontamento;
    
    const { error: apontamentoError } = await supabase
      .from('bd_registro_apontamento_cam_equipa')
      .update(updateData)
      .eq('id', id);

    if (apontamentoError) {
      console.error('Erro ao atualizar apontamento:', apontamentoError);
      if (apontamentoError.code === '23503') {
        if (apontamentoError.details?.includes('caminhao_equipamento_id')) {
          throw new Error('Veículo não encontrado no sistema');
        } else if (apontamentoError.details?.includes('centro_custo_id')) {
          throw new Error('Centro de custo não encontrado no sistema');
        }
      }
      throw apontamentoError;
    }

    if (inspecao) {
      console.log("Updating inspection data for apontamento ID:", id);
      
      const { data: existingInspecao, error: checkError } = await supabase
        .from('bd_registro_apontamento_inspecao')
        .select('id')
        .eq('apontamento_caminhao_equipamento_id', id)
        .maybeSingle();
        
      if (checkError) {
        console.error('Erro ao verificar existência de inspeção:', checkError);
        throw checkError;
      }
      
      if (existingInspecao) {
        const { error: inspecaoError } = await supabase
          .from('bd_registro_apontamento_inspecao')
          .update(inspecao)
          .eq('apontamento_caminhao_equipamento_id', id);

        if (inspecaoError) {
          console.error('Erro ao atualizar inspeção:', inspecaoError);
          throw inspecaoError;
        }
      } else {
        const { error: inspecaoError } = await supabase
          .from('bd_registro_apontamento_inspecao')
          .insert({
            ...inspecao,
            apontamento_caminhao_equipamento_id: id
          });

        if (inspecaoError) {
          console.error('Erro ao criar inspeção:', inspecaoError);
          throw inspecaoError;
        }
      }
    }
    
    console.log("Apontamento and inspection updated successfully");
  } catch (error) {
    console.error('Erro ao atualizar apontamento:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Falha ao atualizar apontamento');
  }
};

export const deleteApontamento = async (id: string): Promise<void> => {
  try {
    const { error: inspecaoError } = await supabase
      .from('bd_registro_apontamento_inspecao')
      .delete()
      .eq('apontamento_caminhao_equipamento_id', id);

    if (inspecaoError) {
      console.error('Erro ao excluir inspeção:', inspecaoError);
      throw inspecaoError;
    }

    const { error: apontamentoError } = await supabase
      .from('bd_registro_apontamento_cam_equipa')
      .delete()
      .eq('id', id);

    if (apontamentoError) {
      console.error('Erro ao excluir apontamento:', apontamentoError);
      throw apontamentoError;
    }
  } catch (error) {
    console.error('Erro ao excluir apontamento:', error);
    throw new Error('Falha ao excluir apontamento');
  }
};

export const getUltimoHorimetro = async (caminhaoId: string): Promise<number | null> => {
  try {
    console.log(`🔍 Buscando último horímetro para caminhão/equipamento: ${caminhaoId}`);
    
    // Usar função privilegiada para contornar RLS
    const { data, error } = await (supabase as any).rpc('get_ultimo_horimetro_privilegiado', {
      caminhao_id: caminhaoId
    });

    if (error) {
      console.error('❌ Erro ao buscar último horímetro:', error);
      return null;
    }

    if (data !== null && data > 0) {
      console.log(`✅ Último horímetro encontrado: ${data}`);
      return data;
    }

    console.log('ℹ️ Nenhum horímetro anterior encontrado para este veículo');
    return null;
  } catch (error) {
    console.error('❌ Erro ao buscar último horímetro:', error);
    return null;
  }
};

// Função para buscar funcionários operacionais baseado em permissões
export const fetchFuncionariosOperacionais = async (): Promise<Array<{id: string, label: string}>> => {
  try {
    console.log('🔍 Buscando funcionários operacionais...');
    
    const { data, error } = await supabase
      .from('bd_funcionarios')
      .select(`
        id,
        nome_completo,
        status,
        bd_funcoes (nome_funcao)
      `)
      .eq('status', 'Ativo')
      .not('bd_funcoes.nome_funcao', 'is', null)
      .in('bd_funcoes.nome_funcao', ['Operador', 'Encarregado', 'Apontador', 'Mestre de Obra'])
      .order('nome_completo');

    if (error) {
      console.error('❌ Erro ao buscar funcionários operacionais:', error);
      console.error('❌ Detalhes do erro:', error.message, error.details);
      
      // Se erro for de RLS, tentar uma busca mais básica
      if (error.message.includes('RLS') || error.message.includes('policy')) {
        console.log('⚠️ Erro de RLS detectado, tentando busca básica...');
        
        const { data: basicData, error: basicError } = await supabase
          .from('bd_funcionarios')
          .select('id, nome_completo')
          .eq('status', 'Ativo')
          .order('nome_completo');
          
        if (basicError) {
          console.error('❌ Erro na busca básica:', basicError);
          return [];
        }
        
        console.log(`✅ Encontrados ${basicData?.length || 0} funcionários ativos (busca básica)`);
        return (basicData || []).map(func => ({
          id: func.id,
          label: func.nome_completo
        }));
      }
      
      return [];
    }

    console.log(`✅ Encontrados ${data?.length || 0} funcionários operacionais`);
    return (data || []).map(func => ({
      id: func.id,
      label: func.nome_completo
    }));
  } catch (error) {
    console.error('❌ Erro ao buscar funcionários operacionais:', error);
    return [];
  }
};

export const uploadFotoAvaria = async (
  file: File
): Promise<string> => {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `avarias/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('apontamentos')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Erro ao fazer upload da imagem:', uploadError);
      throw uploadError;
    }

    const { data } = supabase.storage
      .from('apontamentos')
      .getPublicUrl(filePath);

    return data.publicUrl;
  } catch (error) {
    console.error('Erro ao fazer upload da imagem:', error);
    throw new Error('Falha ao enviar imagem');
  }
};
