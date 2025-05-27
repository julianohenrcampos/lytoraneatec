
export interface PermissaoServiceResult {
  userId: string;
  roles: string[];
  mainRoleId: string | null;
  permissions: string[];
  permissionRoutes: string[];
}
