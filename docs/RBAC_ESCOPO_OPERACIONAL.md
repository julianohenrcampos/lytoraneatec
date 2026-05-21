# RBAC × Escopo Operacional — Matriz Oficial

> Documento normativo (Fase E1). Fonte de verdade para qualquer decisão de
> permissão e escopo no ERP LYTOTEC. Atualizar apenas via PR aprovado.

## 1. Princípio dual

O acesso a qualquer recurso operacional é resolvido por **duas dimensões
independentes** que se combinam com **AND lógico**:

| Dimensão | Define | Fonte da verdade |
|---|---|---|
| **Permissão (RBAC)** | *O QUE* o usuário pode fazer (visualizar, criar, editar, excluir, aprovar) | Tabelas `bd_roles`, `bd_permissions`, `bd_role_permission_actions`, `bd_user_permission_overrides`. Tela `/admin/permissoes`. |
| **Vínculo operacional (Escopo)** | *ONDE* o usuário pode fazer (quais Centros de Custo) | Tabela `bd_centros_custo` (FKs a `bd_funcionarios`). |

Consequências:
- Tem permissão mas não tem vínculo → **fail-closed** (lista vazia / 0 linhas).
- Tem vínculo mas não tem permissão → **bloqueado** (botão oculto / 403).
- Exceções globais: `SuperAdm` e `profiles.acesso_global = true` ignoram escopo.

## 2. Campos operacionais em `bd_centros_custo`

| Coluna | Papel operacional | Status |
|---|---|---|
| `aprovador_diarias_id` | Gerente Regional / Aprovador de Diárias | em uso |
| `adm_obra_funcionario_id` | AdmOBRA responsável | em uso |
| `adm_sede_funcionario_id` | AdmSede responsável | em uso |
| `diretoria_id` | Diretoria responsável | existe mas **não integra escopo** ainda |
| `departamento_id` | Departamento | usado em RH; não compõe escopo de Diárias |
| *(futuro)* `eng_obra_funcionario_id` | EngOBRA responsável | **não existe** — decisão pendente |

## 3. Matriz oficial de escopo (estado atual)

| Role | Origem do escopo | Resultado |
|---|---|---|
| `SuperAdm` | `fn_is_super_admin(uid) = true` ou `profiles.acesso_global = true` | todos os CCs (`isGlobal`) |
| `GerenteRegional` | `cc.aprovador_diarias_id = funcionario_id` ∪ solicitações onde aprova | restrito |
| `AdmOBRA` | `cc.adm_obra_funcionario_id = funcionario_id` (+ aprovador/sede se também responsável) | restrito |
| `AdmSede` | `cc.adm_sede_funcionario_id = funcionario_id` ∪ `get_admsede_centros_custo()` | restrito (legado) |
| `Apontador` / `Encarregado` | `bd_diaria_solicitacoes.responsavel_campo_id = funcionario_id` | mais restrito (por solicitação) |
| `AdmRH` / `DP` / `DepartamentoPessoal` / `Financeiro` | sem scope por CC; visão ampla em RH via RLS `fn_can_access_funcionario_operacional` | global em RH |
| `Diretoria` | **futuro**; `diretoria_id` ainda não integra `fn_diaria_scope_centros_custo` | n/a |
| `EngOBRA` | **futuro**; sem coluna e sem role | n/a |

## 4. Fontes únicas (Single Source of Truth)

| Domínio | Fonte | Anti-padrão |
|---|---|---|
| Escopo de CC | `public.fn_diaria_scope_centros_custo(p_user_id)` (RPC `SECURITY DEFINER`) | duplicar a CTE no frontend |
| Permissão granular | `usePermission().hasActionPermission(codigo, acao)` | `if (role === 'GerenteRegional')` |
| SuperAdm | `usePermission().isSuperAdmin` (já cobre `acesso_global`) | comparar e-mail / user_id |
| Hook frontend de escopo | `useEscopoOperacional()` (E2) | reescrever a regra de scope em cada tela |

## 5. Anti-padrões proibidos

1. **Hardcode de role/usuário** em código (`if (email === '...')`, `if (role === 'GerenteRegional')`, listas brancas de UUID).
2. **Bypass por `isSuperAdmin || acessoGlobal`** como única condição visual de uma ação que tem permissão RBAC equivalente (deve sempre cair em `hasActionPermission`).
3. **Listar `bd_centros_custo`** sem filtrar por escopo em telas restritas (vaza CCs fora do escopo do usuário).
4. **Usar `profiles.funcoes` (legado)** como fonte primária em código novo. Migrar para `bd_user_roles` + `bd_role_permission_actions`.
5. **Reimplementar a CTE de escopo** no frontend (sempre consumir a RPC).

## 6. Hooks/funções de referência

- `usePermission()` — única porta para RBAC (codigo + acao + overrides).
- `useEscopoOperacional()` — única porta para escopo de CC no frontend (E2).
- `useDiariasDataScope()` — usado nas telas de Diárias; pode no futuro delegar a `useEscopoOperacional` para consistência.
- `fn_diaria_scope_centros_custo(p_user_id)` — RPC oficial de escopo (SECURITY DEFINER).
- `fn_diaria_has_global_access(p_user_id)` — RPC oficial de bypass global em Diárias.
- `fn_can_access_funcionario_operacional(...)` — função usada por RLS de `bd_funcionarios` (não substituir).

## 7. Roadmap (não aprovado nesta fase)

| Fase | Item | Tipo | Status |
|---|---|---|---|
| E3 | Aplicar escopo consistente em Relatório/Folha de Diárias | frontend/service | pendente |
| E4 | Lista de funcionários RH respeitar escopo de gestor | frontend | pendente |
| E5 | Revisar `AditivoSolicitarModal` + notificações de aditivo | frontend | pendente |
| E6 | Incluir `diretoria_id` em `fn_diaria_scope_centros_custo` | DB (RPC) | pendente — alto risco |
| E7 | Criar coluna `eng_obra_funcionario_id` e role `EngOBRA` | DB (DDL + RBAC) | pendente — alto risco |

## 8. Procedimento para alteração

Qualquer mudança em escopo ou permissão exige:
1. PR explícito atualizando este documento **antes** do código.
2. Aprovação operacional (SuperAdm/SponsorOperacional).
3. Validação com 4 perfis: SuperAdm, GerenteRegional, AdmOBRA, usuário sem vínculo.
4. Registro em `mem://auth/rbac-granular` (memória de projeto).
