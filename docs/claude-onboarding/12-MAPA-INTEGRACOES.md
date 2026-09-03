# 12 — MAPA DE INTEGRAÇÕES EXTERNAS

> Auditoria READ-ONLY. **Nenhum valor de secret é reproduzido — apenas nomes.**

---

## 1. Visão geral

| Integração | Direção | Camada | Secret | Consumidor |
|---|---|---|---|---|
| **Mapbox** | saída | Edge `geocode-proxy`, `get-mapbox-public-token` + SDK no browser | `MAPBOX_TOKEN` | Central do Transporte, Mapa Operacional, Relatório APS, endereços de RH/CC |
| **PNCP** (gov.br) | entrada | Edge `pncp-sync` | — (API pública) | Módulo Licitações |
| **Resend** | saída | Edge `atestado-submeter`, `atestado-notificar-reenvio` | `RESEND_API_KEY` | Atestados Médicos |
| **Guardian Web** | saída | Edge `guardian-web-proxy` | credenciais do usuário (login/senha) | Abastecimento |
| **Site institucional Lytorânea** | saída | Edge `onboard-fornecedor`, `sync-subcategorias-site` | `LYTOTEC_API_KEY` | Catálogo de ativos, cadastro de fornecedores |
| **WhatsApp (wa.me)** | saída | link no frontend | — | Contato/compartilhamento |
| **Lovable / GPT Engineer** | bidirecional | `<script src="cdn.gpteng.co/gptengineer.js">`, `lovable-tagger`, `previewAuthStorage` | — | Ambiente de desenvolvimento |
| **cdnjs (Cloudflare)** | saída | runtime do browser | — | PDF.js worker, fontes Roboto |
| **ui-avatars.com** | saída | runtime do browser | — | Avatares gerados |
| **esm.sh / deno.land** | build | Edge Functions (Deno) | — | Dependências |

**Não há webhooks de entrada** (nenhuma Edge Function expõe endpoint de callback de terceiro).

---

## 2. Mapbox

```
Browser (mapbox-gl ^3.22.0)
   └── get-mapbox-public-token  (verify_jwt = ON)  →  MAPBOX_TOKEN
Browser (autocomplete / geocoding)
   └── supabase.functions.invoke('geocode-proxy')   (3 chamadas em src/)
          └── 🔴 SEM AUTENTICAÇÃO
          ├── https://api.mapbox.com/geocoding/v5/mapbox.places/...
          ├── bd_cache_enderecos      (SELECT/INSERT/UPDATE via service_role)
          └── bd_geocoding_falhas     (INSERT)
```

**Consumidores no frontend:**
`src/components/shared/AddressAutocomplete.tsx`, `MapAdjustModal.tsx`, `src/hooks/useGeocoding.ts`, `src/lib/geocoding/`, `src/utils/geocoding/`, `src/components/mapa-operacional/{MapaOperacionalMap,MapaOperacionalPainelLateral,mapaOperacionalGeo}.tsx`, `src/components/central-transporte/{mov-direta/MovimentacoesMapa,puxada/PuxadasMapa}.tsx`, `src/components/relatorio-aps/RelatorioApsMapa.tsx`.

**Ações do `geocode-proxy`:** `autocomplete` (default), `reverse`, `geocode`.

**Dados geocodificados no banco:** `bd_funcionarios` e `bd_centros_custo` têm o mesmo bloco de colunas (`latitude`, `longitude`, `mapbox_place_name`, `geocoding_status`, `geocoding_source`, `geocoding_relevance`, `geocoding_updated_at`, `endereco_normalizado`). Protegidos pelos triggers `fn_proteger_geocoding_manual` e `fn_validar_geocoding_no_save`.

**Riscos:**
- 🔴 `geocode-proxy` sem autenticação ⇒ abuso de cota Mapbox e envenenamento de `bd_cache_enderecos` (ver `10-MAPA-EDGE-FUNCTIONS.md` §4.2).
- 🟡 `get-mapbox-public-token` devolve o `MAPBOX_TOKEN` ao browser. Se for um token **secreto** (`sk.`) em vez de público (`pk.`), é vazamento de credencial. **`[VERIFICAR]`** no Dashboard → Settings → Edge Functions → Secrets: o valor de `MAPBOX_TOKEN` começa com `pk.`? E o token tem *URL restrictions* configuradas no Mapbox?

---

## 3. PNCP — Portal Nacional de Contratações Públicas

```
Cron / UI  →  Edge pncp-sync (917 LOC, verify_jwt = false, service_role)
                 ├── https://pncp.gov.br/api/...
                 ├── bd_configuracoes_sistema (flag `modo_engenharia_licitacoes`)
                 ├── bd_pncp_perfis_busca      (filtro por user_id)
                 ├── bd_pncp_sync_log          (status, user_id)
                 ├── bd_pncp_contratacoes / bd_pncp_todas_licitacoes
                 └── bd_orgaos_publicos / bd_orgaos_alias / bd_licitacoes_orgaos_pendentes
```

Matching e classificação: `bd_matching_config`, `bd_matching_exclusoes`, RPC `classificar_orgao_pendente`, `fn_ultima_classificacao_data`. UI em `/licitacoes/configuracoes-matching` e `/licitacoes/orgaos-pendentes`.

**Risco:** 🔴 bypass de autenticação via `{"source":"cron"}` — ver `10-MAPA-EDGE-FUNCTIONS.md` §4.1.

---

## 4. Resend (e-mail transacional)

Usado apenas no fluxo de Atestados Médicos:
- `atestado-submeter` → notifica o destino conforme o tipo de documento
- `atestado-notificar-reenvio` → solicita reenvio

**Destinatário hardcoded** (`supabase/functions/atestado-submeter/index.ts:37`):
```ts
const EMAIL_DP = "ronald.ventura@lytoranea.com.br";
```
Comentário no arquivo: *"demais tipos => ronald.ventura@lytoranea.com.br, sem sistema afetado"*.

Também aparece no código `saude@lytoranea.com.br` (3 ocorrências) e `lytoranea@lytoranea.com.br`.

**Risco:** 🟡 roteamento de e-mail corporativo hardcoded no código-fonte. A saída de um colaborador quebra o fluxo silenciosamente. Deveria estar em `bd_configuracoes_sistema` (tabela que já existe para isso).

Tabelas de rastreio: `bd_envios`, `bd_log_comunicacao`.

**`[VERIFICAR]`** — domínio verificado no Resend e SPF/DKIM configurados para `lytoranea.com.br`.

---

## 5. Guardian Web (sistema de abastecimento)

```
Frontend  →  supabase.functions.invoke('guardian-web-proxy')   (verify_jwt = ON)
                ├── getUser() próprio
                ├── fn_backend_can_invoke  (recurso: 'guardian-web-proxy')
                └── https://www.guardianweb.online/webservicev1gw
                       ├── /v1/autenticar
                       └── /v2/listar/abastecimentos
```

Hooks: `src/hooks/abastecimento/useGuardianWebAuth.ts`, `useAbastecimentos.ts`.
Tabelas: `bd_abastecimentos`, `bd_abast_sync_log`.

**É a integração mais bem protegida do projeto**: `verify_jwt = on` + `getUser()` + autorização via `fn_backend_can_invoke` + auditoria em `bd_backend_exec_auditoria`.

### 🟡 Legado Python duplicado
Existem **dois arquivos idênticos** implementando o proxy antigo em Flask:
- `api/proxy_server.py`
- `src/components/reabastecimento/proxy_server.py`

Ambos contêm:
```python
GUARDIAN_BASE_URL = "https://www.guardianweb.online/webservicev1gw"
CACHE_FILE = "cache_abastecimentos.json"
CORS(app)                    # CORS totalmente aberto
```
Recebem `login` e `senha` em POST e repassam ao Guardian, com cache em arquivo local.

**Não são executados pelo Vite** (não são `.ts`/`.tsx`), mas:
- estão versionados no Git;
- o de `src/` está dentro da árvore de fontes;
- existe `api/__pycache__/guardian_api.cpython-313.pyc` — indica que **já foi executado**, e o `.pyc` referencia um arquivo `guardian_api.py` que **não está mais no repositório**.

**Risco:** 🟡 código morto que manipula credenciais. Se esse servidor for iniciado em qualquer máquina, expõe um proxy de autenticação com CORS aberto e cache de credenciais em disco.

**Ação recomendada (NÃO aplicada):** confirmar que o proxy Flask está desativado em todos os ambientes; então propor remoção.

---

## 6. Site institucional Lytorânea

Duas Edge Functions integram o ERP com outro sistema, autenticadas por `LYTOTEC_API_KEY`:

| Função | Direção | Destino |
|---|---|---|
| `onboard-fornecedor` | entrada (site → ERP) | Cria empresa; grava em `bd_integracao_fornecedores_log` (`empresa_id_gerada`) |
| `sync-subcategorias-site` | saída (ERP → site) | `POST https://vitxtbotmtxfytusptbf.supabase.co/functions/v1/subcategorias-sync` com header `x-api-key` |

### ⚠️ Segundo projeto Supabase
`sync-subcategorias-site/index.ts:81` referencia **`vitxtbotmtxfytusptbf.supabase.co`** — um projeto Supabase **distinto** do ERP (`eexzgpmrousuxlkvqwkm`). É o backend do site institucional.

**`LYTOTEC_API_KEY` é uma chave compartilhada** usada por 5 funções com propósitos muito diferentes:
`heartbeat-dispositivo`, `registrar-ponto-totem`, `onboard-fornecedor`, `sync-subcategorias-site`, `auto-finalizar-diarias`/`process-desligamentos`/`ponto-diaria-shadow` (via `allowApiKey`).

**Risco:** 🟠 uma única chave dá acesso a: registro de ponto, cadastro de fornecedores, finalização de diárias, processamento de desligamentos e sincronização de catálogo. **Não há segregação de escopo por chave.** O vazamento de `LYTOTEC_API_KEY` em qualquer um dos consumidores (totens em campo, site institucional, cron externo) compromete todos os outros.

---

## 7. Integrações no runtime do browser (CDNs externas)

| Recurso | Origem | Onde |
|---|---|---|
| `gptengineer.js` | `https://cdn.gpteng.co` | `index.html` (obrigatório pelo Lovable) |
| `pdf.worker.min.js` (PDF.js 3.11.174) | `https://cdnjs.cloudflare.com` | `src/components/pops/PopPdfViewer.tsx:11`, `src/components/ssoAgendamentoExames/dialog/PdfViewer.tsx:7` |
| Fontes Roboto (`.ttf`) | `https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/...` | `src/lib/pdfFonts.ts` (**órfão**), `src/services/valeTransporte/pdfGenerator.ts:6-7` |
| Avatares | `https://ui-avatars.com` | 7 ocorrências |
| Google Fonts | `fonts.googleapis.com` / `fonts.gstatic.com` | `<link rel="preconnect">` em `index.html` |

**Risco:** 🟡 **cadeia de suprimentos**. Um comprometimento de `cdn.gpteng.co` ou `cdnjs.cloudflare.com` executa código arbitrário no ERP com a sessão do usuário. **Não há Content-Security-Policy nem Subresource Integrity (`integrity=`) em nenhum desses recursos.** `netlify.toml` não define header de CSP.

O worker do PDF.js é especialmente relevante: a versão do CDN (`3.11.174`) deve casar exatamente com `pdfjs-dist@3.11.174` do `package.json` — casa hoje, mas é um acoplamento frágil a um recurso externo.

---

## 8. WhatsApp

3 ocorrências de `https://wa.me` no frontend — links de contato/compartilhamento. **Não há integração de API (Business/Cloud API), webhook ou envio automatizado.** A menção a "WhatsApp" no escopo da auditoria não corresponde a uma integração real neste código.

---

## 9. Lovable / GPT Engineer

| Artefato | Papel |
|---|---|
| `index.html` → `<script src="https://cdn.gpteng.co/gptengineer.js">` | Editor visual — comentário no arquivo proíbe remoção |
| `lovable-tagger` (devDependency) | Tagging de componentes no build |
| `src/integrations/supabase/previewAuthStorage.ts` | Brokering de sessão para o editor via `postMessage` |
| `.lovable/plan-*.md` (6 arquivos, jul/2026) | Planos de execução |
| `og:url` = `https://lytotec.lovable.app` | Metadados sociais ainda apontando para o domínio Lovable |
| Origens em `_shared/pops-cors.ts` | 2 hosts de preview Lovable na allowlist de CORS |
| 11.362 de 11.369 commits | Autoria `gpt-engineer-app[bot]` |

**Relevante para a transição Lovable → Claude Code**: enquanto esses artefatos existirem, o projeto continua acoplado ao ambiente Lovable. Ver `18-REGRAS-PARA-DESENVOLVIMENTO-FUTURO.md`.

---

## 10. Mapa origem → destino consolidado

```
FRONTEND (browser)
 ├─ mapbox-gl ─────────────────────────► api.mapbox.com          [token via get-mapbox-public-token]
 ├─ AddressAutocomplete ──► geocode-proxy ──► api.mapbox.com     [🔴 sem auth]
 ├─ useAbastecimentos ────► guardian-web-proxy ──► guardianweb.online  [🟢 auth completa]
 ├─ MonitoramentoPNCP ────► pncp-sync ──► pncp.gov.br            [🔴 bypass por body]
 ├─ PopPdfViewer / PdfViewer ─────────► cdnjs.cloudflare.com     [🟡 sem SRI]
 ├─ pdfGenerator ─────────────────────► cdnjs.cloudflare.com     [🟡 sem SRI]
 ├─ avatares ─────────────────────────► ui-avatars.com
 └─ index.html ───────────────────────► cdn.gpteng.co            [🟡 sem SRI]

EXTERNO → ERP
 ├─ Site institucional ──[x-api-key]──► onboard-fornecedor
 ├─ Totens em campo ─[x-device-secret]► registrar-ponto-totem, identificar-funcionario-por-face
 ├─ Dispositivos ────[x-api-key]──────► heartbeat-dispositivo
 ├─ Cron externo ────[x-api-key]──────► auto-finalizar-diarias, process-desligamentos, ponto-diaria-shadow
 └─ Público (atestados) ─[HMAC+nonce]─► atestado-*

ERP → EXTERNO
 ├─ sync-subcategorias-site ──[x-api-key]──► vitxtbotmtxfytusptbf.supabase.co  [2º projeto Supabase]
 └─ atestado-submeter / -notificar-reenvio ──► api.resend.com
```

---

## 11. Secrets — inventário por nome (valores NÃO reproduzidos)

| Secret | Funções que consomem | Sensibilidade |
|---|---:|---|
| `SUPABASE_SERVICE_ROLE_KEY` | 29 | 🔴 máxima — bypass total de RLS |
| `SUPABASE_JWT_SECRET` / `JWT_SECRET` | 1 (`fix-empty-rbac-roles`) | 🔴 máxima — permite forjar sessões |
| `LYTOTEC_API_KEY` | 5+ | 🟠 chave compartilhada multi-propósito |
| `ATESTADO_HMAC_SECRET` | 3 | 🟠 |
| `RESEND_API_KEY` | 2 | 🟠 |
| `MAPBOX_TOKEN` | 2 | 🟡 (custo) |
| `SUPABASE_ANON_KEY` | 10 | ⚪ pública por design |
| `SUPABASE_URL` | 29 | ⚪ pública |
| `RBAC_DUAL_WRITE_ENABLED` | 1 | ⚪ flag |
| `FIX_EMPTY_RBAC_ROLES_API_KEY` | 1 | 🔴 (gate da função de forja de JWT) |

**Nenhum secret foi encontrado hardcoded em Edge Functions** — todos vêm de `Deno.env.get()`. ✔

**No frontend**, as únicas credenciais no código são as `anon key` (públicas por design), em `src/integrations/supabase/client.ts:7` e `src/pages/dev/TestePonto.tsx:9`.
