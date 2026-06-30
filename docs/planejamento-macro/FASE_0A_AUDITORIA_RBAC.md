# Fase 0A — Auditoria somente leitura (Equipe Designada / Apontador / Carga Horária)

Data: execução automatizada via plano v5.
Escopo: nenhuma escrita. Apenas `SELECT` + `rg`. Decisões de Fase 0B aguardam aprovação explícita.

---

## 0A.1 — Estrutura real do RBAC

Tabelas do RBAC consolidado (confirmadas existentes no banco):

| Tabela | Linhas | Status |
|---|---|---|
| `bd_permissions` | 84 | **canônica** (catálogo de permissões) |
| `bd_role_permission_actions` | 818 | **canônica** (mapeia role → permissão → ação) |
| `bd_roles` | — | canônica |
| `bd_user_roles` | — | canônica |
| `bd_user_permission_overrides` | — | canônica |
| `bd_permissoes_acoes` | 66 | **legada** — substituída por `bd_role_permission_actions` |

Função SQL canônica: `public.user_has_permission_action` (já endurecida em fase anterior — bypass exige `acesso_global=true` + role `SuperAdm`).
Guards canônicos: `usePermission`, `ActionGuard`.
Helper de serviço: `src/services/rbac/checkUserAction.ts`.

### `bd_permissoes_acoes` — classificação: **legada**

Evidências:
- Mantida apenas para histórico. Há 4 migrations antigas (2026-04 a 2026-06) que popularam a tabela, mas o RBAC consolidado migrou para `bd_role_permission_actions`.
- O único consumidor restante (`src/services/rbac/actionPermissionsCRUD.ts`) chama `auditLegacyRbacWrite(...)` em cada operação, ou seja, qualquer escrita é registrada como **legacy write**.
- `src/utils/rbacLegacyWriteAudit.ts` lista explicitamente `bd_permissoes_acoes` como tabela legada.
- A documentação oficial `docs/RBAC_ADMIN_ARQUITETURA.md` **não cita** `bd_permissoes_acoes` como canônica.

**Decisão:** o plano não cria, não lê nem referencia `bd_permissoes_acoes` em nenhuma fase. Toda nova ação granular passa por `bd_role_permission_actions`.

---

## 0A.2 — Auditoria das 4 permissões-alvo

Consulta executada em `bd_permissions` + `bd_role_permission_actions` + `bd_roles`:

| Código | Existe? | Módulo | Ações cadastradas | Roles vinculadas |
|---|---|---|---|---|
| `engenharia_planejamento_equipe_view` | ✅ | `null` | `visualizar` | `AdmOBRA`, `GerenteRegional` |
| `engenharia_planejamento_equipe_manage` | ✅ | `null` | `criar`, `editar`, `excluir` | `AdmOBRA`, `GerenteRegional` |
| `engenharia_planejamento_equipe_emprestimo` | ✅ | `null` | `criar` | `GerenteRegional` |
| `engenharia_ordem_diaria_campo_view` | ✅ | `engenharia` | _(nenhuma)_ | _(nenhuma)_ |
| `engenharia_planejamento_equipe_definir_apontador` | ❌ | — | — | — |

### Pontos de uso no código (`rg`)

- `src/pages/Portal.tsx:90` — rota `/engenharia/ordem-do-dia` gateada por `engenharia_ordem_diaria_campo_view`.
- `src/components/routing/OrdemDiariaCampoGuard.tsx:14` — guard de rota mobile usa `engenharia_ordem_diaria_campo_view` como alternativa ao `engenharia_ordem_diaria_view`.
- `src/components/planejamento-macro/modals/PlanejarEquipeDesignadaForm.tsx:73–75` — UI atual já consome `engenharia_planejamento_equipe_manage / criar` e `engenharia_planejamento_equipe_emprestimo`.
- `src/constants/menuStructure.ts:117` — entrada de menu.

### Observações

1. **`engenharia_ordem_diaria_campo_view` está sem `bd_role_permission_actions`.** O acesso à página é obtido por fallback (responsabilidade na OD), conforme própria descrição da permissão. Não impacta o plano atual, mas fica registrado.
2. As três permissões `equipe_*` têm `modulo=null` no catálogo. A criação eventual da permissão granular do Apontador (0B.1) usará `modulo='engenharia'` (alinhado a `engenharia_ordem_diaria_campo_view`).

---

## 0A.3 — Comportamento da tela `/admin/permissoes`

Verificação em `src/services/rbac/permissionsCRUD.ts` (linhas 85–86):

```ts
export const fetchPermissions = async (filters: RBACPermissionFilter = {}) => {
  let query = supabase.from("bd_permissions").select("*");
  ...
}
```

A listagem parte direto de `bd_permissions` com `select("*")` — **sem `INNER JOIN`** obrigatório em `bd_role_permission_actions` nem em `bd_role_permissions`.

**Resposta:** ✅ **Sim**, a tela `/admin/permissoes` lista permissões recém-criadas mesmo sem vínculo a roles ou ações. SuperAdm/AdmObra podem atribuir ações depois pela própria UI.

Implicação para 0B.1: caminho liberado — podemos criar a permissão granular órfã sem quebrar a tela admin, **se** a condição de necessidade operacional for cumprida.

---

## 0A.4 — Leitura segura de `profiles` para `tem_profile`

Policies SELECT atuais em `public.profiles`:

| Policy | Quem lê? |
|---|---|
| `profiles_self_select_safe` | `id = auth.uid()` (somente o próprio profile) |
| `profiles_admin_select_safe` | SuperAdm OU `admin_permissoes_view` OU role `AdmRH` / `AdmLogistica` / `AdmEquipamentos` / `AdmSSO` / `AdmOBRA` / `Financeiro` / `DP` |

**Conclusão:** um usuário comum (sem essas roles administrativas) **NÃO** consegue ler `profiles.funcionario_id` de outros usuários. JOIN client-side restrito **só** funcionaria para os perfis administrativos.

Como o módulo Planejamento Macro é operado também por `AdmOBRA` (que tem leitura via policy admin), o JOIN client funcionaria para os usuários previstos hoje. Mesmo assim, expor `profiles` direto (mesmo restrito a `id, funcionario_id`) cria acoplamento desnecessário entre Planejamento e profiles.

**Recomendação Caminho B (RPC mínima):**

Criar `fn_funcionarios_tem_profile(p_ids uuid[])` `SECURITY DEFINER`, que retorna **somente** `(funcionario_id uuid, tem_profile boolean)`. Vantagens:

- Funciona uniformemente para qualquer role com `engenharia_planejamento_equipe_view`, sem depender da policy admin de `profiles`.
- Nenhuma PII (e-mail, nome, role) atravessa o cliente.
- Encapsula a regra: se mudar a fonte da verdade no futuro, basta alterar a RPC.

Esta RPC entra na Fase 0B.2 (condicional à aprovação).

---

## 0A.5 — Colunas reais de autoria em `bd_planejamento_atividade_equipe`

Colunas confirmadas (relevantes para auditoria):

| Coluna | Tipo | Nullable |
|---|---|---|
| `criado_por` | uuid | YES |
| `modificado_por` | uuid | YES |
| `created_at` | timestamptz | NO |
| `updated_at` | timestamptz | NO |

Confirma o que o plano previa. Sem campo extra como `created_by` em inglês. A UI da Fase 1 usará exatamente:

- **Agregado da atividade:**
  - `Equipe montada por: <usuário do MIN(created_at)> em <MIN(created_at) BRT>` → ler `criado_por` da linha que tem o menor `created_at`.
  - `Última alteração por: <usuário do MAX(updated_at)> em <MAX(updated_at) BRT>` → ler `modificado_por` (ou `criado_por` se `modificado_por IS NULL`) da linha que tem o maior `updated_at`.
- **Por linha:** continua exibindo seu próprio `criado_por`/`created_at` e `modificado_por`/`updated_at`.

Como ambas as colunas de autoria são **nullable**, a UI deve tratar `null` como "—" (sem fingir autoria).

Também registrado: `papel_na_tarefa` é `USER-DEFINED` (enum), `tipo_alocacao` idem, `horas_previstas` é `numeric` nullable. Nada disso será alterado em schema na Fase 1.

---

## 0A.6 — Conclusões e recomendações para Fase 0B

| Critério de aceite | Resultado |
|---|---|
| Estrutura RBAC real confirmada | ✅ Canônico = `bd_permissions` + `bd_role_permission_actions` (+ roles/user_roles/overrides). `bd_permissoes_acoes` é **legada**, não usar. |
| Tabela das 4 permissões-alvo | ✅ Acima. 3 existem com ações/roles; `engenharia_ordem_diaria_campo_view` existe sem ações/roles (acesso por fallback). |
| `/admin/permissoes` lista permissão sem action/role? | ✅ Sim (`select("*")` direto em `bd_permissions`). |
| Leitura segura de `profiles` p/ `tem_profile`? | ❌ Para usuário comum não há policy. ✅ Para AdmOBRA/AdmRH/etc. existe. **Recomendação:** RPC mínima (Caminho B). |
| Colunas reais de autoria em `bd_planejamento_atividade_equipe` | ✅ `criado_por`, `modificado_por`, `created_at`, `updated_at`. Autoria nullable. |

### Recomendações para Fase 0B (a serem aprovadas pelo usuário)

1. **Criar `engenharia_planejamento_equipe_definir_apontador`?**
   **Recomendação: NÃO criar agora.** O slot Apontador segue sob `engenharia_planejamento_equipe_manage / editar`. Justificativas:
   - A justificativa operacional para isolar o Apontador (controle granular separado de Encarregado/Mestre) **não foi comprovada** nesta auditoria. Hoje quem pode `equipe_manage / editar` (AdmOBRA, GerenteRegional) já é quem deve definir o Apontador.
   - Criar permissão órfã agora gera ruído na tela admin e exige treinamento extra para o SuperAdm atribuir.
   - Caso campo demande, fica fácil criar depois (idempotente, sem migration de schema).

2. **Criar RPC `fn_funcionarios_tem_profile`?**
   **Recomendação: SIM.** Retorna apenas `(funcionario_id, tem_profile boolean)`, sem PII. Desacopla Planejamento de `profiles` e funciona para qualquer role autorizada a ver a aba Equipe Designada.

### Resultado proposto da Fase 0B

- **0B.1** — não executar (sem necessidade comprovada).
- **0B.2** — executar (criar RPC mínima).

Aguardando aprovação explícita do usuário para executar **somente** a Fase 0B.2 e seguir para a Fase 1.
