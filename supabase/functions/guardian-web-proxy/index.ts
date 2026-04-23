import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GUARDIAN_BASE_URL = "https://www.guardianweb.online/webservicev1gw"
const GUARDIAN_AUTH_ENDPOINT = `${GUARDIAN_BASE_URL}/v1/autenticar`
const GUARDIAN_ABAST_ENDPOINT = `${GUARDIAN_BASE_URL}/v2/listar/abastecimentos`

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AuthRequest {
  username: string
  password: string
}

interface AbastecimentoRequest {
  token: string
  placa?: string
  frota?: string
  dataIni?: string
  dataFim?: string
  saveToCache?: boolean
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const path = url.pathname

    // Endpoint: Authenticate
    if (path.includes('/authenticate') && req.method === 'POST') {
      const { username, password } = await req.json() as AuthRequest

      if (!username || !password) {
        return new Response(
          JSON.stringify({ erro: 'Username e password são obrigatórios' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('🔐 Autenticando usuário:', username)

      const response = await fetch(GUARDIAN_AUTH_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ login: username, senha: password })
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('❌ Falha na autenticação:', data)
        return new Response(
          JSON.stringify({ erro: data.erros?.[0] || 'Falha na autenticação' }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('✅ Autenticação bem-sucedida')
      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Endpoint: Get Abastecimentos
    if (path.includes('/abastecimentos') && req.method === 'POST') {
      const { token, placa, frota, dataIni, dataFim, saveToCache = true } = await req.json() as AbastecimentoRequest

      if (!token) {
        return new Response(
          JSON.stringify({ erro: 'Token é obrigatório' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('🔍 Buscando abastecimentos:', { placa, frota, dataIni, dataFim })

      const params = new URLSearchParams()
      if (placa) params.append('placa', placa.toUpperCase())
      if (frota) params.append('frota', frota.toUpperCase())
      if (dataIni) params.append('dataIni', dataIni)
      if (dataFim) params.append('dataFim', dataFim)

      const response = await fetch(`${GUARDIAN_ABAST_ENDPOINT}?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('❌ Erro ao buscar abastecimentos:', data)
        return new Response(
          JSON.stringify({ erro: data.erros?.[0] || 'Erro ao buscar abastecimentos' }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const abastecimentos = data.dados || []
      console.log(`✅ ${abastecimentos.length} abastecimentos encontrados`)

      // Salvar no cache do Supabase se solicitado
      if (saveToCache && abastecimentos.length > 0) {
        try {
          const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
          )

          const registrosParaInserir = abastecimentos.map((abast: any) => ({
            identificador: abast.identificador,
            tipo_procedimento: abast.tipo_procedimento,
            data_abast: abast.data_abast?.split('T')[0],
            hora_abast: abast.hora_abast,
            comboista: abast.comboista?.toString(),
            comboista_tag: abast.comboista_tag,
            operador: abast.operador,
            operador_tag: abast.operador_tag,
            frota: abast.frota,
            frota_tag: abast.frota_tag,
            placa: abast.placa,
            combustivel: abast.combustivel,
            litragem: parseFloat(abast.litragem) || null,
            bico: abast.bico,
            estoque: abast.estoque,
            medidor: parseFloat(abast.medidor) || null,
            medidor_anterior_valor: parseFloat(abast.medidor_anterior_valor) || null,
            medidor_anterior_data: abast.medidor_anterior_data,
            encerrante_fim: parseFloat(abast.encerrante_fim) || null,
            cc: abast.cc,
            latitude: parseFloat(abast.latitude) || null,
            longitude: parseFloat(abast.longitude) || null,
            identificacao_do_ponto: abast.identificacao_do_ponto,
            operacao: abast.operacao,
            medidor_via_entrada: abast.medidor_via_entrada,
            medidor_unidade: abast.medidor_unidade,
            codigo_terceiro: abast.codigo_terceiro,
            foto_verificada: abast.foto_verificada || false,
            registro_editado_em: abast.registro_editado_em,
            registrado_editado_por: abast.registrado_editado_por,
            data_integracao: new Date().toISOString()
          }))

          const { error: upsertError } = await supabaseClient
            .from('bd_abastecimentos')
            .upsert(registrosParaInserir, { onConflict: 'identificador' })

          if (upsertError) {
            console.error('⚠️ Erro ao salvar no cache:', upsertError)
          } else {
            console.log(`💾 ${registrosParaInserir.length} registros salvos no cache`)
          }
        } catch (cacheError) {
          console.error('⚠️ Erro ao processar cache:', cacheError)
        }
      }

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ erro: 'Rota não encontrada' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Erro fatal na Edge Function:', error)
    return new Response(
      JSON.stringify({ erro: error.message || 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
