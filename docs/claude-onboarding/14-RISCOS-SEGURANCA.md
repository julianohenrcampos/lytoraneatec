# 14 — RISCOS DE SEGURANÇA

> Auditoria READ-ONLY. **Nenhuma correção foi aplicada.**
> Análise **estática** — sem acesso ao banco do ERP. Todo item traz a evidência no repositório e a **consulta/teste de confirmação**.
>
> Classificação: `CRÍTICO` · `ALTO` · `MÉDIO` · `BAIXO` · `INFORMATIVO`

---

## Índice de achados

| # | Achado | Severidade | Confirmado estaticamente? |
|---|---|---|---|
| **SEC-01** | `bd_funcionarios` legível por `anon` e por qualquer autenticado (`USING(true)`) com PII e folha | **CRÍTICO** | ✔ código; ⚠️ estado real a confirmar |
| **SEC-02** | `pncp-sync`: bypass de autenticação por campo do corpo (`source: "cron"`) com `service_role` | **CRÍTICO** | ✔ |
| **SEC-03** | `geocode-proxy`: Edge Function sem nenhuma autenticação, com `service_role` e `MAPBOX_TOKEN` | **ALTO** | ✔ |
| **SEC-04** | `user_offline_context` no `localStorage` não assinado, usado para elevar a SuperAdm na UI | **ALTO** | ✔ |
| **SEC-05** | 93 policies `PERMISSIVE` com `USING(true)`/`WITH CHECK(true)` anulando o desenho de RLS | **ALTO** | ✔ |
| **SEC-06** | Buckets públicos com PII (`funcionarios`, `apontamentos`, `tickets`, `sso-checklists`) | **ALTO** | ✔ criação; ⚠️ conteúdo a confirmar |
| **SEC-07** | `Allow bucket creation`: qualquer autenticado cria/altera/apaga buckets | **ALTO** | ✔ |
| **SEC-08** | Site URL e Redirect URLs de Auth em `http://` | **ALTO** | ✔ documento; ⚠️ confirmar HTTPS no Netlify |
| **SEC-09** | `.env` rastreado no Git e ausente do `.gitignore` | **MÉDIO** | ✔ |
| **SEC-10** | Dados sensíveis duplicados em `bd_funcionarios` apesar de `bd_funcionarios_sensivel` | **MÉDIO** | ✔ |
| **SEC-11** | `fix-empty-rbac-roles`: Edge que forja JWT de SuperAdmin | **MÉDIO** | ✔ |
| **SEC-12** | `login-dispositivo-totem` sem rate limiting | **MÉDIO** | ✔ |
| **SEC-13** | `LYTOTEC_API_KEY` compartilhada entre 5+ funções de propósitos distintos | **MÉDIO** | ✔ |
| **SEC-14** | Guards de rota com comportamento *fail-open* | **MÉDIO** | ✔ |
| **SEC-15** | 15 funções `SECURITY DEFINER` sem `SET search_path` | **MÉDIO** | ✔ |
| **SEC-16** | Sem CSP e sem SRI; scripts de CDN externas | **MÉDIO** | ✔ |
| **SEC-17** | Tabelas de auditoria graváveis/apagáveis por qualquer autenticado | **MÉDIO** | ✔ |
| **SEC-18** | Divergência entre `is_super_admin` (estrita) e `fn_is_super_admin` (ampla) | **MÉDIO** | ✔ |
| **SEC-19** | Proxy Python legado que manipula credenciais, versionado | **BAIXO** | ✔ |
| **SEC-20** | Logs de diagnóstico com e-mail, salário e fluxo de senha | **BAIXO** | ✔ |
| **SEC-21** | E-mails de SuperAdm e de destino hardcoded no código | **BAIXO** | ✔ |
| **SEC-22** | `anon key` hardcoded em `client.ts` e `TestePonto.tsx` | **INFORMATIVO** | ✔ |
| **SEC-23** | `.innerHTML` com template string em 4 arquivos | **INFORMATIVO** | ✔ |

---

## 🔴 CRÍTICO

### SEC-01 — `bd_funcionarios` exposta a `anon` e a qualquer autenticado

**Evidência (migrations):**

`supabase/migrations/20250702171415-d3bbe062-399a-4565-a3ae-6fb1aeb06aa5.sql`
```sql
CREATE POLICY "Allow anonymous email verification for registration"
ON bd_funcionarios FOR SELECT TO anon USING (true);

CREATE POLICY "Allow email verification for registration"
ON bd_funcionarios FOR SELECT TO authenticated USING (true);
```
`supabase/migrations/20260203034704_1d6f9807-7fdb-4254-a11b-39252b276cdf.sql:57`
```sql
CREATE POLICY "Verificação de email para registro anon"
ON bd_funcionarios FOR SELECT TO anon
USING (
  -- Apenas permite verificar existência de email (não retorna dados sensíveis)
  true
);
```

Nenhuma dessas três policies é dropada em migration posterior (verificado por replay cronológico + `grep` direto).

**Por que é crítico:**
1. **RLS filtra linhas, não colunas.** O comentário na migration (*"Não expõe dados sensíveis pois o código da aplicação filtra apenas os campos: email, nome_completo, status"*) reflete um erro conceitual: a filtragem é feita no cliente e é trivialmente contornável.
2. `bd_funcionarios` contém (`types.ts`): `cpf` (NOT NULL), `salario_base`, `banco`, `agencia`, `conta_corrente`, `chave_pix`, `data_nascimento`, `endereco_completo` + 7 colunas de endereço, `latitude`/`longitude`, `gratificacao`, `insalubridade`, `periculosidade`, `adicional_noturno`, `refeicao`, `diarias`, `custo_passagem`, `matricula`, `email`.
3. A `anon key` está **publicada no bundle** (`src/integrations/supabase/client.ts:7`) e no `.env` rastreado no Git — por design ela é pública, o que torna o acesso trivial para qualquer pessoa na internet.
4. Policies são **PERMISSIVE** (só existe 1 `RESTRICTIVE` em todo o projeto) ⇒ combinam por **OR** ⇒ a policy elaborada `funcionarios_operacional_select` e toda a arquitetura de `bd_funcionarios_sensivel`/`vw_funcionarios_*`/auditoria de leitura sensível ficam **inoperantes**.

**Confirmação (obrigatória, read-only):**
```sql
select policyname, permissive, roles, cmd, qual
from pg_policies
where schemaname='public' and tablename='bd_funcionarios'
order by cmd, policyname;
```
```bash
# Reproduz exatamente o que um terceiro faria, usando só a chave pública
curl -s "https://eexzgpmrousuxlkvqwkm.supabase.co/rest/v1/bd_funcionarios?select=nome_completo,cpf,salario_base,chave_pix&limit=1" \
  -H "apikey: <VITE_SUPABASE_PUBLISHABLE_KEY>"
```
- `[]` ou erro 401/403 → risco não materializado.
- Uma linha com CPF/salário/PIX → **exposição de dados pessoais e financeiros de todos os funcionários à internet aberta** (LGPD Art. 46/48 — inclusive dever de comunicação ao titular e à ANPD).

**Não corrigido.** Ver plano proposto em §"Encaminhamento" ao final.

---

### SEC-02 — `pncp-sync`: bypass de autenticação com `service_role`

**Evidência:** `supabase/functions/pncp-sync/index.ts:342-360`
```ts
const authHeader = req.headers.get("Authorization");
let isCronCall = false;
try {
  body = await req.clone().json();
  isCronCall = body?.source === "cron";   // auto-declarado
  userId    = body?.user_id || null;      // auto-declarado
} catch {}

if (!authHeader && !isCronCall) {
  return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, ... });
}
```
`supabase/config.toml` → `[functions.pncp-sync] verify_jwt = false`.

**Dois defeitos:**
1. `{"source":"cron"}` no corpo **dispensa autenticação**. Não há segredo de cron.
2. Quando `authHeader` está presente, **ele nunca é validado** — qualquer string após `Bearer ` satisfaz a condição.

Após o gate, a função cria um client com `SUPABASE_SERVICE_ROLE_KEY` (bypass total de RLS), lê `bd_configuracoes_sistema`, `bd_pncp_perfis_busca` (filtrando por `user_id` fornecido pelo atacante), e escreve em `bd_pncp_sync_log`, `bd_pncp_contratacoes`, `bd_pncp_todas_licitacoes`, `bd_orgaos_publicos`.

**Impacto:** execução não autenticada de rotina privilegiada; consumo de cota Supabase e da API do PNCP; poluição de dados de licitações; atribuição falsa de execuções a `user_id` arbitrário.

**Confirmação sem efeito colateral:**
```sql
select id, status, user_id, created_at
from public.bd_pncp_sync_log
order by created_at desc limit 50;
```
Execuções com `user_id` nulo/desconhecido e sem correspondência em cron legítimo indicam exploração.

**Confirmação ativa (dispara um sync — usar apenas em janela controlada):**
```bash
curl -i -X POST "https://eexzgpmrousuxlkvqwkm.supabase.co/functions/v1/pncp-sync" \
  -H "content-type: application/json" -d '{"source":"cron"}'
```

---

## 🟠 ALTO

### SEC-03 — `geocode-proxy` sem autenticação
`supabase/functions/geocode-proxy/index.ts:151` — `Deno.serve` vai direto ao `req.json()`. Não lê `Authorization`, `x-api-key` nem `x-device-secret`. `verify_jwt = false`. `Access-Control-Allow-Origin: *`. Sem rate limiting.

Usa `SUPABASE_SERVICE_ROLE_KEY` e `MAPBOX_TOKEN`. Escreve em `bd_cache_enderecos` (4 pontos) e `bd_geocoding_falhas` (1 ponto).

**Impacto:** proxy Mapbox aberto (custo/cota); envenenamento do cache de endereços que alimenta o geocoding de funcionários e centros de custo — o que por sua vez alimenta a **cerca geográfica do ponto eletrônico** (`bd_centros_custo.raio_ponto_metros`).

```bash
curl -i -X POST "https://eexzgpmrousuxlkvqwkm.supabase.co/functions/v1/geocode-proxy" \
  -H "content-type: application/json" -d '{"action":"reverse","latitude":-23.55,"longitude":-46.63}'
```

---

### SEC-04 — `user_offline_context` não assinado eleva privilégio na UI
`src/utils/offlinePermissions.ts` grava em `localStorage` um objeto **sem assinatura**:
```json
{"userId":"...","isSuperAdmin":true,"permissions":["*"],
 "validatedFromServer":true,"userRole":"SuperAdm","timestamp":"..."}
```
Validação na leitura: apenas idade < 24 h, `userId` correspondente e `validatedFromServer === true` — **todos os três campos são controlados pelo próprio cliente**.

Consumidores:
- `src/hooks/usePermission.ts` — "Camada B" → `permissions = ['*']`, `isSuperAdmin = true`
- `src/components/routing/SecureRouteGuard.tsx` — `emergencyAdminBypass` → renderiza `children` sem qualquer verificação
- `canAccessOfflineModule()` → libera módulos offline

**Impacto:** qualquer usuário autenticado abre o DevTools, grava o objeto e obtém a **interface completa de administrador**, incluindo `/admin/permissoes`, `/admin/auditoria`, `/admin/qualidade-cadastral`. Os dados continuam protegidos por RLS no backend, mas:
- expõe a estrutura administrativa e nomes de permissões;
- qualquer operação cujo único gate seja o frontend passa a ser executável;
- combinado com SEC-05 (93 policies `USING(true)`), várias dessas operações **têm efeito real no banco**.

**Confirmação:** em uma conta de teste sem privilégios, no console do navegador:
```js
localStorage.setItem('user_offline_context', JSON.stringify({
  userId: '<id-da-conta-de-teste>', email: null, isSuperAdmin: true,
  permissions: ['*'], userRole: 'SuperAdm', validatedFromServer: true,
  timestamp: new Date().toISOString()
}));
location.reload();
```
Se o menu administrativo aparecer, o risco está confirmado.

---

### SEC-05 — 93 policies permissivas anulam o desenho de RLS
Inventário completo em `08-MAPA-RLS.md` §5. Resumo do impacto:
- **Escrita irrestrita** (`FOR ALL USING(true)`, herda `WITH CHECK`) para qualquer autenticado em: `bd_caminhoes_equipamentos`, `bd_centros_custo`, `bd_departamentos`, `bd_empresas`, `bd_equipes`, `bd_usinas`, `bd_ordens_servico`, `bd_registro_apontamento_inspecao`, `bd_catalogo_*`, `bd_fabricantes`, `bd_modelos`, `bd_tipos_equipamento`, `bd_frotas`, `bd_grupos_ativos`, `bd_linhas_operacionais`, `bd_portfolio_empresas`, aliases.
- `bd_centros_custo` gravável por qualquer autenticado é particularmente grave: é o eixo de escopo de **40 tabelas** e da cerca geográfica do ponto. Alterar `raio_ponto_metros` ou coordenadas de um CC compromete o controle de jornada.
- Policies com nome `"Allow all access to X during development"` continuam vivas em produção (`bd_lista_programacao_entrega`, `bd_caminhoes`, `bd_centro_custo`).

Como só existe **1 policy RESTRICTIVE** em todo o projeto, não há como uma policy restritiva "vencer" as permissivas.

---

### SEC-06 — Buckets públicos com dados pessoais
`funcionarios`, `apontamentos`, `tickets`, `sso-checklists`, `avatars`, `inspecao-fotos`, `veiculos`, `empresas-logos`, `portfolio`, `services` foram criados com `public = true`. Objetos em bucket público são servidos **sem autenticação** por `/storage/v1/object/public/<bucket>/<path>`; as policies de `storage.objects` não se aplicam a esse caminho.

Precedente: `os_photos` já foi corrigido de público para privado (`20260422201946`).

```sql
select id, public, file_size_limit, allowed_mime_types from storage.buckets order by public desc, id;
select bucket_id, count(*) from storage.objects
where bucket_id in ('funcionarios','apontamentos','tickets','sso-checklists') group by 1;
```

---

### SEC-07 — Qualquer autenticado pode gerenciar buckets
`supabase/migrations/20250703183928-6e477a49-f50c-49f5-9765-8d34273f6d40.sql`
```sql
CREATE POLICY "Allow bucket creation" ON storage.buckets
FOR ALL TO authenticated USING (true) WITH CHECK (true);
```
`FOR ALL` inclui `UPDATE` e `DELETE` ⇒ um usuário comum pode **tornar público** um bucket privado (`documentos-rh`, `biometria-facial`, `atestados-medicos`, `assinaturas-funcionarios`) ou apagá-lo.

```sql
select policyname, cmd, roles, qual, with_check from pg_policies
where schemaname='storage' and tablename='buckets';
```

---

### SEC-08 — Auth configurado em HTTP
`SUPABASE_AUTH_CONFIG.md` e `.env` (`VITE_APP_PUBLIC_URL="http://lytotec.com.br"`) indicam Site URL e Redirect URLs em `http://`. O documento diz explicitamente *"Quando HTTPS estiver disponível, adicionar também…"*.

**Impacto:** links de recuperação de senha contêm `access_token` no fragmento; a sessão trafega em claro; MITM em rede não confiável captura a sessão.

**Confirmação:** `curl -I http://lytotec.com.br` — se não houver `301` para `https://`, o risco é real. E verificar no Dashboard → Authentication → URL Configuration.

---

## 🟡 MÉDIO

### SEC-09 — `.env` rastreado no Git
`git ls-files | grep '^\.env'` → **`.env`**. O `.gitignore` cobre `*.local` mas **não** `.env`.
Conteúdo atual: apenas URL do projeto, `project_id` e chaves **anon/publishable** (públicas por design). **Nenhum `service_role` foi encontrado no repositório.**
**Risco real:** o padrão convida a que um segredo verdadeiro seja adicionado no futuro e vazado. Se o repositório GitHub for público, o histórico completo já está exposto.
**`[VERIFICAR]`** — o repositório `github.com/julianohenrcampos/lytoranea` é público ou privado?

### SEC-10 — PII duplicada entre `bd_funcionarios` e `bd_funcionarios_sensivel`
A tabela segregada existe e tem colunas de hash (`cpf_hash`, `email_hash`, `pix_hash`), mas **os mesmos dados continuam em `bd_funcionarios`**. A migração ficou em modo aditivo e nunca foi concluída. Amplifica SEC-01. Detalhe em `05-MAPA-BANCO-DADOS.md` §5.

### SEC-11 — `fix-empty-rbac-roles` forja JWT de SuperAdmin
Única função com `SUPABASE_JWT_SECRET`; assina JWTs (`jose/SignJWT`, HS256, 5 min) impersonando `julianohcampos@yahoo.com.br` e concede papéis RBAC em massa. Gate: `x-api-key` (`FIX_EMPTY_RBAC_ROLES_API_KEY`) **ou** JWT de SuperAdm. A lógica está correta, mas o raio de explosão de um vazamento dessa chave é total.

### SEC-12 — Sem rate limiting no login de totem
`login-dispositivo-totem` não usa `fn_rate_limit_check`/`bd_rate_limit_tentativas` (que existem no projeto). Permite força bruta sobre `codigo_dispositivo` + `senha` (mínimo 8 caracteres). Sucesso gera `device_session_token` válido para 3 Edge Functions de ponto.

### SEC-13 — `LYTOTEC_API_KEY` sem segregação de escopo
Uma única chave autentica: registro de ponto em totem, heartbeat de dispositivo, onboarding de fornecedor, sync de subcategorias com o site, finalização de diárias, processamento de desligamentos e o shadow de ponto. A chave está distribuída em totens físicos em campo e no site institucional (outro projeto Supabase).

### SEC-14 — Guards *fail-open*
Três comportamentos deliberados (comentados no código como proteção contra instabilidade), detalhados em `06-MAPA-RBAC.md` §8:
1. `SecureRouteGuard` libera quando `hasVerifiedOnce && !isLoading && permissions.length === 0`;
2. `SimplePermissionGuard` mantém acesso após perda de permissão (`wasEverApproved`);
3. `hasRoutePermission` retorna `true` para rota não mapeada (66 de 95 rotas mapeadas).

### SEC-15 — 15 funções `SECURITY DEFINER` sem `SET search_path`
Lista em `09-MAPA-RPCS-FUNCOES-TRIGGERS.md` §2.1. As mais relevantes: `delete_funcionario_with_admin_bypass`, `consolidar_funcionarios_duplicados`, `can_delete_funcionario`, `get_user_permissions`, `user_has_permission_hybrid`, `get_current_user_role`.
_(Contexto: 484 de 499 funções `SECURITY DEFINER` **têm** `search_path` — a postura geral é boa.)_

### SEC-16 — Ausência de CSP e de SRI
`netlify.toml` define apenas headers de cache — **não há `Content-Security-Policy`**, `X-Frame-Options`, `Referrer-Policy` nem `Permissions-Policy`.
Scripts/recursos de terceiros carregados sem `integrity=`: `cdn.gpteng.co/gptengineer.js` (index.html), `cdnjs.cloudflare.com` (PDF.js worker × 2, fontes Roboto × 2), `ui-avatars.com`.

### SEC-17 — Auditoria alterável pelo auditado
Policies `FOR ALL USING(true)` vivas em `bd_auditoria_correcao_registros_carga` (role `public`), `bd_auditoria_correcao_volume_formula`, `bd_auditoria_sync_equipe_funcionario`, `bd_auditoria_volume_correcao`. Qualquer autenticado pode inserir, alterar e **apagar** registros de auditoria.

### SEC-18 — Dois predicados de SuperAdmin com semânticas diferentes
`is_super_admin` (só `bd_user_roles`; 18 usos em policies + 2 Edge Functions) × `fn_is_super_admin` (4 fontes, incluindo `profiles.acesso_global`, `profiles.funcoes`, `profiles.funcao_sistema`, `bd_funcoes_permissao`; 378 usos). O resultado da autorização depende de qual função a policy usa. Detalhe em `06-MAPA-RBAC.md` §4.

---

## 🟢 BAIXO

### SEC-19 — Proxy Python legado versionado
`api/proxy_server.py` e `src/components/reabastecimento/proxy_server.py` (**idênticos**): Flask com `CORS(app)` totalmente aberto, recebe `login`/`senha` do Guardian Web em POST e grava cache em `cache_abastecimentos.json`. Existe `api/__pycache__/guardian_api.cpython-313.pyc` referenciando um `guardian_api.py` que **não está mais no repositório** — indicando execução prévia. Substituído pela Edge Function `guardian-web-proxy`.

### SEC-20 — Logs de diagnóstico com dados sensíveis
`console.log` com e-mail, matrícula, nome de funcionário, salário e fluxo de senha em: `src/services/authRecoveryService.ts` (5 ocorrências), `src/components/funcionarios/EmailConfirmationModal.tsx` e `funcionarios/EmailConfirmationModal.tsx` ("Confirmando email com senha temporária: ${email}"), `src/services/adminService.ts:25`, `src/lib/auth.ts:254`, `src/pages/ResetPassword.tsx`, `src/components/funcionarios/classificacao/BaixarClassificacaoModal.tsx` (`SALARIO_ATUAL_DEBUG`).
**Mitigação já existente:** `vite.config.ts` aplica `pure: ['console.log','console.info','console.debug','console.warn']` em `mode === 'production'`. Portanto **em produção esses logs são removidos do bundle**; permanecem em `build:dev` e preview.
Nas Edge Functions os logs são estruturados e não expõem segredos.

### SEC-21 — E-mails hardcoded
`src/config/superAdminEmails.ts` (2 e-mails com SuperAdm de fallback), `supabase/functions/fix-empty-rbac-roles/index.ts:58`, `supabase/functions/atestado-submeter/index.ts:37` (`EMAIL_DP`), `src/services/adminService.ts:55` e `src/components/admin/EmailConfirmationButton.tsx` (`xmatheus457@gmail.com`), e 6 migrations que concedem SuperAdm por e-mail.
Risco operacional (quebra silenciosa na saída de um colaborador) > risco de segurança.

---

## ⚪ INFORMATIVO

### SEC-22 — `anon key` no código
`src/integrations/supabase/client.ts:7` e `src/pages/dev/TestePonto.tsx:9`. **É o padrão do Supabase** — a chave `anon` é pública por design e a segurança depende inteiramente do RLS. Registrado porque **é exatamente essa premissa que SEC-01 e SEC-05 quebram**.

### SEC-23 — `.innerHTML` com template string
4 arquivos (`relatorio-medicao/Reabastecimento.tsx:571`, `RelatorioMedicaoHeader.tsx:571`, `relatorio-reabastecimento/reabastecimentos.tsx:571`, `pages/reabastecimentos.tsx:573`) — mesma linha duplicada:
```ts
element.innerHTML = `<div style="...">${message}</div>`;
```
`message` é uma string interna de estado ("Carregando...", "Sem dados"), não entrada de usuário. 3 dos 4 arquivos são **órfãos**. Baixo risco real; registrado por completude.

Uso único de `dangerouslySetInnerHTML`: `src/components/ui/chart.tsx:79` — componente padrão do shadcn/ui que injeta CSS de tema. Não recebe entrada de usuário.

**Não há `eval()` nem `new Function()` no projeto.** ✔
**SQL dinâmico (`EXECUTE format`) aparece em apenas 7 de 869 migrations**, sempre em DO blocks de manutenção idempotente de policies, sem interpolação de entrada de usuário. ✔

---

## Pontos fortes de segurança (registrados para não serem perdidos)

1. **RLS habilitado em 100% das 194 tabelas.**
2. **484 de 499 funções `SECURITY DEFINER` com `SET search_path`.**
3. **Nenhum `service_role` no frontend.** Verificado por varredura de JWT e da string `SERVICE_ROLE` em `src/`, `public/`, `scripts/`.
4. **Nenhum secret hardcoded em Edge Functions** — todos via `Deno.env.get()`.
5. **Arquitetura de predicados por domínio** (`fn_<dominio>_can_<acao>`) reutilizada em policies e RPCs — desenho maduro.
6. **Segregação de client em Edge Functions**: decisão de autorização com o JWT do usuário, efeito colateral com `service_role` (exemplo: `pop-excluir`).
7. **Auditoria estruturada** em 13 tabelas, incluindo auditoria de **leitura** de dados sensíveis.
8. **HMAC + nonce** no fluxo público de atestados (anti-replay).
9. **Service Worker com bypass correto** de `*.supabase.co`, `/functions/v1/`, `/auth/` — nenhum token cacheado.
10. **`previewAuthStorage`** valida origem do editor com regex ancorada — implementação criteriosa.
11. **CORS por allowlist já existe** (`_shared/pops-cors.ts`) — o padrão correto está disponível, só não foi generalizado.
12. **Telemetria de RBAC legado** já instalada, com dados sendo coletados para o cutover.
13. **`console.*` removido do bundle de produção** por configuração do Vite.

---

## Encaminhamento proposto (NADA foi executado)

Nenhuma correção deve ser feita sem sua autorização explícita. A sequência sugerida, em ordem de prioridade:

| Ordem | Ação | Tipo |
|---|---|---|
| 1 | **Verificar** SEC-01 no banco real (consulta `pg_policies` + teste `curl` com anon key) | verificação |
| 2 | **Verificar** SEC-02 e SEC-03 (log de `bd_pncp_sync_log`; `curl` no `geocode-proxy`) | verificação |
| 3 | **Verificar** SEC-06/SEC-07 (`storage.buckets`, policies de `storage.buckets`) | verificação |
| 4 | **Verificar** SEC-08 (HTTPS no domínio) e SEC-09 (visibilidade do repositório) | verificação |
| 5 | Apresentar **plano de remediação por item**, com SQL, rollback, testes e impacto retroativo | proposta |
| 6 | Executar remediação apenas após aprovação item a item | execução |

> ⚠️ **Atenção especial ao passo 6 para SEC-01 e SEC-05**: a remoção de uma policy `USING(true)` **pode quebrar funcionalidades em produção** que hoje dependem silenciosamente dela. Cada remoção exige mapeamento prévio de quem lê/escreve a tabela e, provavelmente, uma policy substituta correta — não é uma exclusão simples.
