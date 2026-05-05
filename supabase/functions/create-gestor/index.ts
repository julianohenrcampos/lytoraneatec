import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  checkRbacMapDrift,
  dualWritePersonalizado,
  dualWriteTotal,
  logRbacDualWrite,
  sanitizeError,
  type RbacCounts,
  type RbacStatus,
} from "./_rbac.ts";

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

/**
 * Fase 5A-2 — Telemetria de uso de RBAC legado.
 * - console.warn estruturado (canal primário, sempre).
 * - insert fire-and-forget em bd_permission_audit_logs (canal secundário, best-effort).
 * - Sem PII: apenas event/edge/branch/table/actor_id.
 * - Nunca derruba a edge.
 */
function logLegacyEdge(
  admin: ReturnType<typeof createClient>,
  rota: string,
  payload: Record<string, unknown>,
) {
  const event = 'RBAC_LEGACY_EDGE_CREATE_GESTOR_USED';
  try {
    try { console.warn(JSON.stringify({ event, rota, ...payload })); } catch { /* noop */ }
    try {
      const actorId = (payload.actor_id as string | null | undefined) ?? null;
      void admin
        .from('bd_permission_audit_logs')
        .insert({ user_id: actorId, origem: event, rota, permitido: true } as any)
        .then(() => {}, () => {});
    } catch { /* fire-and-forget */ }
  } catch { /* telemetria nunca quebra a edge */ }
}

Deno.serve(async (req) => {
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

    // Capturar IP e UA para auditoria
    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('cf-connecting-ip') ||
      req.headers.get('x-real-ip') ||
      'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // [Fase 2] Verificação SuperAdm: prioridade RPC has_role, fallback profiles.funcoes (legado mantido)
    // Whitelist de e-mails hardcoded REMOVIDA nesta fase.
    let isSuperAdmin = false;
    let superAdmSource = 'none';

    const { data: hasRoleData, error: hasRoleError } = await supabaseAdmin.rpc('has_role', {
      p_role: 'SuperAdm',
      p_user_id: requestingUser.id,
    });
    if (!hasRoleError && hasRoleData === true) {
      isSuperAdmin = true;
      superAdmSource = 'has_role';
    } else {
      // Fallback legado: profiles.funcoes / funcao_sistema (mantido conforme escopo aprovado)
      logLegacyEdge(supabaseAdmin, 'create-gestor:superadm-fallback-profiles', {
        edge: 'create-gestor',
        branch: 'superadm-fallback-profiles',
        actor_id: requestingUser.id,
      });
      const { data: requestingProfile } = await supabaseAdmin
        .from('profiles')
        .select('funcoes, funcao_sistema')
        .eq('id', requestingUser.id)
        .single();
      if (
        requestingProfile?.funcoes?.includes('SuperAdm') ||
        requestingProfile?.funcao_sistema === 'SuperAdm'
      ) {
        isSuperAdmin = true;
        superAdmSource = 'profiles_legacy';
      }
    }

    if (!isSuperAdmin) {
      console.error('❌ Usuário não é SuperAdmin');
      // Audit log: tentativa negada
      await supabaseAdmin.from('bd_security_audit_log').insert({
        event_type: 'create_gestor_denied',
        rpc_name: 'create-gestor',
        user_id: requestingUser.id,
        ip: clientIp,
        user_agent: userAgent,
        contexto: {
          email_solicitante: requestingUser.email,
          motivo: 'usuario_nao_e_superadm',
          fase: 'fase2_hardening',
        },
      });
      return new Response(
        JSON.stringify({ error: 'Apenas SuperAdmins podem cadastrar gestores' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ SuperAdm validado via: ${superAdmSource}`);

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

        logLegacyEdge(supabaseAdmin, 'create-gestor:read-bd-permissoes', {
          edge: 'create-gestor',
          branch: 'read-bd-permissoes',
          table: 'bd_permissoes',
          actor_id: requestingUser.id,
        });

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
          logLegacyEdge(supabaseAdmin, 'create-gestor:insert-bd-funcoes-permissao', {
            edge: 'create-gestor',
            branch: 'insert-bd-funcoes-permissao',
            table: 'bd_funcoes_permissao',
            actor_id: requestingUser.id,
          });
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
    } else {
      logLegacyEdge(supabaseAdmin, 'create-gestor:write-profiles-funcoes', {
        edge: 'create-gestor',
        branch: 'write-profiles-funcoes',
        table: 'profiles',
        actor_id: requestingUser.id,
      });
    }

    console.log('✅ Gestor criado com sucesso!', {
      id: newUserId,
      email,
      nome_completo,
      tipo_acesso,
      funcoes
    });

    // [Fase 2] Audit log: sucesso
    await supabaseAdmin.from('bd_security_audit_log').insert({
      event_type: 'create_gestor_success',
      rpc_name: 'create-gestor',
      user_id: requestingUser.id,
      target_id: newUserId,
      ip: clientIp,
      user_agent: userAgent,
      contexto: {
        email_solicitante: requestingUser.email,
        gestor_criado_email: email,
        tipo_acesso,
        funcoes,
        superadm_source: superAdmSource,
      },
    });

    // =====================================================================
    // Fase 5B-2.6 — Dual-write RBAC (shadow-safe)
    // Só executa se RBAC_DUAL_WRITE_ENABLED === "true". Default: OFF.
    // Bloco totalmente isolado em try/catch — nunca quebra o legado.
    // =====================================================================
    let rbacStatus: RbacStatus = 'disabled';
    let rbacCounts: RbacCounts | undefined = undefined;

    try {
      const flag = (Deno.env.get('RBAC_DUAL_WRITE_ENABLED') ?? '').trim();

      // Observabilidade da flag (sem PII, sem valor bruto da secret).
      // Fire-and-forget: nunca quebra o fluxo legado.
      // NOTA: bd_permission_audit_logs não possui coluna `contexto`; detalhes
      // (flag_present/flag_length/flag_is_true/target_id/tipo_acesso) ficam
      // apenas no console.warn estruturado.
      try {
        const rawFlag = Deno.env.get('RBAC_DUAL_WRITE_ENABLED') ?? '';
        const flagPresent = rawFlag !== '';
        const flagLength = rawFlag.length;
        const flagIsTrue = flag === 'true';

        void supabaseAdmin
          .from('bd_permission_audit_logs')
          .insert({
            user_id: requestingUser.id,
            origem: 'RBAC_DUAL_WRITE_FLAG_EVAL',
            rota: 'create-gestor',
            permitido: flagIsTrue,
          } as any)
          .then(() => {}, () => {});

        if (!flagIsTrue) {
          void supabaseAdmin
            .from('bd_permission_audit_logs')
            .insert({
              user_id: requestingUser.id,
              origem: 'RBAC_DUAL_WRITE_DISABLED',
              rota: 'create-gestor',
              permitido: false,
            } as any)
            .then(() => {}, () => {});
        }

        try {
          console.warn(JSON.stringify({
            event: 'RBAC_DUAL_WRITE_FLAG_EVAL',
            rota: 'create-gestor',
            flag_present: flagPresent,
            flag_length: flagLength,
            flag_is_true: flagIsTrue,
            target_id: newUserId ?? null,
            tipo_acesso,
          }));
        } catch { /* noop */ }
      } catch { /* telemetria nunca quebra a edge */ }

      if (flag === 'true' && newUserId) {
        // Cliente com JWT do SuperAdm — criado APENAS quando flag ativa.
        const supabaseAsCaller = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          {
            global: { headers: { Authorization: authHeader } },
            auth: { autoRefreshToken: false, persistSession: false },
          }
        );

        const drift = await checkRbacMapDrift(supabaseAdmin);
        if (drift === 'drift') {
          rbacStatus = 'skipped_drift';
          logRbacDualWrite(supabaseAdmin, 'RBAC_DUAL_WRITE_SKIPPED_DRIFT', {
            actor_id: requestingUser.id,
            target_id: newUserId,
            tipo_acesso,
            status: 'skipped_drift',
          });
        } else if (tipo_acesso === 'total') {
          const r = await dualWriteTotal(supabaseAsCaller, supabaseAdmin, newUserId);
          rbacStatus = r.status;
          logRbacDualWrite(supabaseAdmin, 'RBAC_DUAL_WRITE_CREATE_GESTOR_TOTAL', {
            actor_id: requestingUser.id,
            target_id: newUserId,
            tipo_acesso,
            status: r.status,
            error: r.error,
          });
        } else {
          const r = await dualWritePersonalizado(
            supabaseAsCaller,
            supabaseAdmin,
            newUserId,
            funcaoSistema, // já é "Gestor_<Primeiro>_<ts>"
            'Função personalizada (5B-2.6 dual-write)', // sem PII
            permissoes ?? [],
          );
          rbacStatus = r.status;
          rbacCounts = r.counts;
          logRbacDualWrite(supabaseAdmin, 'RBAC_DUAL_WRITE_CREATE_GESTOR_PERSONALIZADO', {
            actor_id: requestingUser.id,
            target_id: newUserId,
            tipo_acesso,
            status: r.status,
            counts: r.counts,
            error: r.error,
          });
        }
      }
    } catch (rbacErr) {
      rbacStatus = 'failed';
      try {
        logRbacDualWrite(supabaseAdmin, 'RBAC_DUAL_WRITE_FAILED', {
          actor_id: requestingUser.id,
          target_id: newUserId ?? null,
          tipo_acesso,
          status: 'failed',
          error: sanitizeError(rbacErr),
        });
      } catch { /* nunca quebrar legado */ }
    }

    // Retorno legado preservado. rbac_status só é incluído se ≠ 'disabled'
    // (omissão garante zero impacto no frontend quando flag desligada).
    const responseData: Record<string, unknown> = {
      id: newUserId,
      email,
      nome_completo,
      tipo_acesso,
      funcoes,
    };
    if (rbacStatus !== 'disabled') {
      responseData.rbac_status = rbacStatus;
      if (rbacCounts) responseData.rbac_counts = rbacCounts;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Gestor cadastrado com sucesso! Já pode fazer login.',
        data: responseData,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('❌ Erro inesperado:', error);
    return new Response(
      JSON.stringify({ error: `Erro interno: ${error.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
