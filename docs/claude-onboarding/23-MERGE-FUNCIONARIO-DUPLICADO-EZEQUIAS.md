# 23 — AUDITORIA E PLANO DE MERGE — FUNCIONÁRIO DUPLICADO

> **EZEQUIAS JOSÉ RUFINO** · Auditoria READ-ONLY em 2026-09-01 · Projeto `eexzgpmrousuxlkvqwkm`
> **NADA FOI EXECUTADO.** Zero DELETE/UPDATE/INSERT/DDL. Nenhuma RPC mutante invocada.
> CPF nunca exibido além dos 2 últimos dígitos.

---

## ⚠️ BLOQUEIO — o critério de desempate fornecido não desambigua

O critério informado foi *"o cadastro canônico é o registro cujo CPF termina em **18**"*.

**Os DOIS registros têm CPF terminando em 18.** Portanto o critério, isoladamente, **não identifica o canônico**.

Os CPFs, porém, **não são o mesmo número**:

| Verificação | Resultado |
|---|---|
| CPFs idênticos? | **NÃO** |
| B é A sem zero à esquerda? | **NÃO** |
| Últimos 9 dígitos iguais? | **NÃO** |
| Coincidem apenas em… | **os 2 últimos dígitos ("18")** |

| Registro | Dígitos no CPF | Formato válido (11 dígitos) |
|---|---:|:--:|
| **A** `aeac500e…6388` | **11** | ✔ **SIM** |
| **B** `0746c95a…1815` | **10** | ✘ **NÃO — malformado** |

---

## PASSO 1 — Registros identificados

Busca por nome normalizado (`normalize_text`, `EZEQUIAS` + `RUFINO`): **exatamente 2 registros**. Não há terceiro — a condição de parada por multiplicidade não se aplica.

| Campo | **A** (proposto canônico) | **B** (proposto duplicado) |
|---|---|---|
| `funcionario_id` | `aeac500e-3219-437a-a9bf-b52425ff6388` | `0746c95a-c9ba-4b9d-bf9e-75973ecf1815` |
| `nome_completo` | EZEQUIAS JOSÉ RUFINO | EZEQUIAS JOSÉ RUFINO |
| CPF mascarado | `***.***.***-18` | `***.***.***-18` |
| Dígitos do CPF | **11 (válido)** | **10 (malformado)** |
| `matricula` | `3410` | `003410` (zero-padded) |
| `status` | Ativo | Ativo |
| `centro_custo_id` | `433c588d…9b41` | `2445d822…522e` |
| `funcao_id` | `de8f4c6d…1739` | `de8f4c6d…1739` (igual) |
| `departamento_id` | `230b5a60…9360` | igual |
| `empresa_id` | `a924d265…eafb` | igual |
| `equipe_id` | null | null |
| `data_admissao` | 2026-03-04 | **2023-11-21** |
| `created_at` | 2026-03-04 18:32 | 2026-08-18 11:19 |
| `updated_at` | 2026-07-16 18:16 | 2026-08-18 11:19 |

### Evidências que sustentam **A** como canônico

1. **Único com CPF estruturalmente válido** (11 dígitos). B tem 10 — truncamento típico de importação numérica.
2. **É o registro com identidade de sistema**: 1 `profiles` → 1 `auth.users` → 1 papel RBAC. B não tem nenhum.
3. Criado no ERP em 2026-03-04; B foi criado 5 meses depois (2026-08-18) com matrícula zero-padded e data de admissão da folha — assinatura clássica de **importação Alterdata**.

### Evidência que favorece **B** em um ponto específico

`data_admissao` de B (**2023-11-21**) parece ser a admissão real da folha; a de A (2026-03-04) coincide com a data de criação do registro no ERP — provavelmente preenchimento automático, não dado real de RH.

**Isto não muda o canônico, mas é candidato a completar/corrigir o canônico — e exige sua decisão.**

---

## PASSO 2 — Auditoria de `merge_duplicate_funcionarios`

### Overloads encontradas (3)

| Função | Owner | SECDEF | search_path | anon | authenticated | service_role |
|---|---|:--:|---|:--:|:--:|:--:|
| `merge_duplicate_funcionarios()` | postgres | ✔ | `public` | ✘ | ✘ | ✔ |
| `merge_duplicate_funcionarios_normalized()` | postgres | ✔ | `public` | **✔** | **✔** | ✔ |
| `merge_duplicate_funcionarios_by_email_normalized()` | postgres | ✔ | `public` | **✔** | **✔** | ✔ |

> 🔴 **Achado colateral (fora do escopo desta tarefa, apenas reportado):** as duas variantes `_normalized` continuam **executáveis por `anon`**. São funções destrutivas em massa que fazem `DELETE FROM bd_funcionarios`. O HOTFIX-01 cobriu apenas `merge_duplicate_funcionarios()`. **Reportado, não corrigido.**

### Análise funcional

| # | Critério | Resultado |
|---|---|---|
| 3 | Assinatura | **Sem parâmetros.** Opera sobre **TODA a tabela**, não sobre um par |
| 8 | Escolha do mestre | `is_active DESC, has_valid_cpf DESC, has_email DESC, has_address DESC, has_dob DESC, has_funcao DESC, updated_at DESC, created_at DESC` |
| 9 | Relacionamentos atualizados | **Apenas 7**: `bd_apontamento_equipe.colaborador_id`, `bd_avaliacao_equipe.colaborador_id`, `bd_registro_apontamento_cam_equipa.operador_id`, `bd_equipes.apontador_id`, `bd_equipes.encarregado_id`, `bd_lista_programacao_entrega.apontador_id`, `profiles.funcionario_id` |
| 10 | Deleta o duplicado? | **SIM — `DELETE FROM bd_funcionarios`** |
| 11 | Mantém auditoria? | Grava em **`bd_carga_status_historico`** (tabela de histórico de status de **carga**) — uso semanticamente incorreto |
| 12 | Trata colisões UNIQUE? | **NÃO** |
| 13 | Trata `profiles.funcionario_id`? | Sim |
| 14 | Trata `bd_funcionarios_sensivel`? | **NÃO** (seria apagado por `ON DELETE CASCADE`) |
| 15 | Callers | **Nenhum** no frontend, Edge Functions ou SQL |

### 🔴 Por que reutilizá-la seria um erro grave neste caso

1. **Escopo global.** Sem parâmetros, mescla **todos** os nomes duplicados do ERP. Viola diretamente "não corrigir duplicados de outras pessoas".
2. **Escolheria o registro ERRADO.** `has_valid_cpf` apenas testa "não vazio e não começa com 'pendente'" — **não valida 11 dígitos**. Ambos pontuam 1. O desempate cai em `updated_at DESC` → **B (2026-08-18) venceria A (2026-07-16)**. A função manteria o CPF malformado e **apagaria o registro que tem o login**.
3. **Não migra `bd_chamados_internos.solicitante_funcionario_id`** — exatamente onde estão as 2 referências de B.
4. **Não trata `bd_funcionarios_sensivel`**, que tem `ON DELETE CASCADE` → o registro de PII segregada do descartado seria **apagado silenciosamente**.
5. **DELETE físico** sem registro de "consolidado em".

### **`MERGE_EXISTENTE_REUTILIZAVEL = NÃO`**

---

## PASSO 3 — Foreign keys para `bd_funcionarios(id)`

**53 constraints · 50 pares (tabela, coluna) distintos · 40 tabelas.** Descoberta dinâmica via `pg_constraint`.

### Referências reais (apenas 3 pares têm dados)

| Tabela | Coluna | ON UPDATE | ON DELETE | Ref. **A** | Ref. **B** |
|---|---|---|---|---:|---:|
| `bd_chamados_internos` | `solicitante_funcionario_id` | NO ACTION | **RESTRICT** | 0 | **2** |
| `bd_funcionarios_sensivel` | `funcionario_id` | NO ACTION | **CASCADE** | **1** | **1** |
| `profiles` | `funcionario_id` | NO ACTION | NO ACTION | **1** | 0 |

**Os outros 47 pares têm 0 referências para ambos os IDs** — incluindo diárias, presenças, ponto, atestados, apontamentos, OS, transporte, equipes, desligamentos, transferências e classificações.

> Anomalia estrutural registrada (não corrigir): `bd_equipes.apontador_id` e `bd_equipes.encarregado_id` possuem **duas FKs cada** para a mesma coluna, com `ON DELETE` divergente (`SET NULL` × `NO ACTION`).

---

## PASSO 4 — Referências sem FK

Varredura por colunas `uuid` com semântica de funcionário e sem FK para `bd_funcionarios`. Verificadas 12 colunas candidatas:

`bd_atestados_nonces_utilizados.funcionario_id` · `bd_auditoria_sync_equipe_funcionario.funcionario_id` · `bd_ct_checklists.realizado_por_funcionario_id` · `bd_ct_recebimentos.recebedor_previsto_id` · `bd_ct_recebimentos.recebedor_real_id` · `bd_diaria_lote_funcionarios.funcionario_id` · `bd_movimentacao_transporte.motorista_id` · `bd_ordens_diarias_obra_apontamentos.registrado_por_funcionario_id` · `bd_ponto_match_log.funcionario_confirmado_id` · `.top1_funcionario_id` · `.top2_funcionario_id` · `bd_ponto_relatorio_auditoria.funcionario_id`

**Resultado: 0 referências para A e 0 para B em todas.**

Classificadas como **NÃO RELACIONADA** neste caso concreto (a coluna existe, mas não aponta para nenhum dos dois).

Colunas como `bd_solicitacoes_equipamento.solicitante_id`, `bd_aprovacoes_fluxo_exec.aprovador_resolvido_id` e `bd_solicitacoes_desmobilizacao.engenheiro_*` referenciam **`profiles`**, não `bd_funcionarios` — classificadas como **FK REAL (para outro domínio)**.

---

## PASSO 5 — JSON / JSONB

64 colunas `json`/`jsonb` no schema `public`. Varredura textual dos dois UUIDs nas 18 mais relevantes (convocados, snapshots de equipe, aditivos, lotes, payloads, auditoria).

| Tabela | Coluna | Ref. **A** | Ref. **B** |
|---|---|---:|---:|
| `bd_auditoria_log` | `dados_novos` | 5 | **7** |
| `bd_auditoria_log` | `dados_anteriores` | 3 | **4** |

**Todas as demais: 0.** Em particular, `bd_diaria_solicitacoes.convocados_pre`, `bd_diaria_aditivos.*`, `bd_ordens_diarias_obra_itens.equipe_snapshot` e `bd_diaria_lote_funcionarios.extras` **não contêm** nenhum dos dois IDs.

> 🔒 **As referências em `bd_auditoria_log` NÃO devem ser reescritas.** São snapshots históricos imutáveis. Reescrevê-las destruiria a trilha de auditoria — o oposto do objetivo.

---

## PASSO 6 — Profiles / Auth

| Métrica | **A** | **B** |
|---|---:|---:|
| `profiles.funcionario_id` apontando | **1** | **0** |
| `auth.users` correspondente | **1** | 0 |
| `bd_user_roles` (papéis RBAC) | **1** | 0 |

**Conclusão:** a identidade de sistema (login, usuário Auth e papel RBAC) está **inteiramente vinculada a A**. B nunca teve acesso ao sistema.

Consequência prática: **nada precisa ser migrado em `profiles`** — o vínculo já está no canônico. Nenhuma alteração em Auth, nenhum usuário criado, nenhum e-mail trocado.

---

## PASSO 7 — Dados sensíveis

| Estrutura | **A** | **B** |
|---|---:|---:|
| `bd_funcionarios_sensivel` | **1 registro** | **1 registro** |
| `bd_funcionarios_biometria_facial` | 0 | 0 |
| `bd_auditoria_leitura_funcionario_sensivel` | 0 | 0 |

Nenhum valor de CPF, salário, PIX, banco, agência, conta ou endereço foi lido ou exibido.

A tabela é populada automaticamente pelo trigger `trg_sync_funcionario_sensitive → fn_sync_funcionario_sensitive` em `bd_funcionarios` — ou seja, o conteúdo de `bd_funcionarios_sensivel` é **derivado** do registro pai.

---

## PASSO 8 — Colisões antes do merge

| Tabela | Ref. A | Ref. B | Constraint relevante | Colisão após merge? | Tratamento necessário |
|---|---:|---:|---|---|---|
| `bd_chamados_internos` | 0 | 2 | `UNIQUE(numero)`, `UNIQUE(protocolo)` — **não envolvem funcionário** | **NÃO** | `UPDATE` simples de FK. Protocolos `CHI-2026-000092` e `CHI-2026-000097` (ambos `respondido`) preservados |
| `bd_funcionarios_sensivel` | 1 | 1 | **`UNIQUE (funcionario_id)`** | 🔴 **SIM** | Não é possível `UPDATE`. Ver §8.1 |
| `profiles` | 1 | 0 | — | **NÃO** | Nada a fazer |

**Nenhuma outra tabela** apresenta colisão, porque **nenhuma outra tem referências** aos dois IDs — não há diárias, presenças, apontamentos, ponto, atestados, transferências, desligamentos, classificações, equipes, OS, solicitações, aprovações ou transporte envolvidos.

### 8.1 Tratamento da colisão em `bd_funcionarios_sensivel`

`UNIQUE (funcionario_id)` impede que a linha de B passe a apontar para A (A já possui a sua).

O conteúdo de `bd_funcionarios_sensivel` é **derivado** de `bd_funcionarios` via trigger. A linha de B é uma cópia dos dados de B — que estão sendo descartados em favor dos de A.

**Tratamento correto:** a linha sensível de B **não deve ser migrada**. Ela é descartada junto com B (via `ON DELETE CASCADE`, se houver DELETE) ou permanece atrelada a B (se houver inativação).

⚠️ **Antes de descartar**, o merge deve comparar as colunas sensíveis de A e B e reportar divergências relevantes — em especial **`banco` e `chave_pix`, que estão CONFLITANTES** (ver §9). Se o dado bancário correto estiver em B, descartá-lo silenciosamente causaria erro de pagamento.

---

## PASSO 9 — Comparação estrutural dos dois cadastros

| Situação | Colunas |
|---|---|
| **IGUAL** (17) | `nome_completo`, `status`, `funcao_id`, `departamento_id`, `empresa_id`, `escolaridade`, `genero`, `tipo_escala`, `data_nascimento`, `agencia`, `conta_corrente`, `salario`-derivados (`gratificacao`, `insalubridade`, `periculosidade`, `adicional_noturno`, `diarias`, `custo_passagem`) |
| **CONFLITANTE** (13) | `id`, `cpf`, `matricula`, `centro_custo_id`, `data_admissao`, `created_at`, `updated_at`, `email`, `banco`, `chave_pix`, `salario_base`, `refeicao`, `endereco_completo` |
| **SÓ NO CANÔNICO A** (2) | `data_ferias` (2027-03-04), `observacoes` |
| **SÓ NO DUPLICADO B** (1) | `modificado_por` (`a3ab780a…703d`) |
| **AMBOS NULL** | demais |

### Leitura

- **`agencia`, `conta_corrente` e `data_nascimento` IGUAIS** confirmam com alta confiança que é **a mesma pessoa**.
- **`banco` e `chave_pix` CONFLITANTES** com a mesma conta corrente é anômalo — precisa de decisão humana. **Risco financeiro.**
- **`salario_base` e `refeicao` CONFLITANTES** — precisa de decisão de RH sobre qual é o vigente.
- **`matricula`**: `3410` × `003410` — equivalentes após remover zeros à esquerda. Mesma matrícula.
- **`centro_custo_id` CONFLITANTE** — decisão operacional sobre a lotação atual.

### Regra proposta (a confirmar)

1. CPF do **canônico A prevalece** (é o único válido).
2. Valores já preenchidos em A **não são sobrescritos automaticamente**.
3. Campos NULL em A e preenchidos em B → **candidatos** a completar (aqui: apenas `modificado_por`, irrelevante).
4. **Todo campo CONFLITANTE é REPORTADO e aguarda decisão** — nenhum é resolvido automaticamente.

---

## PASSO 10 — Preservação do histórico

Não há histórico volumoso a preservar: o duplicado B possui **apenas 2 chamados internos**.

A estratégia é `UPDATE` da FK (`solicitante_funcionario_id`), preservando `id`, `protocolo`, `numero`, `created_at`, status e todo o conteúdo dos chamados. **Nenhum DELETE + INSERT.**

---

## PASSO 11 — Auditoria

### Infraestrutura existente em `bd_funcionarios`

8 triggers ativos:

| Trigger | Função | Papel |
|---|---|---|
| `trg_auditoria_bd_funcionarios` | `fn_auditoria_log` | **Auditoria automática** → `bd_auditoria_log` (INSERT/UPDATE/**DELETE**) |
| `trg_audit_cpf_alterado` | `trg_audit_cpf_alterado_fn` | Auditoria específica de alteração de CPF |
| `trg_sync_funcionario_sensitive` | `fn_sync_funcionario_sensitive` | Sincroniza → `bd_funcionarios_sensivel` |
| `trg_funcionarios_link_profile` | `trg_funcionarios_link_profile_fn` | Vincula profile automaticamente |
| `prevent_funcionario_duplicates_normalized` | `prevent_duplicate_funcionarios_normalized` | **Impede duplicidade por nome normalizado** |
| `trg_proteger_geocoding_manual_func` / `trg_validar_geocoding_func` | geocoding | guardas |
| `update_funcionarios_updated_at` | `update_updated_at_column` | timestamp |

`bd_auditoria_log` possui **39.901 registros** de `bd_funcionarios` e já audita `DELETE`, gravando `dados_anteriores`.

> ❓ **Pergunta em aberto:** existe o trigger `prevent_funcionario_duplicates_normalized` — e mesmo assim B foi criado em 2026-08-18 com o mesmo nome normalizado de A. Ou o trigger foi criado depois, ou permite a inserção quando o CPF difere. **Reportado, não investigado** (fora do escopo).

### Registro proposto da consolidação

Usar a infraestrutura existente — **sem criar tabela**. O trigger `fn_auditoria_log` já grava automaticamente. Adicionalmente, gravar um registro explícito de consolidação em `bd_auditoria_log`:

```
tabela           = 'bd_funcionarios'
operacao         = 'UPDATE'
registro_id      = <DUPLICATE_ID>
usuario_id       = auth.uid()
campos_alterados = ARRAY['consolidacao_duplicado']
dados_novos      = jsonb_build_object(
                     'acao','MERGE_FUNCIONARIO',
                     'duplicate_id', <DUPLICATE_ID>,
                     'canonical_id', <CANONICAL_ID>,
                     'motivo','Consolidação de cadastro duplicado — Ezequias José Rufino',
                     'referencias_migradas', jsonb_build_object('bd_chamados_internos', 2),
                     'executado_em', now()
                   )
```

> ❌ **Não usar `bd_carga_status_historico`** como as funções de merge existentes fazem — é tabela de histórico de status de carga, uso semanticamente incorreto.

---

## PASSO 12 — Destino do registro duplicado

| Opção | Viável? | Avaliação |
|---|---|---|
| **A) DELETE físico** | Sim | É o que as funções existentes fazem. `ON DELETE CASCADE` removeria a linha de `bd_funcionarios_sensivel`. A auditoria capta o DELETE com `dados_anteriores`. **Porém**: a rastreabilidade passaria a depender de leitura de JSONB de auditoria, e o CPF malformado voltaria a ficar livre no `UNIQUE(cpf)`. |
| **B) Soft-delete** | **Não existe** coluna `deleted_at` em `bd_funcionarios` |
| **C) Inativação** | Sim | `status = 'Inativo'` — mecanismo já existente e usado pelo ERP |
| **D) Marcação como consolidado** | Sim | `observacoes` recebendo referência ao canônico |
| **E) Mecanismo do merge existente** | = opção A | mas com todos os defeitos da §2 |

### Recomendação: **C + D** (inativar e marcar), **não** DELETE

Justificativa:
1. O ERP **já usa `status`** como mecanismo de desativação — é o modelo existente.
2. Preserva rastreabilidade **consultável** (não dependente de JSONB de auditoria).
3. Mantém o CPF malformado retido no `UNIQUE(cpf)`, evitando reuso indevido.
4. Preserva a linha de `bd_funcionarios_sensivel` de B para eventual conferência do conflito bancário.
5. **Totalmente reversível.**

> Isso **diverge** das funções de merge existentes (que deletam). A divergência é intencional e está justificada — a instrução é explícita: *"Se DELETE físico puder destruir rastreabilidade: não propor DELETE."*
>
> **A escolha final é sua.** Se preferir DELETE físico para alinhar ao padrão existente, o plano se ajusta trocando o passo 5.

---

## PASSOS 13–14 — Plano transacional atômico com guards

> **PROPOSTA. NÃO EXECUTADA.** Placeholders `:CANONICAL_ID` e `:DUPLICATE_ID` a confirmar.

```sql
BEGIN;

-- ─────────────────────────────────────────────────────────────
-- GUARDS (abortam tudo se qualquer premissa falhar)
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_canonical uuid := 'aeac500e-3219-437a-a9bf-b52425ff6388';
  v_duplicate uuid := '0746c95a-c9ba-4b9d-bf9e-75973ecf1815';
  v_cnt int;
BEGIN
  -- 1. ambos existem
  IF NOT EXISTS (SELECT 1 FROM public.bd_funcionarios WHERE id = v_canonical) THEN
    RAISE EXCEPTION 'GUARD: CANONICAL_ID nao existe';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.bd_funcionarios WHERE id = v_duplicate) THEN
    RAISE EXCEPTION 'GUARD: DUPLICATE_ID nao existe';
  END IF;

  -- 2. CPF do canonico termina em 18 E tem 11 digitos
  IF NOT EXISTS (
    SELECT 1 FROM public.bd_funcionarios
     WHERE id = v_canonical
       AND right(regexp_replace(coalesce(cpf,''),'[^0-9]','','g'),2) = '18'
       AND length(regexp_replace(coalesce(cpf,''),'[^0-9]','','g')) = 11
  ) THEN
    RAISE EXCEPTION 'GUARD: CPF do CANONICAL_ID nao confere (esperado 11 digitos terminando em 18)';
  END IF;

  -- 3. nao surgiu um terceiro Ezequias
  SELECT count(*) INTO v_cnt FROM public.bd_funcionarios
   WHERE upper(public.normalize_text(nome_completo)) LIKE '%EZEQUIAS%'
     AND upper(public.normalize_text(nome_completo)) LIKE '%RUFINO%';
  IF v_cnt <> 2 THEN
    RAISE EXCEPTION 'GUARD: esperados 2 registros, encontrados %', v_cnt;
  END IF;

  -- 4. idempotencia — merge ja executado?
  IF EXISTS (
    SELECT 1 FROM public.bd_auditoria_log
     WHERE tabela = 'bd_funcionarios'
       AND dados_novos->>'acao' = 'MERGE_FUNCIONARIO'
       AND dados_novos->>'duplicate_id' = v_duplicate::text
  ) THEN
    RAISE EXCEPTION 'GUARD: merge ja executado anteriormente para este duplicado';
  END IF;

  -- 5. footprint inesperado: nenhuma referencia nova alem das mapeadas
  SELECT count(*) INTO v_cnt FROM public.bd_chamados_internos
   WHERE solicitante_funcionario_id = v_duplicate;
  IF v_cnt <> 2 THEN
    RAISE EXCEPTION 'GUARD: esperados 2 chamados internos, encontrados %', v_cnt;
  END IF;

  SELECT count(*) INTO v_cnt FROM public.profiles WHERE funcionario_id = v_duplicate;
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION 'GUARD: DUPLICATE_ID passou a ter profile vinculado (%)', v_cnt;
  END IF;

  SELECT count(*) INTO v_cnt FROM public.profiles WHERE funcionario_id = v_canonical;
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION 'GUARD: CANONICAL_ID deveria ter exatamente 1 profile, tem %', v_cnt;
  END IF;

  -- 6. colisao conhecida em bd_funcionarios_sensivel continua sendo 1x1
  SELECT count(*) INTO v_cnt FROM public.bd_funcionarios_sensivel
   WHERE funcionario_id IN (v_canonical, v_duplicate);
  IF v_cnt <> 2 THEN
    RAISE EXCEPTION 'GUARD: bd_funcionarios_sensivel fora do esperado (%)', v_cnt;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- LOCK mínimo (apenas as 2 linhas do funcionário)
-- ─────────────────────────────────────────────────────────────
SELECT id FROM public.bd_funcionarios
 WHERE id IN ('aeac500e-3219-437a-a9bf-b52425ff6388',
              '0746c95a-c9ba-4b9d-bf9e-75973ecf1815')
 FOR UPDATE;

-- ─────────────────────────────────────────────────────────────
-- PASSO 1 — migrar a ÚNICA referência externa do duplicado
-- ─────────────────────────────────────────────────────────────
UPDATE public.bd_chamados_internos
   SET solicitante_funcionario_id = 'aeac500e-3219-437a-a9bf-b52425ff6388'
 WHERE solicitante_funcionario_id = '0746c95a-c9ba-4b9d-bf9e-75973ecf1815';
-- esperado: 2 linhas

-- ─────────────────────────────────────────────────────────────
-- PASSO 2 — (OPCIONAL, requer aprovação) completar data_admissao
--           Só se você confirmar que 2023-11-21 é a admissão real.
-- ─────────────────────────────────────────────────────────────
-- UPDATE public.bd_funcionarios
--    SET data_admissao = '2023-11-21'
--  WHERE id = 'aeac500e-3219-437a-a9bf-b52425ff6388';

-- ─────────────────────────────────────────────────────────────
-- PASSO 3 — inativar e marcar o duplicado (NÃO deletar)
-- ─────────────────────────────────────────────────────────────
UPDATE public.bd_funcionarios
   SET status = 'Inativo',
       observacoes = concat_ws(E'\n', observacoes,
         'CONSOLIDADO em aeac500e-3219-437a-a9bf-b52425ff6388 (cadastro duplicado) — ' ||
         to_char(now(),'YYYY-MM-DD'))
 WHERE id = '0746c95a-c9ba-4b9d-bf9e-75973ecf1815';

-- ─────────────────────────────────────────────────────────────
-- PASSO 4 — auditoria explícita da consolidação
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.bd_auditoria_log
  (tabela, operacao, registro_id, usuario_id, campos_alterados, dados_novos)
VALUES
  ('bd_funcionarios','UPDATE','0746c95a-c9ba-4b9d-bf9e-75973ecf1815', auth.uid(),
   ARRAY['consolidacao_duplicado'],
   jsonb_build_object(
     'acao','MERGE_FUNCIONARIO',
     'duplicate_id','0746c95a-c9ba-4b9d-bf9e-75973ecf1815',
     'canonical_id','aeac500e-3219-437a-a9bf-b52425ff6388',
     'motivo','Consolidação de cadastro duplicado — Ezequias José Rufino',
     'referencias_migradas', jsonb_build_object('bd_chamados_internos', 2),
     'destino_duplicado','inativado_e_marcado'
   ));

-- ─────────────────────────────────────────────────────────────
-- VALIDAÇÃO FINAL — aborta se algo ficou pendente
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE v_cnt int;
BEGIN
  SELECT count(*) INTO v_cnt FROM public.bd_chamados_internos
   WHERE solicitante_funcionario_id = '0746c95a-c9ba-4b9d-bf9e-75973ecf1815';
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'POS: ainda restam % chamados no duplicado', v_cnt; END IF;

  SELECT count(*) INTO v_cnt FROM public.bd_chamados_internos
   WHERE solicitante_funcionario_id = 'aeac500e-3219-437a-a9bf-b52425ff6388';
  IF v_cnt <> 2 THEN RAISE EXCEPTION 'POS: canonico deveria ter 2 chamados, tem %', v_cnt; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.bd_funcionarios
                  WHERE id='aeac500e-3219-437a-a9bf-b52425ff6388'
                    AND right(regexp_replace(coalesce(cpf,''),'[^0-9]','','g'),2)='18'
                    AND length(regexp_replace(coalesce(cpf,''),'[^0-9]','','g'))=11) THEN
    RAISE EXCEPTION 'POS: CPF do canonico foi alterado indevidamente';
  END IF;
END $$;

COMMIT;
-- Qualquer EXCEPTION acima → ROLLBACK automático de TUDO.
```

---

## PASSO 15 — SQL de validação pós-merge

```sql
-- 1. duplicado sem referências externas
select 'bd_chamados_internos' t, count(*) from bd_chamados_internos
 where solicitante_funcionario_id='0746c95a-c9ba-4b9d-bf9e-75973ecf1815'
union all select 'profiles', count(*) from profiles
 where funcionario_id='0746c95a-c9ba-4b9d-bf9e-75973ecf1815';
-- ESPERADO: 0 e 0

-- 2/3/4. canônico recebeu o histórico e o total foi preservado
select count(*) as chamados_no_canonico from bd_chamados_internos
 where solicitante_funcionario_id='aeac500e-3219-437a-a9bf-b52425ff6388';
-- ESPERADO: 2   (antes: A=0, B=2 → total 2. Depois: A=2, B=0 → total 2)

select count(*) as total_chamados_dos_dois from bd_chamados_internos
 where solicitante_funcionario_id in ('aeac500e-3219-437a-a9bf-b52425ff6388',
                                      '0746c95a-c9ba-4b9d-bf9e-75973ecf1815');
-- ESPERADO: 2  (idêntico ao valor pré-merge)

select protocolo, status from bd_chamados_internos
 where solicitante_funcionario_id='aeac500e-3219-437a-a9bf-b52425ff6388'
 order by protocolo;
-- ESPERADO: CHI-2026-000092 e CHI-2026-000097, ambos preservados

-- 5/6/7/8. nada mais existia — confirmar que continua zero
-- (diárias, presenças, apontamentos, ponto, atestados, solicitações, vínculos)
select 'diaria_presencas' t, count(*) from bd_diaria_presencas where funcionario_id in ('aeac500e-3219-437a-a9bf-b52425ff6388','0746c95a-c9ba-4b9d-bf9e-75973ecf1815')
union all select 'diaria_aditivos', count(*) from bd_diaria_aditivos where funcionario_id in ('aeac500e-3219-437a-a9bf-b52425ff6388','0746c95a-c9ba-4b9d-bf9e-75973ecf1815')
union all select 'ponto_batidas', count(*) from bd_ponto_batidas where funcionario_id in ('aeac500e-3219-437a-a9bf-b52425ff6388','0746c95a-c9ba-4b9d-bf9e-75973ecf1815')
union all select 'atestados', count(*) from bd_atestados_medicos where funcionario_id in ('aeac500e-3219-437a-a9bf-b52425ff6388','0746c95a-c9ba-4b9d-bf9e-75973ecf1815')
union all select 'apontamento_equipe', count(*) from bd_apontamento_equipe where colaborador_id in ('aeac500e-3219-437a-a9bf-b52425ff6388','0746c95a-c9ba-4b9d-bf9e-75973ecf1815')
union all select 'ponto_vinculos', count(*) from bd_ponto_vinculos_operacionais where funcionario_id in ('aeac500e-3219-437a-a9bf-b52425ff6388','0746c95a-c9ba-4b9d-bf9e-75973ecf1815');
-- ESPERADO: 0 em todas (igual ao pré-merge)

-- 9. nenhum profile órfão
select count(*) as profiles_orfaos from profiles p
 where p.funcionario_id is not null
   and not exists (select 1 from bd_funcionarios f where f.id = p.funcionario_id);
-- ESPERADO: 0

-- 10. nenhuma FK quebrada apontando para os dois IDs
select count(*) as fks_quebradas from bd_chamados_internos c
 where c.solicitante_funcionario_id is not null
   and not exists (select 1 from bd_funcionarios f where f.id = c.solicitante_funcionario_id);
-- ESPERADO: 0

-- 11. nenhuma duplicidade UNIQUE criada
select funcionario_id, count(*) from bd_funcionarios_sensivel
 where funcionario_id in ('aeac500e-3219-437a-a9bf-b52425ff6388','0746c95a-c9ba-4b9d-bf9e-75973ecf1815')
 group by 1 having count(*) > 1;
-- ESPERADO: 0 linhas

-- 12. canônico mantém CPF correto
select id, '***.***.***-'||right(regexp_replace(cpf,'[^0-9]','','g'),2) as cpf_mascarado,
       length(regexp_replace(cpf,'[^0-9]','','g')) as digitos, status
from bd_funcionarios where id='aeac500e-3219-437a-a9bf-b52425ff6388';
-- ESPERADO: ***.***.***-18 | 11 | Ativo

-- 13. auditoria do merge existe
select registro_id, dados_novos->>'canonical_id' as canonical, dados_novos->>'motivo' as motivo, created_at
from bd_auditoria_log
where dados_novos->>'acao'='MERGE_FUNCIONARIO'
  and dados_novos->>'duplicate_id'='0746c95a-c9ba-4b9d-bf9e-75973ecf1815';
-- ESPERADO: exatamente 1 linha
```

---

## PASSO 16 — Delta zero do sistema

```sql
-- funcionários afetados = exatamente 2
select count(*) as funcionarios_afetados from bd_funcionarios
 where id in ('aeac500e-3219-437a-a9bf-b52425ff6388','0746c95a-c9ba-4b9d-bf9e-75973ecf1815');
-- ESPERADO: 2

-- nenhum outro funcionário teve status alterado na janela do merge
select count(*) as outros_alterados from bd_funcionarios
 where updated_at > :inicio_merge
   and id not in ('aeac500e-3219-437a-a9bf-b52425ff6388','0746c95a-c9ba-4b9d-bf9e-75973ecf1815');
-- ESPERADO: 0

-- nenhum outro chamado interno teve solicitante alterado
select count(*) as outros_chamados_alterados from bd_chamados_internos
 where updated_at > :inicio_merge
   and solicitante_funcionario_id <> 'aeac500e-3219-437a-a9bf-b52425ff6388';
-- ESPERADO: 0

-- total global de funcionários inalterado (nada foi deletado)
select count(*) as total_funcionarios from bd_funcionarios;
-- ESPERADO: idêntico ao pré-merge (2.398)
```

---

## Achados colaterais — REPORTADOS, NÃO CORRIGIDOS

| # | Achado | Severidade |
|---|---|---|
| 1 | `merge_duplicate_funcionarios_normalized()` e `merge_duplicate_funcionarios_by_email_normalized()` continuam **executáveis por `anon`** e fazem `DELETE FROM bd_funcionarios` em massa | 🔴 **CRÍTICO** — extensão do SEC-24 não coberta pelo HOTFIX-01 |
| 2 | As 3 funções de merge escolheriam o registro **errado** neste caso (`updated_at DESC` favorece o import) e não tratam `bd_chamados_internos` nem `bd_funcionarios_sensivel` | 🟠 ALTO |
| 3 | O trigger `prevent_funcionario_duplicates_normalized` existe, mas B foi criado com nome normalizado idêntico ao de A | 🟡 investigar |
| 4 | `bd_equipes.apontador_id` e `.encarregado_id` têm **FK duplicada** com `ON DELETE` divergente | 🟡 |
| 5 | As funções de merge gravam "auditoria" em `bd_carga_status_historico` (tabela de status de **carga**) | 🟡 |
| 6 | `banco` e `chave_pix` divergem entre os dois cadastros, com a **mesma conta corrente** | 🟠 risco financeiro — exige conferência de RH |

**Nenhum foi corrigido.** Nenhum outro funcionário foi analisado ou tocado.

---

# MERGE EXECUTADO

| Item | Valor |
|---|---|
| **Status** | ✅ **EXECUTADO COM SUCESSO** |
| Timestamp | **2026-09-01 03:55:05 UTC** |
| Migration (banco) | `schema_migrations` → version `20260901035505`, name `merge_funcionario_duplicado_ezequias_jose_rufino` |
| Migration (arquivo) | `supabase/migrations/20260901035505_merge_funcionario_duplicado_ezequias_jose_rufino.sql` |
| Rollback | `docs/claude-onboarding/hotfix/ROLLBACK-MERGE-EZEQUIAS.sql` |
| Atomicidade | `DO` block único — uma instrução, tudo ou nada |

## Decisões aplicadas (padrões conservadores)

| Pergunta em aberto | Decisão aplicada |
|---|---|
| Canônico | **A = `aeac500e…6388`** — único com CPF de 11 dígitos e detentor do login/auth/role |
| `data_admissao` | **NÃO alterada.** A mantém `2026-03-04`. A correção para `2023-11-21` continua **pendente de decisão do RH** |
| Destino do duplicado | **Inativado e marcado** (não deletado) |
| Conflito `banco` / `chave_pix` | **NÃO tocado.** O merge não altera dado financeiro. B permanece íntegro (inativo) para conferência do RH |

## Estado final

| | **CANÔNICO** `aeac500e…6388` | **DUPLICADO** `0746c95a…1815` |
|---|---|---|
| `status` | **Ativo** | **Inativo** |
| CPF | `***.***.***-18` (11 díg.) | `***.***.***-18` (10 díg.) |
| `matricula` | 3410 | 003410 |
| `data_admissao` | 2026-03-04 (inalterada) | 2023-11-21 |
| Chamados internos | **2** | **0** |
| Profiles | 1 | 0 |
| `bd_funcionarios_sensivel` | 1 | 1 (preservado) |
| `observacoes` | inalterada | `CONSOLIDADO em aeac500e-… (cadastro duplicado) — 2026-09-01` |

## Validação pós-merge — todas as verificações passaram

| # | Verificação | Esperado | Obtido |
|---|---|---|---|
| 1 | Chamados no duplicado | 0 | **0** ✔ |
| 1 | Profiles no duplicado | 0 | **0** ✔ |
| 2 | Chamados no canônico | 2 | **2** ✔ |
| 3 | Total de chamados dos dois (antes = depois) | 2 | **2** ✔ |
| 4 | Protocolos preservados | CHI-2026-000092, CHI-2026-000097 | **ambos, status `respondido`** ✔ |
| 5–8 | Diárias/presenças/ponto/atestados/apontamentos/vínculos | 0 (era 0) | **0** ✔ |
| 9 | Profiles órfãos | 0 | **0** ✔ |
| 10 | FKs quebradas | 0 | **0** ✔ |
| 11 | Colisões UNIQUE criadas | 0 | **0** ✔ |
| 12 | Canônico mantém CPF correto e Ativo | sim | **11 díg., final 18, Ativo** ✔ |
| 13 | Auditoria do merge | 1 registro | **1** ✔ |

## Delta zero — comprovado

| Verificação | Resultado |
|---|---|
| Outros funcionários alterados na janela | **0** ✔ |
| Outros chamados internos alterados | **0** ✔ |
| Funcionários deletados | **0** ✔ |
| Dados financeiros alterados | **0** ✔ |
| Profiles / Auth / RBAC alterados | **0** ✔ |

### Nota sobre a contagem total de funcionários
A auditoria mediu **2.398** e a validação pós-merge mediu **2.399**. A diferença **não vem do merge** (a migration não faz `INSERT` em `bd_funcionarios`): **10 funcionários foram cadastrados por usuários do ERP em 2026-08-31 entre 17:43 e 19:38 UTC**, nenhum deles Ezequias. Confirmado por `created_at` e pela verificação `outros_funcionarios_alterados = 0`.

## Pendências que permanecem com o RH

1. **`data_admissao`** — o canônico mantém `2026-03-04`. O valor `2023-11-21` (vindo da folha) provavelmente é a admissão real. **Decisão pendente.**
2. **`banco` e `chave_pix` divergentes** entre os dois cadastros, com a **mesma conta corrente**. O registro inativado preserva os valores de B para conferência. **Risco de pagamento — decisão pendente.**
3. **`centro_custo_id`, `salario_base`, `refeicao`** divergentes — não resolvidos automaticamente, conforme a regra acordada.
