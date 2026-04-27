# Documentação da Estrutura RLS (Row-Level Security)

### 📌 Nome do Módulo

Camada de **Row-Level Security** do banco PostgreSQL/Supabase do Sistema
Corporativo LYTOTEC. Concentra a análise de tabelas protegidas, tabelas
expostas, funções de segurança e recomendações.

### ⚙️ Responsabilidades

- Garantir isolamento de dados por perfil, equipe e centro de custo.
- Documentar políticas ativas por tabela e por operação (`SELECT`, `INSERT`,
  `UPDATE`, `DELETE`).
- Identificar tabelas sem RLS e priorizar correções.
- Servir como referência única para auditoria de segurança.

### 🔗 Integrações

- [Visão Geral](./overview.md) — Status geral da estrutura RLS.
- [Tabelas com RLS Habilitado](./tables-with-rls.md) — Tabelas protegidas e suas políticas.
- [Tabelas sem RLS](./tables-without-rls.md) — Tabelas desprotegidas (CRÍTICO).
- [Funções de Segurança](./security-functions.md) — Funções utilizadas nas políticas RLS.
- [Problemas Críticos](./critical-issues.md) — Problemas de segurança identificados.
- [Recomendações](./recommendations.md) — Ações recomendadas para melhoria.

### 🧠 Regras de Negócio

- Papéis (`role`) **nunca** ficam na tabela `profiles`; são armazenados em
  `bd_user_roles` e consultados via funções `SECURITY DEFINER` (ex.: `has_role`).
- Visibilidade de Diárias é concedida via `fn_diaria_can_select_row`
  (criador OR responsável de campo OR centro de custo autorizado).
- Acesso global de SuperAdm exige flag `acesso_global = true` em
  `bd_user_roles` — a regra é aplicada de forma consistente em todo o sistema.

### 🛡️ Segurança

#### Status atual

> **⚠️ Atualização 2026-04-26 (Fase 2 hardening):** Auditoria read-only confirmou que **100% das tabelas em `public` possuem RLS habilitado**. As estatísticas históricas abaixo (de 2025-01-17) referem-se à fotografia inicial. A view `vw_auditoria_sistema` foi **corrigida nesta fase** (`security_invoker=true` + revoke direto para `anon`/`authenticated`). Risco residual atual: policies permissivas em tabelas sensíveis (tratado em Fase 3).

| Categoria | Quantidade (snapshot 2025-01-17) | Status atual (2026-04-26) |
|-----------|---------------------------------:|--------------------------:|
| ✅ Tabelas com RLS habilitado | 17 | **100% das tabelas em `public`** |
| ⚠️ Tabelas sem RLS habilitado | 17 | **0** |
| 🔧 Funções de segurança ativas | 8 | revisar via `supabase--linter` |
| 📋 Políticas RLS ativas | 27 | revisar via `pg_policies` |

#### Prioridades de ação (atualizadas)

1. ~~**ALTO** — Corrigir `vw_auditoria_sistema`~~ ✅ **RESOLVIDO Fase 2 (2026-04-26)**
2. **ALTO** — Revisar policies permissivas em tabelas sensíveis (`bd_funcionarios`, `bd_assinaturas`, `bd_desligamentos`, `bd_arquivo_morto`) — **Fase 3**.
3. **ALTO** — Criar permissão `gestao_abastecimento_view` para encerrar fallback provisório do `guardian-web-proxy` — **Fase 3**. Ver `docs/RBAC_HARDCODES_PENDENTES.md`.
4. **MÉDIO** — Adicionar `SET search_path = ''` em funções `SECURITY DEFINER` legacy.
5. **BAIXO** — Auditoria contínua via Central de Auditoria já implementada.

### 📊 Observações Técnicas

- Funções de segurança devem definir `search_path` explicitamente para
  evitar vetores de elevação de privilégio.
- Views `SECURITY DEFINER` exigem revisão para não contornar RLS.
- Auditoria automatizada em `bd_auditoria_log` e `bd_auditoria_biometria` complementa as políticas.

---

**Última atualização:** 2026-04-26
**Versão:** 1.2 — Status RLS atualizado pós-correções; documentação histórica preservada.
