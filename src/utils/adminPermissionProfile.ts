import type { ManageablePermissionProfile } from "@/services/rbac/permissionAdminSecure";

const FALLBACK_ROLE_TO_IGNORE = "user";

export const ADMIN_PERMISSION_ROLES = [
  "SuperAdm",
  "Administrador",
  "AdmRH",
  "AdmLogistica",
  "AdmEquipamentos",
  "AdmSSO",
  "AdmOBRA",
  "AdmSede",
  "TecSSO",
] as const;

const cleanRoleList = (roles?: Array<string | null | undefined>) =>
  Array.from(
    new Set(
      (roles || [])
        .map((role) => role?.trim())
        .filter((role): role is string => !!role && role !== FALLBACK_ROLE_TO_IGNORE)
    )
  );

export const getLegacyFallbackRoles = (profile: Pick<ManageablePermissionProfile, "funcoes" | "funcao_sistema">) => {
  const roleCandidates = cleanRoleList([
    profile.funcao_sistema || undefined,
    ...(profile.funcoes || []),
  ]);

  return roleCandidates;
};

export const getCanonicalRoleNames = (profile: ManageablePermissionProfile): string[] => {
  const canonicalRoles = cleanRoleList(profile.role_names);
  if (canonicalRoles.length > 0) return canonicalRoles;

  const fallbackRoles = getLegacyFallbackRoles(profile);
  return fallbackRoles;
};

export const getCanonicalPrimaryRole = (profile: ManageablePermissionProfile): string | null => {
  const primaryRole = profile.primary_role?.trim();
  if (primaryRole) return primaryRole;

  const canonicalRoles = cleanRoleList(profile.role_names);
  if (canonicalRoles.length > 0) return canonicalRoles[0];

  const fallbackRoles = getLegacyFallbackRoles(profile);
  return fallbackRoles[0] || null;
};

export const hasCanonicalPermissionProfile = (profile: ManageablePermissionProfile): boolean => {
  return getCanonicalRoleNames(profile).length > 0 || !!getCanonicalPrimaryRole(profile);
};

export const getCanonicalRoleDisplay = (profile: ManageablePermissionProfile): string => {
  const primaryRole = getCanonicalPrimaryRole(profile);
  const roleNames = getCanonicalRoleNames(profile);

  if (!primaryRole && roleNames.length === 0) return "Nenhuma";
  if (!primaryRole) return roleNames.join(", ");

  const additionalRoles = roleNames.filter((role) => role !== primaryRole);
  if (additionalRoles.length === 0) return primaryRole;

  return `${primaryRole} (+${additionalRoles.length})`;
};

export const canManageDepartmentScope = (profile: ManageablePermissionProfile): boolean => {
  const roleNames = getCanonicalRoleNames(profile);
  return roleNames.some((role) => ADMIN_PERMISSION_ROLES.includes(role as (typeof ADMIN_PERMISSION_ROLES)[number]));
};

export const getPermissionStatusLabel = (profile: ManageablePermissionProfile) =>
  hasCanonicalPermissionProfile(profile) ? "Com Permissão" : "Sem Permissão";