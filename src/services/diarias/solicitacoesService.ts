import { supabase } from "@/integrations/supabase/client";
import { notificationService } from "@/services/notificationService";
import {
  assertPeriodoValidoOuFalhar,
  isPeriodoRetroativo,
  assertPeriodoNormalOuFalhar,
  calcularJanelaSemanal,
} from "@/utils/diariasPeriodoUtils";
import { verificarDuplicidadeSolicitacao as verificarDuplicidadeNormalSemana } from "./antiFraudeService";
import type { 
  DiariaSolicitacao, 
  SolicitacaoFormData, 
  SolicitacaoFilters,
  SolicitacaoResumo,
  StatusSolicitacao 
} from "@/types/diarias";

/**
 * Defesa em profundidade: valida estrutura Seg→Dom (7 dias) e checa
 * retroativo contra papel SuperAdm via RPC.
 * Lançar Error aborta o fluxo antes de qualquer write no banco.
 */
async function assertPeriodoEReceitaUsuario(
  dataInicio: string,
  dataFim: string,
): Promise<void> {
  // 1) Estrutura Seg→Dom (7 dias)
  assertPeriodoValidoOuFalhar(dataInicio, dataFim);

  // 2) Retroativo só para SuperAdm
  if (isPeriodoRetroativo(dataInicio)) {
    const { data: isSuperAdm, error } = await supabase.rpc('fn_is_super_admin');
    if (error) {
      console.error('[Diarias][periodo] erro ao checar fn_is_super_admin', error);
      throw new Error('Não foi possível validar permissão para período retroativo. Tente novamente.');
    }
    if (isSuperAdm !== true) {
      throw new Error('PERIODO_RETROATIVO: apenas SuperAdm pode criar/editar solicitações fora da semana atual');
    }
  }
}

/**
 * Defesa em profundidade ESPECÍFICA da Solicitação NORMAL.
 *
 * Aplica três regras, sempre na mesma ordem, em createSolicitacao,
 * updateSolicitacao e enviarParaAutorizacao:
 *
 *  1. Estrutura/semana operacional: data_inicio e data_fim na mesma semana
 *     Seg→Dom, com data_fim = domingo.
 *  2. Retroativo intra-semana: usuário comum não pode iniciar antes de hoje.
 *  3. Unicidade Normal/CC/semana: bloqueia segunda solicitação Normal ativa
 *     para o mesmo CC dentro da mesma janela operacional
 *     (data_inicio_semana / data_fim_semana).
 *
 * Para tipo === 'extraordinaria', NENHUMA dessas regras se aplica:
 * o trigger trg_check_solicitacao_periodo_overlap já libera Extraordinária
 * e a justificativa ≥20 chars é validada pelo banco.
 */
async function assertSolicitacaoNormalValida(params: {
  centro_custo_id: string;
  data_inicio: string;
  data_fim: string;
  tipo_solicitacao?: 'normal' | 'extraordinaria' | null;
  isEditing?: boolean;
  solicitacaoIdAtual?: string;
}): Promise<void> {
  const tipo = params.tipo_solicitacao || 'normal';
  if (tipo !== 'normal') return;

  // (1) Resolver SuperAdm via RPC oficial
  const { data: isSuperAdm, error: rpcErr } = await supabase.rpc('fn_is_super_admin');
  if (rpcErr) {
    console.error('[Diarias][assertNormal] erro fn_is_super_admin', rpcErr);
    throw new Error('Não foi possível validar permissão para o período. Tente novamente.');
  }

  // (2) Estrutura + retroativo intra-semana — traduz códigos para mensagem amigável
  try {
    assertPeriodoNormalOuFalhar(
      params.data_inicio,
      params.data_fim,
      isSuperAdm === true,
      !!params.isEditing,
    );
  } catch (e: any) {
    const m = e?.message || '';
    if (m.includes('PERIODO_RETROATIVO_INTRASEMANA')) {
      throw new Error('Solicitação retroativa permitida apenas para SuperAdm.');
    }
    if (m.includes('PERIODO_FORA_SEMANA_OPERACIONAL')) {
      throw new Error('O período selecionado ultrapassa a semana operacional. Crie uma nova solicitação para a próxima semana.');
    }
    throw e;
  }

  // (3) Unicidade Normal/CC/semana — chave: janela semanal real (Seg→Dom)
  const { data_inicio_semana, data_fim_semana } = calcularJanelaSemanal(params.data_inicio);
  const dup = await verificarDuplicidadeNormalSemana(
    params.centro_custo_id,
    data_inicio_semana,
    data_fim_semana,
    params.solicitacaoIdAtual,
  );
  if (dup.duplicada) {
    throw new Error('Já existe uma solicitação Normal para este CC nesta semana. Use Extraordinária para necessidades específicas.');
  }
}

// Interface de escopo para filtros obrigatórios
interface SolicitacaoScopeFilters {
  criado_por?: string;  // Engenheiro: filtra por criador
  centro_custo_ids?: string[];  // Gerente: filtra por CCs gerenciados
  responsavel_campo_id?: string;
}

export async function getSolicitacoes(
  filters?: SolicitacaoFilters,
  scope?: SolicitacaoScopeFilters
): Promise<DiariaSolicitacao[]> {
  let query = supabase
    .from('bd_diaria_solicitacoes')
    .select(`
      *,
      bd_centros_custo (
        id,
        codigo_centro_custo,
        nome_centro_custo
      ),
      engenheiro_solicitante:bd_funcionarios!bd_diaria_solicitacoes_engenheiro_solicitante_id_fkey(
        id,
        nome_completo
      )
    `)
    .order('created_at', { ascending: false });

  // Aplicar filtros de ESCOPO (opcionais). Quando o scope vier vazio (perfis
  // delegados ao RLS, ex: AdmOBRA/GerenteRegional/compostos), nenhum filtro
  // adicional é aplicado e a regra de visibilidade é resolvida pelo RLS
  // (fn_diaria_can_select_row: criador OR responsavel_campo OR CC autorizado).
  const scopeVazio = !scope || (
    !scope.criado_por &&
    !scope.responsavel_campo_id &&
    !(scope.centro_custo_ids && scope.centro_custo_ids.length)
  );
  if (scopeVazio && import.meta.env.DEV) {
    console.debug('[Diarias][getSolicitacoes] sem scope frontend, delegado ao RLS');
  }
  if (scope?.criado_por) {
    query = query.eq('criado_por', scope.criado_por);
  }
  if (scope?.centro_custo_ids?.length) {
    query = query.in('centro_custo_id', scope.centro_custo_ids);
  }
  if (scope?.responsavel_campo_id) {
    query = query.eq('responsavel_campo_id', scope.responsavel_campo_id);
  }

  // Filtro por número de solicitação (busca parcial)
  if (filters?.numero_solicitacao) {
    query = query.ilike('numero_solicitacao', `%${filters.numero_solicitacao}%`);
  }

  // Aplicar filtros opcionais do usuário
  if (filters?.periodo_inicio) {
    query = query.gte('data_inicio', filters.periodo_inicio);
  }
  if (filters?.periodo_fim) {
    query = query.lte('data_fim', filters.periodo_fim);
  }
  if (filters?.centro_custo_id) {
    query = query.eq('centro_custo_id', filters.centro_custo_id);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.criado_por && !scope?.criado_por) {
    // Aplicar apenas se não veio do scope
    query = query.eq('criado_por', filters.criado_por);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Erro ao buscar solicitações:', error);
    throw new Error(error.message);
  }

  return (data || []) as unknown as DiariaSolicitacao[];
}

export async function getSolicitacaoById(id: string): Promise<DiariaSolicitacao | null> {
  const { data, error } = await supabase
    .from('bd_diaria_solicitacoes')
    .select(`
      *,
      bd_centros_custo (
        id,
        codigo_centro_custo,
        nome_centro_custo
      )
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Erro ao buscar solicitação:', error);
    throw new Error(error.message);
  }

  if (!data) return null;
  return data as unknown as DiariaSolicitacao;
}

// Função para gerar número de solicitação via RPC (bypass RLS)
async function generateNumeroSolicitacao(): Promise<string> {
  const { data, error } = await supabase.rpc('generate_numero_solicitacao');
  if (error) {
    console.error('Erro ao gerar número de solicitação:', error);
    throw error;
  }
  return data as string;
}

async function getAuthenticatedUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    console.error('[Diarias][createSolicitacao] erro ao obter usuário autenticado', error);
  }

  const userId = data.user?.id;

  if (!userId) {
    throw new Error('Sua sessão expirou. Recarregue a página e tente novamente.');
  }

  return userId;
}

// Verificar duplicidade de funcionários em solicitações com período sobreposto
async function verificarDuplicidadeSolicitacao(
  dataInicio: string,
  dataFim: string,
  convocadosPre: any[],
  solicitacaoAtualId?: string
): Promise<void> {
  const funcionarioIds = (convocadosPre || [])
    .map((c: any) => c.funcionario_id)
    .filter(Boolean);

  if (funcionarioIds.length === 0) return;

  const { data, error } = await supabase.rpc('verificar_duplicidade_solicitacao', {
    p_data_inicio: dataInicio,
    p_data_fim: dataFim,
    p_funcionario_ids: funcionarioIds,
    p_solicitacao_atual_id: solicitacaoAtualId || null,
  });

  if (error) {
    console.error('Erro ao verificar duplicidade:', error);
    return; // Não bloquear em caso de erro na verificação
  }

  const resultado = data as any;
  if (resultado?.duplicada) {
    const nomes = Array.isArray(resultado.funcionarios_conflito)
      ? resultado.funcionarios_conflito.join(', ')
      : '';
    throw new Error(
      `Funcionário(s) ${nomes} já está(ão) na solicitação Nº ${resultado.numero_solicitacao} no mesmo período. Não é possível duplicar.`
    );
  }
}

async function sincronizarConvocadosPreControlado(
  solicitacaoId: string,
  convocadosPre: SolicitacaoFormData['convocados_pre'] = []
): Promise<void> {
  const { data: solicitacaoAtual, error: solicitacaoError } = await supabase
    .from('bd_diaria_solicitacoes')
    .select('convocados_pre')
    .eq('id', solicitacaoId)
    .maybeSingle();

  if (solicitacaoError) {
    throw new Error(solicitacaoError.message);
  }

  const atuais = Array.isArray(solicitacaoAtual?.convocados_pre)
    ? solicitacaoAtual!.convocados_pre as any[]
    : [];

  const atuaisMap = new Map(atuais.map((item) => [item.funcionario_id, item]));
  const novosMap = new Map((convocadosPre || []).map((item) => [item.funcionario_id, item]));

  for (const funcionarioId of atuaisMap.keys()) {
    if (!novosMap.has(funcionarioId)) {
      await removerFuncionarioConvocado(solicitacaoId, funcionarioId);
    }
  }

  for (const convocado of convocadosPre || []) {
    const atual = atuaisMap.get(convocado.funcionario_id);
    if (!atual || JSON.stringify(atual) !== JSON.stringify(convocado)) {
      if (atual) {
        await removerFuncionarioConvocado(solicitacaoId, convocado.funcionario_id);
      }
      await adicionarFuncionarioConvocado(solicitacaoId, {
        funcionario_id: convocado.funcionario_id,
        funcao_id: convocado.funcao_id,
        valor_diaria: convocado.valor_diaria,
        valor_diaria_exclusiva: convocado.valor_diaria_exclusiva,
        valor_refeicao: convocado.valor_refeicao,
        nome_funcionario: convocado.nome_funcionario || '',
        nome_funcao: convocado.nome_funcao || '',
        cpf: convocado.cpf,
        matricula: convocado.matricula,
      });
    }
  }
}

function traduzirErroCriacaoSolicitacao(error: any): string {
  const mensagem = traduzirErroPeriodoSobreposto(error);
  const message = error?.message || '';
  const details = error?.details || '';
  const hint = error?.hint || '';

  if (
    error?.code === '42501' ||
    message.includes('row-level security policy') ||
    details.includes('row-level security policy')
  ) {
    console.error('[Diarias][createSolicitacao] bloqueio RLS detalhado', {
      code: error?.code,
      message,
      details,
      hint,
    });

    if (details.includes('criado_por') || hint.includes('criado_por')) {
      return 'A solicitação precisa ser criada pelo próprio usuário autenticado. Recarregue a tela e tente novamente.';
    }

    if (error?.backendCanCreate === true) {
      return 'O backend reconheceu sua permissão, mas bloqueou a gravação final da solicitação. Tente novamente; se persistir, o erro real foi registrado no console para diagnóstico.';
    }

    return 'Seu perfil não possui permissão de criação de solicitação de diária.';
  }

  return mensagem;
}

export async function createSolicitacao(formData: SolicitacaoFormData): Promise<DiariaSolicitacao> {
  const tipo = formData.tipo_solicitacao || 'normal';

  // Defesa em profundidade da Solicitação NORMAL (estrutura semanal + retroativo + unicidade CC/semana)
  if (tipo === 'normal') {
    await assertSolicitacaoNormalValida({
      centro_custo_id: formData.centro_custo_id,
      data_inicio: formData.data_inicio,
      data_fim: formData.data_fim,
      tipo_solicitacao: 'normal',
      isEditing: false,
    });
  } else {
    // Extraordinária: mantém validação estrutural legada (Seg→Dom 7d) e retroativo só SuperAdm.
    await assertPeriodoEReceitaUsuario(formData.data_inicio, formData.data_fim);
  }

  const currentUserId = await getAuthenticatedUserId();

  const { data: backendCanCreate, error: canCreateError } = await supabase.rpc('fn_diaria_can_create', {
    p_user_id: currentUserId,
  });

  if (canCreateError) {
    console.error('[Diarias][createSolicitacao] erro no preflight fn_diaria_can_create', {
      userId: currentUserId,
      message: canCreateError.message,
      code: canCreateError.code,
      details: canCreateError.details,
      hint: canCreateError.hint,
    });
  }

  if (backendCanCreate === false) {
    throw new Error('Seu perfil não possui permissão de criação de solicitação de diária.');
  }

  // Verificar duplicidade antes de criar
  await verificarDuplicidadeSolicitacao(
    formData.data_inicio,
    formData.data_fim,
    formData.convocados_pre || []
  );

  // Gerar número de solicitação
  const numero_solicitacao = await generateNumeroSolicitacao();
  
  const insertData = {
    numero_solicitacao,
    data_inicio: formData.data_inicio,
    data_fim: formData.data_fim,
    data_inicio_semana: formData.data_inicio_semana || null,
    data_fim_semana: formData.data_fim_semana || null,
    tipo_solicitacao: formData.tipo_solicitacao || 'normal',
    flag_extraordinaria: formData.flag_extraordinaria || false,
    justificativa_extraordinaria: formData.justificativa_extraordinaria || null,
    centro_custo_id: formData.centro_custo_id,
    justificativa: formData.justificativa,
    considera_fds_feriado: formData.considera_fds_feriado ?? false,
    qtde_dias_uteis_estimado: formData.qtde_dias_uteis_estimado ?? 0,
    qtde_fds_estimado: formData.qtde_fds_estimado ?? 0,
    qtde_feriados_estimado: formData.qtde_feriados_estimado ?? 0,
    valor_estimado_total: formData.valor_estimado_total ?? 0,
    criado_por: currentUserId,
    convocados_pre: [],
    regras_operacionais_snapshot: formData.regras_operacionais_por_data ?? { datas: {}, observacao: '', classificacao: 'feriado_ponte_operacional' },
    responsavel_campo_id: formData.responsavel_campo_id || null,
    engenheiro_solicitante_id: formData.engenheiro_solicitante_id || null,
    status: 'rascunho'
  };

  console.info('[Diarias][createSolicitacao] tentativa de criação', {
    centro_custo_id: insertData.centro_custo_id,
    data_inicio: insertData.data_inicio,
    data_fim: insertData.data_fim,
    responsavel_campo_id: insertData.responsavel_campo_id,
    engenheiro_solicitante_id: insertData.engenheiro_solicitante_id,
    convocados_pre_count: formData.convocados_pre?.length || 0,
    flag_extraordinaria: insertData.flag_extraordinaria,
    tipo_solicitacao: insertData.tipo_solicitacao,
  });

  const { data, error } = await supabase
    .from('bd_diaria_solicitacoes')
    .insert(insertData as any);

  if (error) {
    console.error('[Diarias][createSolicitacao] erro ao criar solicitação', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      backendCanCreate,
      insertData,
    });
    throw new Error(traduzirErroCriacaoSolicitacao({ ...error, backendCanCreate }));
  }

  const { data: createdRow, error: createdRowError } = await supabase
    .from('bd_diaria_solicitacoes')
    .select('id')
    .eq('numero_solicitacao', numero_solicitacao)
    .eq('criado_por', currentUserId)
    .maybeSingle();

  if (createdRowError || !createdRow?.id) {
    console.error('[Diarias][createSolicitacao] solicitação criada mas não pôde ser recarregada logo após o insert', {
      numero_solicitacao,
      currentUserId,
      message: createdRowError?.message,
      code: createdRowError?.code,
      details: createdRowError?.details,
      hint: createdRowError?.hint,
    });
    throw new Error('A solicitação foi gravada, mas não pôde ser recarregada automaticamente. Atualize a lista e tente novamente.');
  }

  try {
    await sincronizarConvocadosPreControlado(createdRow.id, formData.convocados_pre || []);
  } catch (syncError: any) {
    console.error('[Diarias][createSolicitacao] erro ao sincronizar convocados após criar solicitação', {
      solicitacaoId: createdRow.id,
      message: syncError?.message,
    });
    await supabase.from('bd_diaria_solicitacoes').delete().eq('id', createdRow.id);
    throw new Error(syncError.message || 'Erro ao validar convocados da solicitação');
  }

  const solicitacaoFinal = await getSolicitacaoById(createdRow.id);

  if (!solicitacaoFinal) {
    throw new Error('Solicitação criada, mas não foi possível recarregar os dados finais.');
  }

  return solicitacaoFinal;
}

// Traduz erros de constraint (sobreposição / duplicidade) em mensagens amigáveis
function traduzirErroPeriodoSobreposto(error: any): string {
  const msg = error?.message || '';

  // Códigos lançados pelo service (Etapa 3 — validação Normal)
  if (msg.includes('NORMAL_DUPLICADA_NA_SEMANA')) {
    const match = msg.match(/NORMAL_DUPLICADA_NA_SEMANA:\s*(.+)/);
    return match?.[1]?.trim() || 'Já existe uma solicitação Normal para este CC nesta semana. Use Extraordinária para necessidades específicas.';
  }
  if (msg.includes('PERIODO_RETROATIVO_INTRASEMANA')) {
    return 'Solicitação retroativa permitida apenas para SuperAdm.';
  }
  if (msg.includes('PERIODO_FORA_SEMANA_OPERACIONAL')) {
    return 'O período selecionado ultrapassa a semana operacional. Crie uma nova solicitação para a próxima semana.';
  }

  if (error?.code === '23P01' || msg.includes('PERIODO_SOBREPOSTO')) {
    const match = msg.match(/PERIODO_SOBREPOSTO:\s*(.+)/);
    if (match?.[1]) return match[1].trim();
    return 'Já existe uma solicitação Normal ativa para este Centro de Custo nesta semana. Use Extraordinária para necessidades específicas.';
  }

  if (msg.includes('FUNCIONARIO_DUPLICADO_NA_DATA')) {
    const match = msg.match(/FUNCIONARIO_DUPLICADO_NA_DATA:\s*(.+)/);
    if (match?.[1]) return match[1].trim();
    return 'Funcionário já possui presença real registrada em outra solicitação ativa nesta data.';
  }

  // Mensagem legada — não é mais disparada pelos triggers atuais (mantida para fallback)
  if (msg.includes('FUNCIONARIO_DUPLICADO_PERIODO')) {
    const match = msg.match(/FUNCIONARIO_DUPLICADO_PERIODO:\s*(.+)/);
    if (match?.[1]) return match[1].trim();
    return 'Funcionário já possui presença em outra solicitação ativa em algum dia deste período.';
  }

  if (msg.includes('chk_justificativa_extraordinaria')) {
    return 'Solicitações Extraordinárias exigem justificativa com pelo menos 20 caracteres.';
  }

  return msg;
}

export async function updateSolicitacao(id: string, formData: Partial<SolicitacaoFormData>): Promise<DiariaSolicitacao> {
  // Defesa em profundidade: se o update toca em data_inicio/data_fim/centro_custo/tipo,
  // re-aplicar validação coerente ao tipo (Normal x Extraordinária).
  const tocaPeriodo = formData.data_inicio !== undefined
    || formData.data_fim !== undefined
    || formData.centro_custo_id !== undefined
    || formData.tipo_solicitacao !== undefined;

  if (tocaPeriodo) {
    // Carrega o registro atual para preencher campos faltantes
    const { data: atual, error: errAtual } = await supabase
      .from('bd_diaria_solicitacoes')
      .select('data_inicio, data_fim, centro_custo_id, tipo_solicitacao')
      .eq('id', id)
      .single();
    if (errAtual) {
      throw new Error('Não foi possível carregar a solicitação para validar o período.');
    }

    const dataInicio = (formData.data_inicio ?? atual?.data_inicio) as string;
    const dataFim = (formData.data_fim ?? atual?.data_fim) as string;
    const centroCustoId = (formData.centro_custo_id ?? atual?.centro_custo_id) as string;
    const tipo = (formData.tipo_solicitacao ?? atual?.tipo_solicitacao ?? 'normal') as 'normal' | 'extraordinaria';

    if (tipo === 'normal') {
      await assertSolicitacaoNormalValida({
        centro_custo_id: centroCustoId,
        data_inicio: dataInicio,
        data_fim: dataFim,
        tipo_solicitacao: 'normal',
        isEditing: true,
        solicitacaoIdAtual: id,
      });
    } else {
      await assertPeriodoEReceitaUsuario(dataInicio, dataFim);
    }
  }

  const updateData: any = {
    updated_at: new Date().toISOString()
  };
  
  if (formData.data_inicio !== undefined) updateData.data_inicio = formData.data_inicio;
  if (formData.data_fim !== undefined) updateData.data_fim = formData.data_fim;
  if (formData.centro_custo_id !== undefined) updateData.centro_custo_id = formData.centro_custo_id;
  if (formData.justificativa !== undefined) updateData.justificativa = formData.justificativa;
  if (formData.considera_fds_feriado !== undefined) updateData.considera_fds_feriado = formData.considera_fds_feriado;
  if (formData.qtde_dias_uteis_estimado !== undefined) updateData.qtde_dias_uteis_estimado = formData.qtde_dias_uteis_estimado;
  if (formData.qtde_fds_estimado !== undefined) updateData.qtde_fds_estimado = formData.qtde_fds_estimado;
  if (formData.qtde_feriados_estimado !== undefined) updateData.qtde_feriados_estimado = formData.qtde_feriados_estimado;
  if (formData.valor_estimado_total !== undefined) updateData.valor_estimado_total = formData.valor_estimado_total;
  if (formData.regras_operacionais_por_data !== undefined) updateData.regras_operacionais_snapshot = formData.regras_operacionais_por_data;
  if (formData.responsavel_campo_id !== undefined) updateData.responsavel_campo_id = formData.responsavel_campo_id || null;
  if (formData.engenheiro_solicitante_id !== undefined) updateData.engenheiro_solicitante_id = formData.engenheiro_solicitante_id || null;
  if (formData.data_inicio_semana !== undefined) updateData.data_inicio_semana = formData.data_inicio_semana || null;
  if (formData.data_fim_semana !== undefined) updateData.data_fim_semana = formData.data_fim_semana || null;
  if (formData.tipo_solicitacao !== undefined) updateData.tipo_solicitacao = formData.tipo_solicitacao;
  if (formData.flag_extraordinaria !== undefined) updateData.flag_extraordinaria = formData.flag_extraordinaria;
  if (formData.justificativa_extraordinaria !== undefined) updateData.justificativa_extraordinaria = formData.justificativa_extraordinaria || null;

  const { data, error } = await supabase
    .from('bd_diaria_solicitacoes')
    .update(updateData)
    .eq('id', id)
    .select(`
      *,
      bd_centros_custo (
        id,
        codigo_centro_custo,
        nome_centro_custo
      )
    `)
    .maybeSingle();

  if (error) {
    console.error('Erro ao atualizar solicitação:', error);
    throw new Error(traduzirErroPeriodoSobreposto(error));
  }

  if (!data) {
    console.warn('[Diarias][updateSolicitacao] UPDATE retornou 0 linhas (possível restrição de RLS no RETURNING). Refazendo SELECT.');
  }

  if (formData.convocados_pre !== undefined) {
    await sincronizarConvocadosPreControlado(id, formData.convocados_pre || []);
  }

  const solicitacaoFinal = await getSolicitacaoById(id);

  if (!solicitacaoFinal) {
    throw new Error('Solicitação atualizada, mas não foi possível recarregar os dados finais.');
  }

  return solicitacaoFinal;
}

export async function deleteSolicitacao(id: string): Promise<void> {
  // Deletar notificações vinculadas à solicitação
  await notificationService.deleteNotificationsByMetadata('solicitacao_id', id);

  // Deletar aprovações relacionadas (sem FK cascade)
  await supabase
    .from('bd_diaria_aprovacoes')
    .delete()
    .eq('entidade_id', id);

  // Deletar solicitação (apontamentos, presenças e convocações são cascateados pelo banco)
  const { error } = await supabase
    .from('bd_diaria_solicitacoes')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Erro ao deletar solicitação:', error);
    throw new Error(error.message);
  }
}

// =====================================================
// AÇÕES DE STATUS
// =====================================================

export async function enviarParaAutorizacao(id: string): Promise<DiariaSolicitacao> {
  // Buscar solicitação para validar duplicidade antes de enviar
  const solicitacao = await getSolicitacaoById(id);
  if (solicitacao) {
    // Re-validar regra Normal (estrutura/retroativo/unicidade semanal) na transição de status,
    // para defender contra payloads obsoletos ou criação alternativa via RPC/painel.
    if ((solicitacao.tipo_solicitacao || 'normal') === 'normal') {
      await assertSolicitacaoNormalValida({
        centro_custo_id: solicitacao.centro_custo_id,
        data_inicio: solicitacao.data_inicio,
        data_fim: solicitacao.data_fim,
        tipo_solicitacao: 'normal',
        isEditing: true, // não re-checar retroativo: já existia
        solicitacaoIdAtual: id,
      });
    }

    await verificarDuplicidadeSolicitacao(
      solicitacao.data_inicio,
      solicitacao.data_fim,
      Array.isArray(solicitacao.convocados_pre) ? solicitacao.convocados_pre as any[] : [],
      id
    );
  }

  const { data, error } = await supabase
    .from('bd_diaria_solicitacoes')
    .update({
      status: 'enviada' as StatusSolicitacao,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select(`
      *,
      bd_centros_custo (
        id,
        codigo_centro_custo,
        nome_centro_custo
      )
    `)
    .maybeSingle();

  if (error) {
    console.error('Erro ao enviar para autorização:', error);
    throw new Error(error.message);
  }

  // Registrar na auditoria
  await registrarAprovacao(id, 'solicitacao', 'enviar');

  if (!data) {
    console.warn('[Diarias][enviarParaAutorizacao] UPDATE retornou 0 linhas. Refazendo SELECT.');
    const refetched = await getSolicitacaoById(id);
    if (!refetched) throw new Error('Solicitação não encontrada após envio.');
    return refetched;
  }

  return data as unknown as DiariaSolicitacao;
}

export async function autorizarSolicitacao(
  id: string, 
  comentario?: string,
  responsavelCampoId?: string,
  observacaoGerente?: string
): Promise<DiariaSolicitacao> {
  const { data: userData } = await supabase.auth.getUser();
  
  const updateData: any = {
    status: 'autorizada' as StatusSolicitacao,
    autorizado_por: userData?.user?.id,
    autorizado_em: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  if (responsavelCampoId) {
    updateData.responsavel_campo_id = responsavelCampoId;
  }
  
  if (observacaoGerente) {
    updateData.observacao_gerente = observacaoGerente;
  }
  
  const { data, error } = await supabase
    .from('bd_diaria_solicitacoes')
    .update(updateData)
    .eq('id', id)
    .select(`
      *,
      bd_centros_custo (
        id,
        codigo_centro_custo,
        nome_centro_custo
      )
    `)
    .maybeSingle();

  if (error) {
    console.error('Erro ao autorizar solicitação:', error);
    throw new Error(error.message);
  }

  // Registrar na auditoria
  await registrarAprovacao(id, 'solicitacao', 'aprovar', comentario || observacaoGerente);

  if (!data) {
    console.warn('[Diarias][autorizarSolicitacao] UPDATE retornou 0 linhas. Refazendo SELECT.');
    const refetched = await getSolicitacaoById(id);
    if (!refetched) throw new Error('Solicitação não encontrada após autorização.');
    return refetched;
  }

  return data as unknown as DiariaSolicitacao;
}

export async function reprovarSolicitacao(
  id: string, 
  comentario?: string,
  observacaoGerente?: string
): Promise<DiariaSolicitacao> {
  const { data: userData } = await supabase.auth.getUser();
  
  const updateData: any = {
    status: 'reprovada' as StatusSolicitacao,
    autorizado_por: userData?.user?.id,
    autorizado_em: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  if (observacaoGerente) {
    updateData.observacao_gerente = observacaoGerente;
  }
  
  const { data, error } = await supabase
    .from('bd_diaria_solicitacoes')
    .update(updateData)
    .eq('id', id)
    .select(`
      *,
      bd_centros_custo (
        id,
        codigo_centro_custo,
        nome_centro_custo
      )
    `)
    .maybeSingle();

  if (error) {
    console.error('Erro ao reprovar solicitação:', error);
    throw new Error(error.message);
  }

  // Registrar na auditoria
  await registrarAprovacao(id, 'solicitacao', 'reprovar', comentario || observacaoGerente);

  if (!data) {
    console.warn('[Diarias][reprovarSolicitacao] UPDATE retornou 0 linhas. Refazendo SELECT.');
    const refetched = await getSolicitacaoById(id);
    if (!refetched) throw new Error('Solicitação não encontrada após reprovação.');
    return refetched;
  }

  return data as unknown as DiariaSolicitacao;
}

export async function cancelarEnvioSolicitacao(id: string): Promise<DiariaSolicitacao> {
  const { data, error } = await supabase
    .from('bd_diaria_solicitacoes')
    .update({
      status: 'rascunho' as StatusSolicitacao,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select(`
      *,
      bd_centros_custo (
        id,
        codigo_centro_custo,
        nome_centro_custo
      )
    `)
    .maybeSingle();

  if (error) {
    console.error('Erro ao cancelar envio:', error);
    throw new Error(error.message);
  }

  // Registrar na auditoria
  await registrarAprovacao(id, 'solicitacao', 'cancelar_envio');

  if (!data) {
    console.warn('[Diarias][cancelarEnvioSolicitacao] UPDATE retornou 0 linhas. Refazendo SELECT.');
    const refetched = await getSolicitacaoById(id);
    if (!refetched) throw new Error('Solicitação não encontrada após cancelar envio.');
    return refetched;
  }

  return data as unknown as DiariaSolicitacao;
}

// =====================================================
// RESUMO E ESTATÍSTICAS
// =====================================================

export async function getSolicitacoesResumo(
  filters?: SolicitacaoFilters,
  scope?: SolicitacaoScopeFilters
): Promise<SolicitacaoResumo> {
  const solicitacoes = await getSolicitacoes(filters, scope);
  
  return {
    total: solicitacoes.length,
    rascunho: solicitacoes.filter(s => s.status === 'rascunho').length,
    enviada: solicitacoes.filter(s => s.status === 'enviada').length,
    autorizada: solicitacoes.filter(s => s.status === 'autorizada').length,
    reprovada: solicitacoes.filter(s => s.status === 'reprovada').length,
  };
}

// =====================================================
// AUDITORIA
// =====================================================

async function registrarAprovacao(
  entidadeId: string, 
  entidade: 'solicitacao' | 'convocacao' | 'relatorio',
  acao: string,
  comentario?: string
): Promise<void> {
  const { error } = await supabase
    .from('bd_diaria_aprovacoes')
    .insert({
      entidade,
      entidade_id: entidadeId,
      acao,
      comentario
    });

  if (error) {
    console.error('Erro ao registrar aprovação:', error);
    // Não lança erro para não interromper o fluxo principal
  }
}

export async function checkSolicitacaoCanBeDeleted(id: string) {
  const [apontamentos, presencas, aprovacoes] = await Promise.all([
    supabase.from('bd_diaria_apontamentos').select('id', { count: 'exact', head: true }).eq('solicitacao_id', id),
    supabase.from('bd_diaria_presencas').select('id', { count: 'exact', head: true }).eq('solicitacao_id', id),
    supabase.from('bd_diaria_aprovacoes').select('id', { count: 'exact', head: true }).eq('entidade_id', id),
  ]);
  return {
    canDelete: true,
    details: {
      totalApontamentos: apontamentos.count || 0,
      totalPresencas: presencas.count || 0,
      totalAprovacoes: aprovacoes.count || 0,
    }
  };
}

export async function cancelarAutorizacao(id: string): Promise<DiariaSolicitacao> {
  // 1. Deletar presenças vinculadas
  await supabase
    .from('bd_diaria_presencas')
    .delete()
    .eq('solicitacao_id', id);

  // 2. Deletar apontamento vinculado
  await supabase
    .from('bd_diaria_apontamentos')
    .delete()
    .eq('solicitacao_id', id);

  // 3. Reverter status para enviada e limpar campos de aprovação
  const { data, error } = await supabase
    .from('bd_diaria_solicitacoes')
    .update({
      status: 'enviada' as StatusSolicitacao,
      autorizado_por: null,
      autorizado_em: null,
      observacao_gerente: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select(`
      *,
      bd_centros_custo (
        id,
        codigo_centro_custo,
        nome_centro_custo
      )
    `)
    .maybeSingle();

  if (error) {
    console.error('Erro ao cancelar autorização:', error);
    throw new Error(error.message);
  }

  // 4. Registrar na auditoria
  await registrarAprovacao(id, 'solicitacao', 'cancelar_autorizacao');

  if (!data) {
    console.warn('[Diarias][cancelarAutorizacao] UPDATE retornou 0 linhas. Refazendo SELECT.');
    const refetched = await getSolicitacaoById(id);
    if (!refetched) throw new Error('Solicitação não encontrada após cancelar autorização.');
    return refetched;
  }

  return data as unknown as DiariaSolicitacao;
}

export async function getHistoricoAprovacoes(entidadeId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('bd_diaria_aprovacoes')
    .select('*')
    .eq('entidade_id', entidadeId)
    .order('feito_em', { ascending: false });

  if (error) {
    console.error('Erro ao buscar histórico:', error);
    throw new Error(error.message);
  }

  return data || [];
}

// =====================================================
// ADICIONAR / REMOVER FUNCIONÁRIO DO CONVOCADOS_PRE
// =====================================================

export interface FuncionarioConvocadoData {
  funcionario_id: string;
  funcao_id: string;
  valor_diaria: number;
  valor_diaria_exclusiva?: number;
  valor_refeicao?: number;
  nome_funcionario: string;
  nome_funcao: string;
  cpf?: string;
  matricula?: string;
}

export async function adicionarFuncionarioConvocado(
  solicitacaoId: string,
  funcionarioData: FuncionarioConvocadoData
): Promise<void> {
  const { error } = await supabase.rpc('gerenciar_convocado_diaria', {
    p_solicitacao_id: solicitacaoId,
    p_funcionario_data: funcionarioData as any,
    p_acao: 'adicionar'
  });

  if (error) throw new Error(error.message);
}

/**
 * Inclusão diária no apontamento: valida duplicidade APENAS na data informada
 * e grava o item em convocados_pre com `data` e `origem_inclusao = 'apontamento_dia'`.
 * Não usa o período (data_inicio/data_fim) da solicitação para validar conflito.
 */
export async function adicionarFuncionarioConvocadoNoDia(
  solicitacaoId: string,
  funcionarioData: FuncionarioConvocadoData,
  dataApontamento: string
): Promise<void> {
  const { error } = await supabase.rpc('gerenciar_convocado_diaria_no_dia' as any, {
    p_solicitacao_id: solicitacaoId,
    p_funcionario_data: funcionarioData as any,
    p_data_apontamento: dataApontamento,
    p_acao: 'adicionar',
  } as any);

  if (error) throw new Error(error.message);
}

/**
 * Inclusão direta em bd_diaria_presencas para o dia selecionado.
 *
 * Cria uma linha "neutra" (presente=false, sem horários, valor=0). A MV
 * mv_relatorio_diarias filtra `presente IS DISTINCT FROM false`, portanto a
 * linha neutra não aparece no relatório financeiro até alguém marcar presença.
 *
 * Idempotente: a UNIQUE (solicitacao_id, funcionario_id, data) garante que
 * cliques repetidos retornem a linha existente em vez de duplicar.
 *
 * Retorna a row completa de bd_diaria_presencas para que o frontend monte o
 * card a partir dos dados reais persistidos no banco.
 */
export type BdDiariaPresencaRow = {
  id: string;
  solicitacao_id: string;
  funcionario_id: string;
  data: string;
  funcao_id: string | null;
  presente: boolean | null;
  hora_entrada: string | null;
  hora_saida: string | null;
  valor_diaria_aplicada: number;
  recebe_refeicao: boolean | null;
  valor_refeicao_aplicado: number | null;
  tipo_apontamento: string | null;
  is_excecao: boolean;
  turno: string;
  tipo_diaria: string | null;
  usar_diaria_exclusiva: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

export async function adicionarPresencaNoDia(
  solicitacaoId: string,
  funcionarioId: string,
  data: string,
  funcaoId: string | null,
  classificacao?: Record<string, unknown>
): Promise<BdDiariaPresencaRow> {
  const { data: row, error } = await supabase
    .rpc('fn_adicionar_funcionario_no_dia' as any, {
      p_solicitacao_id: solicitacaoId,
      p_funcionario_id: funcionarioId,
      p_data: data,
      p_funcao_id: funcaoId,
      p_classificacao: (classificacao ?? {}) as any,
    } as any)
    .single();

  if (error) throw new Error(error.message);
  if (!row) throw new Error('NAO_PERSISTIU_PRESENCA');
  return row as unknown as BdDiariaPresencaRow;
}

export async function removerFuncionarioConvocado(
  solicitacaoId: string,
  funcionarioId: string,
  forcarRemocao?: boolean
): Promise<void> {
  // Se forçar remoção (SuperAdm retroativo), primeiro deletar presenças existentes
  if (forcarRemocao) {
    const { error: delError } = await supabase
      .from('bd_diaria_presencas')
      .delete()
      .eq('solicitacao_id', solicitacaoId)
      .eq('funcionario_id', funcionarioId);
    
    if (delError) throw new Error(`Erro ao remover presenças: ${delError.message}`);
  }

  const { error } = await supabase.rpc('gerenciar_convocado_diaria', {
    p_solicitacao_id: solicitacaoId,
    p_funcionario_data: { funcionario_id: funcionarioId } as any,
    p_acao: 'remover'
  });

  if (error) throw new Error(error.message);
}

// Verificar se funcionário possui PRESENÇA REAL (hora_entrada preenchida)
// em outra solicitação ativa NA MESMA DATA selecionada no apontamento.
// REGRA: bloqueio é por DIA, nunca por período. Convocação planejada
// (sem hora_entrada) NÃO bloqueia — segue como alerta via fn_diaria_funcionario_elegibilidade.
export async function verificarFuncionarioEmOutraSolicitacao(
  funcionarioId: string,
  dataApontamento: string,
  solicitacaoAtualId: string
): Promise<{
  emOutra: boolean;
  numeroSolicitacao?: string;
  solicitacaoId?: string;
  centroCustoCodigo?: string;
  centroCustoNome?: string;
  dataConflito?: string;
}> {
  if (!dataApontamento) {
    return { emOutra: false };
  }

  const { data, error } = await supabase
    .from('bd_diaria_presencas')
    .select(`
      solicitacao_id,
      data,
      bd_diaria_solicitacoes!inner(
        numero_solicitacao,
        status,
        bd_centros_custo ( codigo_centro_custo, nome_centro_custo )
      )
    `)
    .eq('funcionario_id', funcionarioId)
    .eq('data', dataApontamento)
    .not('hora_entrada', 'is', null)
    .neq('solicitacao_id', solicitacaoAtualId)
    .not('bd_diaria_solicitacoes.status', 'in', '(cancelado,cancelada,reprovada)')
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Erro ao verificar duplicidade por dia:', error);
    return { emOutra: false };
  }

  if (!data) return { emOutra: false };

  const sol: any = (data as any).bd_diaria_solicitacoes;
  const cc: any = sol?.bd_centros_custo;
  const dataConflito = (data as any).data as string | undefined;

  // Defesa extra: se vier conflito em data diferente da solicitada, ignora.
  if (dataConflito && dataConflito !== dataApontamento) {
    console.warn('[DIARIA][CONFLITO_IGNORADO_DATA_DIFERENTE]', {
      origem: 'verificarFuncionarioEmOutraSolicitacao',
      selectedDate: dataApontamento,
      conflitoData: dataConflito,
      funcionario_id: funcionarioId,
    });
    return { emOutra: false };
  }

  return {
    emOutra: true,
    solicitacaoId: data.solicitacao_id,
    numeroSolicitacao: sol?.numero_solicitacao,
    centroCustoCodigo: cc?.codigo_centro_custo,
    centroCustoNome: cc?.nome_centro_custo,
    dataConflito,
  };
}
