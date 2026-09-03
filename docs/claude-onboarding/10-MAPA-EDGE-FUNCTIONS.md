# 10 — MAPA DAS EDGE FUNCTIONS

> Auditoria READ-ONLY. Fonte: `supabase/functions/**` + `supabase/config.toml`. **Nada foi modificado nem redeployado.**

---

## 1. Panorama

**36 Edge Functions** (Deno). **29 com `verify_jwt = false`** em `supabase/config.toml`, 7 com verificação de JWT pela plataforma.

`verify_jwt = false` **não significa "sem autenticação"** — significa que a plataforma não valida o JWT e a função assume essa responsabilidade. Foi verificado, função a função, qual mecanismo cada uma usa.

### Mecanismos de autenticação encontrados
| Mecanismo | Funções |
|---|---|
| `authenticateEdgeRequest` + `authorizeBackendInvocation` (`_shared/backend-security.ts`) | `delete-user`, `auto-finalizar-diarias`, `process-desligamentos`, `ponto-diaria-shadow`, `sync-subcategorias-site` |
| `auth.getClaims(token)` + `is_super_admin` RPC | `definir-senha-dispositivo`, `vincular-ccs-dispositivo`, `cadastrar-biometria-facial`, `fix-empty-rbac-roles` |
| `auth.getClaims(token)` + RPC do domínio decide | `pop-excluir`, `pop-descartar-rascunho`, `pop-upload-arquivo`, `pop-arquivo-blob` |
| `x-device-secret` (sessão de dispositivo em `bd_ponto_dispositivos`) | `identificar-funcionario-por-face`, `confirmar-match-totem`, `registrar-ponto-totem` |
| `x-api-key` = `LYTOTEC_API_KEY` | `heartbeat-dispositivo`, `onboard-fornecedor`, `registrar-ponto-totem` (alternativa) |
| HMAC + nonce (`ATESTADO_HMAC_SECRET`, `bd_atestados_nonces_utilizados`) | as 6 funções `atestado-*` |
| Código + senha bcrypt do dispositivo | `login-dispositivo-totem` |
| **Nenhum** | 🔴 **`geocode-proxy`** |
| **Auto-declarado pelo corpo da requisição** | 🔴 **`pncp-sync`** |

---

## 2. Tabela completa

| Função | LOC | verify_jwt | service_role | Autenticação própria | CORS | Secrets |
|---|---:|:--:|:--:|---|:--:|---|
| `admin-confirm-email` | 188 | **on** | – | plataforma | – | – |
| `atestado-arquivo-blob` | 144 | **on** | ✔ | plataforma + HMAC | – | URL, ANON, SERVICE_ROLE |
| `atestado-arquivo-signed-url` | 107 | off | ✔ | HMAC + nonce | – | URL, ANON, SERVICE_ROLE |
| `atestado-criar-upload-url` | 69 | off | ✔ | HMAC | – | URL, SERVICE_ROLE, ATESTADO_HMAC_SECRET |
| `atestado-notificar-reenvio` | 145 | off | ✔ | HMAC | – | + RESEND_API_KEY |
| `atestado-submeter` | 508 | off | ✔ | HMAC + nonce | – | + RESEND_API_KEY |
| `atestado-validar-matricula` | 268 | off | ✔ | HMAC | – | ATESTADO_HMAC_SECRET |
| `auto-finalizar-diarias` | 244 | off | – | `authenticateEdgeRequest(allowApiKey)` | – | LYTOTEC_API_KEY |
| `cadastrar-biometria-facial` | 221 | off | ✔ | `getClaims` | `*` | URL, SERVICE_ROLE, ANON |
| `confirmar-match-totem` | 77 | off | ✔ | `x-device-secret` | `*` | URL, SERVICE_ROLE |
| `create-gestor` | 821 | off | ✔ | `getUser()` próprio | `*` | + RBAC_DUAL_WRITE_ENABLED |
| `definir-senha-dispositivo` | 116 | off | ✔ | `getClaims` + `is_super_admin` | `*` | URL, ANON, SERVICE_ROLE |
| `delete-user` | 152 | off | ✔ (shared) | `authenticateEdgeRequest` + `authorizeBackendInvocation` | `*` | – |
| `excluir-solicitacao-equipamento` | 161 | **on** | – | plataforma | – | – |
| **`fix-empty-rbac-roles`** | 369 | off | ✔ | `x-api-key` **OU** `getClaims`+`is_super_admin` | `*` | **SUPABASE_JWT_SECRET, JWT_SECRET**, URL, SERVICE_ROLE, ANON |
| **`geocode-proxy`** | 465 | off | ✔ | 🔴 **NENHUMA** | `*` | URL, SERVICE_ROLE, MAPBOX_TOKEN |
| `get-mapbox-public-token` | 30 | **on** | – | plataforma | `*` | MAPBOX_TOKEN |
| `guardian-web-proxy` | 253 | **on** | ✔ | plataforma + `getUser()` + `fn_backend_can_invoke` | `*` | URL, SERVICE_ROLE |
| `heartbeat-dispositivo` | 97 | off | ✔ | `x-api-key` | – | + LYTOTEC_API_KEY |
| `identificar-funcionario-manual` | 211 | **on** | ✔ | plataforma | – | URL, SERVICE_ROLE |
| `identificar-funcionario-por-face` | 294 | off | ✔ | `x-device-secret` + expiração de sessão | `*` | URL, SERVICE_ROLE |
| `login-dispositivo-totem` | 148 | off | ✔ | código + senha bcrypt | `*` | URL, SERVICE_ROLE |
| `onboard-fornecedor` | 308 | off | ✔ | `x-api-key` | `*` | LYTOTEC_API_KEY, URL, SERVICE_ROLE |
| **`pncp-sync`** | 917 | off | ✔ | 🔴 `authHeader` **OU** `body.source === "cron"` | `*` | URL, SERVICE_ROLE |
| `ponto-diaria-shadow` | 100 | off | – | `authenticateEdgeRequest(allowApiKey)` | – | – |
| `pop-arquivo-blob` | 129 | off | ✔ | `getClaims` + RPC | restrito | URL, ANON, SERVICE_ROLE |
| `pop-descartar-rascunho` | 79 | off | ✔ | `getClaims` + RPC | restrito | idem |
| `pop-excluir` | 84 | off | ✔ | `getClaims` + `fn_pop_excluir` | restrito | idem |
| `pop-upload-arquivo` | 157 | off | ✔ | `getClaims` + RPC | restrito | idem |
| `process-desligamentos` | 131 | off | – | `authenticateEdgeRequest(allowApiKey)` | – | LYTOTEC_API_KEY |
| `registrar-ponto` | 609 | off | ✔ | `getUser()` | – | URL, SERVICE_ROLE, ANON |
| `registrar-ponto-dispositivo-obra` | 202 | **on** | ✔ | plataforma | `*` | URL, SERVICE_ROLE |
| `registrar-ponto-totem` | 627 | off | ✔ | `x-device-secret` **ou** `x-api-key` | – | + LYTOTEC_API_KEY |
| `sync-ponto-offline` | 443 | off | ✔ | `getUser()` | – | URL, SERVICE_ROLE, ANON |
| `sync-subcategorias-site` | 149 | off | – | `authenticateEdgeRequest(allowApiKey)` | – | LYTOTEC_API_KEY |
| `vincular-ccs-dispositivo` | 168 | off | ✔ | `getClaims` + `is_super_admin` | `*` | URL, ANON, SERVICE_ROLE |

---

## 3. Módulo compartilhado `_shared/`

| Arquivo | Papel |
|---|---|
| `backend-security.ts` | `corsHeaders`, `createServiceClient()`, `createUserClient()`, `jsonResponse()`, `getRequestId()`, `getClientIp()`, `authenticateEdgeRequest()`, `authorizeBackendInvocation()`, `auditBackendEvent()` |
| `pops-cors.ts` | **CORS por allowlist** + `POPS_BUCKET` + `POPS_MAX_BYTES` (20 MB) + `isUuid` |
| `atestados-cors.ts`, `atestados-hmac.ts` | CORS e HMAC do fluxo de atestados |
| `ponto-helpers.ts`, `ponto-validators.ts` | Validação de ponto (GPS, cerca, cooldown) |
| `calculoDiaria.ts`, `integracao-diaria.ts` | Cálculo e integração de diárias |

### `authenticateEdgeRequest` — implementação
Aceita dois modos:
1. `Authorization: Bearer <jwt>` → cria user client com `ANON_KEY` e valida o token
2. `x-api-key` comparado contra os secrets nomeados em `apiKeySecretNames` (quando `allowApiKey: true`)

Retorna `EdgeAuthContext { mode, userId, email, subject, token }` ou `null`.

Complementada por `authorizeBackendInvocation(client, auth, recurso, contexto)` → delega a `fn_backend_can_invoke` no banco, e por `auditBackendEvent()` → grava em `bd_backend_exec_auditoria` com `nivelRisco`, `permitido`, `sucesso`, `statusHttp`, `ip`, `requestId`.

> **Este é o padrão de referência do projeto.** As funções que não o usam são justamente as de maior risco.

### CORS — duas políticas coexistindo

| Política | Onde | Origens |
|---|---|---|
| **Permissiva** | `_shared/backend-security.ts` → `Access-Control-Allow-Origin: "*"` | qualquer |
| **Allowlist** | `_shared/pops-cors.ts` → `corsFor(req)` com `Vary: Origin` e bloqueio explícito | `app.lytoranea.com.br`, `staging.lytoranea.com.br`, `lytotec.com.br`, `www.lytotec.com.br`, `radiant-company-core.lovable.app`, 2 hosts de preview Lovable, `localhost:8080`, `localhost:5173` |

Apenas as 4 funções `pop-*` usam a allowlist. As demais usam `*`.

> `Access-Control-Allow-Origin: *` **não permite envio de cookies**, e as funções autenticam por header (`Authorization`/`x-api-key`/`x-device-secret`), não por cookie. Portanto o CORS permissivo **não abre CSRF** — mas remove a barreira de origem para funções que dependem apenas de estar publicamente acessíveis (ver §4).

---

## 4. 🔴 Achados críticos

### 4.1 `pncp-sync` — bypass de autenticação por campo do corpo

`supabase/functions/pncp-sync/index.ts:342-360`
```ts
const authHeader = req.headers.get("Authorization");
let isCronCall = false;
try {
  const clonedReq = req.clone();
  body = await clonedReq.json();
  isCronCall = body?.source === "cron";      // ← auto-declarado pelo cliente
  salvarTodas = body?.salvarTodas === true;
  userId = body?.user_id || null;            // ← auto-declarado pelo cliente
} catch {}

if (!authHeader && !isCronCall) {
  return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, ... });
}
// segue com SERVICE_ROLE
```

**Dois problemas:**
1. `{"source":"cron"}` no corpo dispensa qualquer autenticação. `isCronCall` nunca é validado contra um segredo.
2. Quando `authHeader` existe, **ele nunca é verificado** — qualquer string `Bearer xxx` passa.

**Impacto:** qualquer pessoa que conheça a URL pode disparar uma sincronização completa do PNCP operando com `service_role` (bypass total de RLS), gravar em `bd_pncp_sync_log` com `user_id` arbitrário (`userId = body?.user_id`), consumir a API externa do PNCP e a cota do projeto Supabase.

**Verificação (read-only, não altera dados de negócio — mas dispara um sync; executar apenas em janela controlada):**
```bash
curl -i -X POST "https://eexzgpmrousuxlkvqwkm.supabase.co/functions/v1/pncp-sync" \
  -H "content-type: application/json" -d '{"source":"cron"}'
```
Um `401` indica que a função foi corrigida ou que a plataforma bloqueia. Um `200`/`202` confirma o achado.
> Alternativa **sem efeito colateral**: inspecionar `bd_pncp_sync_log` por execuções com `user_id` nulo/desconhecido.
> ```sql
> select id, status, user_id, created_at from public.bd_pncp_sync_log order by created_at desc limit 50;
> ```

### 4.2 `geocode-proxy` — sem nenhuma autenticação

`supabase/functions/geocode-proxy/index.ts:151` — `Deno.serve` entra direto no `body`, sem ler `Authorization`, `x-api-key` ou `x-device-secret`. `Access-Control-Allow-Origin: *`.

**Impacto:**
- Proxy aberto para a API Mapbox usando `MAPBOX_TOKEN` do projeto → **abuso de cota e custo**;
- Escrita irrestrita em `bd_cache_enderecos` (4 pontos) e `bd_geocoding_falhas` (1 ponto) com `service_role` → **envenenamento do cache de endereços**, que alimenta o geocoding de funcionários e centros de custo;
- Sem rate limiting.

**Verificação:**
```bash
curl -i -X POST "https://eexzgpmrousuxlkvqwkm.supabase.co/functions/v1/geocode-proxy" \
  -H "content-type: application/json" \
  -d '{"action":"reverse","latitude":-23.55,"longitude":-46.63}'
```
`200` com resultado confirma o proxy aberto.

### 4.3 `fix-empty-rbac-roles` — forja JWT de SuperAdmin

`supabase/functions/fix-empty-rbac-roles/index.ts`
```ts
const SUPER_ADMIN_CONFIG = { email: "julianohcampos@yahoo.com.br", roleName: "SuperAdm" };
const INTERNAL_API_KEY_SECRET_NAMES = ["FIX_EMPTY_RBAC_ROLES_API_KEY"];

async function buildSuperAdminAuthHeader(userId, email) {
  const jwtSecret = Deno.env.get("SUPABASE_JWT_SECRET") ?? Deno.env.get("JWT_SECRET");
  const token = await new SignJWT({ sub: userId, email, role: "authenticated", aud: "authenticated" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt().setExpirationTime("5m").sign(secret);
```

É a **única** função que:
- recebe o `SUPABASE_JWT_SECRET` como secret;
- **assina JWTs válidos** para o projeto, impersonando um usuário específico;
- concede papéis RBAC (`ROLE_MATRIX` com `AdmEquipamentos`, `Operador`, `Usuário`) em massa.

Autenticação: `x-api-key` (`FIX_EMPTY_RBAC_ROLES_API_KEY`) **OU** JWT de SuperAdm. A lógica está correta, mas o **raio de explosão é máximo**: quem obtiver `FIX_EMPTY_RBAC_ROLES_API_KEY` obtém a capacidade de forjar sessões e conceder papéis.

**Recomendação (não aplicada):** avaliar se essa função ainda é necessária. Trata-se de um utilitário de correção pontual mantido em produção.

**Verificação:** confirmar se o secret está definido e se a função ainda está deployada — Dashboard → Edge Functions e Settings → Secrets.

### 4.4 `login-dispositivo-totem` — sem rate limiting
Autentica por `codigo_dispositivo` + `senha` (bcrypt, mínimo 8 caracteres). **Não chama `fn_rate_limit_check` nem grava em `bd_rate_limit_tentativas`**, apesar de esse mecanismo existir no projeto. Permite força bruta sobre a senha do totem. Um totem comprometido produz `device_session_token` válido para `identificar-funcionario-por-face`, `confirmar-match-totem` e `registrar-ponto-totem`.

---

## 5. Pontos positivos do design das Edge Functions

- **Segregação de clients**: `createUserClient(authHeader)` (ANON + JWT do usuário, sujeito a RLS) vs `createServiceClient()` (service_role). Várias funções fazem a **decisão de autorização com o client do usuário** e usam `service_role` só para o efeito colateral. Exemplo exemplar: `pop-excluir` — chama `fn_pop_excluir` com o JWT do usuário e só depois usa `service_role` para remover os PDFs do bucket.
- **Auditoria estruturada** em `bd_backend_exec_auditoria` com nível de risco, IP, request-id e resumo — inclusive em caminhos de negação (`delete-user` audita o 401 e o 403).
- **Sessões de dispositivo com expiração** (`device_session_expires_at`) verificadas em toda requisição.
- **Nenhum secret hardcoded** — todos vêm de `Deno.env.get`.
- **HMAC + nonce** no fluxo público de atestados (previne replay).
- **CORS por allowlist** já implementado (módulo POPs) — existe o padrão correto, só não foi generalizado.
- **`no-store`** em várias respostas sensíveis.

---

## 6. Invocações a partir do frontend

| Edge Function | Chamadas em `src/` |
|---|---:|
| `admin-confirm-email` | 4 |
| `geocode-proxy` | 3 |
| `identificar-funcionario-manual`, `get-mapbox-public-token` | 2 |
| `registrar-ponto-totem`, `registrar-ponto`, `ponto-diaria-shadow`, `pncp-sync`, `excluir-solicitacao-equipamento`, `delete-user`, `create-gestor`, `confirmar-match-totem`, `cadastrar-biometria-facial` | 1 |

**23 das 36 funções não são invocadas de `src/`** — são chamadas por: dispositivos totem (fetch direto), cron/jobs externos com `LYTOTEC_API_KEY`, o fluxo público de atestados, o site institucional (`onboard-fornecedor`, `sync-subcategorias-site`) e o Guardian Web.

**`[VERIFICAR]`** no Dashboard → Edge Functions: quais estão realmente **deployadas** e qual o volume de invocações de cada uma nos últimos 30 dias. Funções deployadas e nunca invocadas devem ser candidatas a revisão (não a remoção sem autorização).

---

## 7. Consultas de apoio

```sql
-- Auditoria de invocação de backend
select recurso, contexto, nivel_risco, permitido, sucesso, count(*), max(created_at)
from public.bd_backend_exec_auditoria
where created_at > now() - interval '30 days'
group by 1,2,3,4,5
order by 6 desc;

-- Execuções negadas (tentativas de acesso indevido)
select recurso, ip, erro_resumo, count(*), max(created_at)
from public.bd_backend_exec_auditoria
where permitido is false and created_at > now() - interval '30 days'
group by 1,2,3 order by 4 desc limit 50;
```
_(ajustar nomes de coluna conforme o schema real de `bd_backend_exec_auditoria`)_
