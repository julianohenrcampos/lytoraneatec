# HOTFIX-03 — `geocode-proxy` (SEC-03)

> **STATUS: PROPOSTA. NÃO APLICADA. NÃO DEPLOYADA.**
> Alvo: `supabase/functions/geocode-proxy/index.ts` (deploy vivo: v102, `ACTIVE`, `verify_jwt = false`).

---

## 1. Mapa de callers (Passo 11 — concluído)

| Origem | Existe? | Evidência |
|---|---|---|
| **Frontend autenticado** | **SIM — único caller** | `src/hooks/useGeocoding.ts` linhas 66, 92, 126 → `supabase.functions.invoke("geocode-proxy", { body })` |
| **Frontend público** | **NÃO** | Verificado em `/atestados-medicos`, `/ponto-totem`, `/ponto-totem-login`, `/register`, `/login`: nenhuma referência a geocoding |
| **Edge Function** | NÃO | nenhuma referência em `supabase/functions/**` |
| **pg_cron / banco** | NÃO | nenhuma referência |

### Telas consumidoras (todas atrás de `SimpleAuthGuard` + `SecureRouteGuard`)
`central-transporte/mov-direta/builder/AjustarPontoDialog` · `MovimentacoesMapa` · `puxada/builder/PuxTrajetoInline` · `PuxadasMapa` · `shared/PontoOperacionalBloco` · `solicitacao/builder/EntregaDialog` · `solicitacao/ViagemEnderecosEditor` · `centrosCusto/AddressAutocomplete` · `centrosCusto/CentroCustoFormModal` · `empresas/EmpresaFormModal` · `mapa-operacional/MapaOperacionalMap` · `shared/MapAdjustModal` · `funcionarios` (endereço).

### Conclusão determinante
**Nenhum fluxo público precisa do `geocode-proxy`.** Exigir JWT válido é seguro e não quebra nada mapeado.

---

## 2. Patch proposto

Alteração **exclusivamente** no início do handler + CORS. Nenhuma linha da lógica de normalização, classificação, cache, fallback progressivo ou chamadas ao Mapbox é tocada.

### 2.1 CORS restritivo (reutiliza a allowlist já existente no projeto)

O projeto já tem `_shared/pops-cors.ts` com a lista de origens confiáveis. Reutilizar a mesma lista, sem inventar nada:

```ts
// substitui o objeto corsHeaders fixo com "*"
const ALLOWED_ORIGINS = new Set<string>([
  "https://app.lytoranea.com.br",
  "https://staging.lytoranea.com.br",
  "https://lytotec.com.br",
  "https://www.lytotec.com.br",
  "https://radiant-company-core.lovable.app",
  "https://id-preview--1adc7942-e288-48d3-a624-545b9db75a12.lovable.app",
  "https://1adc7942-e288-48d3-a624-545b9db75a12.lovableproject.com",
  "http://localhost:8080",
  "http://localhost:5173",
]);

function corsFor(req: Request) {
  const origin = req.headers.get("Origin");
  const headers: Record<string, string> = {
    "Vary": "Origin",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (!origin) return { headers, blocked: false };            // server-to-server
  if (ALLOWED_ORIGINS.has(origin)) {
    return { headers: { ...headers, "Access-Control-Allow-Origin": origin }, blocked: false };
  }
  return { headers, blocked: true };
}
```

### 2.2 Autenticação + autorização + validação + rate limit

Trecho atual (v102, linhas ~151-160):
```ts
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action: string = body.action || "autocomplete";
```

Trecho proposto:
```ts
Deno.serve(async (req) => {
  const cors = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors.headers });
  if (cors.blocked)  return new Response("forbidden", { status: 403, headers: cors.headers });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }),
      { status: 405, headers: { ...cors.headers, "Content-Type": "application/json" } });
  }

  // ---- HOTFIX-03 (SEC-03): exigir JWT válido -------------------------------
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Não autorizado" }),
      { status: 401, headers: { ...cors.headers, "Content-Type": "application/json" } });
  }
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "Token inválido" }),
      { status: 401, headers: { ...cors.headers, "Content-Type": "application/json" } });
  }
  const callerId = userData.user.id;
  // ---- fim do gate de autenticação ----------------------------------------

  try {
    // Limite de tamanho do payload (defesa contra abuso)
    const rawBody = await req.text();
    if (rawBody.length > 4096) {
      return new Response(JSON.stringify({ error: "payload_muito_grande" }),
        { status: 413, headers: { ...cors.headers, "Content-Type": "application/json" } });
    }
    const body = JSON.parse(rawBody);
    const action: string = body.action || "autocomplete";
    if (!["autocomplete", "geocode", "reverse"].includes(action)) {
      return new Response(JSON.stringify({ error: "action_invalida" }),
        { status: 400, headers: { ...cors.headers, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Rate limit por usuário, reutilizando o mecanismo já existente no projeto
    const { data: rl } = await supabase.rpc("fn_rate_limit_check", {
      p_escopo: "geocode_proxy",
      p_chave_tipo: "user_id",
      p_chave_valor: callerId,
      p_max_tentativas: 120,
      p_janela_segundos: 60,
      p_bloqueio_segundos: 300,
    });
    if (rl && (rl as any).bloqueado === true) {
      return new Response(JSON.stringify({ error: "rate_limited" }),
        { status: 429, headers: { ...cors.headers, "Content-Type": "application/json" } });
    }
    // ... resto do corpo INALTERADO, trocando `corsHeaders` por `cors.headers`
```

> ⚠️ O nome/retorno exato dos campos de `fn_rate_limit_check` (retorno `record`) precisa ser lido antes de codificar — ver "Pendência" na §5. O padrão de uso está em `supabase/functions/atestado-validar-matricula/index.ts:79`.

### 2.3 Sobre autorização por permissão
**Não é proposta permission key.** Geocodificação é utilitária e usada por 6 módulos distintos (CT, Centros de Custo, Empresas, Mapa Operacional, RH, Relatório APS). Exigir uma permissão específica quebraria telas legítimas. **JWT válido + rate limit por usuário é o gate proporcional.**

### 2.4 O que este patch NÃO altera
- Mapbox continua sendo o provedor. Nenhuma URL, parâmetro ou modelo de chamada muda.
- `bd_cache_enderecos` e `bd_geocoding_falhas`: nenhuma alteração de schema, de chave de conflito (`onConflict: "endereco"`) ou de política de escrita.
- Normalização (`normalizeAddress`), classificação (`classify`), `parseContext`, fallback progressivo, `proximity`/`bbox`/`types`: intactos.
- Formato de resposta: idêntico.

---

## 3. Impacto sobre o frontend

`supabase.functions.invoke()` **já envia automaticamente** o `Authorization: Bearer <jwt>` da sessão ativa. Como todos os callers estão atrás de `SimpleAuthGuard`, **nenhuma alteração no frontend é necessária**.

⚠️ **Verificar antes de aplicar:** se alguma tela chamar geocoding **antes** da sessão hidratar (ex.: `useGeocoding` montado durante `isLoading` do `useAuth`), a chamada receberá 401. Mitigação sugerida: `enabled: !!userId` nos hooks consumidores. **Ainda não implementado — a verificar em homologação.**

---

## 4. Rollback

**Verificado:** o arquivo local `supabase/functions/geocode-proxy/index.ts` (463 linhas) é **idêntico ao deploy vivo v102** e está limpo no commit `697c9656`. O código de rollback já está versionado — não é necessário arquivo de backup separado.

```bash
git checkout 697c9656 -- supabase/functions/geocode-proxy/index.ts
```
```bash
supabase functions deploy geocode-proxy --project-ref eexzgpmrousuxlkvqwkm
```

Nenhum objeto de banco é alterado ⇒ **não há rollback de banco**.

---

## 5. Pendência antes de codificar

| # | Pendência | Como resolver |
|---|---|---|
| 1 | Assinatura de retorno de `fn_rate_limit_check` (retorno `record`) | `select pg_get_functiondef(oid) from pg_proc where proname='fn_rate_limit_check';` e espelhar o uso de `atestado-validar-matricula` |
| 2 | `fn_rate_limit_check` estará restrita a `service_role` pelo HOTFIX-01 | ✔ compatível: `geocode-proxy` a chama com client `service_role` |
| 3 | Origens reais em produção | Confirmar se `app.lytoranea.com.br` / `staging.lytoranea.com.br` estão em uso; a allowlist deve cobrir o domínio real (`lytotec.com.br`) |
| 4 | Hidratação de sessão nos hooks | Testar `AddressAutocomplete` em cold start |

---

## 6. Testes (apenas scripts — NÃO executar contra produção sem aprovação)

| # | Teste | Comando | Resultado esperado |
|---|---|---|---|
| T1 | **NEGATIVO — anônimo** | `curl -i -X POST "$URL/functions/v1/geocode-proxy" -H "content-type: application/json" -d '{"action":"reverse","latitude":-23.55,"longitude":-46.63}'` | **401** `{"error":"Não autorizado"}` — hoje retorna **200 com resultado** |
| T2 | **NEGATIVO — Bearer inválido** | idem + `-H "authorization: Bearer xxx"` | **401** `{"error":"Token inválido"}` |
| T3 | **NEGATIVO — origem não permitida** | idem + `-H "Origin: https://evil.example"` | **403** `forbidden` |
| T4 | **NEGATIVO — action inválida** | autenticado, `{"action":"drop"}` | **400** `{"error":"action_invalida"}` |
| T5 | **NEGATIVO — payload grande** | autenticado, body > 4096 bytes | **413** `{"error":"payload_muito_grande"}` |
| T6 | **NEGATIVO — rate limit** | autenticado, 130 chamadas em 60 s | **429** a partir da 121ª |
| T7 | **POSITIVO — autocomplete** | tela `Centros de Custo → endereço`, digitar um logradouro | sugestões aparecem normalmente |
| T8 | **POSITIVO — reverse** | `MapAdjustModal`, arrastar o pino | endereço preenchido normalmente |
| T9 | **POSITIVO — cache** | repetir T7 com o mesmo termo | resposta com `source: "cache"` |
| T10 | **POSITIVO — CT** | `Central do Transporte → nova movimentação → definir origem/destino` | trajeto e mapa renderizam |

Conferência de que o cache não regrediu (read-only):
```sql
select count(*) as cache_total,
       max(updated_at) as ultimo_registro
from public.bd_cache_enderecos;
```
Esperado: contagem continua crescendo após T7/T8 (hoje: 1.675 registros).
