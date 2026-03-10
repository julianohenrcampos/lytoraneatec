import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

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

    if (!isWeekend && !isHoliday) {
      return new Response(
        JSON.stringify({ message: 'Hoje não é FDS nem feriado. Nenhuma ação.', date: brDate }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Find presences with hora_entrada but no hora_saida for today
    const { data: pendentes, error: fetchError } = await supabase
      .from('bd_diaria_presencas')
      .select('id, funcionario_id, hora_entrada, funcao_id, valor_diaria_aplicada, solicitacao_id, turno')
      .eq('data', brDate)
      .eq('presente', true)
      .not('hora_entrada', 'is', null)
      .is('hora_saida', null)

    if (fetchError) {
      throw new Error(`Erro ao buscar presenças: ${fetchError.message}`)
    }

    if (!pendentes || pendentes.length === 0) {
      return new Response(
        JSON.stringify({ message: 'Nenhuma presença pendente para finalizar.', date: brDate }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
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
      const horas = totalMinutos / 60

      // Determine tipo_diaria
      let tipo_diaria = 'nenhuma'
      let multiplier = 0
      if (horas > 9) { tipo_diaria = 'uma_e_meia'; multiplier = 1.5 }
      else if (horas > 4.33) { tipo_diaria = 'completa'; multiplier = 1 }
      else if (horas > 0) { tipo_diaria = 'meia'; multiplier = 0.5 }

      // Get the base value (valor_diaria_original) from convocados_pre
      // We use the current valor_diaria_aplicada as the base since it was set at start
      const baseValor = p.valor_diaria_aplicada || 0
      // Recalculate: if entrada was already saved, the valor was set based on 'completa'
      // So we need to reverse it. The original value = valor / 1 (completa multiplier)
      // Actually, the valor_diaria_aplicada is already the original * multiplier from start phase
      // At start, tipo is 'completa' so valor = original * 1. So baseValor IS the original.
      const valorFinal = baseValor * multiplier

      const { error: updateError } = await supabase
        .from('bd_diaria_presencas')
        .update({
          hora_saida: horaSaidaPadrao,
          tipo_diaria,
          valor_diaria_aplicada: valorFinal
        })
        .eq('id', p.id)

      if (!updateError) updated++
    }

    return new Response(
      JSON.stringify({ 
        message: `Auto-finalização concluída. ${updated}/${pendentes.length} registros atualizados.`,
        date: brDate,
        isWeekend,
        isHoliday,
        total: pendentes.length,
        updated
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Erro na auto-finalização:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})