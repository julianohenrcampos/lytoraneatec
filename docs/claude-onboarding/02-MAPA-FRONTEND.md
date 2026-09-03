# 02 — MAPA DO FRONTEND

> Auditoria READ-ONLY. Fonte: `src/**`. Nenhuma alteração realizada.

---

## 1. Entry point e composição raiz

**`src/main.tsx`** (10 linhas)
```
createRoot(#root).render(<App />)
registerServiceWorker()          // @/lib/pwa/registerSW — no-op em iframe/preview/localhost
```

**`index.html`** — splash screen inline (`#initial-splash`), meta PWA iOS/Android, `<meta name="robots" content="noindex, nofollow">`, e o script obrigatório do Lovable:
```html
<!-- IMPORTANT: DO NOT REMOVE THIS SCRIPT TAG OR THIS VERY COMMENT! -->
<script src="https://cdn.gpteng.co/gptengineer.js" type="module"></script>
```

**`src/App.tsx`** (365 linhas) — árvore de providers:
```
GlobalErrorBoundary
└── QueryClientProvider (staleTime 5min, retry 1)
    └── ThemeProvider (next-themes, attribute="class", defaultTheme="light", enableSystem)
        └── TooltipProvider
            ├── <Sonner />                      (toasts)
            └── PageTitleProvider
                └── BrowserRouter
                    └── Suspense(RouteFallback)
                        └── Routes  (95 <Route>)
```
Hook global: `useBodyPointerEvents()` (workaround de `pointer-events` em modais Radix).

---

## 2. Guards de rota (`src/components/routing/`)

| Arquivo | LOC | Importadores | Situação |
|---|---:|---:|---|
| `SimpleAuthGuard.tsx` | 34 | 1 (`App.tsx`) | **ATIVO** — só verifica sessão (`useAuth`) |
| `SimplePermissionGuard.tsx` | 74 | 1 (`App.tsx`) | **ATIVO** — só verifica `canAccessDashboard` |
| `SecureRouteGuard.tsx` | 196 | 1 (`App.tsx`) | **ATIVO** — verifica permissão e action granular |
| `OrdemDiariaCampoGuard.tsx` | 66 | 1 (`App.tsx`) | **ATIVO** — guard específico da Ordem do Dia |
| `AuthGuard.tsx` | 34 | **0** | **LEGADO SEM USO** |
| `RouteProtection.tsx` | 40 | **0** | **LEGADO SEM USO** |

### Composição usada em `App.tsx`

```tsx
<Auth>    = SimpleAuthGuard
<Perm>    = SimpleAuthGuard + SimplePermissionGuard
<Secure permission="x">          = SimpleAuthGuard + SimplePermissionGuard + SecureRouteGuard
<Secure permission="x" action="y"> = SimpleAuthGuard + SecureRouteGuard   // SimplePermissionGuard É PULADO
```
O comentário no próprio código explica: *"Rotas com action granular usam apenas o SecureRouteGuard, que conhece o contrato de capabilities; o SimplePermissionGuard não avalia actions."*

---

## 3. Rotas (95 declaradas em `src/App.tsx`)

### 3.1 Públicas (sem guard)
| Rota | Página |
|---|---|
| `/login` | `SimpleLogin` (síncrono) |
| `/register` | `Register` |
| `/forgot-password` | `ForgotPassword` |
| `/reset-password` | `ResetPassword` |
| `/waiting-approval` | `WaitingApproval` |
| `/atestados-medicos` | `AtestadosMedicos` — **envio público de atestado, sem guards por design** |
| `/ponto-totem-login` | `PontoTotemLogin` — autenticação por código+senha de dispositivo |
| `/ponto-totem` | `PontoTotem` |
| `*` | `NotFound` |

### 3.2 Somente autenticação (`<Auth>`)
`/` (Portal), `/engenharia/ordem-do-dia` (+ `:ordemId/item/:itemId`, com `OrdemDiariaCampoGuard`), `/dev/teste-ponto`, `/dev/pwa-status`, `/dev/escopo-debug` (apenas `import.meta.env.DEV`).

### 3.3 Protegidas por permissão (`<Secure>`) — agrupadas

**Dashboards**
| Rota | Permissão |
|---|---|
| `/dashboard-rh` | `dashboard_rh_view` |
| `/dashboard-maquinas` | `dashboard_maquinas_view` |
| `/dashboard-cbuq` | `dashboard_cbuq_view` |

**Gestão RH** — `/gestao-rh/{empresas, departamentos, centros-custo, diretorias, funcoes, funcionarios, equipes, arquivo-morto}` com `gestao_rh_*_view`.
`/gestao-rh/desligamentos` → **redirect** para `/gestao-rh/funcionarios?tab=desligamentos`.
`/gestao-rh/central-aprovacoes` → OR de `["central_aprovacoes_view", "acesso_gestao_aprovacoes"]`.

**Gestão Veículos/Equipamentos** — `/gestao-maquinas/*`:
caminhoes, usinas, relatorio-medicao, abastecimento, solicitacoes-equipamentos, disponibilidade, portfolio-empresas, linhas-operacionais (`<Perm>`, sem permissão específica), central-transporte (+ `solicitacao/:solicitacaoId`, `movimentacao/nova`, `movimentacao/:viagemId`), mapa-operacional, checklist-saida/:movimentacaoId (`<Perm>`), `/minhas-mobilizacoes`.
`/gestao-maquinas/planejamento-macro` → **redirect** para `/engenharia/planejamento-macro`.

> A Central do Transporte é a única área que usa **actions granulares**: `action="visualizar"` e `action="criar"` sobre `gestao_maquinas_central_transporte_view`.

**Engenharia** — `/engenharia/planejamento-macro` (`engenharia_planejamento_macro_view`), `/engenharia/ordem-do-dia` (+detalhe). Rotas antigas `/engenharia/ordem-diaria-campo*` → redirect.

**Requisições e Logística** — `/programacao-entrega`, `/registro-aplicacao`, `/requisicoes/{cadastro, registro-cargas, apontamento-equipe, apontamento-caminhoes, chamados-os, gestao-os}`, `/relatorio-aplicacao-diaria`.

**Diárias** — `/requisicoes/diarias/{dashboard, solicitacoes, relatorio, apontamento-campo}`, `/requisicoes/diarias/auditoria-ponto-shadow` (gate `__superadmin_only__`).
`/gestao-aprovacoes-diarias` → redirect legado; `/_legacy/gestao-aprovacoes-diarias` mantida como fallback interno não linkado.

**Licitações** — `/licitacoes/{dashboard, monitoramento-pncp, configuracoes-pncp, orgaos-pendentes, configuracoes-matching, relatorio}`.
> `/licitacoes/dashboard` e `/licitacoes/relatorio` renderizam **o mesmo componente** `RelatorioLicitacoes` com permissões diferentes.

**SSO (Segurança e Saúde Ocupacional)** — `/sso/{checklists, desvios, agendamento-exames, clinicas, checklists/dashboard, ver-e-agir, atestados}`.

**Admin** — `/admin/{permissoes, gestao-fluxos, auditoria, configuracoes-sistema, ponto-dispositivos, biometria-facial, auditoria-biometria, gestao-ponto, qualidade-cadastral}`.
> `/admin/configuracoes-sistema` e `/admin/ponto-dispositivos` reutilizam a permissão `admin_permissoes_view`.
> `/admin/qualidade-cadastral` usa a permissão **sintética** `__superadmin_only__` (não existe no catálogo; só SuperAdm passa).

**Ponto** — `/ponto` (`ponto_registrar`), `/admin/gestao-ponto` (`biometria_facial_gerenciar`).

**Chamados Internos** — `/chamados-internos`, `/abrir`, `/atendimento`, `/dashboard`, `/admin`, `/:chamadoId`.

**POPs** — `/pops` e `/pops/gestao`, ambas com `pops_view`.

### 3.4 Rota congelada
```tsx
// FROZEN: frente "Ponto Dispositivo de Obra" pausada — retomar plano real (timeout em Funcionários).
// const PontoDispositivo = lazy(() => import("@/pages/PontoDispositivo"));
// <Route path="/ponto-dispositivo" element={<PontoDispositivo />} />
```
Arquivo `src/pages/PontoDispositivo.tsx` e a Edge Function `registrar-ponto-dispositivo-obra` **permanecem no repositório**.

---

## 4. Layout e navegação

`src/components/layout/`:

| Arquivo | Importadores | Situação |
|---|---:|---|
| `MainLayout.tsx` | 64 | **ATIVO** — layout padrão de todas as páginas |
| `AppSidebar.tsx` | — | **ATIVO** — consome `menuStructure` |
| `AppHeader.tsx` | — | **ATIVO** |
| `ResponsiveContainer.tsx` | — | ATIVO |
| `MainLayoutOptimized.tsx` | **0** | **LEGADO SEM USO** |
| `Navbar.tsx` | **0** | **LEGADO SEM USO** |

### Menu (`src/constants/menuStructure.ts`, 490 linhas, 6 importadores)

11 grupos:
1. **Gestão de RH** — Dashboard RH, Empresas, Diretorias, Departamentos, Centros de Custo, Funções, Funcionários, Equipes, Arquivo Morto, Central de Aprovações, Agendamento de Exames, Clínicas
2. **Engenharia** — Planejamento Macro da Obra, Ordem do Dia
3. **Gestão Veic/Equip** — Dashboard Máquinas, Caminhões e Equipamentos, Usinas, Chamados e OS, Gestão de OS, Apontamento de Caminhões, Relatório de Medição, Relatório de Abastecimento, Portfólio de Empresas, Solicitações de Equipamento, Central do Transporte, Mapa Operacional, Minhas Mobilizações
4. **Requisições e Logística** — Dashboard Logística, Cadastro de Requisições, Programação de Entrega, Registro de Cargas, Registro de Aplicação, Apontamento de Equipe, Relatório de Aplicação Diária
5. **Diárias** — Dashboard, Solicitações, Apontamento de Campo, Relatório/Folha
6. **Licitações** — Dashboard, Monitoramento PNCP, Configurações PNCP
7. **SSO - Segurança** — Dashboard SSO, CHECK LIST MTE_TAC, Registro de Desvios, Ver e Agir, Atestados Médicos
8. **Administração** — Gestão de Permissões, Gestão de Fluxos, Configurações do Sistema, Dispositivos de Ponto, Central de Auditoria, Qualidade Cadastral, Biometria Facial
9. **Ponto Eletrônico** — Registrar Ponto, Gestão de Ponto
10. **Chamados Internos** — Dashboard, Meus Chamados, Abrir Chamado, Atendimento, Administração
11. **POPs** — Biblioteca de POPs, Gestão de POPs

> **`src/constants/___menuStructure.ts`** (182 linhas, prefixo de três underscores) tem **0 importadores** → duplicata legada.

### Observação sobre itens de menu ausentes de rota
Itens presentes no menu mas **sem rota correspondente em `App.tsx`**: `/licitacoes/orgaos-pendentes` e `/licitacoes/configuracoes-matching` existem em rota mas não no menu; inversamente há itens do menu com permissões que não aparecem em `ROUTE_PERMISSIONS`. Ver `06-MAPA-RBAC.md` §6.

---

## 5. Contexts / Providers (`src/contexts/`, apenas 91 LOC)

| Arquivo | Situação |
|---|---|
| `PageTitleContext.tsx` | **ATIVO** — montado em `App.tsx` |
| `TimezoneContext.tsx` | **0 importadores → LEGADO SEM USO** |

> **Não existe AuthContext nem PermissionContext.** A identidade e as permissões são resolvidas por hooks com **cache em variável de módulo** (`usePermission.ts`), o que significa que cada componente que chama `usePermission()` compartilha o mesmo `_cache` global mas mantém seu próprio `useState`.

---

## 6. Hooks (`src/hooks/` — 257 arquivos, 35.723 LOC)

### 6.1 Organização por domínio
`abastecimento/`, `admin/`, `atestados/`, `central-transporte/`, `dashboard/`, `diarias/`, `equipamentos/`, `funcionarios/`, `ordemDiariaCampo/`, `planejamentoMacro/`, `ponto/`, `pops/`, `programacao/`, `qualidade-cadastral/`, `registro-aplicacao/`, `relatorio-aplicacao/`, `relatorio-aps/`, `rh/`, `sso/`, `ssoAgendamentoExames/`, `ssoDesvios/`, `ssoVerAgir/`, `vehicles/` + hooks soltos na raiz.

### 6.2 Hooks de autenticação/permissão — **15 variantes coexistindo**

| Hook | LOC | Importadores | Classificação |
|---|---:|---:|---|
| `usePermission.ts` | 937 | **116** | **ATIVO — fonte principal** |
| `useAuth.ts` | 151 | 19 | **ATIVO — fonte principal** |
| `usePermissionGuard.ts` | 127 | 10 | ATIVO |
| `useAuthRecovery.ts` | 95 | 2 | ATIVO |
| `usePermissionCacheInvalidation.ts` | 30 | 2 | ATIVO |
| `useAuthPermissionsStable.ts` | 234 | 1 (`PlanejamentoMacroPage`) | **LEGADO AINDA UTILIZADO** |
| `usePermissao.ts` | 447 | 1 | **LEGADO AINDA UTILIZADO** |
| `useOfflinePermissionsSync.ts` | 40 | 1 | ATIVO |
| `usePermissionDebug.ts` | 93 | 1 | EXPERIMENTAL |
| `useRemoverPermissoes.ts` | 90 | 1 | ATIVO |
| `useAuthPermissions.ts` | 45 | **0** | **LEGADO SEM USO** |
| `useDynamicPermissions.ts` | 43 | **0** | **LEGADO SEM USO** |
| `useRobustPermissions.ts` | 42 | **0** | **LEGADO SEM USO** |
| `useSimplePermissions.ts` | 152 | **0** | **LEGADO SEM USO** |
| `useUserPermissions.ts` | 195 | **0** | **LEGADO SEM USO** |

Detalhe em `06-MAPA-RBAC.md`.

---

## 7. Services (`src/services/` — 287 arquivos, 53.173 LOC)

Subpastas: `accessControl/`, `central-aprovacoes/`, `centrosCusto/`, `diarias/`, `equipe/`, `excel/`, `mapa-operacional/`, `notifications/`, `ordemDiariaCampo/`, `pdf/`, `permissoes/`, `planejamentoMacro/`, `pptx/`, `programacao/`, `ponto/`, `rbac/`, `registro-aplicacao/`, `relatorio-aps/`, `rh/`, `sso/`, `ssoAgendamentoExames/`, `ssoDesvios/`, `ssoVerAgir/`, `subcategorias/`, `valeTransporte/`, `veiculo/`.

**Dois diretórios de permissão coexistindo:**
- `src/services/permissoes/` → `funcaoPermissaoCRUD.ts`, `permissaoCRUD.ts`, `userPermissoes.ts`, `unifiedPermissionsService.ts` (**RBAC legado**: `bd_permissoes`, `bd_funcoes_permissao`)
- `src/services/rbac/` → `rolesCRUD.ts`, `permissionsCRUD.ts`, `actionPermissionsCRUD.ts`, `userRolesCRUD.ts`, `userOverridesService.ts`, `checkUserAction.ts` (**RBAC novo**: `bd_roles`, `bd_permissions`, `bd_role_permission_actions`, `bd_user_roles`, `bd_user_permission_overrides`)

---

## 8. Integrations (`src/integrations/supabase/`)

| Arquivo | LOC | Papel |
|---|---:|---|
| `client.ts` | 17 | Cria o client. URL e `anon key` **hardcoded** (padrão Lovable). `storage: brokeredPreviewStorage()`, `persistSession: true`, `autoRefreshToken: true` |
| `previewAuthStorage.ts` | 88 | Storage adapter para funcionar dentro de iframe de preview do Lovable |
| `types.ts` | **27.140** (976 KB) | Schema `Database` gerado: 194 Tables, 70 Views, 452 Functions, 22 Enums |

**Existe um único client Supabase no frontend** — não há duplicação de instância.

---

## 9. Schemas, validações e tipos

- **`src/validations/`** (4 arquivos, 185 LOC): `apontamentoEquipeSchema.ts`, `programacaoSchema.ts`, `registroAplicacaoSchema.ts`, `planejamentoMacro/`.
  **Cobertura mínima** — apenas 3 formulários validados por Zod centralizadamente, apesar de `zod` + `@hookform/resolvers` estarem presentes em todo o projeto (schemas inline em muitos componentes).
- **`src/types/`** (56 arquivos, 6.126 LOC): um arquivo por domínio (`diarias.ts`, `centralTransporte*.ts` × 6, `chamadosInternos.ts`, `pncp.ts`, `pops.ts`, `sso*.ts`, `relatorioAps*.ts` × 4, `veiculo.ts`…). Inclui 4 arquivos `.d.ts` (`pwa`, `service-worker`, `background-sync`, `toast`).
- **`src/constants/`**: `menuStructure.ts`, `routePermissions.ts`, `checklistCeTemplates.ts` (737 LOC), `ctChecklistTemplates.ts`, `chamadosInternos.ts`, `categorias.ts`, `atestadosTiposDocumento.ts`, `atestadosSistemasAfetados.ts` + `___menuStructure.ts` (órfão).

---

## 10. Feature toggles (build-time, `src/config/`)

| Flag | Arquivo | Env var | Default | Efeito |
|---|---|---|---|---|
| `RBAC_LEGACY_FALLBACK_ENABLED` | `rbacFlags.ts` | `VITE_RBAC_LEGACY_FALLBACK_ENABLED` | **`true`** | Liga/desliga os ramos D1–D4 e E2 de fallback legado em `usePermission.ts` |
| `CT3B_SOLICITACAO_PAGE_ENABLED` | `ct3Flags.ts` | `VITE_CT3B_SOLICITACAO_PAGE_ENABLED` | `false` (mas **`true` no `.env`**) | Página dedicada de solicitação da Central do Transporte vs. modal legado CT-2 |
| `DIARIAS_LOTES_UI_PREVIEW` | `diariasFlags.ts` | `VITE_DIARIAS_LOTES_UI_PREVIEW` | `false` | Painel read-only de preview de lotes em Diárias |

**Todas são build-time.** Alterar exige **rebuild + redeploy**. Não há tabela de feature flags no banco (decisão explícita documentada em `rbacFlags.ts`).

---

## 11. PWA

- `public/manifest.webmanifest`
- `public/sw.js` (109 linhas, `SW_VERSION = 'v2'`) — registro via `src/lib/pwa/registerSW`
- `public/models/` — modelos do `face-api.js` servidos estaticamente
- `src/components/pwa/`, `src/components/offline/`, `src/hooks/useOfflineSync.ts`, `useConnectionStatus.ts`, `useAppVersionCheck.ts`
- Páginas de diagnóstico: `/dev/pwa-status`, `/dev/teste-ponto`

---

## 12. Arquivos órfãos no frontend

**161 arquivos `.ts`/`.tsx` (≈ 9% de `src/`) nunca são importados** por nenhum outro arquivo alcançável a partir de `main.tsx`. Lista completa e classificação em `16-LEGADO-DUPLICIDADES.md`.

Destaques (páginas inteiras sem rota):
`Login.tsx`, `Dashboard.tsx`, `Dashboard1.tsx`, `GestaoFrotas.tsx`, `CatalogoEquipamentos.tsx`, `CatalogoSugestoes.tsx`, `Contact.tsx`, `Privacy.tsx`, `IntegrityChannel.tsx`, `SecureApontamentoEquipe.tsx`, `abastecimento.tsx`, `reabastecimentos.tsx`.
