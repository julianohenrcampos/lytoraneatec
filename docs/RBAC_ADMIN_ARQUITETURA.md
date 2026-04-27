# Gestão de Permissões — Arquitetura Técnica Oficial

## 1. Objetivo desta referência

Esta é a referência oficial da Gestão de Permissões após a blindagem do RBAC.

Ela substitui `docs/PERMISSION_SYSTEM_FIX.md` como documento operacional do módulo administrativo.

## 2. Escopo desta implementação

Esta consolidação **não altera**:

- RLS policies
- funções SQL de autorização (`fn_has_permission`, `fn_has_role`, similares)
- RPCs de segurança (`fn_assign_user_role_secure`, `fn_remove_user_role_secure`, `fn_clear_user_admin_roles_secure`, `fn_update_managed_profile_access_scope`, `fn_get_manageable_permission_profiles`)

O escopo desta refatoração ficou restrito a:

- UI administrativa em `/admin/permissoes`
- hooks de leitura (`usePermissao`, `usePermissionGuard`, `useProfileSecurity`)
- utilitários legados da camada admin

## 3. Fonte canônica de verdade

### 3.1 Canônico no RBAC blindado

- `bd_permissions`
- `bd_roles`
- `bd_role_permissions`
- `bd_role_permission_actions`
- `bd_user_roles`
- `bd_user_permission_overrides`

### 3.2 RPCs e funções canônicas consumidas pela camada admin

- `fn_can_view_permission_admin`
- `fn_actor_can_assign_role`
- `fn_get_manageable_permission_profiles`
- `fn_assign_user_role_secure`
- `fn_remove_user_role_secure`
- `fn_clear_user_admin_roles_secure`
- `fn_update_managed_profile_access_scope`

### 3.3 Compatibilidade transitória, nunca regra principal da tela admin

- `profiles.funcoes`
- `profiles.funcao_sistema`
- `funcao_sistema`
- `bd_permissoes`
- `bd_funcoes_permissao`
- helpers híbridos antigos

## 4. Fluxo de dados da tela admin

### 4.1 Aba Permissões

UI → `permissionsCRUD.ts` → `bd_permissions`

### 4.2 Aba Funções

UI → `rolesCRUD.ts` → `bd_roles` + `bd_role_permissions` + `bd_role_permission_actions`

### 4.3 Aba Usuários

UI → `usePermissao.ts` → `fetchManageablePermissionProfiles()` → `fn_get_manageable_permission_profiles`

Na aba Usuários, os campos principais passam a ser:

- `role_names`
- `primary_role`
- `acesso_global`
- `departamento_id`
- `departamento_nome`

Overrides individuais continuam sendo lidos/escritos em:

- `bd_user_permission_overrides`

## 5. Contrato canônico da camada administrativa

O DTO principal da Gestão de Permissões é `ManageablePermissionProfile` em:

- `src/services/rbac/permissionAdminSecure.ts`

Campos operacionais principais:

- `role_names?: string[]`
- `primary_role?: string | null`
- `acesso_global?: boolean`
- `departamento_id?: string | null`
- `departamento_nome?: string | null`

## 6. Classificação das camadas

### 6.1 CANÔNICO

- `src/services/rbac/permissionsCRUD.ts`
- `src/services/rbac/rolesCRUD.ts`
- `src/services/rbac/userRolesCRUD.ts`
- `src/services/rbac/permissionAdminSecure.ts`
- `src/components/permissoes/PermissaoTable.tsx`
- `src/components/permissoes/PermissaoFormModal.tsx`
- `src/components/permissoes/FuncaoPermissaoTable.tsx`
- `src/components/permissoes/FuncaoPermissaoFormModal.tsx`

### 6.2 HÍBRIDO CONTROLADO

- `src/hooks/usePermission.ts`
- `src/hooks/useProfileSecurity.ts`
- `src/hooks/usePermissionGuard.ts`

### 6.3 LEGADO / COMPATIBILIDADE

- `src/utils/hybridPermissions.ts`
- `src/utils/permissionValidation.ts` (somente compatibilidade parcial)
- `src/services/permissoes/*`
- `profiles.funcoes`
- `profiles.funcao_sistema`

## 7. Matriz de estado atual

| Área | Situação |
|---|---|
| Catálogo de permissões | Funciona |
| Catálogo de funções | Funciona |
| Atribuição de função ao usuário | Funciona |
| Overrides individuais | Funciona |
| Exibição da aba Usuários por RBAC blindado | Funciona |
| Fallback legado fora da camada admin | Parcial / transitório |
| Helpers híbridos antigos | Frágil / precisa migrar gradualmente |

## 8. Regras operacionais da aba Usuários

Após esta refatoração, nenhuma decisão visual principal de `/admin/permissoes` deve depender de:

- `hybridPermissions.ts`
- `profile.funcoes`
- `funcao_sistema`

As decisões principais passam a depender de:

- `role_names`
- `primary_role`
- `acesso_global`
- overrides reais do RBAC

## 9. Checklist para criar novo perfil

1. Criar ou revisar permissões em `bd_permissions`
2. Criar ou revisar função em `bd_roles`
3. Configurar ações por permissão em `bd_role_permission_actions`
4. Definir escopo do perfil (`global`, `departamental`, `centro de custo`, `próprio`)
5. Validar dependências de rota/guard
6. Atribuir usuário em `bd_user_roles`
7. Só usar overrides quando houver exceção operacional real

## 10. Checklist para alterar perfil existente sem quebrar backend/RLS

1. Confirmar qual role está ativa em `role_names` e `primary_role`
2. Revisar impacto em `bd_role_permission_actions`
3. Confirmar se o perfil exige `acesso_global`
4. Revisar guards que exigem permissão explícita
5. Testar a aba Usuários e detalhes do usuário
6. Validar se o comportamento visual bate com o RBAC efetivo
7. Não alterar RLS, SQL auth functions ou RPCs de segurança durante ajustes de UI

## 11. Matriz obrigatória para novos perfis

| Perfil | Pode ver | Pode criar | Pode editar | Pode excluir | Pode aprovar | Escopo | Observações | Permissões-código relacionadas |
|---|---|---|---|---|---|---|---|---|
| Exemplo: AdmRH | Sim | Sim | Sim | Não | Sim | Global | Gestão administrativa de RH | `admin_rh_view`, `admin_rh_create`, `admin_rh_edit`, `admin_rh_approve` |
| Exemplo: AdmLogistica | Sim | Sim | Sim | Não | Não | Departamental/Global conforme vínculo | Operação logística | `admin_logistica_view`, `admin_logistica_create`, `admin_logistica_edit` |

## 12. Convenção de modelagem para novos perfis

- **Nome da função:** refletir o domínio operacional real
- **Descrição:** explicar objetivo e escopo
- **Permissões base por módulo:** sempre por código explícito
- **Ações permitidas:** `visualizar`, `criar`, `editar`, `excluir`, `aprovar`
- **Regra de escopo:** declarar se é `global`, `departamental`, `centro de custo` ou `próprio`
- **Observação operacional:** registrar exceções e overrides esperados

## 13. Resultado esperado da camada admin

- Aba Permissões reflete `bd_permissions`
- Aba Funções reflete `bd_roles` + `bd_role_permission_actions`
- Atribuição de função reflete `bd_user_roles`
- Detalhes do usuário mostram função real do RBAC
- Overrides individuais refletem `bd_user_permission_overrides`
- Status “Com Permissão / Sem Permissão” segue o RBAC blindado

## 14. Referência histórica

O documento `docs/PERMISSION_SYSTEM_FIX.md` deve ser tratado como histórico de correções anteriores, não como especificação operacional atual.