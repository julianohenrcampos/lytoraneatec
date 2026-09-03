# 18 — REGRAS PARA DESENVOLVIMENTO FUTURO

> Estas regras foram definidas por você no prompt mestre da auditoria e estão aqui consolidadas
> com o contexto técnico real encontrado no ERP LYTOTEC.
> Elas valem para **toda** solicitação futura, sem exceção.

---

## 1. Protocolo obrigatório para qualquer tarefa

| Etapa | Ação |
|---|---|
| **1 — ENTENDER** | Reformular objetivamente o problema |
| **2 — LOCALIZAR** | Identificar arquivos, tabelas, RPCs, policies, triggers e Edge Functions relacionados |
| **3 — CONSULTAR EXISTENTE** | Antes de propor qualquer estrutura nova, procurar o que já existe (checklist §3) |
| **4 — DIAGNOSTICAR** | Explicar a causa raiz e a arquitetura atual |
| **5 — IMPACTO** | Informar exatamente o que precisaria ser alterado |
| **6 — NÃO ESCOPO** | Informar explicitamente o que **NÃO** será alterado |
| **7 — PLANO** | Apresentar o plano de implementação |
| **8 — BANCO** | Se houver alteração de banco: SQL/migration proposta, rollback e consultas de validação. **NÃO executar.** |
| **9 — TESTES** | Definir testes e **RESULTADOS ESPERADOS**, com comandos de conferência |
| **10 — APROVAÇÃO** | **PARAR** e perguntar: *"Plano pronto para aprovação. Posso executar?"* |
| **11 — IMPLEMENTAR** | Somente após autorização explícita, e exclusivamente o plano aprovado |
| **12 — VALIDAR** | Executar typecheck / testes / build aplicáveis |
| **13 — RELATÓRIO** | Arquivos alterados, banco alterado, migrations, testes, resultados, pendências, riscos |

---

## 2. Regra de escopo

**NÃO modificar** páginas, módulos, fluxos, componentes, hooks, services, RPCs, migrations, policies, triggers, Edge Functions ou estruturas **fora da funcionalidade explicitamente solicitada**.

**Única exceção:** dependências **diretamente relacionadas e tecnicamente necessárias**.

**Se encontrar problema fora do escopo: REPORTAR. NÃO CORRIGIR.**

Nunca usar uma solicitação como oportunidade para:
- refatorar código
- modernizar módulo
- reorganizar arquitetura
- alterar padrões
- renomear estruturas
- remover legado
- trocar biblioteca
- atualizar dependências
- melhorar outra página

Qualquer impacto externo aguarda autorização explícita.

### Por que isso importa neste projeto especificamente
- **161 arquivos órfãos** e **duas gerações de RBAC** convidam à "limpeza". Vários desses artefatos são **legado intencional preservado** (redirects, rotas `_legacy`, frente `FROZEN` do Ponto Dispositivo, `mv_relatorio_diarias_legacy_20260514`).
- **`usePermission.ts`** tem 116 importadores. **`MainLayout`** tem 64. Uma refatoração "de passagem" vira uma mudança de centenas de arquivos.
- **`fn_is_super_admin`** é usada em 378 policies. "Simplificar" essa função altera a segurança de todo o ERP.

---

## 3. Política "CONSULTAR ANTES DE CRIAR"

**NUNCA** criar tabela, coluna, função, RPC, service, hook, componente, página ou fluxo simplesmente porque parece necessário.

### Checklist obrigatório antes de propor qualquer estrutura nova

| # | Procurar | Onde / como |
|---|---|---|
| 1 | estrutura equivalente | `05-MAPA-BANCO-DADOS.md`, `02-MAPA-FRONTEND.md` |
| 2 | tabelas relacionadas | lista das 194 tabelas em `03-MAPA-BACKEND-SUPABASE.md`; `grep` em `types.ts` |
| 3 | colunas existentes | `types.ts` → `Tables.<tabela>.Row` |
| 4 | views | 70 views listadas em `03-MAPA-BACKEND-SUPABASE.md` §6 |
| 5 | materialized views | `mv_relatorio_diarias`, `mv_relatorio_diarias_v2`, `_legacy_20260514` |
| 6 | funções PostgreSQL | 593 definições nas migrations |
| 7 | RPCs | **452** em `types.ts → Functions`; famílias em `09-MAPA-RPCS-FUNCOES-TRIGGERS.md` §3 |
| 8 | triggers | 219 vivos, 106 tabelas |
| 9 | Edge Functions | 36, em `10-MAPA-EDGE-FUNCTIONS.md` §2 |
| 10 | services | 287 arquivos em `src/services/` |
| 11 | hooks | 257 arquivos em `src/hooks/` |
| 12 | componentes | 873 arquivos em `src/components/` |
| 13 | páginas | 111 em `src/pages/` |
| 14 | tipos TypeScript | 56 arquivos em `src/types/` |
| 15 | permissões | `bd_permissions`, `bd_permissoes`, `routePermissions.ts`, `menuStructure.ts` |
| 16 | feature toggles | `src/config/{rbacFlags,ct3Flags,diariasFlags}.ts` |
| 17 | código legado ainda ativo | `16-LEGADO-DUPLICIDADES.md` |
| 18 | estrutura semelhante em outro módulo | grafo em `17-DEPENDENCIAS-ENTRE-MODULOS.md` |

**Comandos de busca úteis:**
```bash
grep -rn "nome_procurado" supabase/migrations/ --include=*.sql
```
```bash
grep -n "nome_da_tabela: {" src/integrations/supabase/types.ts
```
```bash
grep -rn "nome_da_funcao" src/ supabase/functions/
```

Somente depois dessa investigação uma estrutura nova pode ser **PROPOSTA**.
**Mesmo assim: NÃO CRIAR.** Apresentar a proposta e aguardar autorização explícita.

---

## 4. Política de banco de dados

O Supabase é **ambiente crítico e em produção**. Antes de qualquer alteração é obrigatório apresentar:

1. estrutura existente
2. motivo da alteração
3. tabelas afetadas
4. colunas afetadas
5. constraints
6. foreign keys
7. índices
8. triggers
9. policies RLS
10. funções
11. RPCs
12. dependências
13. **volume aproximado de dados** (obter com a consulta de `05-MAPA-BANCO-DADOS.md` §10)
14. riscos
15. compatibilidade retroativa
16. rollback
17. testes
18. consultas de validação
19. resultado esperado

**Jamais assumir que uma tabela não existe apenas pelo nome.** Pesquisar também por sinônimos, nomes históricos, nomes abreviados, estruturas legadas, colunas JSON/JSONB, views e tabelas de relacionamento.

> Este projeto tem precedentes concretos disso: `bd_permissoes` × `bd_permissions`, `bd_funcoes` (cargo) × `bd_funcoes_permissao` (papel legado), `bd_centros_custo` × `bd_centro_custo` (legada) × `bd_centros_custo_alias`, `registro-aplicacao` × `registro-aplicacoes`.

### 4.1 Política para NOVA TABELA
Só pode ser **proposta** quando **TODOS** os critérios forem demonstrados:
1. nenhuma tabela existente atende
2. estender tabela existente seria arquiteturalmente incorreto
3. não existe estrutura equivalente
4. não existe relacionamento que resolva o requisito
5. a nova entidade possui ciclo de vida próprio
6. há justificativa de normalização
7. foram avaliados impactos em: RLS, auditoria, FK, índices, realtime, frontend, relatórios, integrações, exclusão e retenção

**Mesmo atendendo tudo: NÃO criar sem aprovação.**

### 4.2 Política de migrations
- Nomenclatura existente: `YYYYMMDDHHMMSS_<uuid>.sql` (padrão Lovable). **Manter o padrão.**
- Toda migration deve ser **idempotente** (`IF NOT EXISTS`, `DROP ... IF EXISTS`, `CREATE OR REPLACE`) — é o padrão já adotado nas 869 migrations.
- **Toda migration nova DEVE incluir, em comentário, o SQL de rollback.** Nenhuma das 869 migrations atuais tem rollback — não repetir esse débito.
- Migrations **não são aplicadas** sem autorização explícita.
- Objetos criados fora de migration (buckets `pops-documentos`, `atestados-medicos`, `ct-checklists`, `chamados-internos-anexos`; jobs `pg_cron`) devem ser **versionados** quando tocados.

### 4.3 Política de RLS
- **RLS está habilitado em 100% das 194 tabelas.** Toda tabela nova nasce com `ENABLE ROW LEVEL SECURITY`.
- **Nunca criar policy com `USING (true)` ou `WITH CHECK (true)`** sem justificativa escrita e aprovação — o projeto já tem 93 dessas e elas anulam o desenho de segurança (`08-MAPA-RLS.md`).
- Policies são **PERMISSIVE** por padrão e combinam por **OR**. Uma policy frouxa anula todas as rigorosas da mesma tabela e comando.
- Reutilizar os predicados existentes (`fn_<dominio>_can_<acao>_<entidade>`) em vez de escrever lógica inline.
- Toda função nova `SECURITY DEFINER` **deve** ter `SET search_path = public` e `REVOKE ALL ... FROM PUBLIC` quando não for RPC pública.
- **Nunca conceder policy ao role `anon`** sem aprovação explícita e escrita.

### 4.4 Política de RBAC
- **NÃO consolidar, NÃO migrar, NÃO corrigir** os dois sistemas de RBAC sem projeto aprovado.
- Toda permissão nova entra no **RBAC NOVO**: `bd_permissions` (+ `bd_permissoes_acoes` para as ações) e é concedida via `bd_role_permission_actions`.
- **Nunca** criar permissão nova em `bd_permissoes`/`bd_funcoes_permissao` (legado).
- Registrar o mapeamento em `bd_rbac_legacy_map` quando houver equivalente legado.
- Manter sincronizados: `App.tsx` (rota) ↔ `routePermissions.ts` ↔ `menuStructure.ts` ↔ `bd_permissions.rota`.
- **Nunca ampliar** os caminhos de bypass (`profiles.acesso_global`, `profiles.funcoes`, `app_metadata`, `user_offline_context`, `'*'`).
- Ao mexer em autorização, escolher conscientemente entre `is_super_admin` (estrita) e `fn_is_super_admin` (ampla), e **documentar a escolha**.

### 4.5 Regra de banco durante a implementação
- **Nunca** corrigir erro de frontend criando tabela ou coluna automaticamente.
- **Nunca** corrigir erro PostgreSQL alterando RLS automaticamente.
- **Nunca** remover constraint para fazer um fluxo funcionar.
- **Nunca** remover trigger apenas porque está bloqueando operação.
  > Neste projeto, os triggers que bloqueiam são **regras de negócio**: `fn_ordens_diarias_guard_emitida`, `fn_pop_bloquear_mutacao_destrutiva`, `fn_lock_itens_solicitacao_rh`, `fn_proteger_geocoding_manual`, `fn_validar_geocoding_no_save`.
- **Nunca** desativar segurança para resolver problema funcional.
- **Descobrir primeiro a causa.**

---

## 5. Política de segurança

- Nenhuma credencial nova no código. Secrets só via `Deno.env.get()` (Edge) ou variáveis `VITE_` públicas (frontend).
- **Nunca** colocar `SERVICE_ROLE` no frontend. _(Hoje o projeto está limpo nesse ponto — manter assim.)_
- Nova Edge Function: usar `_shared/backend-security.ts` (`authenticateEdgeRequest` + `authorizeBackendInvocation` + `auditBackendEvent`).
- Nova Edge Function com `verify_jwt = false` exige autenticação própria **documentada** e aprovação explícita.
- CORS: preferir a allowlist (`_shared/pops-cors.ts`) a `Access-Control-Allow-Origin: *`.
- Nunca autorizar apenas no frontend — o gate real é RLS/RPC.
- Nunca usar `user_metadata` para autorização (o projeto já faz isso corretamente: usa `app_metadata`).
- Bucket novo nasce **privado**, com `file_size_limit` e `allowed_mime_types` definidos.
- Dados sensíveis (`cpf`, `salario_base`, `chave_pix`, `conta_corrente`, biometria) exigem view segura + auditoria de leitura.

---

## 6. Política de testes

- **113 arquivos de teste** existem (Vitest + Testing Library), concentrados em Central do Transporte, importador de veículos, Diárias, Planejamento Macro e POPs.
- `package.json` **não tem script `test` nem `typecheck`** — propor a adição (com aprovação) antes de qualquer trabalho que dependa deles.
- Comandos atuais:
```bash
npx vitest run
```
```bash
npx tsc --noEmit -p tsconfig.app.json
```
- Toda alteração em lógica de negócio no banco deve vir com **consulta SQL de validação** e **resultado esperado**.
- Toda alteração em RLS deve vir com teste de acesso **positivo e negativo** (usuário que deve ver × usuário que não deve).
- Toda alteração em RBAC deve vir com o snapshot de permissões antes/depois:
```sql
select * from public.fn_get_my_permission_snapshot();
```

---

## 7. Proibição de refatoração oportunista

Reafirmando, porque neste projeto a tentação é alta:

❌ Não remover os 161 arquivos órfãos "de passagem"
❌ Não consolidar os 15 hooks de permissão
❌ Não unificar os 9 predicados de SuperAdmin
❌ Não apagar `src/components/funcionarios/funcionarios/`
❌ Não remover as policies `USING(true)` sem plano aprovado
❌ Não desligar `RBAC_LEGACY_FALLBACK_ENABLED`
❌ Não unificar `recharts` + `apexcharts`
❌ Não remover as gerações V1/V2 do importador de veículos
❌ Não remover o `<script src="cdn.gpteng.co/gptengineer.js">` do `index.html`
❌ Não apagar `.lovable/`, `previewAuthStorage.ts` nem `lovable-tagger`

✅ **Reportar cada um desses pontos e aguardar decisão.**

---

## 8. Regra de mudança de escopo durante a implementação

Se, durante a implementação, o plano aprovado se mostrar insuficiente:

**PARE.**
Não amplie o escopo silenciosamente.
Explique: o que foi descoberto · por que o plano não basta · qual a nova mudança necessária · qual o impacto.
**Aguarde nova aprovação.**

---

## 9. Regra de preservação

O ERP **está em operação, com usuários reais e dados reais**.

- **Compatibilidade retroativa é obrigatória.**
- Toda funcionalidade existente deve continuar funcionando, salvo quando a solicitação disser explicitamente que será substituída.
- Fluxos novos devem nascer **aditivos**, **isolados**, **feature-flagged quando houver risco** e **reversíveis**.

> O projeto já demonstra esse padrão em vários pontos — seguir o precedente:
> `funcionarios_operacional_select` em modo aditivo (`OR` com as funções legadas), rotas antigas mantidas como redirect, `/_legacy/gestao-aprovacoes-diarias` como fallback, `ponto-diaria-shadow` rodando em paralelo sem efeito, `RBAC_LEGACY_FALLBACK_ENABLED` como flag de cutover.

---

## 10. Regras específicas herdadas da transição Lovable → Claude Code

| Regra | Motivo |
|---|---|
| Não remover o script do Lovable de `index.html` | Comentário explícito no arquivo proíbe |
| Não editar `src/integrations/supabase/client.ts`, `types.ts` e `previewAuthStorage.ts` manualmente | São **gerados** ("This file is automatically generated. Do not edit it directly.") |
| Regenerar `types.ts` apenas via Supabase CLI, e como commit isolado | 976 KB — diff enorme, alto risco de conflito |
| Migrations continuam com o padrão `YYYYMMDDHHMMSS_<uuid>.sql` | Compatibilidade com o histórico e com `supabase_migrations.schema_migrations` |
| Manter mensagens de commit descritivas | O histórico atual tem 11.362 commits com mensagens genéricas ("Changes") — não replicar |
| Antes de trabalhar em uma frente, ler `.lovable/plan-*.md` e `docs/` | Existem 6 planos e 20 documentos anteriores com contexto que não deve ser redescoberto |

---

## 11. Checklist rápido antes de abrir qualquer PR

- [ ] Etapas 1–10 do protocolo cumpridas e aprovação obtida
- [ ] Nada fora do escopo aprovado foi tocado
- [ ] Nenhuma estrutura nova criada sem passar pelo checklist §3
- [ ] Se houve mudança de banco: migration idempotente + rollback em comentário + consultas de validação
- [ ] Se houve mudança de RLS: teste de acesso positivo e negativo
- [ ] Se houve mudança de RBAC: rota ↔ `routePermissions` ↔ `menuStructure` ↔ `bd_permissions` sincronizados
- [ ] Nenhuma policy `USING(true)` / `WITH CHECK(true)` introduzida
- [ ] Nenhuma nova função `SECURITY DEFINER` sem `SET search_path`
- [ ] Nenhum secret no código
- [ ] `npx tsc --noEmit` sem erros novos
- [ ] `npx vitest run` sem falhas novas
- [ ] `bun run lint` sem erros novos
- [ ] `bun run build` conclui
- [ ] Relatório da Etapa 13 entregue
