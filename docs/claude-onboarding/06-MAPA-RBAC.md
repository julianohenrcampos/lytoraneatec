# 06 — MAPA DO RBAC E AUTORIZAÇÃO

> **PARTE CRÍTICA.** Auditoria READ-ONLY.
> Nada foi consolidado, migrado ou corrigido. Este documento apenas descreve o que existe.

---

## 1. Resumo executivo do RBAC

O ERP LYTOTEC opera hoje com **cinco fontes de autoridade simultâneas**, avaliadas em **OR**:

| # | Fonte | Onde vive | Status |
|---|---|---|---|
| 1 | `bd_user_roles` → `bd_roles` → `bd_role_permission_actions` → `bd_permissions` | RBAC **NOVO** (granular por ação) | **Oficial** |
| 2 | `bd_role_permissions` → `bd_permissions` | RBAC **NOVO sem ação** | Fallback ativo |
| 3 | `profiles.funcao_permissao` → `bd_funcoes_permissao.permissoes[]` → `bd_permissoes` | RBAC **LEGADO** | Ativo em `fn_has_permission` |
| 4 | `profiles.funcoes[]` / `profiles.funcao_sistema` | Papel como texto | Ativo no frontend e em `fn_is_super_admin` |
| 5 | `profiles.acesso_global = true` | Bypass total | Ativo no frontend e em `fn_is_super_admin` |

Além disso, no **frontend** existem mais 2 caminhos de elevação:

| # | Fonte | Onde |
|---|---|---|
| 6 | JWT `app_metadata.funcoes` / `app_metadata.acesso_global` | `usePermission.ts` "Camada A" |
| 7 | `localStorage['user_offline_context']` | `usePermission.ts` "Camada B" + `SecureRouteGuard` |

**Nenhuma delas foi desligada.** A flag `RBAC_LEGACY_FALLBACK_ENABLED` (default `true`) cobre apenas os ramos D1–D4 e E2 — **não cobre as Camadas A, B e C**, conforme documentado no próprio `src/config/rbacFlags.ts`.

---

## 2. Modelo de dados

### 2.1 RBAC NOVO
```
auth.users / profiles
   └── bd_user_roles (user_id, role_id)
          └── bd_roles (id, nome, descricao, ativo)
                 ├── bd_role_permissions        (role_id, permission_id)                 ← sem ação
                 └── bd_role_permission_actions  (role_id, permission_id, acao)          ← com ação
                        └── bd_permissions (id, codigo, nome, modulo, rota, tipo, ativo)

bd_user_permission_overrides (user_id, permission_id, acao, permitido: bool)  ← allow/deny individual
bd_permissoes_acoes          (permission_id → bd_permissions, acao, descricao) ← catálogo de ações
```

### 2.2 RBAC LEGADO
```
profiles.funcao_permissao ──► bd_funcoes_permissao (nome_funcao, permissoes uuid[])
                                     │ (array, SEM FK)
                                     └──► bd_permissoes (nome_permissao, rota)
profiles.funcoes      text[]     ← nomes de papel em texto livre
profiles.funcao_sistema text     ← papel único em texto livre
profiles.acesso_global  boolean  ← bypass
```

### 2.3 Ponte
```
bd_rbac_legacy_map (legacy_nome, new_codigo → bd_permissions, action_padrao, status, observacao)
views: vw_rbac_legacy_map_drift, vw_rbac_standard_funcao_permissoes, vw_rbac_standard_permission_gaps
```

---

## 3. Ações (`Acao`)

Definidas em `src/hooks/usePermission.ts`:
```ts
export type Acao = 'visualizar' | 'criar' | 'editar' | 'excluir' | 'aprovar';
```
Persistidas como `text` em `bd_role_permission_actions.acao`, `bd_user_permission_overrides.acao` e `bd_permissoes_acoes.acao` — **não há enum PostgreSQL**, portanto não há garantia de integridade dos valores.

**`[VERIFICAR NO BANCO]`**
```sql
select acao, count(*) from public.bd_role_permission_actions group by 1 order by 2 desc;
select acao, count(*) from public.bd_user_permission_overrides group by 1 order by 2 desc;
```

---

## 4. Predicados de SuperAdmin — **semânticas divergentes**

Foram encontradas **9 funções** de superadmin. As duas principais **não são equivalentes**:

### `public.is_super_admin(p_user_id uuid)` — **ESTRITA**
_Última definição: `20260322155315_9a6d8a1a-....sql`_
```sql
SELECT EXISTS (
  SELECT 1 FROM public.bd_user_roles ur
  JOIN public.bd_roles r ON ur.role_id = r.id
  WHERE ur.user_id = p_user_id AND r.nome = 'SuperAdm'
)
```
→ Considera **apenas o RBAC novo**. Não olha `profiles`.

### `public.fn_is_super_admin(p_user_id uuid default auth.uid())` — **AMPLA**
_Última definição: `20260422165258_de7dfe33-....sql`_
```sql
SELECT exists(bd_user_roles + bd_roles.nome='SuperAdm' AND r.ativo)
    OR exists(profiles WHERE acesso_global = true
                          OR 'SuperAdm' = any(funcoes)
                          OR funcao_sistema = 'SuperAdm')
    OR exists(profiles JOIN bd_funcoes_permissao ON ... WHERE fp.nome_funcao = 'SuperAdm')
```
→ Considera **4 fontes distintas**.

### Uso relativo (ocorrências nas migrations)

| Predicado | Usos | Semântica |
|---|---:|---|
| `fn_is_super_admin` | **378** | ampla |
| `check_is_super_admin` → delega a `fn_is_super_admin` | **219** | ampla |
| `check_is_super_admin_hybrid` → delega a `fn_is_super_admin` | 25 | ampla |
| `check_is_super_admin_new` | 24 | (a verificar) |
| **`is_super_admin`** | **32** | **estrita** |
| `is_ponto_superadmin` / `fn_ponto_is_superadmin` | 10 / 8 | escopo Ponto |
| `is_superadm_or_rh` | 11 | escopo RH |
| `is_departmental_super_admin` | 1 | escopo departamental |

### ⚠️ Consequência operacional

As Edge Functions `definir-senha-dispositivo` e `vincular-ccs-dispositivo` chamam explicitamente **`is_super_admin`** (estrita).
Portanto: **um usuário com `profiles.acesso_global = true` mas sem linha em `bd_user_roles` tem acesso total à UI e a 378 policies, mas é rejeitado por essas duas Edge Functions.** O contrário também ocorre em outros pontos.

**`[VERIFICAR NO BANCO]`** — quantos usuários divergem entre as duas definições:
```sql
select
  count(*) filter (where public.is_super_admin(p.id))    as superadm_estrito,
  count(*) filter (where public.fn_is_super_admin(p.id)) as superadm_amplo
from public.profiles p;

-- Lista dos divergentes (sem expor e-mail além do necessário)
select p.id
from public.profiles p
where public.fn_is_super_admin(p.id) and not public.is_super_admin(p.id);
```

---

## 5. `fn_has_permission` — a função central de autorização

_Última definição: `20260422215138_2a6b4f0d-....sql`_

Ordem de avaliação (CASE):
1. `fn_is_super_admin(p_user_id)` → **true** (bypass amplo)
2. `explicit_deny` em `bd_user_permission_overrides` (`permitido = false`) → **false**
3. `explicit_allow` em `bd_user_permission_overrides` (`permitido = true`) → **true**
4. `role_allow` via `bd_user_roles` + (`bd_role_permissions` **OU** `bd_role_permission_actions`) → **true**
5. `legacy_allow` via `profiles.funcao_permissao` → `bd_funcoes_permissao.permissoes[]` → `bd_permissoes` → **true**
6. senão **false**

Suporta **aliases** via `fn_permission_aliases(p_nome_permissao)` (mapeia nomes legados para códigos novos).

**Pontos de atenção confirmados:**
- Os passos 2 e 3 fazem `left join` de `bd_user_permission_overrides` contra **`bd_permissoes` (legado) e `bd_permissions` (novo)** ao mesmo tempo. Como a FK da coluna `permission_id` aponta só para `bd_permissions`, o ramo legado é estruturalmente morto.
- O passo 4 **ignora a coluna `acao`** — qualquer ação concedida a um papel libera a permissão inteira nesta função. A granularidade só existe em `fn_has_action`.

## 5.1 `fn_has_action(p_user_id, p_codigo, p_acoes text[])`
_Última definição: `20260505114343_...`_ — **é a função granular correta**:
1. `fn_is_super_admin` → true
2. override `permitido=true` com `acao = ANY(p_acoes)` → true
3. `bd_role_permission_actions` com `acao = ANY(p_acoes)` **e sem override de deny correspondente** → true

**Não consulta o RBAC legado.** Portanto o modelo granular está isolado do legado — bom sinal para o cutover.

---

## 6. RBAC no frontend — `src/hooks/usePermission.ts` (937 LOC)

### 6.1 Cadeia de decisão (ordem real de execução)

```
0.  Cache de módulo (_cache, TTL 60s, chaveado por userId)
    ↓ (miss)
A.  JWT app_metadata.funcoes contém 'SuperAdm'  OU  app_metadata.acesso_global === true
       → permissions = ['*'], isSuperAdmin = true, TODAS as rotas   →  RETORNA
    ↓
B.  localStorage['user_offline_context'] com validatedFromServer=true, mesmo userId, < 24h,
    e (isSuperAdmin || permissions inclui '*')
       → permissions = ['*']  (não retorna: segue para C em background)
    ↓
C.  SELECT profiles(id, funcoes, acesso_global) — timeout 3s
       acesso_global === true      → bypassSource='acesso_global'
       'superadm' ∈ funcoes        → bypassSource='profiles_funcoes'  (marcado como LEGADO)
       → permissions = ['*'], grava snapshot offline validado          →  RETORNA
    ↓
D1. SELECT profiles.funcoes (paralelo, só para earlyIsSuperAdmin)   [flag]
D.  SELECT bd_user_roles → bd_roles                                  ← RBAC OFICIAL
    ↓ (sem role)
D2. fallback: profiles.funcoes[0] como roleName + lookup em bd_roles  [flag]
    ↓ (sem role ainda)
    → canAccessDashboard = false → redireciona /waiting-approval
    ↓
    se isSuperAdmin:  SELECT bd_permissions (todas)
    senão:            SELECT bd_role_permission_actions (por role_id)
                      ↓ (vazio)
D3.                   fallback: SELECT bd_role_permissions            [flag]
                      SELECT bd_user_permission_overrides
    ↓
D4. se permissionCodes.length <= 1: fallback bd_funcoes_permissao + bd_permissoes  [flag]
    ↓ (exceção não tratada)
E1. cache válido (<60s, permissions não vazio) → mantém cache
E2. earlyIsSuperAdmin → permissions = ['*'] em "modo degradado", retry em 15s  [flag]
E3. senão → bloqueio seguro (permissionsError = true)
```

`[flag]` = coberto por `RBAC_LEGACY_FALLBACK_ENABLED` (default **`true`**).

### 6.2 Telemetria (positivo)
`emitRbacFallbackEvent()` grava eventos estruturados em `bd_permission_audit_logs` (fire-and-forget, com throttling por `sessionStorage`), com `branch`, `reason`, `skipped`, `source`, `legacy`, `userId`, `route`, `permitido`. Branches instrumentadas: `early_superadm`, `role_fallback`, `role_permissions_fallback`, `extra_legacy_permissions`, `degraded_superadm`, `superadmin_bypass`.

Complementada por `src/utils/rbacLegacyTelemetry.ts` (`logLegacyUsage`) com eventos:
`RBAC_LEGACY_APP_METADATA_FUNCOES_USED`, `RBAC_LEGACY_PROFILES_FUNCOES_BYPASS_USED`, `RBAC_LEGACY_PROFILES_FUNCOES_ROLE_FALLBACK`, `RBAC_LEGACY_BD_ROLE_PERMISSIONS_READ`, `RBAC_LEGACY_PROFILES_FUNCOES_DEGRADED`, `RBAC_LEGACY_SUPERADMIN_EMAIL_FALLBACK_USED`.

> **Esta telemetria é o ativo mais valioso para o cutover.** Ver `18-REGRAS-PARA-DESENVOLVIMENTO-FUTURO.md`.

**`[VERIFICAR NO BANCO]`** — quais fallbacks legados ainda são realmente exercidos:
```sql
select
  dados->>'branch'  as branch,
  dados->>'reason'  as reason,
  dados->>'source'  as source,
  (dados->>'legacy')::boolean as legacy,
  count(*), min(created_at), max(created_at), count(distinct user_id) as usuarios
from public.bd_permission_audit_logs
where created_at > now() - interval '60 days'
group by 1,2,3,4
order by 5 desc;
```
_(ajustar nomes de coluna conforme o schema real de `bd_permission_audit_logs`)_

### 6.3 API pública do hook
`hasPermission(codigo)`, `hasActionPermission(codigo, acao)`, `hasRouteAccess(route)`, `checkRoutePermission` (alias), `getAccessibleRoutes()`, `debugRouteAccess(route)`, `clearCache()` + `invalidateUsePermissionRuntimeCache()` (exportada à parte) + hooks de conveniência `useHasPermission`, `useHasAnyPermission`.

Em **todos** os pontos há a mesma escada: `isSuperAdmin → true`; `permissions.includes('*') → true`.

`hasActionPermission` tem um fallback próprio:
```ts
// 3. Fallback: se não há dados granulares, checa permissão básica para 'visualizar'
if (acao === 'visualizar' && state.roleActions.length === 0) {
  return state.permissions.includes(codigo);
}
```

---

## 7. Guards e o wildcard `'*'`

`'*'` **não é uma permissão do catálogo** — é um marcador de "modo degradado/bypass" produzido apenas pelo frontend (Camadas A, B, C e E2). Ele é aceito em:
- `usePermission.hasPermission` / `hasActionPermission`
- `hasRoutePermission` (`src/constants/routePermissions.ts`)
- `SecureRouteGuard` (`effectivePermissions.includes('*')`)
- `useHasPermission`, `useHasAnyPermission`

**O backend nunca emite nem reconhece `'*'`.** Ou seja: `'*'` libera exclusivamente a interface.

---

## 8. Comportamentos fail-open identificados nos guards

### 8.1 `SecureRouteGuard` — bloqueio condicional
```tsx
if (requiredPermission && !effectivePermissions.includes(requiredPermission)) {
  if (!hasVerifiedOnce || (!isLoading && permissions.length > 0)) {
    return <AcessoNegado/>;
  }
  // else: cai fora do if e RENDERIZA children
}
```
Se `hasVerifiedOnce === true`, `isLoading === false` e `permissions.length === 0` (ex.: revalidação que retornou vazio por erro de RLS), a condição é falsa e o acesso é **liberado**.

### 8.2 `SimplePermissionGuard` — acesso persistente
```tsx
if (!canAccessDashboard && wasEverApproved) {
  console.log('⚠️ Permissão perdida mas já foi aprovado - MANTENDO acesso');
}
// segue e renderiza children
```
Uma vez aprovado na sessão, a perda de permissão **não** derruba o acesso.

### 8.3 `hasRoutePermission` — rota não mapeada é permitida
```ts
if (!required) return true; // rota não mapeada => permitida (legado)
```
`ROUTE_PERMISSIONS` mapeia **66 rotas**; `App.tsx` declara **95**. As não mapeadas passam por essa função como permitidas. _(Impacto contido: o gate real de rota é o `SecureRouteGuard` com `requiredPermission` explícito; `hasRouteAccess` alimenta principalmente a visibilidade de menu.)_

**Todos esses comportamentos são intencionais** (comentados no código como proteção contra instabilidade do Supabase e perda de formulário). Estão documentados aqui como **fatos**, não como bugs a corrigir. Ver classificação de risco em `14-RISCOS-SEGURANCA.md`.

---

## 9. Superfície de escrita do RBAC no frontend

| Camada | Arquivos | Tabelas escritas |
|---|---|---|
| **RBAC NOVO** | `src/services/rbac/rolesCRUD.ts`, `permissionsCRUD.ts`, `actionPermissionsCRUD.ts`, `userRolesCRUD.ts`, `userOverridesService.ts`, `checkUserAction.ts` | `bd_roles`, `bd_permissions`, `bd_role_permission_actions`, `bd_user_roles`, `bd_user_permission_overrides` |
| **RBAC LEGADO** | `src/services/permissoes/permissaoCRUD.ts`, `funcaoPermissaoCRUD.ts`, `userPermissoes.ts`, `unifiedPermissionsService.ts` (**órfão**) | `bd_permissoes`, `bd_funcoes_permissao`, `bd_permissoes_acoes` |
| UI | `src/pages/GestaoPermissoes.tsx`, `src/components/permissoes/{AssignPermissionModal,UserDetailsModal,UserProfilesTable,PermissionFixNotification}.tsx` | ambos |
| Auditoria de escrita legada | `src/utils/rbacLegacyWriteAudit.ts` | telemetria |

Funções de escrita seguras no banco: `fn_assign_user_role_secure`, `fn_remove_user_role_secure`, `fn_clear_user_admin_roles_secure`, `fn_actor_can_assign_role`, `fn_actor_can_manage_user_target`, `fn_actor_can_override_permission`, `fn_role_is_protected`, `fn_permission_is_protected`, `fn_target_user_has_protected_access`, `fn_can_manage_permission_catalog`, `fn_can_manage_user_access`, `fn_can_read_permission_row`, `fn_can_view_permission_admin`, `fn_get_manageable_permission_profiles`, `fn_update_managed_profile_access_scope`, `fn_registrar_permissao`, `rbac_auto_migrate_user`, `rpc_create_gestor_role`.

---

## 10. Lista de e-mails com SuperAdm hardcoded

`src/config/superAdminEmails.ts`:
```ts
export const SUPER_ADMIN_FALLBACK_EMAILS = [
  'julianohcampos@yahoo.com.br',
  'ramonvalentevalente@gmail.com',
];
```
**Consumidores reais:**
- `src/hooks/useAuthPermissionsStable.ts` (1 importador: `PlanejamentoMacroPage.tsx`) → **ATIVO**
- `src/hooks/useSimplePermissions.ts` (**0 importadores**) → morto

Também hardcoded:
- `supabase/functions/fix-empty-rbac-roles/index.ts:58` → `SUPER_ADMIN_CONFIG = { email: "julianohcampos@yahoo.com.br", roleName: "SuperAdm" }`
- Diversas migrations concedem SuperAdm por e-mail (`20250701202825`, `20250723192322`, `20250724140232`, `20250804123633`, `20250901133726`, `20250901133748`)

> Nas **funções SQL atuais** (`is_super_admin`, `fn_is_super_admin`) **não há e-mail hardcoded** — o que é positivo. A dependência de e-mail sobrevive apenas no frontend e na Edge `fix-empty-rbac-roles`.

---

## 11. `__superadmin_only__` — permissão sintética

Usada em duas rotas de `App.tsx`:
- `/admin/qualidade-cadastral`
- `/requisicoes/diarias/auditoria-ponto-shadow`

Não existe no catálogo `bd_permissions`. Funciona porque `SecureRouteGuard` libera SuperAdm antes de comparar códigos, e nenhum papel comum jamais possuirá esse código. É um **gate sintético** — funciona, mas é uma convenção implícita, não documentada em nenhum lugar do banco.

---

## 12. Onde cada modelo AINDA é utilizado (mapa de cutover)

| Consumidor | RBAC NOVO | RBAC LEGADO | Bypass `profiles` |
|---|:--:|:--:|:--:|
| `usePermission.ts` (frontend, 116 importadores) | ✔ (D) | ✔ (D2, D4) | ✔ (A, B, C, E2) |
| `fn_has_permission` (SQL, base de policies) | ✔ | ✔ (`legacy_allow`) | ✔ (via `fn_is_super_admin`) |
| `fn_has_action` (SQL, granular) | ✔ | ✘ | ✔ (via `fn_is_super_admin`) |
| `is_super_admin` (Edge Functions de dispositivo) | ✔ | ✘ | ✘ |
| `fn_is_super_admin` (378 usos em policies) | ✔ | ✔ | ✔ |
| `useAuthPermissionsStable` (1 página) | — | — | ✔ (e-mail hardcoded) |
| `usePermissao.ts` (1 importador, 447 LOC) | — | ✔ | — |
| `services/permissoes/*` (UI de permissões) | — | ✔ | — |
| `services/rbac/*` (UI de permissões) | ✔ | ✘ | ✘ |

---

## 13. Consultas de diagnóstico do RBAC (read-only)

```sql
-- 1) Catálogo
select count(*) as permissions_novas from public.bd_permissions;
select count(*) as permissoes_legadas from public.bd_permissoes;
select count(*) as roles from public.bd_roles;
select count(*) as funcoes_permissao_legadas from public.bd_funcoes_permissao;

-- 2) Adoção do RBAC novo
select count(*) as usuarios_total from public.profiles;
select count(distinct user_id) as usuarios_com_role from public.bd_user_roles;
select count(*) as usuarios_sem_role
  from public.profiles p
 where not exists (select 1 from public.bd_user_roles ur where ur.user_id = p.id);

-- 3) Dependência do legado
select count(*) as profiles_com_funcao_permissao from public.profiles where funcao_permissao is not null;
select count(*) as profiles_com_funcoes          from public.profiles where funcoes is not null and cardinality(funcoes) > 0;
select count(*) as profiles_com_funcao_sistema   from public.profiles where coalesce(funcao_sistema,'') <> '';
select count(*) as profiles_acesso_global        from public.profiles where acesso_global is true;

-- 4) Granularidade
select count(*) as vinculos_sem_acao  from public.bd_role_permissions;
select count(*) as vinculos_com_acao  from public.bd_role_permission_actions;
select count(*) as overrides          from public.bd_user_permission_overrides;

-- 5) Drift do mapa legado→novo
select status, count(*) from public.bd_rbac_legacy_map group by 1;
select * from public.vw_rbac_legacy_map_drift;
select * from public.vw_rbac_standard_permission_gaps;
```

---

## 14. Conclusão

- Existe um **RBAC novo, granular e bem estruturado** (`bd_roles`/`bd_permissions`/`bd_role_permission_actions`/overrides) com funções SQL corretas (`fn_has_action`) e telemetria de cutover já instalada.
- Existe um **RBAC legado** (`bd_permissoes`/`bd_funcoes_permissao`/`profiles.funcoes`) que **continua sendo consultado em produção**, tanto no frontend quanto dentro de `fn_has_permission`.
- Existem **dois predicados de SuperAdmin com semânticas diferentes**, ambos em uso.
- O frontend possui **quatro caminhos de elevação a `'*'`** que não passam pelo RBAC.

**NÃO consolidar. NÃO migrar. NÃO corrigir.** Este documento é apenas o mapa. Qualquer cutover deve ser precedido pela análise dos dados de `bd_permission_audit_logs` (§6.2) e aprovado explicitamente.
