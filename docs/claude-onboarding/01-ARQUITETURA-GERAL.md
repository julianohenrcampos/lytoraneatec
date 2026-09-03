# 01 — ARQUITETURA GERAL — ERP LYTOTEC

> Documento produzido por auditoria **READ-ONLY** em 2026-08-31.
> Nenhuma alteração foi feita na aplicação, no banco, em migrations ou em deploy.
> Todo conteúdo abaixo está fundamentado em arquivos reais do repositório.

---

## 1. Identificação

| Item | Valor |
|---|---|
| Nome do produto | LYTOTEC ERP — Lytorânea Construtora |
| Repositório | `https://github.com/julianohenrcampos/lytoranea.git` (remote `origin`) |
| Branch atual | `main` (única branch local), working tree limpo |
| Commits | 11.369 (11.362 por `gpt-engineer-app[bot]` = Lovable; 7 por `Juliano Campos`) |
| Origem | Desenvolvido predominantemente via **Lovable** (`.lovable/`, `lovable-tagger`, `cdn.gpteng.co/gptengineer.js` em `index.html`) |
| Domínio público | `http://lytotec.com.br` (`VITE_APP_PUBLIC_URL`) |
| Hospedagem | Netlify (`netlify.toml`, `publish = dist`, build via `bun install && bun run build`) |

---

## 2. Stack real (verificada em `package.json`)

### Runtime / build
- **React** `^18.3.1` + **React DOM** `^18.3.1`
- **TypeScript** `^5.5.3`
- **Vite** `^5.4.1` com `@vitejs/plugin-react-swc` `^3.5.0`
- **Node** `22.18.0` (`.nvmrc`) — atenção: `netlify.toml` fixa `NODE_VERSION = "18"` (**divergência**)
- **Gerenciador de pacotes**: ambíguo — existem `bun.lock`, `bun.lockb` **e** `package-lock.json`. O build do Netlify usa **bun** (`BUN_VERSION = 1.1.20`).

### UI
- **Tailwind CSS** `^3.4.11` + `tailwindcss-animate` + `@tailwindcss/typography`
- **shadcn/ui** (`components.json`, style `default`, baseColor `slate`, cssVariables `true`, alias `@/components/ui`)
- **Radix UI** (25 pacotes `@radix-ui/react-*`)
- `lucide-react`, `next-themes`, `sonner`, `cmdk`, `vaul`, `embla-carousel-react`

### Dados / estado
- **@supabase/supabase-js** `^2.52.0`
- **@tanstack/react-query** `^5.56.2` (`staleTime: 5min`, `retry: 1`)
- **@tanstack/react-table** `^8.21.2`
- `react-hook-form` `^7.53.0` + `@hookform/resolvers` + **zod** `^3.23.8`

### Domínio específico
- **Mapbox GL** `^3.22.0` (mapa operacional, Central do Transporte, relatório APS)
- **face-api.js** `^0.22.2` (biometria facial de ponto)
- PDF/planilhas: `jspdf`, `jspdf-autotable`, `pdf-lib`, `@react-pdf/renderer`, `pdfjs-dist@3.11.174`, `exceljs`, `xlsx`, `papaparse`, `pptxgenjs`, `jszip`, `file-saver`
- Gráficos: `recharts`, `apexcharts` + `react-apexcharts` (**dois motores de gráfico coexistindo**)
- `@dnd-kit/*` (drag & drop), `react-signature-canvas`, `react-dropzone`

### Qualidade
- **ESLint** `^9.9.0` (flat config `eslint.config.js`) + `typescript-eslint` `^8.0.1`
- **Vitest** `^4.1.6` + Testing Library + `jsdom` — `vitest.config.ts` presente, `setupFiles: ./src/test/setup.ts`

---

## 3. Configuração de TypeScript (permissiva — relevante para risco)

`tsconfig.json` / `tsconfig.app.json`:

```
"strict": false
"noImplicitAny": false
"strictNullChecks": false
"noUnusedLocals": false
"noUnusedParameters": false
"skipLibCheck": true
"allowJs": true
"paths": { "@/*": ["./src/*"] }
```

**Consequência:** o compilador não protege contra `null`/`undefined` nem contra `any` implícito. Grande parte das garantias de tipo do Supabase (`Database` gerado) é diluída em runtime.

---

## 4. Scripts disponíveis (`package.json`)

| Script | Comando | O que faz |
|---|---|---|
| `dev` | `vite` | Servidor de desenvolvimento (porta 8080, host `::`) |
| `build` | `vite build` | Build de produção para `dist/` |
| `build:dev` | `NODE_OPTIONS=--max-old-space-size=6144 vite build --mode development` | Build em modo development com heap ampliado (6 GB) — indício de projeto pesado |
| `lint` | `eslint .` | Lint do repositório inteiro |
| `preview` | `vite preview` | Serve o `dist/` |

**LACUNAS IDENTIFICADAS:**
- **Não existe script `test`** apesar de existirem **113 arquivos de teste** e `vitest.config.ts` configurado.
- **Não existe script `typecheck`** (`tsc --noEmit`).

---

## 5. Estrutura de diretórios (real)

```
/
├── .env                     ← RASTREADO NO GIT (ver 14-RISCOS-SEGURANCA.md)
├── .lovable/                ← 6 planos de execução do Lovable (jul/2026)
├── api/proxy_server.py      ← proxy Flask p/ Guardian Web (duplicado em src/)
├── codigos-para-estudos/
├── docs/                    ← 20 documentos legados + subpastas ct2, diarias,
│                              pendencias, planejamento-macro, qa, rls-structure
├── public/                  ← sw.js, manifest.webmanifest, icons/, models/ (face-api)
├── scripts/                 ← ct2/, pr31_gerar_artefatos.ts
├── src/                     ← 1.814 arquivos .ts/.tsx · ~358.400 LOC
├── supabase/
│   ├── config.toml          ← project_id + verify_jwt por função
│   ├── functions/           ← 36 Edge Functions + _shared/
│   ├── migrations/          ← 869 arquivos .sql · 6,8 MB
│   └── storage.sql
├── netlify.toml
├── vite.config.ts
└── vitest.config.ts
```

### Volume de código por área (`src/`)

| Diretório | Arquivos | LOC aprox. |
|---|---:|---:|
| `src/components/` | 873 | 174.161 |
| `src/services/` | 287 | 53.173 |
| `src/hooks/` | 257 | 35.723 |
| `src/pages/` | 111 | 31.669 |
| `src/integrations/` | 3 | 27.245 (976 KB só em `supabase/types.ts`) |
| `src/lib/` | 102 | 14.752 |
| `src/utils/` | 105 | 12.711 |
| `src/types/` | 56 | 6.126 |
| `src/constants/` | 12 | 2.050 |
| `src/validations/` | 4 | 185 |
| `src/config/` | 4 | 110 |
| `src/contexts/` | 2 | 91 |
| **TOTAL** | **1.814** | **~358.389** |

---

## 6. Arquitetura lógica (encontrada)

```
Navegador (SPA React + PWA)
   │
   ├── BrowserRouter (react-router-dom v6) — 95 rotas em src/App.tsx
   │      └── Guards: SimpleAuthGuard → SimplePermissionGuard → SecureRouteGuard
   │
   ├── Hooks de domínio (src/hooks/**) — React Query
   │      └── Services (src/services/**)
   │             └── supabase-js client (src/integrations/supabase/client.ts)
   │
   ├── Supabase PostgREST → 194 tabelas · 70 views · 452 RPCs expostas
   │      └── RLS (618 policies vivas) + funções SECURITY DEFINER
   │
   ├── Supabase Edge Functions (36) → Deno, service_role, integrações externas
   │
   └── Supabase Storage (23 buckets identificados)
```

### Pontos arquiteturais notáveis

1. **Lógica de negócio majoritariamente no banco.** 452 funções expostas como RPC e 228 triggers. O frontend chama mais RPC (`.rpc(` = 217 ocorrências) do que tabela direta (`supabase.from(` = 180 ocorrências). Isso é uma decisão arquitetural forte e deve ser preservada.

2. **Autorização em três camadas concorrentes**: RLS no Postgres, funções helper `SECURITY DEFINER`, e guards no React. As três **não são equivalentes** — ver `06-MAPA-RBAC.md`.

3. **Code splitting agressivo.** Apenas 6 imports síncronos em `App.tsx`; todo o resto é `React.lazy`. `vite.config.ts` define 10 `manualChunks`.

4. **Console silenciado em produção.** `vite.config.ts` aplica `pure: ['console.log','console.info','console.debug','console.warn']` apenas em `mode === 'production'` (preserva `console.error`).

5. **PWA manual e defensiva.** `public/sw.js` (109 linhas) faz *network-first* para HTML, *cache-first* para `/assets/`, e **bypass explícito** de `*.supabase.co`, `/functions/v1/`, `/auth/` e `/version.json`.

---

## 7. Variáveis de ambiente utilizadas

**Frontend (`.env`, prefixo `VITE_`)** — apenas NOMES, valores não reproduzidos:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_APP_PUBLIC_URL`
- `VITE_CT3B_SOLICITACAO_PAGE_ENABLED`

**Referenciadas em código mas ausentes do `.env`:**
- `VITE_RBAC_LEGACY_FALLBACK_ENABLED` (lida em `src/config/rbacFlags.ts`, default `true`)
- `VITE_DIARIAS_LOTES_UI_PREVIEW` (lida em `src/config/diariasFlags.ts`, default `false`)

**Não-VITE presentes no `.env`** (nunca chegam ao bundle — provavelmente resíduo):
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`

**Edge Functions (secrets do Supabase)** — apenas NOMES:
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `JWT_SECRET`, `MAPBOX_TOKEN`, `RESEND_API_KEY`, `LYTOTEC_API_KEY`, `ATESTADO_HMAC_SECRET`, `RBAC_DUAL_WRITE_ENABLED`, `FIX_EMPTY_RBAC_ROLES_API_KEY`

---

## 8. CI/CD e deploy

- **Não há workflows de CI** (`.github/` ausente do repositório).
- Deploy: Netlify a partir de `main` (`netlify.toml`).
- SPA redirect `/* → /index.html` (status 200).
- Headers de cache: `/sw.js` `max-age=0, must-revalidate`; `/manifest.json` `max-age=86400` — **atenção**: o arquivo real é `manifest.webmanifest`, não `manifest.json`; a regra de header não se aplica ao arquivo existente.
- `vite.config.ts` gera `dist/version.json` com `BUILD_ID` (usado por `useAppVersionCheck`).

---

## 9. Observação crítica sobre acesso ao banco nesta auditoria

O MCP Supabase disponível nesta sessão está conectado ao projeto **`zoruxlcqkagcqrmevmrk`**, que **NÃO é o ERP LYTOTEC**. Trata-se de um SaaS distinto de licitações/PNCP (tabelas `organizations`, `plans`, `subscriptions`, `pncp_opportunities`, `edital_analyses`…), com apenas 39 tabelas.

O ERP LYTOTEC é o projeto **`eexzgpmrousuxlkvqwkm`** (`.env`, `supabase/config.toml`, `src/integrations/supabase/client.ts`).

**Consequência:** toda a auditoria de banco deste conjunto de documentos foi feita **estaticamente**, a partir de:
1. `supabase/migrations/*.sql` (869 arquivos, ordenados cronologicamente pelo nome, com reconstrução do estado final via replay de `CREATE`/`DROP`);
2. `src/integrations/supabase/types.ts` (schema gerado pelo Supabase CLI — reflete o estado real do banco no momento da geração).

Itens que **exigem confirmação no banco real** estão marcados com **`[VERIFICAR NO BANCO]`** ao longo dos documentos, sempre acompanhados da consulta SQL read-only correspondente.
