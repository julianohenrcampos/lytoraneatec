# 08 — MAPA DE RLS (ROW LEVEL SECURITY)

> Auditoria READ-ONLY, **estática**. Estado reconstruído por replay cronológico de `CREATE POLICY` / `DROP POLICY` nas 869 migrations.
> **Toda conclusão deste documento exige confirmação com `pg_policies` no banco real.**

---

## 1. Cobertura de RLS — **100%**

Todas as **194 tabelas** presentes em `types.ts` possuem `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` em alguma migration. **Nenhuma tabela sem RLS.**

11 tabelas tiveram RLS desabilitado em algum momento (fase de desenvolvimento em jul/2025) — **todas foram reabilitadas posteriormente**:

| Tabela | Último statement | Migration |
|---|---|---|
| `bd_caminhoes_equipamentos` | ENABLE | `20260422195205` |
| `bd_funcionarios` | ENABLE | `20260422174019` |
| `bd_carga_status_historico`, `bd_centros_custo`, `bd_equipes`, `bd_lista_programacao_entrega`, `bd_programacao_entrega`, `bd_requisicoes`, `bd_ruas_requisicao`, `bd_usinas` | ENABLE | `20250724121403` |
| `bd_registro_apontamento_inspecao` | ENABLE | `20250724121731` |

`bd_pops` também tem `FORCE ROW LEVEL SECURITY` (aplica RLS até ao owner da tabela) — **é a única tabela com FORCE**.

**`[VERIFICAR NO BANCO]`**
```sql
select c.relname, c.relrowsecurity as rls_on, c.relforcerowsecurity as rls_forced
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname='public' and c.relkind='r' and not c.relrowsecurity
order by 1;   -- deve retornar ZERO linhas
```

---

## 2. Volume de policies

| Métrica | Valor |
|---|---:|
| `CREATE POLICY` totais nas migrations | 1.196 |
| Policies **vivas** após replay | **684** |
| Tabelas/objetos com policy viva | 207 (inclui `storage.objects`) |
| Policies **PERMISSIVE** | 683 |
| Policies **RESTRICTIVE** | **1** |

> ⚠️ **Praticamente todas as policies são PERMISSIVE**, ou seja, combinam-se por **OR**. Basta **uma** policy permissiva sobre uma tabela para liberar as linhas, independentemente de quão restritivas sejam todas as outras. Esse é o fato mais importante deste documento.

### Tabelas com mais policies

| Policies | Objeto |
|---:|---|
| 44 | `storage.objects` |
| 16 | `bd_funcionarios` |
| 12 | `bd_registro_apontamento_cam_equipa`, `bd_diaria_presencas` |
| 11 | `bd_sso_checklist_itens` |
| 10 | `bd_sso_checklists` |
| 9 | `bd_equipes`, `bd_pncp_perfis_busca`, `bd_pncp_contratacoes` |
| 8 | `bd_apontamento_equipe`, `bd_avaliacao_equipe`, `profiles`, `bd_ordens_servico` |

---

## 3. Arquitetura das policies — funções helper

As policies delegam a decisão para funções `SECURITY DEFINER`. Funções mais chamadas dentro de policies vivas:

| Chamadas | Função | Semântica |
|---:|---|---|
| 80 | `check_is_super_admin` | → `fn_is_super_admin` (**ampla**) |
| 67 | `fn_is_super_admin` | ampla (4 fontes) |
| 39 | `fn_has_role` | papel nominal |
| 34 | `has_permission` | permissão |
| 30 | `fn_logistica_is_privileged_user` | escopo logística |
| 30 | `has_role` | papel nominal (legado) |
| 29 | `has_sso_permission` | escopo SSO |
| 27 | `fn_has_permission` | RBAC novo **+ legado** |
| 24 | `fn_pncp_can_manage` | escopo PNCP |
| 23 | `fn_ativos_can_access_solicitacao` | escopo ativos |
| 20 | `fn_ativos_has_financial_access` | segregação financeira |
| **18** | **`is_super_admin`** | **estrita (só `bd_user_roles`)** |
| 18 | `fn_logistica_current_funcionario_id`, `fn_logistica_can_access_centro_custo` | escopo por CC |
| 15 | `fn_can_access_funcionario_sensitive`, `get_user_funcionario_id`, `fn_logistica_can_access_requisicao` | |
| 14 | `usuario_acessa_equipe`, `check_is_super_admin_hybrid`, `fn_diaria_scope_centros_custo` | |

**Padrão dominante e correto:** escopo por **centro de custo** + **papel** + **bypass de SuperAdm**.

⚠️ **Mistura de predicados de SuperAdmin dentro das policies**: `check_is_super_admin` (80), `fn_is_super_admin` (67), `is_super_admin` (18), `check_is_super_admin_hybrid` (14), `check_is_super_admin_new` (11). Três semânticas diferentes coexistindo na mesma camada de segurança. Ver `06-MAPA-RBAC.md` §4.

---

## 4. 🔴 CRÍTICO — `bd_funcionarios` exposta a `anon` e a qualquer autenticado

Existem **três policies vivas** de `SELECT` totalmente permissivas sobre `bd_funcionarios`:

| Policy | Role | Expressão | Migration |
|---|---|---|---|
| `Allow anonymous email verification for registration` | **`anon`** | `USING (true)` | `20250702171415-d3bbe062-...` |
| `Verificação de email para registro anon` | **`anon`** | `USING (true)` | `20260203034704_1d6f9807-...` |
| `Allow email verification for registration` | `authenticated` | `USING (true)` | `20250702171415-d3bbe062-...` |

O comentário na própria migration explicita a intenção — e o erro conceitual:

> *"Não expõe dados sensíveis pois o código da aplicação filtra apenas os campos: email, nome_completo, status"*

**RLS filtra LINHAS, não COLUNAS.** A filtragem de colunas feita no código do frontend não protege nada: qualquer cliente com a `anon key` (que é pública por design e está no bundle) pode emitir uma requisição PostgREST selecionando qualquer coluna.

E `bd_funcionarios` **contém**, conforme `types.ts` (ver `05-MAPA-BANCO-DADOS.md` §5):
`cpf` (NOT NULL), `salario_base`, `banco`, `agencia`, `conta_corrente`, `chave_pix`, `data_nascimento`, `endereco_completo` + 7 colunas de endereço, `latitude`, `longitude`, `gratificacao`, `insalubridade`, `periculosidade`, `adicional_noturno`, `refeicao`, `diarias`, `custo_passagem`, `matricula`, `email`, `imagem`, `observacoes`.

### Efeito colateral: a policy correta fica inútil

A policy elaborada `funcionarios_operacional_select` (migration `20260427021600`), que combina `fn_funcionarios_can_select_row` + `fn_can_access_funcionario_operacional` + `fn_can_access_funcionario_sensitive`, é **PERMISSIVE** — logo é combinada por **OR** com as três policies acima. O resultado efetivo de todo o conjunto é `true`.

Da mesma forma, toda a arquitetura de segregação (`bd_funcionarios_sensivel`, `vw_funcionarios_operacional`, `vw_funcionarios_rh`, `fn_get_funcionario_sensitive`, `bd_auditoria_leitura_funcionario_sensivel`) é **contornável** enquanto essas policies existirem.

### **`[VERIFICAR NO BANCO]` — verificação obrigatória e prioritária**

```sql
-- 1) As policies existem mesmo?
select policyname, permissive, roles, cmd,
       pg_get_expr(polqual, polrelid)      as using_expr,
       pg_get_expr(polwithcheck, polrelid) as check_expr
from pg_policies pp
join pg_policy p on p.polname = pp.policyname
join pg_class c on c.oid = p.polrelid and c.relname = pp.tablename
where pp.schemaname = 'public' and pp.tablename = 'bd_funcionarios'
order by cmd, policyname;

-- 2) Existe alguma policy para o role anon em QUALQUER tabela?
select schemaname, tablename, policyname, cmd, roles, qual
from pg_policies
where schemaname = 'public' and 'anon' = any(roles)
order by 1,2,3;

-- 3) Todas as policies com USING(true) ou WITH CHECK(true)
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and (btrim(coalesce(qual,'')) = 'true' or btrim(coalesce(with_check,'')) = 'true')
order by tablename, policyname;
```

**Teste funcional (read-only, seguro)** — reproduz o cenário do atacante usando apenas a `anon key` já pública:
```bash
curl -s "https://eexzgpmrousuxlkvqwkm.supabase.co/rest/v1/bd_funcionarios?select=cpf,salario_base,chave_pix&limit=1" \
  -H "apikey: <VITE_SUPABASE_PUBLISHABLE_KEY>"
```
**Resultado esperado se o sistema estiver seguro:** `[]` ou erro de permissão.
**Resultado esperado se a policy existir:** uma linha com CPF, salário e chave PIX.

> ⚠️ Executar este teste é uma verificação de leitura. Nenhum dado é alterado. Se retornar dados, trata-se de **exposição de dados pessoais e financeiros a qualquer pessoa na internet**.

---

## 5. Policies permissivas vivas — inventário completo (93)

`USING (true)` e/ou `WITH CHECK (true)`. Agrupadas por criticidade do dado.

### 5.1 🔴 Dados pessoais / financeiros
| Tabela | Policy | Cmd | Role |
|---|---|---|---|
| `bd_funcionarios` | Allow anonymous email verification for registration | SELECT | **anon** |
| `bd_funcionarios` | Verificação de email para registro anon | SELECT | **anon** |
| `bd_funcionarios` | Allow email verification for registration | SELECT | authenticated |

### 5.2 🟠 Escrita irrestrita para qualquer autenticado (`FOR ALL USING(true)`)
> Em Postgres, `FOR ALL` com apenas `USING` faz o `WITH CHECK` herdar a expressão do `USING` ⇒ **INSERT/UPDATE/DELETE liberados**.

| Tabela | Policy |
|---|---|
| `bd_caminhoes_equipamentos` | Usuários autenticados podem acessar veículos |
| `bd_centros_custo` | Usuários autenticados podem acessar centros de custo |
| `bd_departamentos` | Usuários autenticados podem acessar departamentos |
| `bd_empresas` | Usuários autenticados podem acessar empresas |
| `bd_equipes` | Usuários autenticados podem acessar equipes (+ `Everyone can insert/update/delete teams`) |
| `bd_usinas` | Usuários autenticados podem acessar usinas |
| `bd_ordens_servico` | Usuários autenticados podem acessar ordens serviço (+ criar/atualizar, role `public`) |
| `bd_registro_apontamento_inspecao` | Usuários autenticados podem acessar inspeções |
| `bd_catalogo_equipamentos` | read/write/update/delete (4 policies) |
| `bd_catalogo_variacoes`, `bd_fabricantes`, `bd_modelos`, `bd_tipos_equipamento`, `bd_frotas`, `bd_grupos_ativos`, `bd_linhas_operacionais` | manage/view |
| `bd_portfolio_empresas` | read/insert/update |
| `bd_centros_custo_alias`, `bd_empresas_alias`, `bd_funcoes_alias` | Autenticados acessam alias |
| `bd_lista_programacao_entrega` | Allow all access ... **during development** (role `public`) |
| `bd_caminhoes`, `bd_centro_custo` | Allow all access ... **during development** (role `public`) — tabelas ausentes de `types.ts` |
| `storage` (`Allow bucket creation`) | ALL, authenticated |

### 5.3 🟡 CRUD irrestrito em Ordens de Serviço (role `public`)
`bd_os_mao_obra`, `bd_os_materiais_utilizados`, `bd_os_movimentacoes` — 4 policies cada (SELECT/INSERT/UPDATE/DELETE) com `USING(true)`/`WITH CHECK(true)` e **role `public`**, criadas em `20250829185259`.

### 5.4 🟡 Auditoria gravável/legível por qualquer autenticado
`bd_auditoria_correcao_registros_carga` (role `public`), `bd_auditoria_correcao_volume_formula`, `bd_auditoria_sync_equipe_funcionario`, `bd_auditoria_volume_correcao` — todas `FOR ALL USING(true)`.
⚠️ **Trilha de auditoria alterável por quem é auditado.**

### 5.5 🟡 RBAC legível por qualquer autenticado
`bd_permissoes`, `bd_permissoes_acoes`, `bd_funcoes_permissao`, `bd_rbac_legacy_map` — SELECT `USING(true)`.
_(Leitura do catálogo é razoável; registrado por completude.)_

### 5.6 🟢 Catálogos/config — leitura ampla aceitável
`bd_categorias_ativos`, `bd_subcategorias_ativos`, `bd_diretorias`, `bd_feriados`, `bd_locais_atendimento`, `bd_empresas_locadoras`, `bd_matching_config`, `bd_matching_exclusoes`, `bd_fluxos_aprovacao`, `bd_fluxo_etapas`, `bd_fluxo_centro_custo`, `bd_fluxo_aplicacoes`, `bd_diaria_calendario_operacional`, `bd_cache_enderecos`, `bd_configuracoes_sistema`.

> ⚠️ `bd_configuracoes_sistema` — SELECT `USING(true)` para autenticados. Verificar se guarda valores sensíveis:
> ```sql
> select chave, ativo from public.bd_configuracoes_sistema order by 1;
> ```

### 5.7 🟢 Inserção ampla justificada
`bd_geocoding_falhas` (role `public`, INSERT), `bd_notificacoes_usuarios` (INSERT), `bd_envios` (INSERT), `profiles` (`Allow profile creation`, INSERT `WITH CHECK(true)`), `bd_carga_status_historico` (SELECT/INSERT/UPDATE), `bd_orgaos_historico_metricas` (role `service_role`).

### 5.8 ⚪ Site institucional legado (leitura pública, role `public`)
`portfolio_categories`, `portfolio_images`, `portfolio_projects`, `services` — tabelas ausentes de `types.ts`.

### 5.9 🟡 `bd_pncp_todas_licitacoes`
SELECT `USING(true)` para autenticados. Dado público de origem (PNCP) — risco baixo, mas contorna `fn_pncp_can_view`.

---

## 6. Policies sem cláusula `TO`

**91 policies vivas não declaram `TO`**, portanto valem para o role `public` — que em Postgres **inclui `anon`**. Na prática, essas policies só liberam algo a um anônimo se sua expressão `USING` for satisfeita sem `auth.uid()`; a maioria usa `auth.uid()` e retorna `NULL`/falso para anônimos. Ainda assim, é um padrão a inventariar.

**`[VERIFICAR NO BANCO]`**
```sql
select tablename, policyname, cmd, roles, qual
from pg_policies
where schemaname='public' and roles = '{public}'
order by tablename, policyname;
```

---

## 7. RLS em `storage.objects` (44 policies)

Buckets cobertos por policy explícita: `sso-checklists` (17 menções), `services` (13), `tickets` (9), `portfolio` (9), `os_photos` (9), `apontamentos` (8), `exames_agendamentos` (7), `avatars` (7), `sso-ver-agir` (5), `ct-checklists` (4), `veiculos` (4), `sso-desvios` (4), `inspecao-fotos` (4), `funcionarios` (4), `empresas-logos` (4), `biometria-facial` (4), `assinaturas-funcionarios` (4), `chamados-internos-anexos` (3), `assinaturas` (3), `pops-documentos` (2), `ponto-fotos` (2), `documentos-rh` (2).

Funções de apoio: `fn_storage_can_access`, `fn_storage_can_upload`, `fn_storage_audit_access`, `fn_storage_entity_id`, `fn_storage_entity_type`, `fn_storage_extract_uuid`, `fn_os_storage_object_allowed`.

⚠️ Policy viva `"Allow bucket creation"` `ON storage.buckets FOR ALL TO authenticated USING(true) WITH CHECK(true)` (migration `20250703183928`) — **qualquer usuário autenticado pode criar/alterar/apagar buckets**.

**`[VERIFICAR NO BANCO]`**
```sql
select policyname, cmd, roles, qual, with_check
from pg_policies where schemaname='storage' and tablename='buckets';
```

Detalhe por bucket em `11-MAPA-STORAGE.md`.

---

## 8. Como validar o estado real e reconciliar com este documento

```sql
-- Snapshot completo das policies (comparar com este documento)
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname in ('public','storage')
order by schemaname, tablename, policyname;

-- Contagem por tabela
select tablename, count(*) as policies
from pg_policies where schemaname='public'
group by 1 order by 2 desc;

-- Tabelas com RLS ligado mas SEM nenhuma policy (= negam tudo, exceto owner/service_role)
select c.relname
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' and c.relrowsecurity
  and not exists (select 1 from pg_policy p where p.polrelid = c.oid)
order by 1;
```

---

## 9. Conclusão

**Pontos fortes reais:**
- Cobertura de RLS de 100% das tabelas.
- Arquitetura madura de predicados por domínio (`fn_<dominio>_can_<acao>`), reutilizados tanto em policies quanto como RPC.
- Segregação por centro de custo consistente e bem estabelecida.
- Auditoria de leitura de dados sensíveis instrumentada.

**Ponto de falha estrutural:**
- Toda essa arquitetura é **anulada** pela coexistência de policies `PERMISSIVE` com `USING(true)`, porque a combinação é por OR. As 93 policies permissivas listadas em §5 — e em especial as três de `bd_funcionarios` — tornam boa parte do desenho de segurança **decorativo**.

**Nenhuma correção foi aplicada.** Ver plano de verificação e priorização em `14-RISCOS-SEGURANCA.md`.
