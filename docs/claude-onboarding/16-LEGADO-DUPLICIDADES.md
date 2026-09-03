# 16 — LEGADO E DUPLICIDADES

> Auditoria READ-ONLY. **Duplicidade aparente NÃO significa que algo pode ser removido.**
> Este documento apenas mapeia. Nenhum arquivo, tabela, função ou policy foi removido.
> Vários itens abaixo são **legado intencional preservado** (redirects, fallbacks, frentes congeladas).

---

## 1. Os dois sistemas de RBAC

O achado mais importante desta seção. Detalhe completo em `06-MAPA-RBAC.md`.

| | RBAC NOVO | RBAC LEGADO |
|---|---|---|
| Tabelas | `bd_roles`, `bd_permissions`, `bd_role_permissions`, `bd_role_permission_actions`, `bd_user_roles`, `bd_user_permission_overrides` | `bd_permissoes`, `bd_funcoes_permissao`, `bd_permissoes_acoes` + `profiles.{funcoes, funcao_sistema, funcao_permissao, acesso_global}` |
| Services | `src/services/rbac/` (6 arquivos) | `src/services/permissoes/` (4 arquivos) |
| Hooks | `usePermission.ts` (ramo D) | `usePermission.ts` (ramos D2/D4), `usePermissao.ts`, `useAuthPermissionsStable.ts` |
| SQL | `fn_has_action` (só novo) | `fn_has_permission` (novo **+** `legacy_allow`), `fn_is_super_admin` (4 fontes) |
| Ponte | `bd_rbac_legacy_map`, `vw_rbac_legacy_map_drift`, `vw_rbac_standard_*`, `fn_permission_aliases` | |
| Telemetria | `emitRbacFallbackEvent()` → `bd_permission_audit_logs`; `logLegacyUsage()` | |
| Flag de cutover | `RBAC_LEGACY_FALLBACK_ENABLED` (default `true`) — cobre D1–D4 e E2, **não** cobre as Camadas A/B/C | |

**Ambos estão ativos em produção.** `NÃO consolidar. NÃO migrar. NÃO corrigir.`

### 1.1 Nove predicados de SuperAdmin
`is_super_admin` (estrita) · `fn_is_super_admin` (ampla) · `check_is_super_admin` · `check_is_super_admin_hybrid` · `check_is_super_admin_new` · `is_departmental_super_admin` · `is_ponto_superadmin` · `fn_ponto_is_superadmin` · `is_superadm_or_rh`.

### 1.2 Dois motores de aprovação
| Motor dinâmico (novo) | Motor por cargo (legado) |
|---|---|
| `bd_fluxos_aprovacao` + `bd_fluxo_etapas` + `bd_fluxo_centro_custo` + `bd_aprovacoes_fluxo_exec` | funções hardcoded |
| `iniciar_fluxo_dinamico`, `aprovar_etapa_dinamica`, `rejeitar_etapa_dinamica`, `liberar_proxima_etapa_dinamica`, `verificar_etapa_disponivel` | `aprovar_gerente_adm`, `aprovar_diretor_adm`, `aprovar_diretor_operacional`, `reprovar_*` |
| `fn_aprovacao_resolver_fluxo`, `fn_aprovacao_resolver_aprovador`, `fn_aprovacao_corporativa_*` | `_map_tipo_aprovador_to_role`, `_map_tipo_aprovador_to_status` |
| UI: `/admin/gestao-fluxos` | — |
| Gate: `fn_motor_aprovacao_corporativo_disponivel` | |

---

## 2. Diretório inteiro duplicado — `funcionarios/funcionarios/`

`src/components/funcionarios/funcionarios/` contém **exatamente os mesmos 12 arquivos** de `src/components/funcionarios/`:

```
AuthDebugPanel.tsx          FuncionarioFormModal.tsx        FuncionarioPage.tsx
DeleteFuncionarioDialog.tsx FuncionarioHeaderActions.tsx    FuncionarioTable.tsx
EmailConfirmationModal.tsx  FuncionarioImageUploadModal.tsx ImportFuncionariosModal.tsx
FuncionarioDetailsModal.tsx FuncionarioImportModal.tsx
FuncionarioFilters.tsx
```

- **Nenhum arquivo importa via o caminho aninhado** (`grep "funcionarios/funcionarios/"` → 0 resultados).
- Os conteúdos **divergiram**: `FuncionarioFormModal.tsx` tem 69 linhas na versão ativa e 68 na aninhada.
- ⚠️ **A cópia aninhada tem `bd_funcionarios` e RBAC em `FuncionarioFilters.tsx`** — é código funcional, não um stub.

**Classificação: `LEGADO SEM USO APARENTE`.** Provável artefato de uma reorganização de pastas feita pelo Lovable sem remover a origem.

---

## 3. Arquivos órfãos — 161 (~9% de `src/`)

Nenhum destes é alcançável a partir de `src/main.tsx`. Excluídos: testes, `__tests__/`, `src/test/`.

### 3.1 Páginas sem rota (12)
`Login.tsx` · `Dashboard.tsx` · `Dashboard1.tsx` · `GestaoFrotas.tsx` · `CatalogoEquipamentos.tsx` · `CatalogoSugestoes.tsx` · `Contact.tsx` · `Privacy.tsx` · `IntegrityChannel.tsx` · `SecureApontamentoEquipe.tsx` · `abastecimento.tsx` · `reabastecimentos.tsx`

### 3.2 Site institucional legado (7)
`components/AuthForm.tsx` · `components/Footer.tsx` · `components/HeroSection.tsx` · `components/ServiceCard.tsx` · `components/admin/AdminPortfolioProjectGrid.tsx` · `pages/Contact.tsx` · `pages/Privacy.tsx`
→ correspondem às tabelas `portfolio_categories`, `portfolio_images`, `portfolio_projects`, `services` e aos buckets `portfolio`, `services`, todos com policies "publicly readable".

### 3.3 Hooks de permissão/auth mortos (7)
`useAuthPermissions.ts` · `useDynamicPermissions.ts` · `useRobustPermissions.ts` · `useSimplePermissions.ts` · `useUserPermissions.ts` · `useAccessControlHybrid.ts` · `useSessionPersistence.ts`
→ e `src/utils/hybridPermissions.ts`, `src/services/permissoes/unifiedPermissionsService.ts`.

> ⚠️ `useSimplePermissions.ts` importa `isSuperAdminFallbackEmail` — mantém viva a referência à lista de e-mails hardcoded mesmo estando morto.

### 3.4 Guards mortos (2)
`components/routing/AuthGuard.tsx` · `components/routing/RouteProtection.tsx`

### 3.5 Layout morto (2)
`components/layout/MainLayoutOptimized.tsx` · `components/layout/Navbar.tsx`

### 3.6 Relatório de Medição — 9 componentes órfãos
`Reabastecimento.tsx` · `RelatorioAplicacaoHeader.tsx` · `RelatorioMedicaoAssinaturas.tsx` · `RelatorioMedicaoContratada.tsx` · `RelatorioMedicaoDescontos.tsx` · `RelatorioMedicaoHeader.tsx` · `RelatorioMedicaoObservacoes.tsx` · `RelatorioMedicaoTabelaServicos.tsx` · `RelatorioMedicaoTotalPeriodo.tsx`
→ A página `RelatorioMedicao.tsx` **está roteada**, mas usa `RelatorioMedicaoPlaceholder.tsx`. Indica **módulo em reconstrução**: `EM MIGRAÇÃO`.

### 3.7 Central do Transporte — 11 componentes órfãos
`AtivosMovimentacaoPanel` · `CaminhoesPuxadaEditor` · `CriarMovimentacaoModal` · `CtChecklistItemRow` · `DecisaoTransporteDialog` · `EtapaItens` · `EtapaSelecao` · `ParadasSelector` · `RecursosArrastaveisPanel` · `SecaoNumerada` · `SelecaoItemVazio`
→ Resíduos das fases CT-2 → CT-3B → CT-4 → CT-5.

### 3.8 Dashboard — 8 componentes órfãos
`maquinas/{UpdateEquipmentStatusButton, UtilizacaoEficiencia, VisaoGeralFrota}` · `rh/{FolhaPagamentoResumo, MediaPorFuncaoChart, RhSecurityIndicator, TopEquipesCards, TopFuncionariosCards}`

### 3.9 Registro de Aplicação — pasta plural órfã
`components/registro-aplicacoes/` (plural) — **toda a pasta é órfã**: `DadosTecnicosMultiplaAplicacaoTab.tsx`, `useAplicacoesMultiplas.ts`.
A pasta ativa é `components/registro-aplicacao/` (singular), que também tem 5 órfãos: `CargaApplicationHistory`, `EntregasTable`, `NovoApontamentoModal`, `RegistroAplicacaoTable`, `form-tabs/NovoRegistroDadosTecnicosTab`.
Services órfãos: `registroAplicacaoService.ts`, `manualFinalizationService.ts`, `registro-aplicacao/fetchEntregasStable.ts`.

### 3.10 Componentes `ui/` do shadcn nunca usados (11)
`aspect-ratio` · `breadcrumb` · `carousel` · `context-menu` · `input-otp` · `menubar` · `navigation-menu` · `resizable` · `slider` · `toaster` · `use-toast.ts`
→ Instalados pelo shadcn CLI e nunca consumidos. `input-otp` e `resizable` têm dependências correspondentes em `package.json` (`input-otp`, `react-resizable-panels`) — dependências que poderiam ser removidas.

> ⚠️ `components/ui/toaster.tsx` e `use-toast.ts` são órfãos porque o projeto usa **`sonner`** (`<Sonner />` em `App.tsx`), não o Toaster do shadcn. Mas `src/hooks/use-toast.ts` (fora de `ui/`) **é usado**. Há duas implementações de toast no repositório.

### 3.11 Debug / experimental (7)
`debug/PermissionDebugModal` · `debug/PermissionDebugPanel` · `debug/UserRoleIndicator` · `funcionarios/AuthDebugPanel` (×2 cópias) · `hooks/registro-aplicacao/useModalDebug.ts` · `planejamento-macro/shared/MockBadge.tsx`
→ `EXPERIMENTAL`. `MockBadge` sinaliza que o Planejamento Macro teve dados mockados em algum momento.

### 3.12 Services órfãos (11)
`aprovacaoCorporativaService.ts` · `central-aprovacoes/index.ts` · `equipe/funcionarioQueries.ts` · `equipe/validation.ts` · `equipeService.ts` · `notifications/notificationEmitter.ts` · `ordemServicoTransactionService.ts` · `permissoes/unifiedPermissionsService.ts` · `registroAplicacaoService.ts` · `subcategorias/syncSubcategorias.ts` · `userService.ts`

### 3.13 Utils / lib órfãos (5)
`utils/duracaoAtendimento.ts` · `utils/duracaoUtils.ts` (**dois utilitários de duração**) · `utils/hybridPermissions.ts` · `utils/offlineQueries.ts` · `lib/pdfFonts.ts`

### 3.14 Outros (restante)
`components/DisabledComponent.tsx` · `components/safe/SafeFormWrapper.tsx` · `components/system/SystemFixedNotification.tsx` · `components/permissoes/PermissionFixNotification.tsx` · `components/offline/OfflineStatusIndicator.tsx` · `components/pwa/PWAStatusIndicator.tsx` · `contexts/TimezoneContext.tsx` · `constants/___menuStructure.ts` · barrels `index.ts` órfãos (`sso/pdf`, `ssoDesvios`, `ssoDesvios/pdf`, `ssoVerAgir`, `ssoAgendamentoExames`, `diarias/pdf`, `hooks/ssoDesvios`) · 4 arquivos `.d.ts` (`pwa`, `service-worker`, `background-sync`, `toast` — órfãos por natureza, é esperado).

---

## 4. Duplicações de nome (mesmo basename, arquivos diferentes)

| Nome | Caminhos | Situação |
|---|---|---|
| `FuncionarioFormModal`, `FuncionarioTable`, `FuncionarioFilters`, `FuncionarioPage`, `FuncionarioDetailsModal`, `FuncionarioHeaderActions`, `FuncionarioImageUploadModal`, `FuncionarioImportModal`, `ImportFuncionariosModal`, `EmailConfirmationModal`, `DeleteFuncionarioDialog`, `AuthDebugPanel` | `funcionarios/` × `funcionarios/funcionarios/` | pasta inteira duplicada (§2) |
| `AddressAutocomplete` | `centrosCusto/` × `shared/` | ambas em uso — **shared/ é a canônica** |
| `EntregasTable` | `registro-aplicacao/` (órfã) × `registro-cargas/` (ativa) | |
| `reabastecimentos` | `components/relatorio-reabastecimento/` × `pages/` | **ambas órfãs** |
| `ConvertToOSModal` × `ConvertToOsModal` | `chamados-os/` × `ordens-servico/` | **ambas órfãs, grafias diferentes** |
| `CaminhaoCombobox` × `ComboboxCaminhao` | `combobox/` | **ambas órfãs, nomes invertidos** |
| `AplicacoesRegistradasList`, `NovaAplicacaoForm`, `FormTabs`, `DadosTecnicosMultiplaAplicacaoTab`, `RelatorioAplicacaoHeader`, `CentroCustoFilters` | várias pastas | verificar caso a caso |
| `use-toast.ts` | `hooks/` (ativo) × `components/ui/` (órfão) | duas implementações de toast + `sonner` |

---

## 5. Arquivos com sufixo indicando versão/estado

| Arquivo | Situação |
|---|---|
| `src/constants/___menuStructure.ts` | **órfão** — 3 underscores como marca de "desativado" |
| `src/pages/RegistroAplicacaoStable.tsx` | **órfão** |
| `src/services/registro-aplicacao/fetchEntregasStable.ts` | **órfão** |
| `src/hooks/useAuthPermissionsStable.ts` | **ATIVO** (1 importador: `PlanejamentoMacroPage`) |
| `src/hooks/useUserDataAccessStable.ts` | verificar |
| `src/pages/central-aprovacoes/RedirectLegacy.tsx` | **ATIVO — legado intencional** (redirect de rota antiga) |
| `src/utils/rbacLegacyTelemetry.ts`, `src/utils/rbacLegacyWriteAudit.ts` | **ATIVOS — instrumentação do cutover** |
| `src/hooks/useConnectionStatusOptimized.ts` | **órfão** (o não-"Optimized" é o ativo) |
| `src/components/layout/MainLayoutOptimized.tsx` | **órfão** |

---

## 6. Importador de veículos — 3 gerações coexistindo

| Geração | Localização | Situação |
|---|---|---|
| V1/V2 | `src/services/veiculo/import/` (+ `__tests__/`, 11 testes) | ATIVO? |
| V2 (UI) | `src/components/veiculos/import/ImportadorV2Wizard.tsx` | ATIVO |
| V3 | `src/services/veiculo/importV3/` — **34 arquivos + 14 testes** | ATIVO |
| V3 (UI) | `src/components/veiculos/import/ImportadorV3Modal.tsx` | ATIVO |
| V3 "Simplificado" | `executarImportacaoV3Simplificado.ts`, `parseWorkbookV3Simplificado.ts`, `gerarWorkbookV3Simplificado.ts`, `hidratarExportacaoV3Simplificado.ts`, `montarPayloadRpcV3Simplificado.ts`, `equipamentosSchemaSimplificado.ts` | variante paralela dentro do V3 |
| Hooks | `useEquipamentosImportV3.ts` **e** `useEquipamentosImportV3Simplificado.ts` | dois |
| Órfãos | `ImportVeiculosModal.tsx`, `ConfirmarImportacaoStep.tsx`, `ResultadoExecucaoStep.tsx`, `form/VeiculoFormTabs.tsx` | |
| Backend | `bd_importador_v2_execucoes`, `bd_importador_v2_linhas_processadas`, `fn_importador_v2_*` (4 RPCs), `fn_importador_ativos_inserir/_atualizar` | duas gerações também no banco |

> É a maior concentração de testes do projeto (25 de 113 arquivos de teste). Indica que a frente foi trabalhada com rigor, mas as gerações não foram desativadas.

---

## 7. Legado intencional preservado (NÃO é problema)

| Item | Motivo declarado no código |
|---|---|
| `/gestao-aprovacoes-diarias` → `RedirectLegacy.tsx` | preserva deep links |
| `/_legacy/gestao-aprovacoes-diarias` → `GestaoAprovacoesDiarias` | *"Página antiga preservada apenas como fallback interno (não linkada no menu)"* |
| `/gestao-rh/desligamentos` → redirect com `?tab=desligamentos` | *"preservando quaisquer query params já presentes (ex.: deep links externos)"* |
| `/gestao-maquinas/planejamento-macro` → `/engenharia/planejamento-macro` | *"FASE 1/2: rota antiga mantida apenas como redirect"* |
| `/engenharia/ordem-diaria-campo*` → `/engenharia/ordem-do-dia` | *"Redirects das rotas antigas (campo) — preservam deep links"* |
| `/ponto-dispositivo` comentado | *"FROZEN: frente 'Ponto Dispositivo de Obra' pausada — retomar plano real (timeout em Funcionários). Arquivo e edge function preservados."* |
| `mv_relatorio_diarias_legacy_20260514` | snapshot da MV antes de mudança |
| `funcionarios_operacional_select` com OR de função nova + 2 legadas | *"Fase 3C/Etapa 2: modo aditivo… Funções legadas serão removidas na Etapa 3 após observação."* |
| `bd_rbac_legacy_map` + `vw_rbac_legacy_map_drift` | ponte de cutover instrumentada |

**Este é um sinal positivo de maturidade** — as migrações foram feitas de forma aditiva e reversível, exatamente como a regra de preservação exige.

---

## 8. Legado no banco de dados

### 8.1 Tabelas com policy viva mas ausentes de `types.ts`
`bd_caminhoes` · `bd_centro_custo` · `bd_centros_custo_alias` · `bd_empresas_alias` · `bd_funcoes_alias` · `bd_os_movimentacoes` · `portfolio_categories` · `portfolio_images` · `portfolio_projects` · `services`
→ Ou foram removidas (deixando policies órfãs no histórico de migrations), ou não estão expostas ao PostgREST. **`[VERIFICAR NO BANCO]`**

### 8.2 Policies com nome de desenvolvimento ainda vivas
`"Allow all access to funcionarios during development"` foi corretamente dropada. Mas continuam vivas:
- `"Allow all access to caminhoes during development"` (`bd_caminhoes`)
- `"Allow all access to centro_custo during development"` (`bd_centro_custo`)
- `"Allow all access to lista_programacao_entrega during development"` (`bd_lista_programacao_entrega`)

### 8.3 Funções duplicadas / com variantes
| Grupo | Variantes |
|---|---|
| Merge de funcionários | `merge_duplicate_funcionarios`, `merge_duplicate_funcionarios_by_email_normalized`, `merge_duplicate_funcionarios_normalized`, `consolidar_funcionarios_duplicados` |
| Registro de aplicação manual | `fn_criar_registro_aplicacao_manual`, `fn_criar_registro_aplicacao_manual_v2` |
| Massa remanescente | `calcular_massa_remanescente`, `calcular_massa_remanescente_aplicacao`, `calcular_massa_remanescente_em_tempo_real` |
| Identificação facial | `identificar_funcionario_por_descriptor`, `identificar_funcionario_por_descriptor_v2` |
| Relatório de diárias | `get_relatorio_diarias`, `get_relatorio_diarias_full` |
| Normalização de texto | `normalize_text`, `normalize_text_immutable`, `unaccent`, `unaccent_immutable` |
| Apontamento de manutenção | `fn_apontar_manutencao_ativo_dia`, `fn_apontar_manutencao_diario` |
| Convocados de diária | `gerenciar_convocado_diaria`, `gerenciar_convocado_diaria_no_dia` |
| Permissão | `has_permission`, `fn_has_permission`, `user_has_permission`, `user_has_permission_action`, `user_has_permission_hybrid`, `get_user_permissions`, `get_user_permissions_hybrid` |
| Papel | `has_role`, `fn_has_role`, `fn_user_has_any_named_role`, `get_current_user_role` |
| Equipes | `get_user_teams`, `get_user_allowed_teams`, `usuario_acessa_equipe` |
| Debug | `debug_user_access`, `debug_user_access_detailed`, `debug_user_authentication` |

### 8.4 Views legadas
`mv_relatorio_diarias_legacy_20260514`, `vw_apontamento_equipe` × `vw_apontamento_equipe_seguro`.

---

## 9. Legado de infraestrutura

| Item | Situação |
|---|---|
| `api/proxy_server.py` + `src/components/reabastecimento/proxy_server.py` | **arquivos idênticos**, Flask, substituídos por `guardian-web-proxy` |
| `api/__pycache__/guardian_api.cpython-313.pyc` | `.pyc` de um `guardian_api.py` **que não existe mais no repositório** |
| `vite.config.ts.timestamp-1755906201623-2a4e365cec31b.mjs` (13 KB) | artefato temporário do Vite, versionado por engano |
| `nvmrç.nvmrc` | arquivo com nome corrompido (cedilha) duplicando `.nvmrc` |
| `25-08-25.txt`, `Ramon.txt`, `teste_envio_Ramon_valente.txt`, `data_lançamento_25-08-25.txt` | 4 arquivos **vazios** (0 bytes) na raiz |
| `.prewarm` | arquivo vazio (artefato Lovable) |
| `bun.lock` + `bun.lockb` + `package-lock.json` | **três lockfiles** de dois gerenciadores diferentes |
| `codigos-para-estudos/` | diretório de estudos versionado |
| `docs/` | 20 documentos + 6 subpastas de documentação anterior — **ler antes de duplicar informação** |
| `.lovable/plan-*.md` | 6 planos de execução do Lovable (jul/2026) |
| `og:url` = `https://lytotec.lovable.app` | metadado ainda apontando para o domínio Lovable |

---

## 10. Verificações NÃO executadas (Parte 16 do escopo)

A auditoria previa executar `typecheck`, `lint`, testes e `build` local após a análise estática. **Nenhum foi executado**, por dois motivos:

1. **`node_modules/` não existe** no repositório. Executar qualquer um deles exigiria `bun install` / `npm install` — o que a **REGRA ABSOLUTA** da auditoria proíbe explicitamente (*"instalar bibliotecas"*, *"atualizar dependências"*).
2. `package.json` **não define scripts `test` nem `typecheck`**, apesar de existirem 113 arquivos de teste e `vitest.config.ts`.

**Comandos para você executar quando autorizar** (nesta ordem):

```bash
bun install
```
```bash
npx tsc --noEmit -p tsconfig.app.json
```
```bash
npx vitest run
```
```bash
bun run lint
```
```bash
bun run build
```

**Expectativas com base na análise estática:**
- `tsc --noEmit`: deve passar — `strict: false`, `strictNullChecks: false`, `noImplicitAny: false`, `skipLibCheck: true`. Erros que aparecerem serão reais e graves.
- `vitest run`: 113 arquivos; concentração em Central do Transporte (24), importador de veículos (25), Diárias, Planejamento Macro, POPs.
- `eslint .`: rodará sobre **1.814 arquivos incluindo os 161 órfãos**; espere volume alto de avisos.
- `bun run build`: pode exigir heap ampliado (o script `build:dev` já usa `--max-old-space-size=6144`).

---

## 11. Resumo — o que é duplicidade real vs. transição controlada

| Duplicidade | Natureza |
|---|---|
| Dois RBACs | 🟠 **transição controlada** (com flag, telemetria e mapa de drift) — mas inacabada |
| Dois motores de aprovação | 🟠 transição sem flag nem telemetria |
| Três gerações de importador | 🟠 transição com testes, sem desativação |
| `funcionarios/funcionarios/` | 🔴 **duplicidade acidental** |
| 161 arquivos órfãos | 🟡 acúmulo natural de 11.369 commits gerados por IA |
| 9 predicados de SuperAdmin | 🔴 duplicidade com **divergência semântica** — a mais perigosa |
| Redirects e rotas `_legacy` | 🟢 legado intencional, bem documentado |
| Frente `FROZEN` do Ponto Dispositivo | 🟢 pausa consciente e documentada |
| 3 lockfiles, arquivos vazios, `.pyc` órfão | 🟡 higiene de repositório |

**Nada foi removido. Nada foi consolidado.**
