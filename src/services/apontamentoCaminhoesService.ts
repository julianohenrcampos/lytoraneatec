
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
        veiculo:caminhao_equipamento_id(id, placa, modelo, frota_id, tipo_veiculo, situacao),
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
      inspecao: inspecao as ApontamentoInspecao
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

async function createFuncionarioIfNeeded(userId: string, email: string | null): Promise<void> {
  try {
    const { data: existingFunc, error: checkError } = await supabase
      .from('bd_funcionarios')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
    
    if (checkError) throw checkError;
    
    if (existingFunc) {
      console.log("User already exists as funcionario with ID:", existingFunc.id);
      return;
    }
    
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('nome_completo')
      .eq('id', userId)
      .single();
      
    if (profileError) throw profileError;
    
    const nomeCompleto = profileData?.nome_completo || email || 'Usuário';
    
    const { error: insertError } = await supabase
      .from('bd_funcionarios')
      .insert({
        id: userId,
        email: email,
        nome_completo: nomeCompleto,
        status: 'Ativo',
        cpf: 'Pendente'
      });
      
    if (insertError) throw insertError;
    
    console.log("Created new funcionario with ID:", userId);
  } catch (error) {
    console.error('Error creating funcionario record:', error);
    throw new Error('Não foi possível criar um registro de funcionário para o usuário atual');
  }
}

export const createApontamento = async (
  apontamento: Omit<ApontamentoCaminhao, 'id'>, 
  inspecao?: Omit<ApontamentoInspecao, 'id' | 'apontamento_caminhao_equipamento_id'>,
  userEmail?: string | null
): Promise<string> => {
  try {
    console.log("Creating apontamento with data:", apontamento);
    
    if (!apontamento.caminhao_equipamento_id) {
      throw new Error('Caminhão/Equipamento é obrigatório');
    }
    
    const operadorId = apontamento.operador_id;
    if (!operadorId) {
      throw new Error('ID do operador é obrigatório');
    }
    
    const userExists = await checkUserInFuncionarios(operadorId);
    if (!userExists) {
      await createFuncionarioIfNeeded(operadorId, userEmail);
    }
    
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
          throw new Error('Usuário não está registrado como funcionário no sistema. Tente novamente.');
        } else if (apontamentoError.details?.includes('caminhao_equipamento_id')) {
          throw new Error('Veículo não encontrado no sistema');
        } else if (apontamentoError.details?.includes('centro_custo_id')) {
          throw new Error('Centro de custo não encontrado no sistema');
        }
      }
      throw apontamentoError;
    }

    const apontamentoId = data.id;
    console.log("Apontamento created with ID:", apontamentoId);

    if (inspecao) {
      console.log("Inserting inspection data for apontamento ID:", apontamentoId);
      const { error: inspecaoError } = await supabase
        .from('bd_registro_apontamento_inspecao')
        .insert({
          ...inspecao,
          apontamento_caminhao_equipamento_id: apontamentoId
        });

      if (inspecaoError) {
        console.error('Erro ao criar inspeção:', inspecaoError);
        throw inspecaoError;
      }
    }

    return apontamentoId;
  } catch (error) {
    console.error('Erro ao criar apontamento:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Falha ao criar apontamento');
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
    const { data, error } = await supabase
      .from('bd_registro_apontamento_cam_equipa')
      .select('horimetro_final')
      .eq('caminhao_equipamento_id', caminhaoId)
      .order('data', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar último horímetro:', error);
      throw error;
    }

    return data?.horimetro_final || null;
  } catch (error) {
    console.error('Erro ao buscar último horímetro:', error);
    return null;
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
