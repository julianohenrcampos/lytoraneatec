# HOTFIX-02 — `pncp-sync` (SEC-02)

> **STATUS: PROPOSTA. NÃO APLICADA. NÃO DEPLOYADA.**
> Alvo: `supabase/functions/pncp-sync/index.ts` (deploy vivo: v152, `ACTIVE`, `verify_jwt = false`).

---

## 1. Mapa de callers (Passo 10 — concluído)

| Origem | Existe? | Evidência |
|---|---|---|
| **Frontend autenticado** | **SIM** | `src/services/pncpService.ts:138` → `supabase.functions.invoke("pncp-sync", { method:"POST", body: { salvarTodas, user_id: user.id } })`; UI em `src/pages/MonitoramentoPNCP.tsx:116` |
| **pg_cron** | **NÃO** | `cron.job` tem exatamente 3 jobs: `auto-finalizar-diarias-16h`, `refresh-mv-relatorio-diarias`, `arquivar-auditoria-diario`. **Nenhum chama `pncp-sync`.** |
| **Outra Edge Function** | NÃO | nenhuma referência em `supabase/functions/**` |
| **Banco / trigger / RPC** | NÃO | nenhuma referência em `pg_proc` |
| **Scripts** | NÃO | nenhuma referência em `scripts/` |
| **Webhook externo** | Não identificável | — |

### Conclusão determinante
**O ramo `body.source === "cron"` não tem consumidor legítimo conhecido.** Não existe cron chamando esta função. O único caller real é o frontend autenticado, que **não** envia `source: "cron"` — envia `{ salvarTodas, user_id }`.

Isso torna a correção substancialmente mais simples e de menor risco do que o previsto: **remover o bypass não quebra nenhum fluxo mapeado.**

Ainda assim, o padrão de cron do projeto já existe e está documentado abaixo, caso a sincronização venha a ser agendada.

---

## 2. Padrão de cron já existente no projeto (a reutilizar, não inventar)

`cron.job` jobid=1 chama uma Edge Function assim:

```sql
SELECT net.http_post(
  url     := 'https://<project>.supabase.co/functions/v1/auto-finalizar-diarias',
  headers := '{"Content-Type":"application/json","Authorization":"Bearer <segredo>"}'::jsonb,
  body    := concat('{"time":"', now(), '"}')::jsonb
);
```

E `auto-finalizar-diarias` valida com:
```ts
authenticateEdgeRequest(req, { allowApiKey: true, apiKeySecretNames: ['LYTOTEC_API_KEY'] })
authorizeBackendInvocation(supabase, auth, 'auto-finalizar-diarias', 'diarias')
```

**Portanto o mecanismo correto já existe no projeto**: `_shared/backend-security.ts`.

### Sobre reutilizar `LYTOTEC_API_KEY`
Conforme instruído, **não reutilizar** se houver opção melhor. `LYTOTEC_API_KEY` hoje autentica 5 fluxos distintos (totens em campo, site institucional, diárias, desligamentos, catálogo) — é uma chave de raio amplo distribuída em dispositivos físicos.

**Nome de secret proposto (NÃO criado, valor NÃO gerado):**

| Nome proposto | Consumidores previstos | Onde seria configurado |
|---|---|---|
| `PNCP_SYNC_CRON_KEY` | (a) job `pg_cron` de sincronização PNCP, se vier a existir; (b) nenhum outro | Dashboard → Project Settings → Edge Functions → Secrets |

Se a decisão for **não agendar** a sincronização, o secret é dispensável e o patch fica ainda menor (apenas o caminho humano).

---

## 3. Patch proposto

Alteração **exclusivamente** no bloco de autenticação. Nenhuma linha da lógica de sincronização, matching, paginação ou upsert é tocada.

### 3.1 Trecho atual (v152, linhas ~341-360)

```ts
    const authHeader = req.headers.get("Authorization");
    let isCronCall = false;
    let salvarTodas = false;
    let body: any = {};
    let userId: string | null = null;
    try {
      const clonedReq = req.clone();
      body = await clonedReq.json();
      isCronCall = body?.source === "cron";
      salvarTodas = body?.salvarTodas === true;
      userId = body?.user_id || null;
    } catch {}

    if (!authHeader && !isCronCall) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🚀 Iniciando sincronização PNCP... (fonte: ${isCronCall ? 'cron' : 'manual'})`);
```

### 3.2 Trecho proposto

```ts
    // ---- HOTFIX-02 (SEC-02) --------------------------------------------
    // Dois caminhos autorizados, ambos verificáveis no servidor:
    //   (1) HUMANO: JWT válido + autorização RBAC existente (fn_pncp_can_manage)
    //   (2) CRON:   segredo dedicado em header (nunca campo do corpo)
    // `body.source` deixa de ter qualquer efeito sobre autorização.
    let salvarTodas = false;
    let body: any = {};
    let bodyUserId: string | null = null;
    try {
      body = await req.clone().json();
      salvarTodas = body?.salvarTodas === true;
      bodyUserId = body?.user_id || null;
    } catch {}

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let isCronCall = false;
    let userId: string | null = null;

    // (2) CRON — segredo dedicado, comparação de tamanho constante
    const cronKey = req.headers.get("x-cron-key");
    const expectedCronKey = Deno.env.get("PNCP_SYNC_CRON_KEY");
    if (cronKey && expectedCronKey && timingSafeEqual(cronKey, expectedCronKey)) {
      isCronCall = true;
      userId = null; // execução de sistema: não se atribui a um usuário
    } else {
      // (1) HUMANO — JWT real, validado contra o Auth
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(
          JSON.stringify({ error: "Não autorizado" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: userData, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userData?.user) {
        return new Response(
          JSON.stringify({ error: "Token inválido" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // Identidade vem do JWT, NUNCA do corpo da requisição
      userId = userData.user.id;

      // Autorização com o RBAC já existente — nenhuma permission key nova
      const { data: podeGerenciar } = await admin.rpc("fn_pncp_can_manage", { p_user_id: userId });
      if (podeGerenciar !== true) {
        return new Response(
          JSON.stringify({ error: "Sem permissão para sincronizar PNCP" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (bodyUserId && bodyUserId !== userId) {
        return new Response(
          JSON.stringify({ error: "user_id divergente do token" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    // ---- fim HOTFIX-02 --------------------------------------------------

    console.log(`🚀 Iniciando sincronização PNCP... (fonte: ${isCronCall ? 'cron' : 'manual'})`);
```

Helper a adicionar no topo do arquivo:

```ts
function timingSafeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i];
  return diff === 0;
}
```

E a linha existente mais abaixo passa a usar o client já criado:

```ts
-    const supabase = createClient(
-      Deno.env.get("SUPABASE_URL") ?? "",
-      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
-    );
+    const supabase = admin;
```

### 3.3 O que este patch NÃO altera
- Lógica de matching, dicionário de sinônimos, pesos, exclusões, score.
- Paginação, chamadas ao PNCP, upserts, `bd_pncp_sync_log`, órgãos pendentes.
- Assinatura da função, formato de resposta, códigos de sucesso.
- `verify_jwt` em `config.toml` — **permanece `false`** de propósito, pois a função precisa aceitar o caminho cron por header próprio e tratar o preflight CORS. A autenticação passa a ser inteiramente interna e verificável.

---

## 4. Alternativa mínima (se a decisão for não agendar)

Se não houver intenção de agendar a sincronização, remove-se o caminho cron por completo — patch ainda menor, sem secret novo:

```ts
    // Apenas caminho humano: JWT válido + fn_pncp_can_manage.
    // `body.source` ignorado.
```

**Recomendação:** esta alternativa, porque hoje **não existe cron algum** chamando `pncp-sync`. O caminho cron pode ser adicionado no futuro, junto com o job, em mudança própria.

---

## 5. Rollback

**Verificado:** o arquivo local `supabase/functions/pncp-sync/index.ts` (915 linhas) é **idêntico ao deploy vivo v152** e está limpo no commit `697c9656`. Portanto o código de rollback já está versionado — não é necessário arquivo de backup separado.

Rollback = redeploy a partir do commit anterior ao hotfix:

```bash
git checkout 697c9656 -- supabase/functions/pncp-sync/index.ts
```
```bash
supabase functions deploy pncp-sync --project-ref eexzgpmrousuxlkvqwkm
```

**Rollback de configuração:** nenhum. O secret `PNCP_SYNC_CRON_KEY` pode ser removido sem efeito colateral se a alternativa da §4 for escolhida.

---

## 6. Testes (apenas scripts — NÃO executar contra produção sem aprovação)

| # | Teste | Comando | Resultado esperado |
|---|---|---|---|
| T1 | **NEGATIVO — anônimo com `source=cron`** | `curl -i -X POST "$URL/functions/v1/pncp-sync" -H "content-type: application/json" -d '{"source":"cron"}'` | **401** `{"error":"Não autorizado"}` — hoje retorna 200 |
| T2 | **NEGATIVO — Bearer inválido** | `curl -i -X POST "$URL/functions/v1/pncp-sync" -H "authorization: Bearer xxx" -H "content-type: application/json" -d '{}'` | **401** `{"error":"Token inválido"}` — hoje retorna 200 |
| T3 | **NEGATIVO — autenticado sem permissão** | invocar de uma conta sem `fn_pncp_can_manage` | **403** `{"error":"Sem permissão para sincronizar PNCP"}` |
| T4 | **NEGATIVO — user_id forjado** | autenticado como A enviando `{"user_id":"<id de B>"}` | **403** `{"error":"user_id divergente do token"}` |
| T5 | **POSITIVO — humano autorizado** | botão "Sincronizar" em `/licitacoes/monitoramento-pncp` com usuário que hoje já usa a tela | **200**, `bd_pncp_sync_log` recebe linha com `user_id` = id real do usuário |
| T6 | **POSITIVO — cron** (só se §3 for adotada) | `curl -i -X POST "$URL/functions/v1/pncp-sync" -H "x-cron-key: $PNCP_SYNC_CRON_KEY" -H "content-type: application/json" -d '{}'` | **200**, log com `user_id` NULL |

Consulta de conferência (read-only):
```sql
select id, status, user_id, created_at
from public.bd_pncp_sync_log
order by created_at desc limit 10;
```
Esperado após T5: linha nova com `user_id` preenchido, não NULL.
