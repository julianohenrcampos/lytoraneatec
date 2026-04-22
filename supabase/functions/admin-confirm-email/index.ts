
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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

interface ConfirmEmailRequest {
  email: string;
  setTemporaryPassword?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = getRequestId(req);
  const ip = getClientIp(req);
  const supabaseAdmin = createServiceClient();
  const auth = await authenticateEdgeRequest(req);

  if (!auth) {
    await auditBackendEvent(supabaseAdmin, {
      auth: null,
      recurso: "admin-confirm-email",
      contexto: "auth_admin",
      nivelRisco: "critico",
      permitido: false,
      sucesso: false,
      statusHttp: 401,
      ip,
      requestId,
      erroResumo: "nao_autenticado",
    });
    return jsonResponse({ error: "Não autorizado" }, 401);
  }

  try {
    const allowed = await authorizeBackendInvocation(supabaseAdmin, auth, "admin-confirm-email", "auth_admin");
    if (!allowed) {
      await auditBackendEvent(supabaseAdmin, {
        auth,
        recurso: "admin-confirm-email",
        contexto: "auth_admin",
        nivelRisco: "critico",
        permitido: false,
        sucesso: false,
        statusHttp: 403,
        ip,
        requestId,
        erroResumo: "sem_permissao",
      });
      return jsonResponse({ error: "Sem permissão para confirmar emails" }, 403);
    }

    const { email, setTemporaryPassword = false }: ConfirmEmailRequest = await req.json();

    if (!email) {
      await auditBackendEvent(supabaseAdmin, {
        auth,
        recurso: "admin-confirm-email",
        contexto: "auth_admin",
        nivelRisco: "critico",
        permitido: true,
        sucesso: false,
        statusHttp: 400,
        ip,
        requestId,
        payloadResumo: { setTemporaryPassword },
        erroResumo: "email_obrigatorio",
      });
      return jsonResponse({ error: "Email é obrigatório" }, 400);
    }

    console.log(`🔧 [ADMIN-CONFIRM-EMAIL] Processando: ${email}`);

    // Buscar o usuário pelo email
    const { data: users, error: getUserError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (getUserError) {
      console.error("❌ Erro ao buscar usuários:", getUserError);
      return jsonResponse({ error: "Erro ao buscar usuário" }, 500);
    }

    const user = users.users.find(u => u.email === email);
    
    if (!user) {
      await auditBackendEvent(supabaseAdmin, {
        auth,
        recurso: "admin-confirm-email",
        contexto: "auth_admin",
        nivelRisco: "critico",
        permitido: true,
        sucesso: false,
        statusHttp: 404,
        ip,
        requestId,
        payloadResumo: { email, setTemporaryPassword },
        erroResumo: "usuario_nao_encontrado",
      });
      return jsonResponse({ error: "Usuário não encontrado no Auth" }, 404);
    }

    console.log(`✅ [ADMIN-CONFIRM-EMAIL] Usuário encontrado: ${user.id}`);

    // Confirmar o email do usuário
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { email_confirm: true }
    );

    if (updateError) {
      console.error("❌ Erro ao confirmar email:", updateError);
      return jsonResponse({ error: "Erro ao confirmar email" }, 500);
    }

    console.log(`✅ [ADMIN-CONFIRM-EMAIL] Email confirmado para: ${email}`);

    // Se solicitado, definir senha temporária
    let temporaryPassword = null;
    if (setTemporaryPassword) {
      // Gerar senha temporária segura
      temporaryPassword = `Temp${Math.random().toString(36).slice(2)}${Date.now().toString().slice(-4)}!`;
      
      const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
        user.id,
        { password: temporaryPassword }
      );

      if (passwordError) {
        console.error("❌ Erro ao definir senha temporária:", passwordError);
        // Não falhar completamente, apenas avisar
        console.warn("⚠️ Email confirmado, mas senha temporária não foi definida");
      } else {
        console.log(`🔑 [ADMIN-CONFIRM-EMAIL] Senha temporária definida para: ${email}`);
      }
    }

    await auditBackendEvent(supabaseAdmin, {
      auth,
      recurso: "admin-confirm-email",
      contexto: "auth_admin",
      nivelRisco: "critico",
      permitido: true,
      sucesso: true,
      statusHttp: 200,
      ip,
      requestId,
      payloadResumo: { email, setTemporaryPassword },
      resultadoResumo: { user_id: user.id, has_password: !!temporaryPassword },
    });

    return jsonResponse({ 
      success: true, 
      message: `Email ${email} confirmado com sucesso`,
      user_id: user.id,
      temporary_password: temporaryPassword,
      has_password: temporaryPassword ? true : false
    });

  } catch (error: any) {
    console.error("❌ Erro na função admin-confirm-email:", error);
    await auditBackendEvent(supabaseAdmin, {
      auth,
      recurso: "admin-confirm-email",
      contexto: "auth_admin",
      nivelRisco: "critico",
      permitido: true,
      sucesso: false,
      statusHttp: 500,
      ip,
      requestId,
      erroResumo: error?.message ?? "erro_interno",
    });
    return jsonResponse({ error: error.message }, 500);
  }
};

serve(handler);
