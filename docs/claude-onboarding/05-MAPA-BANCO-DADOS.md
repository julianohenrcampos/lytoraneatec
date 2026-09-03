# 05 — MAPA DO BANCO DE DADOS

> Auditoria READ-ONLY, **estática** (migrations + `types.ts`). Sem acesso ao banco real.
> 194 tabelas · 70 views/MVs · 452 RPCs · 22 enums · 355 FKs (tabela→tabela).

---

## 1. Hubs relacionais (tabelas mais referenciadas por FK)

| Tabela | FKs de entrada | Papel |
|---|---:|---|
| **`bd_funcionarios`** | **50** | Entidade central de pessoas (domínio "funcionário") |
| **`profiles`** | **47** | Entidade central de usuários (domínio "auth") |
| **`bd_centros_custo`** | **40** | Eixo de escopo operacional/organizacional de quase todo o ERP |
| `bd_diaria_solicitacoes` | 17 | Raiz do agregado de Diárias |
| `bd_caminhoes_equipamentos` | 14 | Raiz do agregado de Ativos |
| `bd_empresas` | 10 | |
| `bd_funcoes` | 9 | Cargo/função do funcionário (**não é papel de RBAC**) |
| `bd_solicitacoes_equipamento` | 8 | |
| `bd_tipos_equipamento` | 7 | |
| `bd_departamentos`, `bd_permissions` | 6 | |
| `bd_equipes`, `bd_categorias_ativos`, `bd_subcategorias_ativos`, `bd_solicitacoes_planejamento`, `bd_ponto_dispositivos` | 5 | |

---

## 2. O eixo de identidade — `auth.users` × `profiles` × `bd_funcionarios`

```
auth.users.id  ──(1:1, mesma PK)──►  profiles.id
                                        │
                                        ├── profiles.funcionario_id ──► bd_funcionarios.id   (FK, nullable, NÃO única)
                                        ├── profiles.funcao_permissao ─► bd_funcoes_permissao.id  (RBAC LEGADO)
                                        ├── profiles.funcoes           text[]   (RBAC LEGADO)
                                        ├── profiles.funcao_sistema    text     (RBAC LEGADO)
                                        └── profiles.acesso_global     boolean  (BYPASS GLOBAL)

bd_funcionarios.id ──► bd_funcionarios_sensivel.funcionario_id (1:1 lógico)
```

### 2.1 `profiles` (14 colunas)
`id`, `email`, `nome_completo`, `cargo`, `imagem_url`, `assinatura_png`, `funcionario_id`, `funcao_permissao`, `funcao_sistema`, `funcoes`, `acesso_global`, `modificado_por`, `created_at`, `updated_at`.

⚠️ **Quatro atributos de autoridade coexistem em `profiles`** (`funcoes`, `funcao_sistema`, `funcao_permissao`, `acesso_global`) **além** do RBAC novo em `bd_user_roles`. Ver `06-MAPA-RBAC.md`.

### 2.2 `profiles.funcionario_id` **não é UNIQUE**
`types.ts` declara `isOneToOne: false` para `profiles_funcionario_id_fkey`. Isso permite **dois usuários apontando para o mesmo funcionário**, e é coerente com a existência das RPCs:
- `merge_duplicate_funcionarios`
- `merge_duplicate_funcionarios_by_email_normalized`
- `merge_duplicate_funcionarios_normalized`
- `listar_ghost_funcionarios`
- `link_profile_to_funcionario_by_email`, `link_profile_from_funcionario_email`, `update_profile_funcionario_id`
- `check_email_duplicate_normalized`, `normalize_email`, `normalize_text_immutable`

**`[VERIFICAR NO BANCO]`**
```sql
-- Funcionários com mais de um profile
select funcionario_id, count(*) qtd
from public.profiles
where funcionario_id is not null
group by 1 having count(*) > 1;

-- Profiles órfãos (sem funcionário)
select count(*) from public.profiles where funcionario_id is null;

-- Funcionários "ghost" (sem profile)
select count(*) from public.bd_funcionarios f
where not exists (select 1 from public.profiles p where p.funcionario_id = f.id);
```

---

## 3. Pontos onde IDs de domínios diferentes podem ser confundidos

Foram identificadas **86 colunas de identidade sem FK declarada** — cada uma é um ponto onde não há garantia de qual domínio o UUID pertence (`auth.users`/`profiles` vs `bd_funcionarios`).

### 3.1 Colunas `solicitante_id` com semânticas divergentes (confirmado)

| Coluna | Aponta para | Evidência |
|---|---|---|
| `bd_chamados_os.solicitante_id` | **`bd_funcionarios`** | FK declarada |
| `bd_chamados_internos.solicitante_funcionario_id` | **`bd_funcionarios`** | FK declarada |
| `bd_solicitacoes_equipamento.solicitante_id` | **indefinido** | sem FK |
| `bd_solicitacoes_desligamento.solicitante_id` | **indefinido** | sem FK |
| `bd_solicitacoes_classificacao.solicitante_id` | **indefinido** | sem FK |
| `bd_solicitacoes_transferencia.solicitante_id` | **indefinido** | sem FK |
| `bd_solicitacoes_desmobilizacao.solicitante_id` | **`profiles`** | FK declarada |

**Este é o principal risco de confusão de domínio do sistema.** Um mesmo nome de coluna (`solicitante_id`) significa "funcionário" em uma tabela e "usuário" em outra.

### 3.2 Colunas de identidade sem FK (86 no total) — amostra relevante

`bd_auditoria_log.usuario_id`, `bd_auditoria_log_archive.usuario_id`, `bd_security_audit_log.user_id`, `bd_permission_audit_logs.user_id`, `bd_permission_change_audit_logs.{actor_user_id,target_user_id}`, **`bd_user_permission_overrides.user_id`** (⚠️ tabela de RBAC), `bd_notificacoes_usuarios.usuario_id`, `bd_assinaturas.usuario_id`, `bd_assinaturas_usuarios.usuario_id`, `bd_diaria_logs.usuario_id`, `bd_fluxo_historico.usuario_id`, `bd_ponto_audit_log.usuario_id`, `bd_ativos_auditoria.actor_user_id`, `bd_os_auditoria.actor_user_id`, `bd_logistica_auditoria.actor_user_id`, `bd_storage_auditoria.actor_user_id`, `bd_backend_exec_auditoria.actor_user_id`, `bd_ordens_diarias_obra_apontamentos.registrado_por_funcionario_id`, `bd_funcionarios_biometria_facial.{cadastrado_por_user_id,validado_por_user_id}`, `bd_diaria_solicitacoes.{criado_por,autorizado_por}`, `bd_pops.{criado_por,aprovado_por}`, e todos os `created_by`/`criado_por` de Central do Transporte, Planejamento, Registro de Aplicação, SSO, PNCP.

> Observação: ausência de FK em **tabelas de log/auditoria** é aceitável (evita bloquear exclusão de usuário). Ausência de FK em **`bd_user_permission_overrides.user_id`** não é: é uma tabela de autorização.

**`[VERIFICAR NO BANCO]`**
```sql
-- Overrides órfãos
select count(*) from public.bd_user_permission_overrides o
where not exists (select 1 from auth.users u where u.id = o.user_id);

-- Inventário completo de FKs reais
select tc.table_name, kcu.column_name, ccu.table_name as ref_table, ccu.column_name as ref_col
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name
join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
where tc.constraint_type='FOREIGN KEY' and tc.table_schema='public'
order by 1,2;
```

---

## 4. `bd_centros_custo` — o eixo de escopo

40 tabelas referenciam CC. Além disso, a própria tabela concentra **quatro papéis de responsabilidade**:

| Coluna | Aponta para | Uso |
|---|---|---|
| `engenheiro_responsavel_id` | `bd_funcionarios` | Escopo de engenharia |
| `adm_obra_funcionario_id` | `bd_funcionarios` | Administrativo de obra |
| `adm_sede_funcionario_id` | `bd_funcionarios` | Administrativo de sede (`get_admsede_centros_custo`, `is_admsede_for_cc`) |
| `aprovador_diarias_id` | `bd_funcionarios` | Aprovação de diárias |
| `planejador_responsavel_id` | **`profiles`** | Planejamento (⚠️ **domínio diferente dos demais**) |

**`planejador_responsavel_id` aponta para `profiles`, enquanto os outros quatro apontam para `bd_funcionarios`.** Essa assimetria é uma armadilha real para qualquer novo desenvolvimento.

Também carrega geocoding (`latitude`, `longitude`, `raio_ponto_metros`) usado pela cerca geográfica do Ponto Eletrônico.

**Funções de escopo por CC** (a base do "RBAC operacional"):
`fn_ativos_user_centros_custo`, `fn_ativos_user_centros_custo_responsavel`, `fn_diaria_scope_centros_custo`, `fn_planejamento_scope_centros_custo`, `fn_notificacao_dest_centros_custo`, `fn_ponto_user_can_access_cc`, `fn_logistica_can_access_centro_custo`, `fn_ativos_can_access_centro_custo`, `get_admsede_centros_custo`, `is_admsede_for_cc`.
Frontend: `src/hooks/useEscopoCentrosCusto.ts`, `useEscopoOperacional.ts`, `useAdmSedeScope.ts` (órfão), `src/pages/dev/EscopoDebug.tsx`.

---

## 5. Segregação de dados sensíveis de funcionários — **INCOMPLETA**

Existe a tabela `bd_funcionarios_sensivel` (39 colunas) para segregar PII/financeiro. **Porém `bd_funcionarios` (53 colunas) continua contendo exatamente os mesmos campos sensíveis:**

| Campo sensível | Em `bd_funcionarios` | Em `bd_funcionarios_sensivel` |
|---|:--:|:--:|
| `cpf` | ✔ (**NOT NULL**) | ✔ (+ `cpf_hash`) |
| `salario_base` | ✔ | ✔ |
| `banco`, `agencia`, `conta_corrente`, `chave_pix` | ✔ | ✔ (+ `pix_hash`) |
| `data_nascimento` | ✔ | ✔ |
| `endereco_*` (8 colunas), `latitude`, `longitude` | ✔ | ✔ |
| `gratificacao`, `insalubridade`, `periculosidade`, `adicional_noturno`, `refeicao`, `diarias`, `custo_passagem` | ✔ | ✔ |
| `email` | ✔ | ✔ (+ `email_hash`) |
| `imagem`, `observacoes` | ✔ | ✔ |

**Conclusão:** a migração para a tabela segregada foi feita em **modo aditivo** e **nunca concluída** — os dados sensíveis permanecem duplicados na tabela de acesso amplo. Qualquer falha de RLS em `bd_funcionarios` expõe folha de pagamento, CPF, PIX e endereço residencial de todos os funcionários.

Isso agrava criticamente o achado de policy permissiva descrito em `08-MAPA-RLS.md` §4 e `14-RISCOS-SEGURANCA.md` §1.

**`[VERIFICAR NO BANCO]`**
```sql
-- Os dados sensíveis ainda estão populados na tabela ampla?
select
  count(*) filter (where cpf          is not null) as com_cpf,
  count(*) filter (where salario_base is not null) as com_salario,
  count(*) filter (where chave_pix    is not null) as com_pix,
  count(*) as total
from public.bd_funcionarios;
```

---

## 6. Tabelas de RBAC — estrutura real

### RBAC NOVO
| Tabela | Colunas |
|---|---|
| `bd_roles` | `id`, `nome`, `descricao`, `ativo`, `created_at`, `updated_at` |
| `bd_permissions` | `id`, `codigo`, `nome`, `descricao`, `modulo`, `rota`, `tipo`, `ativo`, timestamps |
| `bd_user_roles` | `id`, `user_id` (→`profiles`), `role_id` (→`bd_roles`), `created_at` |
| `bd_role_permissions` | `id`, `role_id`, `permission_id` — **sem granularidade de ação** |
| `bd_role_permission_actions` | `id`, `role_id`, `permission_id`, **`acao`**, `created_at` |
| `bd_user_permission_overrides` | `id`, `user_id`, `permission_id`, **`acao`**, **`permitido`** (boolean), timestamps |

### RBAC LEGADO
| Tabela | Colunas |
|---|---|
| `bd_permissoes` | `id`, `nome_permissao`, `descricao`, `rota`, `modificado_por`, timestamps — **0 FKs de entrada** |
| `bd_funcoes_permissao` | `id`, `nome_funcao`, `descricao`, **`permissoes: uuid[]`** (array, sem FK), `modificado_por`, timestamps |
| `bd_permissoes_acoes` | `id`, `permission_id` (→ **`bd_permissions`**, isto é, o catálogo NOVO), `acao`, `descricao` |

### Ponte
| Tabela | Colunas |
|---|---|
| `bd_rbac_legacy_map` | `legacy_nome`, `new_codigo` (→`bd_permissions`), `action_padrao`, `status`, `observacao`, timestamps |
| View | `vw_rbac_legacy_map_drift`, `vw_rbac_standard_funcao_permissoes`, `vw_rbac_standard_permission_gaps`, `vw_rbac_roles_safe`, `vw_rbac_permissions_safe` |

**Inconsistência estrutural detectada:** `bd_user_permission_overrides.permission_id` tem FK apenas para `bd_permissions` (catálogo NOVO), mas a função `fn_has_permission` faz `left join` de `bd_user_permission_overrides` contra **`bd_permissoes` (legado) E `bd_permissions` (novo)`** simultaneamente. O ramo legado desse join é estruturalmente inalcançável enquanto a FK existir.

**`[VERIFICAR NO BANCO]`**
```sql
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.bd_user_permission_overrides'::regclass;
```

---

## 7. Enums (22)

| Enum | Valores conhecidos |
|---|---|
| `chamado_interno_prioridade` | `baixa`, `normal`, `alta`, `critico` |
| `chamado_interno_status`, `chamado_interno_setor`, `chamado_interno_evento_tipo` | (referenciados em `types.ts`) |
| `ponto_modo_registro` | `pwa_pessoal`, `totem`, `dispositivo_obra` |
| `ponto_status_sync` | `sincronizado`, `pendente_sync`, `erro_sync` |
| `ponto_tipo_vinculo` | `fixo`, `temporario`, `mobilizado`, `compartilhado` |
| `ponto_tipo_batida`, `ponto_status_validacao` | |
| `diaria_lote_origem` | `legado`, `explicito`, `apontamento_dia` |
| `diaria_lote_status`, `diaria_lote_item_status` | |
| `prioridade_solicitacao_enum` | `NORMAL`, `ALTA`, `URGENTE` |
| `confiabilidade_previsao_enum` | `ALTA`, `MEDIA`, `BAIXA` |
| `tipo_alocacao_equipe` | `proprio_cc`, `emprestado_outra_obra` |
| `papel_equipe_tarefa`, `status_equipe_designada` | |
| `status_operacional_enum`, `status_solicitacao_equip_enum` | |
| `origem_localizacao_enum` | |
| `origem_auditoria_biometria`, `tipo_evento_auditoria_biometria` | |

> Note a **inconsistência de convenção**: alguns enums usam `MAIÚSCULAS` (`NORMAL`/`ALTA`), outros `minúsculas` (`baixa`/`normal`/`alta`). `bd_funcionarios.status` e `bd_centros_custo.situacao` são **`text` livre**, não enums.

---

## 8. Índices

**434 índices distintos** criados nas migrations (474 statements). Não é possível avaliar cobertura sem `pg_stat_user_indexes`.

**`[VERIFICAR NO BANCO]`**
```sql
-- FKs sem índice de apoio (causa comum de lentidão em JOIN/DELETE)
select c.conrelid::regclass as tabela, a.attname as coluna
from pg_constraint c
join unnest(c.conkey) k(attnum) on true
join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
where c.contype = 'f' and c.connamespace = 'public'::regnamespace
  and not exists (
    select 1 from pg_index i
    where i.indrelid = c.conrelid and a.attnum = any(i.indkey[0:0])
  )
order by 1,2;

-- Índices nunca usados
select schemaname, relname, indexrelname, idx_scan, pg_size_pretty(pg_relation_size(indexrelid))
from pg_stat_user_indexes
where schemaname='public' and idx_scan = 0
order by pg_relation_size(indexrelid) desc;
```

---

## 9. Tabelas presentes em policies mas ausentes de `types.ts`

Indicam tabelas **removidas do banco** (policies órfãs no histórico) ou **não expostas** ao PostgREST:

`bd_caminhoes`, `bd_centro_custo`, `bd_centros_custo_alias`, `bd_empresas_alias`, `bd_funcoes_alias`, `bd_os_movimentacoes`, `portfolio_categories`, `portfolio_images`, `portfolio_projects`, `services`.

**`[VERIFICAR NO BANCO]`**
```sql
select tablename from pg_tables where schemaname='public'
and tablename in ('bd_caminhoes','bd_centro_custo','bd_centros_custo_alias',
 'bd_empresas_alias','bd_funcoes_alias','bd_os_movimentacoes',
 'portfolio_categories','portfolio_images','portfolio_projects','services');
```

---

## 10. Volume de dados

Não determinável estaticamente. **Obrigatório levantar antes de qualquer alteração de esquema.**

**`[VERIFICAR NO BANCO]`**
```sql
select
  c.relname as tabela,
  pg_size_pretty(pg_total_relation_size(c.oid)) as tamanho_total,
  s.n_live_tup as linhas_estimadas
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_stat_user_tables s on s.relid = c.oid
where n.nspname='public' and c.relkind='r'
order by pg_total_relation_size(c.oid) desc
limit 40;
```
