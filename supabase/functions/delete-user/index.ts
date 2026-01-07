import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get the authorization header to verify the caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the caller's JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !caller) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Caller verified:', caller.id, caller.email);

    // Check if caller is SuperAdmin
    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('funcoes, funcao_sistema')
      .eq('id', caller.id)
      .single();

    if (profileError) {
      console.error('Error fetching caller profile:', profileError);
      return new Response(
        JSON.stringify({ error: 'Erro ao verificar permissões' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isSuperAdmin = 
      callerProfile?.funcoes?.includes('SuperAdm') || 
      callerProfile?.funcao_sistema === 'SuperAdm';

    if (!isSuperAdmin) {
      console.error('Caller is not SuperAdmin:', caller.email);
      return new Response(
        JSON.stringify({ error: 'Apenas SuperAdmins podem excluir usuários' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the user ID to delete
    const { userId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prevent self-deletion
    if (userId === caller.id) {
      return new Response(
        JSON.stringify({ error: 'Não é possível excluir sua própria conta' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Attempting to delete user:', userId);

    // Get user info before deletion for logging
    const { data: userToDelete } = await supabaseAdmin
      .from('profiles')
      .select('email, nome_completo')
      .eq('id', userId)
      .single();

    console.log('User to delete:', userToDelete);

    // Delete from profiles table first (due to foreign key)
    const { error: deleteProfileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (deleteProfileError) {
      console.error('Error deleting profile:', deleteProfileError);
      return new Response(
        JSON.stringify({ error: 'Erro ao excluir perfil do usuário', details: deleteProfileError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Profile deleted successfully');

    // Delete from Supabase Auth
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteAuthError) {
      console.error('Error deleting auth user:', deleteAuthError);
      // Profile was already deleted, but auth deletion failed
      return new Response(
        JSON.stringify({ 
          error: 'Perfil excluído, mas erro ao remover autenticação', 
          details: deleteAuthError.message,
          partial: true
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Auth user deleted successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Usuário ${userToDelete?.email || userId} excluído com sucesso`,
        deletedUser: {
          id: userId,
          email: userToDelete?.email,
          nome: userToDelete?.nome_completo
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
