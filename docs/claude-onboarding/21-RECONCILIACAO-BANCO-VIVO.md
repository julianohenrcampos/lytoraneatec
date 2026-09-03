# 21 — RECONCILIAÇÃO CÓDIGO × BANCO VIVO (FASE 0.1)

> Executado em **2026-08-31**, somente **READ-ONLY**, contra o projeto de produção.
> **Nenhuma alteração** foi feita em aplicação, banco, policies, funções, buckets, Auth ou deploy.
>
> Este documento **corrige e substitui** os achados dos documentos 03, 05, 08, 09, 10, 11, 14 e 16
> onde houver divergência. A auditoria estática (replay de migrations) **superestimou** o estado de
> risco em pontos importantes.

---

## PASSO 0 — Conexão

| Item | Valor |
|---|---|
| Project ref | **`eexzgpmrousuxlkvqwkm`** ✔ |
| Database | `postgres` · PostgreSQL **17.6** |
| Host | `db.eexzgpmr…….supabase.co` (mascarado) |
| Validação de identidade | 194 tabelas `public`; **6/6** tabelas-assinatura LYTOTEC presentes (`bd_funcionarios`, `bd_centros_custo`, `bd_diaria_solicitacoes`, `bd_ct_viagens`, `bd_permissions`, `profiles`); **0** tabelas do projeto `zoruxlcqkagcqrmevmrk` |

**Observação sobre a Fase 0:** o `list_projects` do MCP **não enumera** este projeto (retorna apenas `zoruxlcqkagcqrmevmrk`, de outra organização). O token, porém, **tem acesso de leitura** a `eexzgpmrousuxlkvqwkm`. A conclusão da auditoria anterior ("MCP conectado ao projeto errado") estava **incorreta**: o projeto correto sempre esteve acessível, apenas não listado.

**`MCP_SUPABASE_PROJETO_CORRETO = SIM`**

Nenhuma senha, `service_role`, `anon key`, JWT secret ou token foi exibido ou consultado.

---

## PASSO 1 — Estado real do banco: ESTÁTICO × VIVO

| Métrica | ESTÁTICO (migrations/types.ts) | **VIVO** | Diferença | Leitura |
|---|---:|---:|---:|---|
| Tabelas `public` | 194 | **194** | 0 | ✔ exato |
| Views `public` | 70¹ | **68** | −2 | ✔ (¹`types.ts` conta as 2 MVs junto) |
| Materialized views | 2 | **2** | 0 | ✔ |
| Funções `public` | 593² | **868** | +275 | ² estático contava definições distintas nas migrations; vivo conta overloads e funções criadas fora de migration |
| Funções `SECURITY DEFINER` | 499 | **483** | −16 | próximo |
| `SECURITY DEFINER` **sem** `search_path` | 15 | **2** | **−13** | 🟢 muito melhor que o estimado |
| Triggers `public` | 219 | **249** | +30 | +30 criados fora de migration |
| Policies `public` | 684 | **490** | **−194** | 🟢 replay estático **superestimou em 40%** |
| Policies `storage` | 44 | **36** | −8 | |
| Tabelas com RLS | 194 | **194** | 0 | ✔ **100% de cobertura confirmada** |
| Tabelas **sem** RLS | 0 | **0** | 0 | ✔ |
| Tabelas com `FORCE RLS` | 1 | **26** | **+25** | 🟢 muito melhor que o estimado |
| Índices `public` | 434 | **664** | +230 | 🟢 |
| Buckets | 23 | **21** | −2 | `portfolio` e `services` **não existem mais** |
| Buckets públicos | 10 | **2** | **−8** | 🟢 8 foram fechados |
| Policies com `USING(true)`/`WITH CHECK(true)` | 93 | **58** | −35 | |
| Policies `RESTRICTIVE` | 1 | **0** | −1 | todas são PERMISSIVE |

### Conclusão do Passo 1
O replay cronológico de migrations é **conservador demais**: capturou `CREATE POLICY` que foram removidas por operações executadas fora do diretório `supabase/migrations/` (via dashboard/Lovable). **194 policies "vivas" no estático não existem no banco.** Isso invalida especificamente os achados SEC-01, SEC-05, SEC-06 e SEC-07.

Ao mesmo tempo, o banco vivo está **mais endurecido** que o estático sugeria: 26 tabelas com `FORCE RLS`, 664 índices, apenas 2 funções sem `search_path`.

---

## PASSO 2 — SEC-01 (bd_funcionarios exposta)

### **`SEC-01_CONFIRMADO = NÃO` — REFUTADO**

Estado vivo de `public.bd_funcionarios`:
- `relrowsecurity = true`, `relforcerowsecurity = false`
- **4 policies** (o estático previa 16)

| Policy | Cmd | Tipo | Roles | Expressão |
|---|---|---|---|---|
| `funcionarios_operacional_select` | SELECT | PERMISSIVE | `authenticated` | `fn_funcionarios_can_select_row(auth.uid(), id) OR fn_can_access_funcionario_operacional(id, departamento_id, centro_custo_id) OR fn_can_access_funcionario_sensitive(id)` |
| `funcionarios_insert_restrito` | INSERT | PERMISSIVE | `authenticated` | `WITH CHECK`: `fn_is_super_admin() OR fn_has_role('AdmRH') OR fn_has_role('AdmSSO') OR fn_has_role('AdmOBRA') OR fn_has_permission('gestao_rh_funcionarios_create') OR fn_has_permission('gestao_rh_funcionarios_edit')` |
| `funcionarios_update_restrito` | UPDATE | PERMISSIVE | `authenticated` | mesma expressão em `USING` e `WITH CHECK` |
| `funcionarios_delete_restrito` | DELETE | PERMISSIVE | `authenticated` | `fn_is_super_admin() OR fn_has_role('AdmRH') OR fn_has_permission('gestao_rh_funcionarios_delete')` |

**As três policies apontadas na auditoria estática NÃO EXISTEM no banco:**
- ❌ `Allow anonymous email verification for registration` (`TO anon USING(true)`)
- ❌ `Verificação de email para registro anon` (`TO anon USING(true)`)
- ❌ `Allow email verification for registration` (`TO authenticated USING(true)`)

Foram removidas em algum momento **fora das migrations versionadas**.

### Grants de tabela
`anon`, `authenticated`, `postgres` e `service_role` possuem `SELECT/INSERT/UPDATE/DELETE` — esse é o **grant padrão do Supabase** e não representa acesso: com RLS habilitado e **nenhuma policy aplicável ao role `anon`**, o Postgres nega todas as linhas por padrão.

### Policies para `anon` em todo o schema
Consulta a `pg_policies` com `'anon' = any(roles)`: **nenhuma policy viva concede acesso ao role `anon` em nenhuma tabela de `public`.**

**Conclusão:** não há exposição de PII de funcionários a usuários anônimos. O achado mais grave da auditoria estática **não se sustenta**. A causa do erro foi tratar o replay de migrations como estado autoritativo — exatamente a limitação que motivou esta fase.

---

## PASSO 3 — Segregação de PII

### **`SEC-10 = CONFIRMADO`** (estruturalmente e por volume)

| Tabela | Colunas | Registros |
|---|---:|---:|
| `bd_funcionarios` | 54 | **2.398** |
| `bd_funcionarios_sensivel` | 40 | **2.040** |

`bd_funcionarios` **ainda contém** todas as colunas sensíveis: `cpf`, `salario_base`, `banco`, `agencia`, `conta_corrente`, `chave_pix`, `data_nascimento`, `endereco_*` (8), `latitude`, `longitude`, `gratificacao`, `insalubridade`, `periculosidade`, `adicional_noturno`, `refeicao`, `diarias`, `custo_passagem`, `email`, `imagem`, `observacoes`.

Volume (agregado, **nenhum valor individual consultado**):

| Coluna | Preenchida em `bd_funcionarios` |
|---|---:|
| `cpf` | **2.397** de 2.398 |
| `salario_base` | 2.304 |
| `conta_corrente` | 1.515 |
| `chave_pix` | 994 |

**A segregação permanece ADITIVA e NÃO CONCLUÍDA.** Os dados sensíveis estão duplicados: 2.040 em `bd_funcionarios_sensivel` e 2.397 em `bd_funcionarios`. 358 funcionários existem apenas na tabela ampla.

### Mitigação real existente
`bd_funcionarios_sensivel` está corretamente protegida: RLS ativo, 4 policies, SELECT/UPDATE por `fn_can_access_funcionario_sensitive(funcionario_id)`, DELETE por `fn_is_super_admin() OR fn_has_role('AdmRH')`.

E `bd_funcionarios` está protegida por `funcionarios_operacional_select`, que inclui `fn_can_access_funcionario_sensitive(id)` no OR.

**Risco real:** MÉDIO. Não é exposição — é **dívida arquitetural**: a duplicação impede que a projeção de colunas por perfil seja efetiva, e qualquer policy futura frouxa em `bd_funcionarios` reexpõe folha e dados bancários. Também é um problema de minimização de dados sob LGPD.

---

## PASSO 4 — Storage

### **`SEC-06_CONFIRMADO = NÃO` — REFUTADO**

**21 buckets vivos. Apenas 2 públicos.**

| Bucket | `public` | `file_size_limit` | `allowed_mime_types` | Objetos |
|---|:--:|---:|---|---:|
| `empresas-logos` | 🔴 **true** | — | — | 5 |
| `veiculos` | 🔴 **true** | — | — | 207 |
| `apontamentos` | 🟢 false | — | — | 2.258 |
| `atestados-medicos` | 🟢 false | — | — | 647 |
| `sso-desvios` | 🟢 false | — | — | 724 |
| `documentos-rh` | 🟢 false | — | — | 435 |
| `sso-checklists` | 🟢 false | **10 MB** | — | 307 |
| `exames_agendamentos` | 🟢 false | — | — | 240 |
| `sso-ver-agir` | 🟢 false | — | — | 142 |
| `tickets` | 🟢 false | — | — | 95 |
| `ponto-fotos` | 🟢 false | — | — | 33 |
| `funcionarios` | 🟢 false | — | — | 28 |
| `avatars` | 🟢 false | — | — | 16 |
| `chamados-internos-anexos` | 🟢 false | — | — | 16 |
| `biometria-facial` | 🟢 false | — | — | 11 |
| `pops-documentos` | 🟢 false | — | — | 7 |
| `os_photos` | 🟢 false | — | — | 6 |
| `assinaturas` | 🟢 false | — | — | 2 |
| `assinaturas-funcionarios` | 🟢 false | — | — | 1 |
| `ct-checklists` | 🟢 false | — | — | 1 |
| `inspecao-fotos` | 🟢 false | — | — | 0 |

**Todos os buckets apontados como públicos na auditoria estática já foram fechados**: `funcionarios`, `apontamentos`, `tickets`, `sso-checklists`, `avatars`, `inspecao-fotos`, `os_photos`. E `portfolio`/`services` **foram removidos**.

**Residual real (BAIXO/MÉDIO):**
- `veiculos` público com 207 objetos — fotos e documentos de veículos. Avaliar se contém documentos (CRLV) ou apenas fotos.
- `empresas-logos` público com 5 objetos — legítimo.
- **Nenhum bucket define `allowed_mime_types`**; apenas `sso-checklists` define `file_size_limit`. Mantém o risco de upload de SVG/HTML com script nos 2 buckets públicos e de abuso de armazenamento nos demais.

### **`SEC-07_CONFIRMADO = NÃO` — REFUTADO**

`storage.buckets`: **RLS habilitado, ZERO policies.** A policy `Allow bucket creation` (`FOR ALL TO authenticated USING(true) WITH CHECK(true)`) **não existe no banco**. Sem policy e com RLS ativo, `anon` e `authenticated` não podem criar, alterar, tornar público ou apagar bucket algum. Apenas `service_role` opera.

---

## PASSO 5 — Edge Functions críticas

### Achado novo e relevante: **`supabase/config.toml` NÃO representa a produção**

| | Repositório (`config.toml`) | **Deploy real** |
|---|---|---|
| Funções | 36 | **38** |
| `verify_jwt = false` | 29 | **37** |
| `verify_jwt = true` | 7 (implícito) | **1** |

**Todas as 37 funções do ERP estão deployadas com `verify_jwt = false`**, incluindo 7 que a auditoria estática classificou como protegidas pela plataforma:
`admin-confirm-email`, `guardian-web-proxy`, `get-mapbox-public-token`, `identificar-funcionario-manual`, `excluir-solicitacao-equipamento`, `atestado-arquivo-blob`, `registrar-ponto-dispositivo-obra`.

A única com `verify_jwt = true` é **`validar-funcionario-intranet`** (v27) — que **não existe no repositório**.
Também deployada e ausente do repositório: **`subcategorias-sync`** (v20).

> Isso significa que a proteção de plataforma que o documento 10 atribuía a 7 funções **não existe**. Cada uma depende inteiramente da sua própria autenticação interna (a maioria a implementa — `guardian-web-proxy` faz `getUser()` + `fn_backend_can_invoke`; `atestado-arquivo-blob` usa HMAC). Mas `get-mapbox-public-token` e `admin-confirm-email` merecem revisão dedicada.

### **`SEC-02_CONFIRMADO = SIM`** — `pncp-sync`

Código **deployado** (v152, `ACTIVE`, `verify_jwt = false`) é idêntico ao local:

```ts
const authHeader = req.headers.get("Authorization");
let isCronCall = false;
try {
  body = await req.clone().json();
  isCronCall = body?.source === "cron";   // auto-declarado pelo cliente
  userId    = body?.user_id || null;      // auto-declarado pelo cliente
} catch {}

if (!authHeader && !isCronCall) return 401;
// segue com SUPABASE_SERVICE_ROLE_KEY
```

| Item | Estado |
|---|---|
| `verify_jwt` | **false** |
| Autenticação | `Authorization` presente **OU** `body.source === "cron"` |
| Validação do `Authorization` | **NENHUMA** — qualquer string `Bearer …` satisfaz |
| `source=cron` | **auto-declarado no corpo**, sem segredo compartilhado |
| `service_role` | **SIM** — bypass total de RLS |
| Segredo interno | **NÃO EXISTE** |
| Chamada anônima | **POSSÍVEL** |

Escreve em `bd_pncp_sync_log` (com `user_id` fornecido pelo chamador), `bd_pncp_contratacoes`, `bd_pncp_todas_licitacoes`, `bd_licitacoes_orgaos_pendentes`.

**Indício operacional (não é prova de exploração):** `bd_pncp_sync_log` tem **115 execuções, 32 com `user_id` NULL**. Último sync: 2026-08-12. Execuções sem `user_id` são o padrão esperado de chamadas `source=cron` legítimas — mas são indistinguíveis de chamadas anônimas de terceiros.

### **`SEC-03_CONFIRMADO = SIM`** — `geocode-proxy`

Código **deployado** (v102, `ACTIVE`):

| Item | Estado |
|---|---|
| `verify_jwt` | **false** |
| Autenticação interna | **NENHUMA** — `Deno.serve` vai direto a `req.json()`, sem ler `Authorization`, `x-api-key` ou `x-device-secret` |
| Autorização | **NENHUMA** |
| Rate limiting | **NENHUM** |
| `MAPBOX_TOKEN` | usado em todas as chamadas a `api.mapbox.com` |
| `service_role` | **SIM** |
| Escrita em cache | `bd_cache_enderecos` (upsert, 3 pontos) e `bd_geocoding_falhas` (insert) |
| CORS | `Access-Control-Allow-Origin: *` |
| Uso anônimo | **POSSÍVEL** |

**Volume atual:** `bd_cache_enderecos` = **1.675 registros**; `bd_geocoding_falhas` = **1.071 registros**.

**Risco real:** abuso de cota/custo Mapbox e envenenamento do cache de endereços, que alimenta o geocoding de `bd_centros_custo` — e portanto a **cerca geográfica do ponto eletrônico** (`raio_ponto_metros`, `latitude`, `longitude`). É o vetor de maior impacto operacional confirmado nesta fase.

Nenhuma função foi invocada. Nenhum teste de carga ou pentest foi executado.

---

## PASSO 6 — RBAC vivo

### Volumetria

| Tabela | Registros |
|---|---:|
| `bd_roles` | 28 |
| `bd_permissions` | 108 |
| `bd_role_permissions` (sem ação) | 423 |
| `bd_role_permission_actions` (com ação) | **1.405** |
| `bd_user_roles` | 249 (**188 usuários distintos**) |
| `bd_user_permission_overrides` | 40 |
| `bd_permissoes` (legado) | 74 |
| `bd_funcoes_permissao` (legado) | 30 |
| `bd_rbac_legacy_map` | 71 |
| `bd_permission_audit_logs` | **9.017** (6.980 nos últimos 90 dias) |
| `profiles` | 203 |

### Dependência do legado (medida)

| Atributo legado em `profiles` | Usuários |
|---|---:|
| `funcao_sistema` preenchido | **203 (100%)** |
| `funcoes[]` preenchido | **190 (94%)** |
| `acesso_global = true` | **12** |
| `funcao_permissao` preenchido | 10 |
| **Sem papel em `bd_user_roles`** | **15** |

### **`RBAC_DIVERGENCIA_CONFIRMADA = NÃO` — REFUTADA**

As funções foram **consolidadas no banco vivo**, ao contrário do que as migrations sugeriam:

```sql
-- fn_is_super_admin agora é apenas um wrapper:
CREATE FUNCTION public.fn_is_super_admin(p_user_id uuid DEFAULT auth.uid())
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT public.is_super_admin(p_user_id) $$;

-- is_super_admin é a ÚNICA implementação canônica, com 4 fontes:
CREATE FUNCTION public.is_super_admin(p_user_id uuid) ...
  SELECT p_user_id IS NOT NULL AND (
       EXISTS (bd_user_roles ⋈ bd_roles WHERE r.ativo AND lower(r.nome)='superadm')
    OR EXISTS (profiles WHERE acesso_global OR 'SuperAdm' = ANY(funcoes) OR funcao_sistema='SuperAdm')
    OR EXISTS (profiles ⋈ bd_funcoes_permissao WHERE lower(fp.nome_funcao)='superadm')
  )
```

| Fonte | `is_super_admin` | `fn_is_super_admin` |
|---|:--:|:--:|
| `bd_user_roles` + `bd_roles` | ✔ | ✔ (delegado) |
| `profiles.acesso_global` | ✔ | ✔ |
| `profiles.funcoes[]` | ✔ | ✔ |
| `profiles.funcao_sistema` | ✔ | ✔ |
| `bd_funcoes_permissao` | ✔ | ✔ |

**Teste empírico sobre os 203 profiles:**
- `is_super_admin` → **16** SuperAdms
- `fn_is_super_admin` → **16** SuperAdms
- **Divergentes → 0**

Os demais predicados (`check_is_super_admin`, `check_is_super_admin_hybrid`, `check_is_super_admin_new`, `fn_ponto_is_superadmin`, `has_permission`, `has_role`, `user_has_permission`) são **wrappers finos** (236–283 caracteres) que delegam à função canônica. A "duplicidade com semânticas divergentes" apontada no documento 06 **não existe mais**.

### Achado remanescente real — **dependência do caminho legado**

- **16 SuperAdms efetivos** × **12 com papel `SuperAdm` em `bd_user_roles`**
- ⇒ **4 usuários são SuperAdm exclusivamente pelo caminho legado** (`acesso_global`, `funcoes[]`, `funcao_sistema` ou `bd_funcoes_permissao`)
- ⇒ **15 usuários não têm nenhum papel no RBAC novo**

Qualquer remoção dos ramos legados **removeria privilégio de 4 SuperAdms e o acesso de até 15 usuários**. Este é o número concreto que faltava para planejar o cutover.

### Uso do legado nas funções (vivo)

| Função | RBAC novo | `bd_funcoes_permissao` | `bd_permissoes` | `acesso_global` / `funcoes` / `funcao_sistema` |
|---|:--:|:--:|:--:|:--:|
| `is_super_admin` | ✔ | ✔ | — | ✔ |
| `fn_has_permission` | ✔ | ✔ | ✔ | — |
| `fn_has_role` | ✔ | ✔ | — | ✔ |
| **`fn_has_action`** | ✔ | ❌ | ❌ | ❌ |

`fn_has_action` (a função granular) está **limpa do legado** — confirmando que o modelo granular é o caminho de saída.

---

## PASSO 7 — Auth / HTTPS

### **`SEC-08_CONFIRMADO = NÃO` — REFUTADO na prática**

```
curl -I http://lytotec.com.br   → HTTP/1.1 301 Moved Permanently
                                  Location: https://lytotec.com.br/
                                  Server: Netlify
curl -I https://lytotec.com.br  → HTTP/1.1 200 OK
                                  Strict-Transport-Security: max-age=31536000
```

O Netlify força HTTPS por redirect 301 permanente e emite **HSTS de 1 ano**. Além disso, o `access_token` de recuperação de senha viaja no **fragmento** da URL, que nunca é enviado ao servidor. Não há tráfego de sessão em texto claro.

**Residual (cosmético/defensivo):** `SUPABASE_AUTH_CONFIG.md` e `VITE_APP_PUBLIC_URL` ainda declaram `http://`. A configuração real de Site URL / Redirect URLs no Supabase **não é legível via MCP**.

**`SEC-08 = REFUTADO` no transporte; `Site URL`/`Redirect URLs` = NÃO VERIFICÁVEL PELO MCP** — conferir manualmente em
`Dashboard → Authentication → URL Configuration` do projeto `eexzgpmrousuxlkvqwkm`.

### Achados novos de Auth (via advisor nativo do Supabase)

| Achado | Nível | Onde conferir |
|---|---|---|
| **`auth_leaked_password_protection` — proteção contra senhas vazadas DESABILITADA** | WARN | Dashboard → Authentication → Policies |
| **`auth_otp_long_expiry` — expiração de OTP acima do recomendado** | WARN | Dashboard → Authentication → Providers → Email |

---

## PASSO 8 — Policies `USING(true)` no banco vivo

### **`SEC-05 = PARCIAL`**

| Métrica | Estático | **Vivo** |
|---|---:|---:|
| Total de policies (`public` + `storage`) | 728 | **526** |
| PERMISSIVE | 727 | **526** |
| RESTRICTIVE | 1 | **0** |
| `USING(true)` | 63 | **50** |
| `WITH CHECK(true)` | 48 | **18** |
| Qualquer `true` | 93 | **58** |
| **Para o role `anon`** | 2 | **0** |

**Nenhuma policy permissiva atinge `anon`.** Uma única atinge `PUBLIC`: `bd_geocoding_falhas` INSERT `WITH CHECK(true)` — necessária para o `geocode-proxy` registrar falhas.

### Classificação das 58 policies

#### 🔴 ALTO RISCO — escrita ampla em tabela operacional estruturante (7)
`FOR ALL USING(true)` para `authenticated`. Em Postgres, `FOR ALL` com apenas `USING` faz o `WITH CHECK` herdar a expressão ⇒ **INSERT/UPDATE/DELETE liberados**.

| Tabela | Por que é alto risco |
|---|---|
| **`bd_centros_custo`** | Eixo de escopo de RLS de **40 tabelas**; contém `latitude`, `longitude`, `raio_ponto_metros` (cerca geográfica do ponto) e os 5 papéis de responsabilidade. Qualquer autenticado pode alterar ou apagar um centro de custo. |
| **`bd_caminhoes_equipamentos`** | Raiz do agregado de Ativos (14 FKs de entrada) |
| **`bd_equipes`** | Define apontador/encarregado — usado por `usuario_acessa_equipe` em 14 policies |
| **`bd_empresas`** | 10 FKs de entrada |
| **`bd_departamentos`** | 6 FKs; usado no escopo departamental |
| **`bd_usinas`** | Operacional |
| **`bd_registro_apontamento_inspecao`** | Operacional |

#### 🟠 PRECISA REVISÃO — escrita ampla em catálogo/apoio (14)
`bd_catalogo_equipamentos` (INSERT/UPDATE/**DELETE**), `bd_catalogo_variacoes` (INSERT/UPDATE), `bd_fabricantes` (ALL), `bd_modelos` (ALL), `bd_tipos_equipamento` (ALL), `bd_frotas` (ALL), `bd_grupos_ativos` (ALL), `bd_linhas_operacionais` (ALL), `bd_portfolio_empresas` (INSERT/UPDATE), `bd_carga_status_historico` (INSERT/UPDATE).
> São catálogos, mas `DELETE` irrestrito em `bd_catalogo_equipamentos` pode quebrar integridade referencial de ativos.

#### 🟠 PRECISA REVISÃO — auditoria gravável pelo auditado (3)
`bd_auditoria_correcao_volume_formula`, `bd_auditoria_sync_equipe_funcionario`, `bd_auditoria_volume_correcao` — `FOR ALL USING(true)` ⇒ qualquer autenticado pode inserir, alterar e **apagar** trilha de auditoria. **Confirma SEC-17.**
> Nota: `bd_auditoria_correcao_registros_carga` (apontada no estático como role `public`) **não aparece mais** na lista viva.

#### 🟢 POTENCIALMENTE JUSTIFICADA — leitura de catálogo/configuração (31)
SELECT `USING(true)` para `authenticated` em: `bd_categorias_ativos`, `bd_subcategorias_ativos`, `bd_diretorias`, `bd_feriados`, `bd_locais_atendimento`, `bd_empresas_locadoras`, `bd_fabricantes`, `bd_modelos`, `bd_tipos_equipamento`, `bd_frotas`, `bd_grupos_ativos`, `bd_linhas_operacionais`, `bd_catalogo_equipamentos`, `bd_catalogo_variacoes`, `bd_matching_config`, `bd_matching_exclusoes`, `bd_fluxos_aprovacao`, `bd_fluxo_etapas`, `bd_fluxo_centro_custo`, `bd_fluxo_aplicacoes`, `bd_diaria_calendario_operacional`, `bd_cache_enderecos`, `bd_permissoes_acoes`, `bd_rbac_legacy_map`, `bd_portfolio_empresas`, `bd_carga_status_historico`, `bd_pncp_todas_licitacoes`, `bd_configuracoes_sistema`.

**`bd_configuracoes_sistema` foi inspecionada e é segura:** contém 22 chaves, todas feature flags e templates de checklist (`ponto_eletronico_ativo`, `fluxo_aprovacao_dinamico`, `motor_aprovacao_corporativo_ativo`, `pops_ativo`, `modo_engenharia_licitacoes`, `score_minimo_inclusao`, `checklist_ce_template_*`…). **Nenhum segredo.** Leitura ampla é legítima.

> Correção ao documento 02: **existem feature flags de runtime no banco** (`bd_configuracoes_sistema`), além das 3 flags build-time do frontend.

#### 🟢 JUSTIFICADA — inserção controlada (3)
`bd_cache_enderecos` INSERT, `bd_envios` INSERT, `bd_notificacoes_usuarios` INSERT, `bd_geocoding_falhas` INSERT (PUBLIC), `bd_orgaos_historico_metricas` ALL (role `service_role`).

### Policies do estático que **não existem** no banco vivo
`bd_funcionarios` (3), `bd_ordens_servico`, `bd_os_mao_obra`, `bd_os_materiais_utilizados`, `bd_os_movimentacoes` (12 policies), `bd_lista_programacao_entrega`, `bd_caminhoes`, `bd_centro_custo`, `bd_centros_custo_alias`, `bd_empresas_alias`, `bd_funcoes_alias`, `bd_permissoes`, `bd_funcoes_permissao`, `profiles` (`Allow profile creation`), `storage.buckets` (`Allow bucket creation`), `portfolio_*`, `services`.

---

## PASSO 9 — SuperAdm offline (SEC-04)

### **`SEC-04 = PARCIAL` — RISCO DE FRONTEND/UI, NÃO DE AUTORIZAÇÃO BACKEND**

Análise do código local (`src/utils/offlinePermissions.ts`, `usePermission.ts`, `SecureRouteGuard.tsx`, `useOfflineSync.ts`, `salvarOffline.ts`).

O objeto `localStorage['user_offline_context']` **não é assinado** e é validado apenas por idade (<24 h), `userId` correspondente e `validatedFromServer === true` — três campos controlados pelo próprio cliente.

**Consumidores e o que cada um libera:**

| Consumidor | Efeito | Classificação |
|---|---|---|
| `usePermission.ts:271` (Camada B) | define `permissions = ['*']`, `isSuperAdmin = true` no estado React | **UI** |
| `SecureRouteGuard.tsx:73` (`emergencyAdminBypass`) | renderiza `children` sem verificar permissão | **UI** |
| `useOfflineSync.ts:113` / `salvarOffline.ts:72` (`canAccessOfflineModule`) | permite **enfileirar localmente** um apontamento offline | **UI/local** |

**Nenhuma operação de backend confia nesse valor.** Verificado:
- O `supabase-js` autentica por **JWT da sessão**, não por `localStorage['user_offline_context']`.
- As Edge Functions fazem `getUser()`/`getClaims()` sobre o JWT real (`registrar-ponto`, `sync-ponto-offline`, `create-gestor`) ou usam `x-device-secret`/HMAC.
- Toda leitura/escrita via PostgREST passa por RLS, que avalia `auth.uid()` do JWT.
- Itens enfileirados offline são reprocessados por `sync-ponto-offline`, que autentica normalmente — o servidor rejeita o que não é permitido.

**Conclusão:**
- **RISCO FRONTEND/UI:** REAL. Um usuário autenticado pode se conceder a interface administrativa completa (menus, telas de `/admin/*`), expondo estrutura de permissões e nomes de rotas.
- **RISCO DE AUTORIZAÇÃO BACKEND:** **NENHUM**. A autoridade real permanece em RLS + RPC + `getUser()` nas Edge Functions.

**Ressalva:** a UI liberada permite acionar operações contra as **7 tabelas ALTO RISCO** do Passo 8 — mas esse acesso já existiria via chamada direta ao PostgREST, independentemente do `localStorage`. O vetor não é o `localStorage`; é a policy permissiva.

---

## 🔴 ACHADO NOVO — SEC-24: funções `SECURITY DEFINER` executáveis por `anon`

**Não detectado na auditoria estática.** Revelado pelo advisor nativo do Supabase e confirmado no catálogo.

| Métrica | Valor |
|---|---:|
| Funções `SECURITY DEFINER` em `public` | 483 |
| Com `EXECUTE` concedido a **`anon`** | **358** |
| Com `EXECUTE` concedido a `authenticated` | 451 |
| Destas, **VOLATILE** (mutantes) executáveis por `anon` | **181** |
| Mutantes, expostas como RPC (retorno ≠ `trigger`), **sem nenhuma checagem de autorização interna** | **≥ 21** |

`SECURITY DEFINER` executa com os privilégios do owner (`postgres`) e **ignora RLS**. Se a função não verifica autorização internamente, um chamador **anônimo** — com a `anon key`, que é pública por design — pode executá-la via `POST /rest/v1/rpc/<nome>`.

### Confirmadas por inspeção direta do código (sem guarda alguma)

| Função | Assinatura | Impacto |
|---|---|---|
| **`update_profile_funcionario_id`** | `(_profile_id uuid, _funcionario_id uuid)` | `UPDATE profiles SET funcionario_id = …` sem qualquer verificação. **Permite revincular qualquer usuário a qualquer funcionário** — altera escopo operacional resolvido por `fn_*_current_funcionario_id` |
| **`liberar_proxima_etapa_dinamica`** | `(p_solicitacao_id uuid)` | Avança a etapa do fluxo de aprovação e escreve `status_fluxo` em `bd_diaria_solicitacoes`. **Impacto financeiro** |
| `merge_duplicate_funcionarios` | `()` | Mescla funcionários duplicados — **destrutiva**, sem argumentos |
| `sync_presencas_valores_funcao` / `sync_convocados_pre_valores` | `()` | Recalculam valores de diária **em massa** |
| `gerenciar_convocado_diaria` / `_no_dia` | `(p_solicitacao_id, p_funcionario_data jsonb, p_acao)` | Adiciona/remove convocado de diária |
| `rbac_auto_migrate_user` | `(p_user_id uuid)` | Migra o RBAC de um usuário |
| `fn_arquivar_auditoria_log` | `(p_lote integer)` | Move registros de auditoria para o archive |
| `fn_backend_audit_event` | 17 parâmetros | **Injeta registros arbitrários** em `bd_backend_exec_auditoria` |
| `fn_ct_registrar_assinatura` | `(p_user uuid, …)` | Registra assinatura **em nome de qualquer usuário** |
| `finalizar_carga_manual` / `finalizar_carga_aplicacao` / `garantir_registro_aplicacao_principal` / `sincronizar_hora_saida_aplicacao` | | Operacional (CBUQ) |
| `fn_registrar_nonce_atestado` | `(p_nonce, p_funcionario_id, p_ip)` | **Queima nonces** → DoS do fluxo público de atestados |
| `fn_rate_limit_check` | 6 parâmetros | Manipula contadores de rate limit |
| `fn_relatorio_aps_definir_carimbo_padrao` / `_desvincular_padrao` / `_inativar_carimbo` | | Carimbos de relatório |
| `fn_calcular_nota_checklist`, `fn_ponto_diaria_simular_batida`, `check_vistorias_sso_pendentes`, `sync_profile_funcao_sistema` | | Diversos |

### Falso positivo verificado (importante)
`update_configuracao_sistema(p_chave, p_valor)` apareceu na varredura automática, mas a **leitura do código mostra que está protegida**:
```sql
IF NOT public.fn_ponto_is_superadmin() THEN
  RAISE EXCEPTION 'Sem permissão para alterar configurações do sistema';
END IF;
```
Isso demonstra que **a lista de 21 é um piso conservador que ainda exige revisão função a função** — nem toda função sem `auth.uid()` literal está desprotegida, e nem toda função com um helper está protegida (o helper pode não checar identidade).

### Verificação (read-only, sem invocar)
```sql
-- Funções SECURITY DEFINER com EXECUTE para anon
select p.proname, pg_get_function_identity_arguments(p.oid) as args, p.provolatile
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
join pg_roles r on r.oid = a.grantee
where n.nspname='public' and p.prosecdef and a.privilege_type='EXECUTE' and r.rolname='anon'
order by p.provolatile desc, p.proname;
```

**Nenhuma função foi invocada durante esta auditoria.**

---

## Outros achados novos do advisor nativo (851 lints)

| Lint | Nível | Qtd | Observação |
|---|---|---:|---|
| `anon_security_definer_function_executable` | WARN | **365** | → SEC-24 |
| `authenticated_security_definer_function_executable` | WARN | **451** | → SEC-24 |
| `function_search_path_mutable` | WARN | 24 | inclui funções `SECURITY INVOKER`; apenas **2** são `SECURITY DEFINER` |
| `extension_in_public` | WARN | 4 | `unaccent`, `vector`, `pg_net`, `btree_gist` no schema `public` |
| `materialized_view_in_api` | WARN | 2 | `mv_relatorio_diarias` e `mv_relatorio_diarias_legacy_20260514` acessíveis pela API de dados |
| `rls_enabled_no_policy` | INFO | 3 | `bd_atestados_nonces_utilizados`, `bd_ct_comando_requests`, `bd_rate_limit_tentativas` — **negam tudo, comportamento correto** (só `service_role`) |
| `auth_leaked_password_protection` | WARN | 1 | desabilitada |
| `auth_otp_long_expiry` | WARN | 1 | acima do recomendado |

> **`pg_net` está instalada** — extensão que permite requisições HTTP a partir do banco. Não constava do inventário estático. Merece revisão de quem pode usá-la.

---

## TABELA DE RECONCILIAÇÃO — SEC-01 a SEC-24

| # | Achado | STATUS | Evidência viva | Evidência estática | Risco real | Ação recomendada (**NÃO EXECUTADA**) |
|---|---|---|---|---|---|---|
| **SEC-01** | `bd_funcionarios` exposta a `anon` | **REFUTADO** | 4 policies, todas `TO authenticated` com predicados; 0 policies para `anon` em todo o schema | 3 policies `USING(true)` no replay de migrations | **NENHUM** | Nenhuma. Corrigir o documento 08/14. |
| **SEC-02** | `pncp-sync` bypass por `source=cron` | **CONFIRMADO** | v152 ACTIVE, `verify_jwt=false`, código deployado idêntico; 32 syncs sem `user_id` | idem | **ALTO** | Exigir segredo de cron (header) e validar o `Authorization` |
| **SEC-03** | `geocode-proxy` sem autenticação | **CONFIRMADO** | v102 ACTIVE, `verify_jwt=false`, sem leitura de header algum; 1.675 registros em cache | idem | **ALTO** | Exigir JWT ou `x-api-key`; adicionar rate limit |
| **SEC-04** | Elevação por `localStorage` | **PARCIAL** | Nenhum caminho de backend consome o valor | código local | **UI apenas** | Assinar o snapshot (HMAC) ou remover a Camada B — baixa prioridade |
| **SEC-05** | Policies `USING(true)` | **PARCIAL** | 58 (não 93); 0 para `anon`; 7 de ALTO RISCO | 93 | **MÉDIO-ALTO** | Rever as 7 de escrita ampla, começando por `bd_centros_custo` |
| **SEC-06** | Buckets públicos com PII | **REFUTADO** | 2 públicos (`empresas-logos` 5 obj., `veiculos` 207 obj.); todos os apontados foram fechados | 10 públicos | **BAIXO** | Avaliar conteúdo de `veiculos`; definir `allowed_mime_types` |
| **SEC-07** | `Allow bucket creation` | **REFUTADO** | `storage.buckets`: RLS ativo, **0 policies** | policy no replay | **NENHUM** | Nenhuma |
| **SEC-08** | Auth em HTTP | **REFUTADO** (transporte) / **NÃO VERIFICÁVEL** (config) | 301 → HTTPS + HSTS 1 ano | `SUPABASE_AUTH_CONFIG.md` | **BAIXO** | Atualizar Site URL para `https://` no Dashboard |
| **SEC-09** | `.env` rastreado no Git | **PARCIAL** | Repositório GitHub retorna **404 sem autenticação ⇒ privado**; `.env` só tem chaves públicas | `git ls-files` | **BAIXO** | Adicionar `.env` ao `.gitignore` + `.env.example` |
| **SEC-10** | PII duplicada | **CONFIRMADO** | 2.397/2.398 com CPF em `bd_funcionarios`; 2.040 em `_sensivel` | colunas em `types.ts` | **MÉDIO** | Concluir a migração e remover colunas sensíveis da tabela ampla |
| **SEC-11** | `fix-empty-rbac-roles` forja JWT | **CONFIRMADO** | v66 ACTIVE, `verify_jwt=false` | código | **MÉDIO** | Avaliar remoção; rotacionar `FIX_EMPTY_RBAC_ROLES_API_KEY` |
| **SEC-12** | Totem sem rate limit | **CONFIRMADO** | `bd_rate_limit_tentativas`: 422 registros, **100% escopo `atestado_validar`**; nada de totem | código | **MÉDIO** | Aplicar `fn_rate_limit_check` em `login-dispositivo-totem` |
| **SEC-13** | `LYTOTEC_API_KEY` compartilhada | **NÃO VERIFICÁVEL** | secrets não legíveis via MCP | 5 funções consomem | **MÉDIO** | Segregar por escopo — conferir em Dashboard → Secrets |
| **SEC-14** | Guards *fail-open* | **CONFIRMADO** | código local inalterado | idem | **BAIXO** (UI) | Rever após estabilização; documentado como intencional |
| **SEC-15** | `SECURITY DEFINER` sem `search_path` | **REFUTADO** em grande parte | **2** (`fn_criar_apontamento_apos_aprovacao`, `listar_ghost_funcionarios`) de 483 | 15 | **BAIXO** | Adicionar `SET search_path` nas 2 |
| **SEC-16** | Sem CSP / SRI | **CONFIRMADO** | Headers vivos: **só** `Strict-Transport-Security`. Sem CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy, X-Content-Type-Options | `netlify.toml` | **MÉDIO** | Adicionar headers no `netlify.toml` |
| **SEC-17** | Auditoria alterável | **CONFIRMADO** | 3 tabelas `FOR ALL USING(true)` (era 4) | 4 tabelas | **MÉDIO** | Restringir para SELECT + INSERT |
| **SEC-18** | Divergência de SuperAdmin | **REFUTADO** | `fn_is_super_admin` delega a `is_super_admin`; 16 = 16, **0 divergentes** | definições antigas nas migrations | **NENHUM** | Nenhuma. Corrigir o documento 06. |
| **SEC-19** | Proxy Python legado | **CONFIRMADO** | arquivos versionados | idem | **BAIXO** | Confirmar desativação e propor remoção |
| **SEC-20** | Logs sensíveis | **PARCIAL** | `vite.config.ts` remove `console.*` em produção | grep | **BAIXO** | Limpar mesmo assim |
| **SEC-21** | E-mails hardcoded | **CONFIRMADO** | código | idem | **BAIXO** | Mover `EMAIL_DP` para `bd_configuracoes_sistema` |
| **SEC-22** | `anon key` no bundle | **INFORMATIVO** | padrão Supabase | idem | **NENHUM** | Nenhuma — mas SEC-24 depende dessa premissa |
| **SEC-23** | `.innerHTML` | **INFORMATIVO** | 3 de 4 arquivos são órfãos | idem | **NENHUM** | Nenhuma |
| **SEC-24** | 🔴 **NOVO** — `SECURITY DEFINER` executável por `anon` | **CONFIRMADO** | **358** funções com `EXECUTE` para `anon`; **≥21** mutantes sem guarda | **não detectado** | **CRÍTICO** | `REVOKE EXECUTE ... FROM anon` em massa + guarda interna nas mutantes |
| **SEC-25** | 🟠 **NOVO** — `config.toml` ≠ produção | **CONFIRMADO** | 37 de 38 funções com `verify_jwt=false`; 2 funções deployadas fora do repositório | — | **MÉDIO** | Reconciliar `config.toml`; versionar `validar-funcionario-intranet` e `subcategorias-sync` |
| **SEC-26** | 🟠 **NOVO** — Auth sem proteção de senha vazada; OTP longo | **CONFIRMADO** | advisor nativo | — | **MÉDIO** | Habilitar no Dashboard |
| **SEC-27** | 🟡 **NOVO** — MVs expostas na API; extensões em `public`; `pg_net` instalada | **CONFIRMADO** | advisor nativo | — | **BAIXO-MÉDIO** | Revogar acesso às MVs; avaliar `pg_net` |

---

## Prioridade recomendada (nada executado)

| Ordem | Item | Justificativa |
|---|---|---|
| **1** | **SEC-24** | Único achado com potencial de escrita não autenticada em dados de produção, incluindo fluxo de aprovação de diárias e vínculo de identidade |
| **2** | **SEC-02** | Execução não autenticada com `service_role` |
| **3** | **SEC-03** | Envenenamento do cache que alimenta a cerca geográfica do ponto |
| **4** | **SEC-05** (7 de ALTO RISCO) | `bd_centros_custo` gravável por qualquer autenticado |
| **5** | SEC-17, SEC-12, SEC-26, SEC-25 | Integridade de auditoria, força bruta no totem, hardening de Auth, reconciliação de deploy |
| **6** | SEC-10 | Dívida de segregação de PII (LGPD — minimização) |
| **7** | SEC-16, SEC-11, SEC-15, SEC-09, SEC-13 | Hardening |
| — | SEC-01, SEC-06, SEC-07, SEC-08, SEC-18 | **Refutados — nenhuma ação** |

⚠️ **Nenhuma ação acima deve ser executada sem plano aprovado item a item.** Em especial, `REVOKE EXECUTE ... FROM anon` em massa (SEC-24) **quebrará qualquer fluxo público legítimo** que dependa de RPC anônima — o fluxo de atestados médicos é candidato direto (`fn_registrar_nonce_atestado`). Exige mapeamento prévio de quais funções o fluxo público realmente usa.

---

## Lição metodológica

O replay de migrations **superestimou o risco em 5 dos 8 achados prioritários** (SEC-01, 06, 07, 08, 18) e **não detectou o achado mais grave** (SEC-24, visível apenas no catálogo vivo via `pg_proc.proacl`).

Migrations descrevem **intenções históricas**, não estado. Neste projeto, um volume relevante de operações foi aplicado fora do diretório versionado — 194 policies removidas, 8 buckets fechados, funções consolidadas, 230 índices criados.

**Regra derivada:** nenhum achado de segurança deste ERP pode ser afirmado sem consulta a `pg_policies`, `pg_proc`, `pg_class` e `storage.buckets` no banco vivo.
