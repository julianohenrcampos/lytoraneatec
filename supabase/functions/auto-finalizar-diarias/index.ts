import {
  auditBackendEvent,
  authenticateEdgeRequest,
  authorizeBackendInvocation,
  corsHeaders,
  createServiceClient,
  getClientIp,
  getRequestId,
  jsonResponse,
} from '../_shared/backend-security.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const requestId = getRequestId(req)
  const ip = getClientIp(req)
  const supabase = createServiceClient()
  const auth = await authenticateEdgeRequest(req, { allowApiKey: true, apiKeySecretNames: ['LYTOTEC_API_KEY'] })

  if (!auth) {
    await auditBackendEvent(supabase, {
      auth: null,
      recurso: 'auto-finalizar-diarias',
      contexto: 'diarias',
      nivelRisco: 'alto',
      permitido: false,
      sucesso: false,
      statusHttp: 401,
      ip,
      requestId,
      erroResumo: 'nao_autenticado',
    })
    return jsonResponse({ error: 'Não autorizado' }, 401)
  }

  try {
    const allowed = await authorizeBackendInvocation(supabase, auth, 'auto-finalizar-diarias', 'diarias')
    if (!allowed) {
      await auditBackendEvent(supabase, {
        auth,
        recurso: 'auto-finalizar-diarias',
        contexto: 'diarias',
        nivelRisco: 'alto',
        permitido: false,
        sucesso: false,
        statusHttp: 403,
        ip,
        requestId,
        erroResumo: 'sem_permissao',
      })
      return jsonResponse({ error: 'Sem permissão para executar a rotina' }, 403)
    }

    // Get today's date in Brazil timezone
    const now = new Date()
    const brDate = now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
    
    // Check day of week (0=Sun, 6=Sat)
    const brNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
    const dayOfWeek = brNow.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

    // Check if today is a holiday
    const { data: feriados } = await supabase
      .from('bd_feriados')
      .select('id')
      .eq('data', brDate)
      .limit(1)
    
    const isHoliday = (feriados && feriados.length > 0)
    // Dia exclusivo = sábado, domingo ou feriado
    const isDiaExclusivo = isWeekend || isHoliday

    if (!isWeekend && !isHoliday) {
      return jsonResponse({ message: 'Hoje não é FDS nem feriado. Nenhuma ação.', date: brDate })
    }

    // Find presences with hora_entrada but no hora_saida for today
    const { data: pendentes, error: fetchError } = await supabase
      .from('bd_diaria_presencas')
      .select('id, funcionario_id, hora_entrada, funcao_id, valor_diaria_aplicada, solicitacao_id, turno, recebe_refeicao, valor_refeicao_aplicado, usar_diaria_exclusiva')
      .eq('data', brDate)
      .eq('presente', true)
      .not('hora_entrada', 'is', null)
      .is('hora_saida', null)

    if (fetchError) {
      throw new Error(`Erro ao buscar presenças: ${fetchError.message}`)
    }

    if (!pendentes || pendentes.length === 0) {
      return jsonResponse({ message: 'Nenhuma presença pendente para finalizar.', date: brDate })
    }

    // For exclusive days, fetch convocados_pre from solicitações to get correct exclusive values
    const solicitacaoIds = [...new Set(pendentes.map(p => p.solicitacao_id))];
    const { data: solicitacoes } = await supabase
      .from('bd_diaria_solicitacoes')
      .select('id, convocados_pre')
      .in('id', solicitacaoIds)

    const solicitacoesMap = new Map<string, any[]>();
    (solicitacoes || []).forEach(s => {
      const convocados = Array.isArray(s.convocados_pre) ? s.convocados_pre : [];
      solicitacoesMap.set(s.id, convocados);
    });

    // Fallback: buscar valores oficiais de bd_funcoes (por função) para garantir valor exclusivo em FDS/feriado
    const funcaoIds = [...new Set(pendentes.map(p => p.funcao_id).filter(Boolean))] as string[];
    const funcoesMap = new Map<string, { valor_diaria: number; valor_diaria_exclusiva: number | null }>();
    if (funcaoIds.length > 0) {
      const { data: funcoes } = await supabase
        .from('bd_funcoes')
        .select('id, valor_diaria, valor_diaria_exclusiva')
        .in('id', funcaoIds);
      (funcoes || []).forEach(f => funcoesMap.set(f.id, {
        valor_diaria: Number(f.valor_diaria) || 0,
        valor_diaria_exclusiva: f.valor_diaria_exclusiva != null ? Number(f.valor_diaria_exclusiva) : null,
      }));
    }

    // Calculate jornada for each record and update
    let updated = 0
    for (const p of pendentes) {
      // Determine default exit time based on turno
      const isNoturno = p.turno === 'noturno'
      const horaSaidaPadrao = isNoturno ? '07:00' : '16:00'
      const [hSaida, mSaida] = horaSaidaPadrao.split(':').map(Number)

      // Calculate hours worked
      const [hE, mE] = (p.hora_entrada as string).split(':').map(Number)
      let totalMinutos = (hSaida * 60 + mSaida) - (hE * 60 + mE)
      if (totalMinutos < 0) totalMinutos += 24 * 60
      const horasBrutas = totalMinutos / 60
      // Descontar 1h de almoço se jornada bruta > 6h
      const horas = horasBrutas > 6 ? horasBrutas - 1 : horasBrutas

      // Determine tipo_diaria
      let tipo_diaria = 'nenhuma'
      let multiplier = 0
      if (horas >= 9.75) { tipo_diaria = 'uma_e_meia'; multiplier = 1.5 }
      else if (horas >= 4.5) { tipo_diaria = 'completa'; multiplier = 1 }
      else if (horas > 0) { tipo_diaria = 'meia'; multiplier = 0.5 }

      // Get the correct base value for dia exclusivo
      // Look up convocados_pre to find valor_diaria_exclusiva
      const convocados = solicitacoesMap.get(p.solicitacao_id) || [];
      const convocado = convocados.find((c: any) => c.funcionario_id === p.funcionario_id);
      const funcaoInfo = p.funcao_id ? funcoesMap.get(p.funcao_id) : undefined;

      let baseValor: number;
      if (isDiaExclusivo) {
        // Prioridade: bd_funcoes.valor_diaria_exclusiva > convocado.valor_diaria_exclusiva > convocado.valor_diaria > valor_diaria_aplicada
        baseValor = (funcaoInfo?.valor_diaria_exclusiva
          ?? convocado?.valor_diaria_exclusiva
          ?? convocado?.valor_diaria
          ?? p.valor_diaria_aplicada
          ?? 0) as number;
      } else {
        baseValor = (funcaoInfo?.valor_diaria ?? p.valor_diaria_aplicada ?? 0) as number;
      }
      
      const valorFinal = baseValor * multiplier

      // Always persist refeição — fill from convocado if missing
      let recebeRefeicao = p.recebe_refeicao;
      let valorRefeicao = p.valor_refeicao_aplicado;
      
      // If recebe_refeicao is null, default to true
      if (recebeRefeicao === null || recebeRefeicao === undefined) {
        recebeRefeicao = true;
      }
      
      // If receives meal but value is missing, fill from convocado
      if (recebeRefeicao && (!valorRefeicao || valorRefeicao === 0) && convocado) {
        valorRefeicao = convocado.valor_refeicao || 0;
      }
      
      // If doesn't receive meal, zero out
      if (!recebeRefeicao) {
        valorRefeicao = 0;
      }

      const updateData: Record<string, any> = {
        hora_saida: horaSaidaPadrao,
        tipo_diaria,
        valor_diaria_aplicada: valorFinal,
        usar_diaria_exclusiva: isDiaExclusivo,
        recebe_refeicao: recebeRefeicao,
        valor_refeicao_aplicado: valorRefeicao || 0,
      };

      const { error: updateError } = await supabase
        .from('bd_diaria_presencas')
        .update(updateData)
        .eq('id', p.id)

      if (!updateError) updated++
    }

    await auditBackendEvent(supabase, {
      auth,
      recurso: 'auto-finalizar-diarias',
      contexto: 'diarias',
      nivelRisco: 'alto',
      permitido: true,
      sucesso: true,
      statusHttp: 200,
      ip,
      requestId,
      resultadoResumo: { total: pendentes.length, updated, isDiaExclusivo },
    })

    return jsonResponse({ 
      message: `Auto-finalização concluída. ${updated}/${pendentes.length} registros atualizados.`,
      date: brDate,
      isWeekend,
      isHoliday,
      isDiaExclusivo,
      total: pendentes.length,
      updated
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno'
    console.error('Erro na auto-finalização:', error)
    await auditBackendEvent(supabase, {
      auth,
      recurso: 'auto-finalizar-diarias',
      contexto: 'diarias',
      nivelRisco: 'alto',
      permitido: true,
      sucesso: false,
      statusHttp: 500,
      ip,
      requestId,
      erroResumo: message,
    })
    return jsonResponse({ error: message }, 500)
  }
})
