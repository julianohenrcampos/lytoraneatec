import {
  auditBackendEvent,
  authenticateEdgeRequest,
  authorizeBackendInvocation,
  corsHeaders,
  createServiceClient,
  getClientIp,
  getRequestId,
  jsonResponse,
} from "../_shared/backend-security.ts";

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = getRequestId(req);
  const ip = getClientIp(req);
  const supabaseAdmin = createServiceClient();
  const auth = await authenticateEdgeRequest(req);

  if (!auth) {
    await auditBackendEvent(supabaseAdmin, {
      auth: null,
      recurso: 'delete-user',
      contexto: 'auth_admin',
      nivelRisco: 'critico',
      permitido: false,
      sucesso: false,
      statusHttp: 401,
      ip,
      requestId,
      erroResumo: 'nao_autenticado',
    });
    return jsonResponse({ error: 'Não autorizado' }, 401);
  }

  try {
    const allowed = await authorizeBackendInvocation(supabaseAdmin, auth, 'delete-user', 'auth_admin');
    if (!allowed) {
      console.error('Caller is not allowed:', auth.email);
      await auditBackendEvent(supabaseAdmin, {
        auth,
        recurso: 'delete-user',
        contexto: 'auth_admin',
        nivelRisco: 'critico',
        permitido: false,
        sucesso: false,
        statusHttp: 403,
        ip,
        requestId,
        erroResumo: 'sem_permissao',
      });
      return jsonResponse({ error: 'Apenas usuários autorizados podem excluir usuários' }, 403);
    }

    // Get the user ID to delete
    const { userId } = await req.json();

    if (!userId) {
      return jsonResponse({ error: 'userId é obrigatório' }, 400);
    }

    // Prevent self-deletion
    if (userId === auth.userId) {
      return jsonResponse({ error: 'Não é possível excluir sua própria conta' }, 400);
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
      return jsonResponse({ error: 'Erro ao excluir perfil do usuário', details: deleteProfileError.message }, 500);
    }

    console.log('Profile deleted successfully');

    // Delete from Supabase Auth
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteAuthError) {
      console.error('Error deleting auth user:', deleteAuthError);
      // Profile was already deleted, but auth deletion failed
      return jsonResponse({ 
        error: 'Perfil excluído, mas erro ao remover autenticação', 
        details: deleteAuthError.message,
        partial: true
      }, 500);
    }

    console.log('Auth user deleted successfully');

    await auditBackendEvent(supabaseAdmin, {
      auth,
      recurso: 'delete-user',
      contexto: 'auth_admin',
      nivelRisco: 'critico',
      permitido: true,
      sucesso: true,
      statusHttp: 200,
      ip,
      requestId,
      payloadResumo: { userId },
      resultadoResumo: { deletedUserId: userId },
    });

    return jsonResponse({ 
      success: true, 
      message: `Usuário ${userToDelete?.email || userId} excluído com sucesso`,
      deletedUser: {
        id: userId,
        email: userToDelete?.email,
        nome: userToDelete?.nome_completo
      }
    }, 200);

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno';
    console.error('Unexpected error:', error);
    await auditBackendEvent(supabaseAdmin, {
      auth,
      recurso: 'delete-user',
      contexto: 'auth_admin',
      nivelRisco: 'critico',
      permitido: true,
      sucesso: false,
      statusHttp: 500,
      ip,
      requestId,
      erroResumo: message,
    });
    return jsonResponse({ error: 'Erro interno do servidor', details: message }, 500);
  }
});
