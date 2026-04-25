import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SignJWT } from "https://esm.sh/jose@5.9.6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Cache-Control": "no-store",
};

type RoleMatrixEntry = {
  roleName: "AdmEquipamentos" | "Operador" | "Usuário";
  permissionCodes: string[];
};

type SuperAdminConfig = {
  email: string;
  roleName: "SuperAdm";
};

const ROLE_MATRIX: RoleMatrixEntry[] = [
  {
    roleName: "AdmEquipamentos",
    permissionCodes: [
      "dashboard_view",
      "dashboard_maquinas_view",
      "gestao_maquinas_caminhoes_view",
      "gestao_maquinas_relatorio_medicao_view",
      "gestao_maquinas_usinas_view",
      "requisicoes_cadastro_view",
      "requisicoes_chamados_os_view",
      "requisicoes_gestao_os_view",
      "requisicoes_apontamento_caminhoes_view",
      "requisicoes_apontamento_equipe_view",
      "gestao_rh_centros_custo_view",
      "gestao_rh_empresas_view",
    ],
  },
  {
    roleName: "Operador",
    permissionCodes: [
      "dashboard_view",
      "requisicoes_apontamento_equipe_view",
      "requisicoes_apontamento_caminhoes_view",
      "diarias_apontamento_view",
      "diarias_view",
      "diarias_solicitacoes_view",
    ],
  },
  {
    roleName: "Usuário",
    permissionCodes: ["dashboard_view"],
  },
];

const ACTION = "visualizar";
const INTERNAL_API_KEY_SECRET_NAMES = ["FIX_EMPTY_RBAC_ROLES_API_KEY", "LYTOTEC_API_KEY", "LOVABLE_API_KEY"] as const;
const SUPER_ADMIN_CONFIG: SuperAdminConfig = {
  email: "julianohcampos@yahoo.com.br",
  roleName: "SuperAdm",
};

async function buildSuperAdminAuthHeader(userId: string, email: string) {
  const jwtSecret = Deno.env.get("SUPABASE_JWT_SECRET") ?? Deno.env.get("JWT_SECRET");

  if (!jwtSecret) {
    throw new Error("JWT secret não disponível para execução interna controlada");
  }

  const secret = new TextEncoder().encode(jwtSecret);
  const token = await new SignJWT({
    sub: userId,
    email,
    role: "authenticated",
    aud: "authenticated",
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(secret);

  return `Bearer ${token}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Método não permitido" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const apiKey = req.headers.get("x-api-key");
    const isInternalCall = INTERNAL_API_KEY_SECRET_NAMES.some((secretName) => {
      const expected = Deno.env.get(secretName);
      return !!expected && !!apiKey && expected === apiKey;
    });

    if (!isInternalCall && !authHeader?.startsWith("Bearer ")) {
      return json({ error: "Não autorizado" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (!isInternalCall) {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader! } },
      });

      const token = authHeader!.replace("Bearer ", "");
      const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
      if (claimsErr || !claimsData?.claims?.sub) {
        return json({ error: "Token inválido" }, 401);
      }

      const userId = String(claimsData.claims.sub);
      const { data: isSuper, error: superErr } = await admin.rpc("is_super_admin", {
        p_user_id: userId,
      });

      if (superErr) {
        return json({ error: superErr.message }, 500);
      }

      if (!isSuper) {
        return json({ error: "Acesso negado" }, 403);
      }
    }

    const roleNames = [...new Set([...ROLE_MATRIX.map((entry) => entry.roleName), SUPER_ADMIN_CONFIG.roleName])];
    const minimalPermissionCodes = [...new Set(ROLE_MATRIX.flatMap((entry) => entry.permissionCodes))];

    const [{ data: roles, error: rolesError }, { data: minimalPermissions, error: minimalPermissionsError }, { data: allPermissions, error: allPermissionsError }, { data: targetProfile, error: profileError }] = await Promise.all([
      admin.from("bd_roles").select("id, nome").in("nome", roleNames),
      admin.from("bd_permissions").select("id, codigo").in("codigo", minimalPermissionCodes),
      admin.from("bd_permissions").select("id, codigo"),
      admin.from("profiles").select("id, email, acesso_global").eq("email", SUPER_ADMIN_CONFIG.email).maybeSingle(),
    ]);

    if (rolesError) return json({ error: rolesError.message }, 500);
    if (minimalPermissionsError) return json({ error: minimalPermissionsError.message }, 500);
    if (allPermissionsError) return json({ error: allPermissionsError.message }, 500);
    if (profileError) return json({ error: profileError.message }, 500);

    const roleIdByName = new Map((roles || []).map((role) => [role.nome as string, role.id as string]));
    const minimalPermissionIdByCode = new Map((minimalPermissions || []).map((permission) => [permission.codigo as string, permission.id as string]));

    const missingRoles = roleNames.filter((name) => !roleIdByName.has(name));
    const missingPermissions = minimalPermissionCodes.filter((code) => !minimalPermissionIdByCode.has(code));

    if (missingRoles.length > 0 || missingPermissions.length > 0) {
      return json({
        error: "Catálogo RBAC incompleto para aplicar o reparo",
        missingRoles,
        missingPermissions,
      }, 400);
    }

    if (!targetProfile?.id) {
      return json({ error: `Perfil não encontrado para ${SUPER_ADMIN_CONFIG.email}` }, 400);
    }

    const superAdminRoleId = roleIdByName.get(SUPER_ADMIN_CONFIG.roleName)!;
    const allPermissionRows = allPermissions || [];
    const allPermissionIds = [...new Set(allPermissionRows.map((permission) => permission.id as string))];

    let actorAuthHeader = authHeader;
    if (isInternalCall) {
      actorAuthHeader = await buildSuperAdminAuthHeader(targetProfile.id, SUPER_ADMIN_CONFIG.email);
    }

    const actorClient = createClient(supabaseUrl, anonKeyOrThrow(), {
      global: { headers: { Authorization: actorAuthHeader! } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const desiredPairs = ROLE_MATRIX.flatMap((entry) => {
      const roleId = roleIdByName.get(entry.roleName)!;
      return entry.permissionCodes.map((permissionCode) => ({
        role_id: roleId,
        permission_id: minimalPermissionIdByCode.get(permissionCode)!,
        role_name: entry.roleName,
        permission_code: permissionCode,
      }));
    });

    const desiredSuperAdminPairs = allPermissionRows.map((permission) => ({
      role_id: superAdminRoleId,
      permission_id: permission.id as string,
      role_name: SUPER_ADMIN_CONFIG.roleName,
      permission_code: permission.codigo as string,
    }));

    const desiredAllPairs = [...desiredPairs, ...desiredSuperAdminPairs];

    const targetRoleIds = [...new Set(desiredAllPairs.map((pair) => pair.role_id))];
    const targetPermissionIds = [...new Set(desiredAllPairs.map((pair) => pair.permission_id))];

    const [{ data: existingLinks, error: linksError }, { data: existingActions, error: actionsError }, { data: existingUserRole, error: userRoleError }] = await Promise.all([
      admin
        .from("bd_role_permissions")
        .select("role_id, permission_id")
        .in("role_id", targetRoleIds)
        .in("permission_id", targetPermissionIds),
      admin
        .from("bd_role_permission_actions")
        .select("role_id, permission_id, acao")
        .in("role_id", targetRoleIds)
        .in("permission_id", targetPermissionIds)
        .eq("acao", ACTION),
      admin
        .from("bd_user_roles")
        .select("user_id, role_id")
        .eq("user_id", targetProfile.id)
        .eq("role_id", superAdminRoleId)
        .maybeSingle(),
    ]);

    if (linksError) return json({ error: linksError.message }, 500);
    if (actionsError) return json({ error: actionsError.message }, 500);
    if (userRoleError) return json({ error: userRoleError.message }, 500);

    const existingLinkSet = new Set((existingLinks || []).map((row) => `${row.role_id}:${row.permission_id}`));
    const existingActionSet = new Set((existingActions || []).map((row) => `${row.role_id}:${row.permission_id}:${row.acao}`));

    const linkRows = desiredAllPairs
      .filter((pair) => !existingLinkSet.has(`${pair.role_id}:${pair.permission_id}`))
      .map(({ role_id, permission_id }) => ({ role_id, permission_id }));

    const actionRows = desiredAllPairs
      .filter((pair) => !existingActionSet.has(`${pair.role_id}:${pair.permission_id}:${ACTION}`))
      .map(({ role_id, permission_id }) => ({ role_id, permission_id, acao: ACTION }));

    if (linkRows.length > 0) {
      const { error } = await actorClient.from("bd_role_permissions").insert(linkRows);
      if (error) return json({ error: error.message }, 500);
    }

    if (actionRows.length > 0) {
      const { error } = await actorClient.from("bd_role_permission_actions").insert(actionRows);
      if (error) return json({ error: error.message }, 500);
    }

    let insertedUserRoles = 0;
    if (!existingUserRole) {
      const { error } = await admin.from("bd_user_roles").insert({
        user_id: targetProfile.id,
        role_id: superAdminRoleId,
      });
      if (error) return json({ error: error.message }, 500);
      insertedUserRoles = 1;
    }

    let updatedProfiles = 0;
    if (!targetProfile.acesso_global) {
      const { error } = await admin
        .from("profiles")
        .update({ acesso_global: true })
        .eq("id", targetProfile.id);
      if (error) return json({ error: error.message }, 500);
      updatedProfiles = 1;
    }

    return json({
      success: true,
      auth_mode: isInternalCall ? "api_key" : "jwt",
      action: ACTION,
      inserted_role_permissions: linkRows.length,
      inserted_role_permission_actions: actionRows.length,
      inserted_user_roles: insertedUserRoles,
      updated_profiles: updatedProfiles,
      super_admin: {
        email: SUPER_ADMIN_CONFIG.email,
        role_name: SUPER_ADMIN_CONFIG.roleName,
        total_permissions_expected: allPermissionIds.length,
      },
      roles_updated: ROLE_MATRIX.map((entry) => ({
        role_name: entry.roleName,
        permissions_expected: entry.permissionCodes.length,
      })),
      skipped_manual_role: "Gestor_Paulo_1767803550988",
    });
  } catch (error) {
    console.error("fix-empty-rbac-roles error:", error);
    return json({ error: error instanceof Error ? error.message : "Erro interno" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function anonKeyOrThrow() {
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!anonKey) throw new Error("SUPABASE_ANON_KEY ausente");
  return anonKey;
}