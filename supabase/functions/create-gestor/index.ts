import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateGestorRequest {
  email: string;
  password: string;
  nome_completo: string;
  tipo_acesso: 'total' | 'personalizado';
  permissoes?: string[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Iniciando criação de gestor...');

    // Criar cliente Supabase com service_role para operações admin
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Verificar se quem está chamando é SuperAdmin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('❌ Token de autorização não fornecido');
      return new Response(
        JSON.stringify({ error: 'Token de autorização não fornecido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar usuário que está fazendo a requisição
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !requestingUser) {
      console.error('❌ Usuário não autenticado:', authError);
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('👤 Usuário solicitante:', requestingUser.email);

    // Verificar se é SuperAdmin
    const superAdminEmails = ['julianohcampos@yahoo.com.br', 'ramonvalentevalente@gmail.com'];
    const { data: requestingProfile } = await supabaseAdmin
      .from('profiles')
      .select('funcoes, funcao_sistema')
      .eq('id', requestingUser.id)
      .single();

    const isSuperAdmin = 
      superAdminEmails.includes(requestingUser.email || '') ||
      requestingProfile?.funcoes?.includes('SuperAdm') ||
      requestingProfile?.funcao_sistema === 'SuperAdm';

    if (!isSuperAdmin) {
      console.error('❌ Usuário não é SuperAdmin');
      return new Response(
        JSON.stringify({ error: 'Apenas SuperAdmins podem cadastrar gestores' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: CreateGestorRequest = await req.json();
    const { email, password, nome_completo, tipo_acesso, permissoes } = body;

    console.log('📋 Dados recebidos:', { email, nome_completo, tipo_acesso, permissoes: permissoes?.length });

    // Validações
    if (!email || !password || !nome_completo || !tipo_acesso) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios: email, password, nome_completo, tipo_acesso' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Senha deve ter no mínimo 6 caracteres' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se email já existe
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existingProfile) {
      console.error('❌ Email já cadastrado:', email);
      return new Response(
        JSON.stringify({ error: 'Este email já está cadastrado no sistema' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar usuário no Auth com email_confirm: true (pula verificação)
    console.log('🔐 Criando usuário no Auth...');
    const { data: authData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase(),
      password,
      email_confirm: true, // IMPORTANTE: Não exige confirmação de email!
      user_metadata: {
        nome_completo,
        tipo_acesso,
      }
    });

    if (createUserError) {
      console.error('❌ Erro ao criar usuário:', createUserError);
      
      // Mensagens de erro específicas
      if (createUserError.message.includes('already registered')) {
        return new Response(
          JSON.stringify({ error: 'Este email já está registrado' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: `Erro ao criar usuário: ${createUserError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const newUserId = authData.user?.id;
    console.log('✅ Usuário criado no Auth:', newUserId);

    // Determinar funções baseado no tipo de acesso
    let funcoes: string[] = [];
    let funcaoSistema: string;
    let funcaoPermissaoId: string | null = null;

    if (tipo_acesso === 'total') {
      funcoes = ['SuperAdm'];
      funcaoSistema = 'SuperAdm';
      console.log('🌐 Configurando acesso total (SuperAdm)');
    } else {
      funcoes = ['Gestor'];
      funcaoSistema = 'Gestor';
      console.log('⚙️ Configurando acesso personalizado');

      // Se personalizado, criar ou buscar função "Gestor" com permissões específicas
      if (permissoes && permissoes.length > 0) {
        console.log('🔍 Buscando UUIDs das permissões:', permissoes);
        
        // Converter nomes de permissões para UUIDs
        const { data: permissoesDb, error: permError } = await supabaseAdmin
          .from('bd_permissoes')
          .select('id, nome_permissao')
          .in('nome_permissao', permissoes);

        if (permError) {
          console.error('❌ Erro ao buscar permissões:', permError);
        }

        // Extrair apenas os UUIDs
        const permissoesUuids = permissoesDb?.map(p => p.id) || [];
        console.log('🔑 Permissões convertidas para UUIDs:', permissoesUuids.length, 'de', permissoes.length);
        
        // Log permissões não encontradas para debug
        if (permissoesDb) {
          const encontradas = permissoesDb.map(p => p.nome_permissao);
          const naoEncontradas = permissoes.filter(p => !encontradas.includes(p));
          if (naoEncontradas.length > 0) {
            console.warn('⚠️ Permissões não encontradas no banco:', naoEncontradas);
          }
        }

        // Criar função personalizada para este gestor
        const funcaoNome = `Gestor_${nome_completo.split(' ')[0]}_${Date.now()}`;
        
        const { data: novaFuncao, error: funcaoError } = await supabaseAdmin
          .from('bd_funcoes_permissao')
          .insert({
            nome_funcao: funcaoNome,
            descricao: `Função personalizada para ${nome_completo}`,
            permissoes: permissoesUuids // UUIDs em vez de strings!
          })
          .select()
          .single();

        if (funcaoError) {
          console.warn('⚠️ Erro ao criar função personalizada:', funcaoError);
        } else {
          funcaoPermissaoId = novaFuncao.id;
          funcoes = [funcaoNome];
          funcaoSistema = funcaoNome;
          console.log('✅ Função personalizada criada:', funcaoNome, 'com', permissoesUuids.length, 'permissões');
        }
      }
    }

    // Atualizar perfil do usuário
    console.log('📝 Atualizando perfil do usuário...');
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        nome_completo,
        funcoes,
        funcao_sistema: funcaoSistema,
        funcao_permissao: funcaoPermissaoId,
        acesso_global: true, // Gestores sempre têm acesso global
        funcionario_id: null, // Não vinculado a funcionário
        updated_at: new Date().toISOString()
      })
      .eq('id', newUserId);

    if (profileError) {
      console.error('⚠️ Erro ao atualizar perfil:', profileError);
      // Não falha completamente, usuário já foi criado
    }

    console.log('✅ Gestor criado com sucesso!', {
      id: newUserId,
      email,
      nome_completo,
      tipo_acesso,
      funcoes
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Gestor cadastrado com sucesso! Já pode fazer login.',
        data: {
          id: newUserId,
          email,
          nome_completo,
          tipo_acesso,
          funcoes
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Erro inesperado:', error);
    return new Response(
      JSON.stringify({ error: `Erro interno: ${error.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
