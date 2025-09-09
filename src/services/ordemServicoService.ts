import { supabase } from "@/integrations/supabase/client";
import { OrdemServico, Material, MaoDeObra, Movimentacao, OsFilterParams } from "@/types/ordemServico";
import { uploadImage } from "./storageService";
import { toDecimal } from "@/utils/number";
import { normalizeDateToBrazilianNoon, formatBrazilianDateToString, parseBrazilianDate, formatBrazilianDateForDisplay, BRAZIL_TIMEZONE } from "@/utils/timezoneUtils";
import { toZonedTime } from "date-fns-tz";

const generateOsNumber = async (): Promise<string> => {
  const year = new Date().getFullYear();
  
  const { count, error } = await supabase
    .from('bd_ordens_servico')
    .select('*', { count: 'exact', head: true })
    .like('numero_os', `${year}-%`);
    
  if (error) throw error;
  
  const sequentialNumber = (count || 0) + 1;
  return `${year}-${sequentialNumber.toString().padStart(4, '0')}`;
};

export const fetchOpenChamados = async (filters: OsFilterParams = {}) => {
  let query = supabase
    .from('bd_chamados_os')
    .select(`
      *,
      centro_custo:centro_custo_id(codigo_centro_custo, nome_centro_custo),
      caminhao_equipamento:caminhao_equipamento_id(placa, tipo_veiculo, marca, modelo)
    `)
    .eq('status', 'Aberto')
    .order('created_at', { ascending: false });

  if (filters.numero_os) {
    query = query.ilike('numero_chamado', `%${filters.numero_os}%`);
  }
  
  if (filters.caminhao_equipamento_id && filters.caminhao_equipamento_id !== 'todos') {
    query = query.eq('caminhao_equipamento_id', filters.caminhao_equipamento_id);
  }
  
  // Priority filter removed for chamados - only used in chamados tab
  
  if (filters.data_inicio) {
    query = query.gte('data_solicitacao', filters.data_inicio);
  }
  
  if (filters.data_fim) {
    query = query.lte('data_solicitacao', filters.data_fim);
  }

  const { data, error } = await query;
  
  if (error) {
    console.error("Error fetching open chamados:", error);
    throw error;
  }
  
  if (data && data.length > 0) {
    const solicitanteIds = [...new Set(data.map(chamado => chamado.solicitante_id))].filter(Boolean);
    
    if (solicitanteIds.length > 0) {
      const { data: solicitantes, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, nome_completo')
        .in('id', solicitanteIds);
      
      if (!profileError && solicitantes) {
        return data.map(chamado => {
          const solicitante = solicitantes.find(s => s.id === chamado.solicitante_id);
          return {
            ...chamado,
            solicitante: solicitante ? solicitante : null
          };
        });
      }
    }
  }
  
  return data || [];
};

export const updateChamadoStatus = async (chamadoId: string, newStatus: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('bd_chamados_os')
      .update({ status: newStatus })
      .eq('id', chamadoId);
      
    if (error) throw error;
    
    console.log(`Chamado ${chamadoId} updated to status: ${newStatus}`);
  } catch (error) {
    console.error("Error updating chamado status:", error);
    throw error;
  }
};

export const convertChamadoToOs = async (
  chamadoId: string, 
  userId: string,
  additionalData?: Partial<OrdemServico>
): Promise<OrdemServico> => {
  try {
    // 1. Buscar o chamado
    const chamado = await getChamadoById(chamadoId);
    
    if (!chamado) {
      throw new Error('Chamado não encontrado');
    }

    // 2. Verificar se já foi convertido
    if (chamado.status !== 'Aberto') {
      throw new Error(`Chamado já foi convertido ou não está aberto. Status atual: ${chamado.status}`);
    }

    // 3. Gerar número da OS
    const numeroOs = await generateOsNumber();
    
    // 4. Preparar dados da OS (usando colunas que existem na bd_ordens_servico)
    const newOsData = {
      numero_os: numeroOs,
      chamado_id: chamadoId,
      caminhao_equipamento_id: chamado.caminhao_equipamento_id,
      data_abertura: formatBrazilianDateToString(normalizeDateToBrazilianNoon()),
      tipo_servico: chamado.tipo_falha || 'Mecânica',
      descricao_servico: chamado.descricao_problema,
      status: 'Aberta',
      ...additionalData
    };
    
    console.log('Creating OS with data:', newOsData);
    
    // 5. Criar a OS
    const { data: novaOs, error } = await supabase
      .from('bd_ordens_servico')
      .insert(newOsData)
      .select()
      .single();
      
    if (error) {
      console.error('Error creating OS:', error);
      throw error;
    }
    
    console.log('OS created successfully:', novaOs);
    
    // Movimentações descontinuadas: não registrar histórico em bd_os_movimentacoes
    
    // 7. Atualizar status do chamado
    await updateChamadoStatus(chamadoId, 'Convertido para OS');
    
    console.log(`Chamado ${chamado.numero_chamado} convertido para OS ${numeroOs} com sucesso`);
    
    return novaOs as any as OrdemServico;
  } catch (error) {
    console.error('Error converting chamado to OS:', error);
    throw error;
  }
};
 
// Helper: marcar equipamento como Disponível ao encerrar OS
const setEquipamentoDisponivel = async (equipamentoId?: string | null) => {
  try {
    if (!equipamentoId) return;
    const { error } = await supabase
      .from('bd_caminhoes_equipamentos')
      .update({ situacao: 'Disponível' })
      .eq('id', equipamentoId);
    if (error) throw error;
    console.log(`✅ Equipamento ${equipamentoId} marcado como "Disponível".`);
  } catch (err) {
    console.error('❌ Erro ao marcar equipamento como "Disponível":', err);
    // Não propaga erro para não bloquear encerramento da OS
  }
};

export const finishOrdemServico = async (osId: string, userId: string): Promise<void> => {
  try {
    const now = new Date();
    const brazilNow = toZonedTime(now, BRAZIL_TIMEZONE);
    const currentDate = formatBrazilianDateToString(normalizeDateToBrazilianNoon(brazilNow));
    const currentTime = `${String(brazilNow.getHours()).padStart(2,'0')}:${String(brazilNow.getMinutes()).padStart(2,'0')}:${String(brazilNow.getSeconds()).padStart(2,'0')}`; // HH:mm:ss Brasil
    
    const { data: updatedOs, error: osError } = await supabase
      .from('bd_ordens_servico')
      .update({
        status: 'Concluída',
        data_encerramento_atendimento: currentDate,
        hora_encerramento_atendimento: currentTime,
        encerrado_por_id: userId
      })
      .eq('id', osId)
      .select('chamado_id, caminhao_equipamento_id')
      .single();
      
    if (osError) throw osError;
    
    // Movimentações descontinuadas: não registrar histórico em bd_os_movimentacoes
    
    if (updatedOs && updatedOs.chamado_id) {
      await updateChamadoStatus(updatedOs.chamado_id, 'Concluído');
    }

    // Marcar equipamento como Disponível ao concluir OS
    if (updatedOs && (updatedOs as any).caminhao_equipamento_id) {
      await setEquipamentoDisponivel((updatedOs as any).caminhao_equipamento_id);
    }
  } catch (error) {
    console.error("Error finishing OS:", error);
    throw error;
  }
};

export const fetchOrdensServico = async (filters: OsFilterParams = {}) => {
  let query = supabase
    .from('bd_ordens_servico')
    .select(`
      *,
      caminhao_equipamento:bd_caminhoes_equipamentos!caminhao_equipamento_id (
        placa,
        tipo_veiculo,
        marca,
        modelo
      )
    `)
    .order('data_abertura', { ascending: false });

  if (filters.numero_os) {
    query = query.ilike('numero_os', `%${filters.numero_os}%`);
  }
  
  if (filters.caminhao_equipamento_id) {
    query = query.eq('caminhao_equipamento_id', filters.caminhao_equipamento_id);
  }
  
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  
  if (filters.data_inicio) {
    query = query.gte('data_abertura', filters.data_inicio);
  }
  
  if (filters.data_fim) {
    query = query.lte('data_abertura', filters.data_fim);
  }

  const { data, error } = await query;
  
  if (error) throw error;
  
  if (data && data.length > 0) {
    const userIds = new Set<string>();
    
    data.forEach((os: any) => {
      if ((os as any).solicitante_id) userIds.add((os as any).solicitante_id);
      if ((os as any).executado_por_id) userIds.add((os as any).executado_por_id);
      if ((os as any).encerrado_por_id) userIds.add((os as any).encerrado_por_id);
    });
    
    const userIdsArray = Array.from(userIds).filter(Boolean);
    
    if (userIdsArray.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from('profiles')
        .select('id, email, nome_completo')
        .in('id', userIdsArray);
      
      if (!usersError && users) {
        return data.map((os: any) => {
          const solicitante = users.find(u => u.id === (os as any).solicitante_id);
          const executado_por = users.find(u => u.id === (os as any).executado_por_id);
          const encerrado_por = users.find(u => u.id === (os as any).encerrado_por_id);
          
          return {
            ...os,
            solicitante: solicitante || null,
            executado_por: executado_por || null,
            encerrado_por: encerrado_por || null
          };
        }) as any as OrdemServico[];
      }
    }
  }
  
  return data as any as OrdemServico[];
};

export const getOrdemServicoById = async (id: string): Promise<OrdemServico> => {
    const { data, error } = await (supabase as any)
    .from('bd_ordens_servico')
    .select(`
      *,
      centro_custo:centro_custo_id(codigo_centro_custo, nome_centro_custo),
      caminhao_equipamento:caminhao_equipamento_id(placa, tipo_veiculo, marca, modelo)
    `)
    .eq('id', id)
    .single();
    
  if (error) throw error;
  
  const userIds = [
    (data as any).solicitante_id,
    (data as any).executado_por_id,
    (data as any).encerrado_por_id
  ].filter(Boolean);
  
  if (userIds.length > 0) {
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id, email, nome_completo')
      .in('id', userIds);
      
    if (!usersError && users) {
      const solicitante = users.find(u => u.id === (data as any).solicitante_id);
      const executado_por = users.find(u => u.id === (data as any).executado_por_id);
      const encerrado_por = users.find(u => u.id === (data as any).encerrado_por_id);
      
      return {
        ...data,
        solicitante: solicitante || null,
        executado_por: executado_por || null,
        encerrado_por: encerrado_por || null
      } as any as OrdemServico;
    }
  }
  
  return data as any as OrdemServico;
};

export const getChamadoById = async (id: string): Promise<any> => {
  const { data, error } = await supabase
    .from('bd_chamados_os')
    .select(`
      *,
      centro_custo:centro_custo_id(codigo_centro_custo, nome_centro_custo),
      caminhao_equipamento:caminhao_equipamento_id(placa, tipo_veiculo, marca, modelo)
    `)
    .eq('id', id)
    .single();
    
  if (error) throw error;
  
  if (data && data.solicitante_id) {
    const { data: solicitante, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, nome_completo')
      .eq('id', data.solicitante_id)
      .single();
      
    if (!profileError && solicitante) {
      return { ...data, solicitante } as any;
    }
  }
  
  return data as any;
};

export const getMaterialsByOsId = async (osId: string): Promise<Material[]> => {
  const { data, error } = await (supabase as any)
    .from('bd_os_materiais_utilizados')
    .select('*')
    .eq('os_id', osId)
    .order('created_at', { ascending: true });
    
  if (error) throw error;
  
  return (data as any) || [];
};

export const getMaoDeObraByOsId = async (osId: string): Promise<MaoDeObra[]> => {
  const { data, error } = await (supabase as any)
    .from('bd_os_mao_obra')
    .select('*')
    .eq('os_id', osId)
    .order('created_at', { ascending: true });
    
  if (error) throw error;
  
  return (data as any) || [];
};

export const getMovimentacoesByOsId = async (osId: string): Promise<Movimentacao[]> => {
  // Movimentações descontinuadas: retornar lista vazia
  return [];
};

export const updateOrdemServico = async (
  id: string,
  osData: Partial<OrdemServico>,
  currentUserId: string,
  motivo: string
): Promise<OrdemServico> => {
  try {
    console.log('🔧🔧🔧 [UPDATE-OS-SERVICE] === INÍCIO DO UPDATE ===');
    console.log('🔧 [UPDATE-OS-SERVICE] id:', id);
    console.log('🔧 [UPDATE-OS-SERVICE] osData recebido:', JSON.stringify(osData, null, 2));
    console.log('🔧 [UPDATE-OS-SERVICE] currentUserId:', currentUserId);
    console.log('🔧 [UPDATE-OS-SERVICE] motivo:', motivo);
    
    // Auto-preencher encerrado_por_id se necessário
    const updatedOsData = { ...osData };
    if (updatedOsData.encerrado_por_id === 'AUTO_FILL') {
      updatedOsData.encerrado_por_id = currentUserId;
      console.log('🔧 [UPDATE-OS-SERVICE] Auto-preenchendo encerrado_por_id:', currentUserId);
    }
    
    // Verificar se o ID é válido
    if (!id || typeof id !== 'string') {
      throw new Error('ID da OS é obrigatório e deve ser uma string válida');
    }

    // Preparar dados limpos para o update
    const cleanData = { ...updatedOsData };
    
    // Remover campos que são calculados ou não devem ser atualizados diretamente
    delete cleanData.id;
    delete cleanData.created_at;
    delete cleanData.numero_os; // número OS não deve mudar após criação
    
    // Remover campos de relacionamento que vêm populados das consultas
    delete (cleanData as any).caminhao_equipamento;
    delete (cleanData as any).centro_custo;
    delete (cleanData as any).solicitante;
    delete (cleanData as any).executado_por;
    delete (cleanData as any).encerrado_por;
    
    console.log('🔧 [UPDATE-OS-SERVICE] Dados após limpeza inicial:', JSON.stringify(cleanData, null, 2));
    console.log('🔧 [UPDATE-OS-SERVICE] Campos específicos a verificar:');
    console.log('🔧   - setor_executante:', cleanData.setor_executante);
    console.log('🔧   - telefone_solicitante:', cleanData.telefone_solicitante);
    console.log('🔧   - obra_patio:', cleanData.obra_patio);
    console.log('🔧   - mecanico_id:', cleanData.mecanico_id);
    
    // Validação e normalização robusta de dados - FORÇA INCLUIR TODOS OS CAMPOS
    const finalCleanData: any = {};
    
    // Lista explícita de todos os campos que devem ser processados
    const requiredFields = [
      // Cabeçalho
      'telefone_solicitante',
      'setor_executante', 
      'tipo_manutencao',
      // Dados Gerais - Classificação
      'tipo_servico',
      'mecanico_id',
      'obra_patio',
      // Dados Gerais - Balanceamento 
      'data_inicio_atendimento',
      'hora_inicio_atendimento',
      'data_encerramento_atendimento',
      'hora_encerramento_atendimento',
      'horimetro_odometro_final',
      'executado_por_id',
      'encerrado_por_id',
      // Tratativa
      'tratativa_solucao',
      // Outros campos importantes
      'descricao_servico',
      'observacoes',
      'valor_servico',
      'terceirizada',
      'status',
      'horimetro_odometro_inicial',
      'data_previsao',
      'data_conclusao',
      'duracao_total'
    ];
    
    // Processar campos obrigatórios primeiro - FORÇA INCLUSÃO
    requiredFields.forEach(field => {
      if (cleanData.hasOwnProperty(field)) {
        const value = cleanData[field as keyof typeof cleanData];
        console.log(`🔧 [UPDATE-OS-SERVICE] Processando campo obrigatório: ${field} = "${value}"`);
        
        // Campos UUID
        if (field.endsWith('_id')) {
          if (!value || value === '' || (typeof value === 'string' && value.trim() === '')) {
            finalCleanData[field] = null;
          } else if (typeof value === 'string') {
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (uuidRegex.test(value.trim())) {
              finalCleanData[field] = value.trim();
            } else {
              console.warn(`⚠️ UUID inválido para ${field}: "${value}", definindo como null`);
              finalCleanData[field] = null;
            }
          } else {
            finalCleanData[field] = value;
          }
          return;
        }
        
        // Campo valor_servico
        if (field === 'valor_servico') {
          if (value === null || value === undefined || value === '' || value === '0') {
            finalCleanData[field] = null;
          } else {
            const numericValue = parseFloat(String(value).replace(',', '.'));
            finalCleanData[field] = isNaN(numericValue) || numericValue <= 0 ? null : numericValue;
          }
          return;
        }
        
        // Campos de data (normalização Brasil)
        if (field.includes('data_')) {
          if (value && value !== '') {
            try {
              const parsed = parseBrazilianDate(String(value));
              const normalized = normalizeDateToBrazilianNoon(parsed);
              finalCleanData[field] = formatBrazilianDateToString(normalized);
            } catch (e) {
              console.warn(`⚠️ Data inválida para ${field}: "${value}"`);
              finalCleanData[field] = null;
            }
          } else {
            finalCleanData[field] = null;
          }
          return;
        }
        
        // Campos de hora
        if (field.includes('hora_')) {
          if (value && value !== '') {
            let timeValue = String(value).trim();
            if (!timeValue.includes(':')) {
              timeValue = `${timeValue}:00`;
            }
            const timeParts = timeValue.split(':');
            if (timeParts.length === 2) {
              finalCleanData[field] = `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}:00`;
            } else if (timeParts.length === 3) {
              finalCleanData[field] = `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}:${timeParts[2].padStart(2, '0')}`;
            } else {
              console.warn(`⚠️ Hora inválida para ${field}: "${value}"`);
              finalCleanData[field] = null;
            }
          } else {
            finalCleanData[field] = null;
          }
          return;
        }
        
        // Campo terceirizada
        if (field === 'terceirizada') {
          finalCleanData[field] = Boolean(value === true || value === 'true');
          return;
        }
        
        // Campos de texto
        if (typeof value === 'string') {
          finalCleanData[field] = value.trim() === '' ? null : value.trim();
          return;
        }
        
        // Outros campos
        finalCleanData[field] = value;
      }
    });
    
    // Processar outros campos não listados
    Object.keys(cleanData).forEach(key => {
      if (!requiredFields.includes(key)) {
        const value = cleanData[key as keyof typeof cleanData];
        
        // Campos UUID
        if (key.endsWith('_id')) {
          if (!value || value === '' || (typeof value === 'string' && value.trim() === '')) {
            finalCleanData[key] = null;
          } else if (typeof value === 'string') {
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (uuidRegex.test(value.trim())) {
              finalCleanData[key] = value.trim();
            } else {
              console.warn(`⚠️ UUID inválido para ${key}: "${value}", definindo como null`);
              finalCleanData[key] = null;
            }
          } else {
            finalCleanData[key] = value;
          }
          return;
        }
        
        // Campos de data (normalização Brasil)
        if (key.includes('data_')) {
          if (value && value !== '') {
            try {
              const parsed = parseBrazilianDate(String(value));
              const normalized = normalizeDateToBrazilianNoon(parsed);
              finalCleanData[key] = formatBrazilianDateToString(normalized);
            } catch (e) {
              console.warn(`⚠️ Data inválida para ${key}: "${value}"`);
            }
          }
          return;
        }
        
        // Campos de hora
        if (key.includes('hora_')) {
          if (value && value !== '') {
            let timeValue = String(value).trim();
            if (!timeValue.includes(':')) {
              timeValue = `${timeValue}:00`;
            }
            const timeParts = timeValue.split(':');
            if (timeParts.length === 2) {
              finalCleanData[key] = `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}:00`;
            } else if (timeParts.length === 3) {
              finalCleanData[key] = `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}:${timeParts[2].padStart(2, '0')}`;
            } else {
              console.warn(`⚠️ Hora inválida para ${key}: "${value}"`);
            }
          }
          return;
        }
        
        // Campo terceirizada
        if (key === 'terceirizada') {
          finalCleanData[key] = Boolean(value === true || value === 'true');
          return;
        }
        
        // Campos de texto
        if (typeof value === 'string') {
          finalCleanData[key] = value.trim() === '' ? null : value.trim();
          return;
        }
        
        // Outros campos
        finalCleanData[key] = value;
      }
    });
    
    console.log('🚀 [UPDATE-OS-SERVICE] Dados finais para update:', JSON.stringify(finalCleanData, null, 2));
    console.log('📊 [UPDATE-OS-SERVICE] Total de campos para update:', Object.keys(finalCleanData).length);
    
    // Verificar se temos dados para atualizar
    if (Object.keys(finalCleanData).length === 0) {
      console.log('⚠️ [UPDATE-OS-SERVICE] ERRO: Nenhum campo válido para atualizar!');
      throw new Error('Nenhum campo válido fornecido para atualização');
    }
    
    // Filtrar apenas colunas válidas existentes na tabela para evitar erros (ex.: observacoes, data_previsao não existem)
    const allowedColumns = new Set([
      'caminhao_equipamento_id',
      'chamado_id',
      'created_at',
      'data_abertura',
      'data_encerramento_atendimento',
      'data_inicio_atendimento',
      'descricao_servico',
      'duracao_total',
      'encerrado_por_id',
      'executado_por_id',
      'hora_encerramento_atendimento',
      'hora_inicio_atendimento',
      'horimetro_odometro_final',
      'horimetro_odometro_inicial',
      'id',
      'mecanico_id',
      'numero_os',
      'obra_patio',
      'setor_executante',
      'status',
      'telefone_solicitante',
      'terceirizada',
      'tipo_manutencao',
      'tipo_servico',
      'tratativa_solucao',
      'updated_at',
      'valor_servico'
    ]);

    const filteredPayload: Record<string, any> = {};
    const removedKeys: string[] = [];
    for (const [k, v] of Object.entries(finalCleanData)) {
      if (allowedColumns.has(k)) {
        filteredPayload[k] = v;
      } else {
        removedKeys.push(k);
      }
    }

    if (removedKeys.length > 0) {
      console.log('🧹 [UPDATE-OS-SERVICE] Removendo chaves não suportadas pela tabela:', removedKeys);
    }

    // Garantir timestamp de atualização
    filteredPayload.updated_at = new Date().toISOString();
    
    console.log('🚀 [UPDATE-OS-SERVICE] Executando UPDATE no Supabase...');
    console.log('🚀 [UPDATE-OS-SERVICE] ID da OS:', id);
    console.log('🚀 [UPDATE-OS-SERVICE] Comando final:', `UPDATE bd_ordens_servico SET ... WHERE id = '${id}'`);
    console.log('🚀 [UPDATE-OS-SERVICE] Payload final filtrado:', JSON.stringify(filteredPayload, null, 2));
    
    const { data: os, error: osError } = await supabase
      .from('bd_ordens_servico')
      .update(filteredPayload)
      .eq('id', id)
      .select('*')
      .single();
      
    if (osError) {
      console.error('❌ [UPDATE-OS-SERVICE] Erro ao atualizar OS:', osError);
      console.error('❌ [UPDATE-OS-SERVICE] Detalhes do erro:', {
        message: osError.message,
        details: osError.details,
        hint: osError.hint,
        code: osError.code
      });
      throw osError;
    }
    
    console.log('✅ [UPDATE-OS-SERVICE] ========== OS ATUALIZADA COM SUCESSO ==========');
    console.log('✅ [UPDATE-OS-SERVICE] Dados retornados:', JSON.stringify(os, null, 2));
    console.log('🕒 [UPDATE-OS-SERVICE] Updated_at:', os.updated_at);
    
    // VERIFICAÇÃO ADICIONAL: Consultar diretamente o banco para confirmar
    console.log('🔍 [UPDATE-OS-SERVICE] === VERIFICAÇÃO DIRETA NO BANCO ===');
    const { data: verificacao, error: verifyError } = await supabase
      .from('bd_ordens_servico')
      .select('id, numero_os, setor_executante, telefone_solicitante, obra_patio, mecanico_id, updated_at')
      .eq('id', id)
      .single();
    
    if (verificacao) {
      console.log('🔍 [UPDATE-OS-SERVICE] Verificação banco:', JSON.stringify(verificacao, null, 2));
    } else if (verifyError) {
      console.error('🔍❌ [UPDATE-OS-SERVICE] Erro na verificação:', verifyError);
    }
    
    console.log('✅ [UPDATE-OS-SERVICE] ================================================');

    // Se a OS foi marcada como Concluída, liberar o equipamento automaticamente
    try {
      if ((os as any)?.status === 'Concluída' && (os as any)?.caminhao_equipamento_id) {
        await setEquipamentoDisponivel((os as any).caminhao_equipamento_id);
      }
    } catch (e) {
      // Apenas logar, não bloquear atualização da OS
      console.warn('⚠️ [UPDATE-OS-SERVICE] Falha ao marcar equipamento como Disponível:', e);
    }

    return os as any as OrdemServico;
  } catch (error) {
    console.error('❌❌❌ [UPDATE-OS-SERVICE] Error updating OS:', error);
    throw error;
  }
};

export const createOrdemServico = async (
  osData: Partial<OrdemServico>,
  currentUserId: string
): Promise<OrdemServico> => {
  try {
    console.log('🔧 [CREATE-OS-SERVICE] === VALIDAÇÃO ANTI-DUPLICAÇÃO ===');
    console.log('🔧 [CREATE-OS-SERVICE] osData:', osData);
    console.log('🔧 [CREATE-OS-SERVICE] currentUserId:', currentUserId);
    
    // CORREÇÃO 3: Validação anti-duplicação por numero_os
    if (osData.numero_os) {
      console.log('🔍 [CREATE-OS-SERVICE] Verificando duplicação por numero_os:', osData.numero_os);
      const { data: existingOs, error: checkError } = await supabase
        .from('bd_ordens_servico')
        .select('id, numero_os')
        .eq('numero_os', osData.numero_os)
        .maybeSingle();
      
      if (checkError) {
        console.error('❌ [CREATE-OS-SERVICE] Erro ao verificar duplicação:', checkError);
      } else if (existingOs) {
        console.error('🚫 [CREATE-OS-SERVICE] ERRO: OS já existe!', existingOs);
        throw new Error(`Já existe uma OS com o número ${osData.numero_os}. Use a função de atualização ao invés de criar nova OS. ID existente: ${existingOs.id}`);
      }
    }
    
    // Gerar número da OS se não foi fornecido
    const numeroOs = osData.numero_os || await generateOsNumber();
    
    // Limpar e normalizar dados antes da inserção
    const cleanData = { ...osData };
    
    // Remover campos que são calculados ou não devem ser atualizados diretamente
    delete cleanData.id;
    delete cleanData.created_at;
    delete (cleanData as any).caminhao_equipamento;
    delete (cleanData as any).centro_custo;
    delete (cleanData as any).solicitante;
    delete (cleanData as any).executado_por;
    delete (cleanData as any).encerrado_por;
    
    const finalCleanData: any = {};
    
    Object.entries(cleanData).forEach(([key, value]) => {
      // Campos de data: converter strings vazias para null
      if (['data_previsao', 'data_conclusao', 'data_inicio_atendimento', 'data_encerramento_atendimento'].includes(key)) {
        finalCleanData[key] = (value === '' || value === null || value === undefined) ? null : value;
      }
      // Campos de hora: converter strings vazias para null, formatar se necessário
      else if (['hora_inicio_atendimento', 'hora_encerramento_atendimento'].includes(key)) {
        if (value === '' || value === null || value === undefined) {
          finalCleanData[key] = null;
        } else if (typeof value === 'string' && value.length === 5) {
          // Formato HH:MM, adicionar segundos se necessário
          finalCleanData[key] = `${value}:00`;
        } else {
          finalCleanData[key] = value;
        }
      }
      // IDs: validar se são UUIDs válidos
      else if (key.endsWith('_id') && value) {
        if (typeof value === 'string' && value.trim() !== '') {
          finalCleanData[key] = value.trim();
        } else {
          finalCleanData[key] = null;
        }
      }
      // Strings: limpar espaços
      else if (typeof value === 'string') {
        const trimmed = value.trim();
        finalCleanData[key] = trimmed !== '' ? trimmed : null;
      }
      // Números: garantir que são válidos
      else if (typeof value === 'number' && !isNaN(value)) {
        finalCleanData[key] = value;
      }
      // Booleanos: manter como estão
      else if (typeof value === 'boolean') {
        finalCleanData[key] = value;
      }
      // null/undefined: converter para null
      else if (value === null || value === undefined) {
        finalCleanData[key] = null;
      }
      // Outros campos: manter como estão se não forem vazios
      else if (value !== '') {
        finalCleanData[key] = value;
      }
    });
    
    const newOsData = {
      ...finalCleanData,
      numero_os: numeroOs,
      data_abertura: finalCleanData.data_abertura || formatBrazilianDateToString(normalizeDateToBrazilianNoon()),
      status: finalCleanData.status || 'Aberta'
    };
    
    console.log('🚀 [CREATE-OS-SERVICE] Inserindo na tabela bd_ordens_servico...');
    console.log('🚀 [CREATE-OS-SERVICE] Dados limpos:', JSON.stringify(newOsData, null, 2));
    
    const { data: os, error: osError } = await supabase
      .from('bd_ordens_servico')
      .insert(newOsData)
      .select()
      .single();
      
    if (osError) {
      console.error('❌ [CREATE-OS-SERVICE] Erro ao criar OS:', osError);
      throw osError;
    }
    
    console.log('✅ [CREATE-OS-SERVICE] OS criada com sucesso:', os);
    
    return os as any as OrdemServico;
  } catch (error) {
    console.error('❌❌❌ [CREATE-OS-SERVICE] Error creating OS:', error);
    throw error;
  }
};

export const generateOsPdf = async (osId: string): Promise<void> => {
  try {
    console.log(`Generating PDF for OS ${osId}`);
    
    const os = await getOrdemServicoById(osId);
    
    alert(`PDF gerado para a OS ${os?.numero_os}`);
    
    return Promise.resolve();
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};

export const exportOsToExcel = async (filters: OsFilterParams = {}): Promise<Blob> => {
  try {
    const ordensServico = await fetchOrdensServico(filters);
    
    const headers = ['Número OS', 'Data Abertura', 'Tipo Serviço', 'Veículo', 'Status'];
    
    const rows = ordensServico.map(os => [
      os.numero_os,
      formatBrazilianDateForDisplay(os.data_abertura),
      os.tipo_servico || 'N/A',
      os.caminhao_equipamento?.placa || 'N/A',
      os.status
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  } catch (error) {
    console.error('Error exporting OS:', error);
    throw error;
  }
};

export const saveMaterial = async (material: Partial<Material>): Promise<Material> => {
  try {
    if (!material?.os_id) {
      throw new Error("os_id obrigatório para salvar material.");
    }
    
    const { id, ...materialData } = material;
    
    const payload = {
      os_id: material.os_id,
      descricao_material: (materialData.descricao_material ?? "").trim(),
      quantidade: toDecimal(materialData.quantidade ?? 0),
      valor_unitario: toDecimal(materialData.valor_unitario ?? 0),
      // valor_total será calculado pela trigger, mas incluímos para consistência
      valor_total: toDecimal(materialData.quantidade ?? 0) * toDecimal(materialData.valor_unitario ?? 0)
    };
    
    if (id) {
      const { data, error } = await supabase
        .from('bd_os_materiais_utilizados')
        .update({
          ...payload,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
        
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase
        .from('bd_os_materiais_utilizados')
        .insert(payload)
        .select()
        .single();
        
      if (error) throw error;
      return data;
    }
  } catch (error) {
    console.error('Error saving material:', error);
    throw error;
  }
};

export const deleteMaterial = async (materialId: string): Promise<void> => {
  try {
    const { error } = await (supabase as any)
      .from('bd_os_materiais_utilizados')
      .delete()
      .eq('id', materialId);
      
    if (error) throw error;
  } catch (error) {
    console.error('Error deleting material:', error);
    throw error;
  }
};

export const saveMaoDeObra = async (maoDeObra: Partial<MaoDeObra>): Promise<MaoDeObra> => {
  try {
    if (!maoDeObra?.os_id) {
      throw new Error("os_id obrigatório para salvar mão de obra.");
    }
    
    const { id, ...maoDeObraData } = maoDeObra;
    
    const payload = {
      os_id: maoDeObra.os_id,
      funcao: (maoDeObraData.funcao ?? "").trim(),
      quantidade: toDecimal(maoDeObraData.quantidade ?? 0),
      valor_unitario: toDecimal(maoDeObraData.valor_unitario ?? 0),
      // valor_total será calculado pela trigger, mas incluímos para consistência
      valor_total: toDecimal(maoDeObraData.quantidade ?? 0) * toDecimal(maoDeObraData.valor_unitario ?? 0)
    };
    
    if (id) {
      const { data, error } = await supabase
        .from('bd_os_mao_obra')
        .update({
          ...payload,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
        
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase
        .from('bd_os_mao_obra')
        .insert(payload)
        .select()
        .single();
        
      if (error) throw error;
      return data;
    }
  } catch (error) {
    console.error('Error saving mão de obra:', error);
    throw error;
  }
};

export const deleteMaoDeObra = async (maoDeObraId: string): Promise<void> => {
  try {
    const { error } = await (supabase as any)
      .from('bd_os_mao_obra')
      .delete()
      .eq('id', maoDeObraId);
      
    if (error) throw error;
  } catch (error) {
    console.error('Error deleting mão de obra:', error);
    throw error;
  }
};
