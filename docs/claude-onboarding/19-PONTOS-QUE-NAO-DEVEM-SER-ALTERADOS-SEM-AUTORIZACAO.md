# 19 — PONTOS QUE NÃO DEVEM SER ALTERADOS SEM AUTORIZAÇÃO

> Lista de **zonas críticas** do ERP LYTOTEC. Cada item indica o raio de impacto real medido nesta auditoria.
> Nenhum destes pontos foi tocado. Alterar qualquer um deles exige o protocolo completo de `18-REGRAS-PARA-DESENVOLVIMENTO-FUTURO.md`.

---

## 🔴 NÍVEL 1 — Alteração pode derrubar o sistema inteiro ou a segurança de todos os módulos

### 1.1 `src/hooks/usePermission.ts` (937 LOC)
- **116 importadores.** É a única fonte de permissão do frontend.
- Contém 7 caminhos de decisão (Camadas A–E) que não podem ser "simplificados" sem análise da telemetria em `bd_permission_audit_logs`.
- Alterar a **assinatura de retorno** é uma mudança de 116 arquivos.
- O cache é uma **variável de módulo** compartilhada — mexer no TTL afeta toda a aplicação.

### 1.2 `fn_is_super_admin` e `is_super_admin` (PostgreSQL)
- `fn_is_super_admin`: **378 usos** em policies + 219 via `check_is_super_admin` + 25 via `_hybrid`.
- `is_super_admin`: 18 usos em policies + 2 Edge Functions (`definir-senha-dispositivo`, `vincular-ccs-dispositivo`).
- **As duas têm semânticas DIFERENTES** (ver `06-MAPA-RBAC.md` §4). Unificá-las muda o acesso efetivo de usuários reais.
- Qualquer mudança nas 4 colunas de `profiles` que `fn_is_super_admin` lê (`acesso_global`, `funcoes`, `funcao_sistema`, `funcao_permissao`) propaga para 378 policies.

### 1.3 `fn_has_permission` e `fn_has_action`
- Base da autorização em 34 + 27 policies.
- `fn_has_permission` contém o ramo `legacy_allow` — **removê-lo pode tirar acesso de usuários que hoje só têm permissão pelo RBAC legado**.
- Antes de qualquer mudança, quantificar: `select count(*) from public.profiles where funcao_permissao is not null;`

### 1.4 Tabelas de RBAC
`bd_roles` · `bd_permissions` · `bd_role_permissions` · `bd_role_permission_actions` · `bd_user_roles` · `bd_user_permission_overrides` · `bd_permissoes` · `bd_funcoes_permissao` · `bd_permissoes_acoes` · `bd_rbac_legacy_map`
- **Nunca** apagar linha sem antes verificar `bd_permission_change_audit_logs`.
- `bd_user_permission_overrides.permitido = false` é um **deny explícito** que vence tudo em `fn_has_permission` — apagar uma linha dessas concede acesso silenciosamente.

### 1.5 `profiles`
- **47 FKs de entrada + 5 triggers.**
- PK = `auth.users.id`.
- Colunas `funcoes`, `funcao_sistema`, `funcao_permissao`, `acesso_global` são autoridade de acesso.
- `profiles.funcionario_id` **não é UNIQUE** — a modelagem tolera múltiplos usuários por funcionário.

### 1.6 `bd_centros_custo`
- **40 FKs de entrada + 4 triggers.**
- É o eixo de escopo de RLS de praticamente todos os módulos.
- `latitude`, `longitude`, `raio_ponto_metros` definem a **cerca geográfica do ponto eletrônico** — alterar afeta o controle de jornada dos funcionários.
- 5 papéis de responsabilidade, sendo que `planejador_responsavel_id` aponta para `profiles` e os outros 4 para `bd_funcionarios`.

### 1.7 `bd_funcionarios`
- **50 FKs de entrada + 9 triggers + 16 policies.**
- Contém dados de folha e PII (CPF, salário, PIX, conta, endereço, coordenadas, data de nascimento).
- Triggers de geocoding (`fn_proteger_geocoding_manual`, `fn_validar_geocoding_no_save`) protegem ajustes manuais.
- ⚠️ Há três policies `USING(true)` sobre esta tabela (`14-RISCOS-SEGURANCA.md` SEC-01). **Removê-las é necessário, mas pode quebrar o fluxo de registro de novo usuário** (`/register` consulta `bd_funcionarios` por e-mail) — exige policy substituta antes.

### 1.8 `supabase/functions/_shared/backend-security.ts`
Usado por 5+ Edge Functions. Alterar `authenticateEdgeRequest` ou `authorizeBackendInvocation` muda a autorização de `delete-user`, `auto-finalizar-diarias`, `process-desligamentos`, `ponto-diaria-shadow`, `sync-subcategorias-site`.

### 1.9 `supabase/config.toml`
Cada linha `verify_jwt = false` é uma decisão de segurança consciente. **Mudar para `true` quebra as funções que fazem CORS preflight e autenticação própria** (totem, atestados, dispositivos). Mudar de `true` para `false` remove a proteção da plataforma.

---

## 🟠 NÍVEL 2 — Alteração quebra um módulo inteiro

### 2.1 Guards de rota
`SimpleAuthGuard` · `SimplePermissionGuard` · `SecureRouteGuard` · `OrdemDiariaCampoGuard`
- Os comportamentos *fail-open* (`hasVerifiedOnce`, `wasEverApproved`, `emergencyAdminBypass`) foram introduzidos deliberadamente para tolerar instabilidade do Supabase e **evitar perda de formulário**. Removê-los sem substituto degrada a experiência em campo (rede móvel instável).

### 2.2 `src/constants/routePermissions.ts` e `menuStructure.ts`
Fonte única de verdade da navegação. Devem permanecer sincronizados com `App.tsx` e `bd_permissions.rota`. `hasRoutePermission` retorna `true` para rota não mapeada — adicionar rota sem mapear a permissão a torna visível no menu para todos.

### 2.3 `src/components/layout/MainLayout.tsx`
64 importadores.

### 2.4 Triggers de guarda (regras de negócio no banco)
| Trigger | Invariante que protege |
|---|---|
| `fn_ordens_diarias_guard_emitida` | Ordem do Dia emitida não pode ser alterada |
| `fn_pop_bloquear_mutacao_destrutiva` | POP publicado não pode sofrer mutação destrutiva |
| `fn_lock_itens_solicitacao_rh` | Itens de solicitação de RH congelam após envio |
| `fn_proteger_geocoding_manual` | Geocoding automático não sobrescreve ajuste manual |
| `fn_validar_geocoding_no_save` | Coordenadas inválidas são rejeitadas |
| `fn_detectar_conflito_designacao` | Impede alocação dupla de funcionário |

> **"Nunca remover trigger apenas porque está bloqueando operação."** São exatamente estes.

### 2.5 Cadeia de cálculo do Registro de Aplicação
`bd_registro_aplicacao_detalhes` (9 triggers) · `bd_registro_apontamento_aplicacao` (5) · `bd_registro_aplicacao_ruas` (3) · `bd_registro_cargas` (4)
Funções: `calcular_massa_remanescente*` (3 variantes) · `calcular_espessura_aplicacao` · `calculate_tonelada_real` · `calculate_aplicacao_area` · `calculate_rua_area/values` · `converter_kg_para_toneladas` · `atualizar_registro_principal_aplicacao` · `atualizar_status_entrega_automatico`
→ Alterar uma coluna dispara recálculo em cascata por toda a hierarquia. **Dados de produção operacional (asfalto aplicado) dependem disso.**

### 2.6 Cadeia de cálculo de Diárias
`calcular_valor_diaria` · `fn_calcular_diaria_aplicada` · `fn_resolver_base_diaria` · `sync_presencas_valores_funcao` · `sync_convocados_pre_valores`
→ **Impacto financeiro direto** (folha de pagamento de diárias).
`mv_relatorio_diarias` + `_mv_relatorio_diarias_dirty` + `refresh_relatorio_diarias`.

### 2.7 Cálculo de custo de OS
`fn_recalcula_total_os` · `fn_recalcula_total_os_from_row` (4 triggers) · `fn_calc_valor_total_item` (4 triggers)

### 2.8 Central do Transporte — idempotência
`fn_ct_mob_command_hash` · `fn_ct_mob_content_hash` · `bd_ct_comando_requests`
→ São o mecanismo anti-duplicação de comandos. Quebrar isso gera mobilizações/viagens duplicadas.

### 2.9 Ponto eletrônico — validadores
`_shared/ponto-validators.ts` · `_validar_gps` · `lib/ponto/verificarCooldownBatida.ts` · `fn_ponto_can_access_batida`
→ **Controle de jornada tem implicação trabalhista.** Alterar a cerca geográfica, o cooldown ou a sequência de batidas tem consequência legal.

### 2.10 Biometria facial
`bd_funcionarios_biometria_facial` (pgvector) · `identificar_funcionario_por_descriptor(_v2)` · `public/models/` (modelos face-api) · bucket `biometria-facial`
→ **Dado biométrico é dado pessoal sensível (LGPD Art. 5º, II).** Qualquer alteração exige avaliação de conformidade.

### 2.11 Fluxo público de Atestados Médicos
`atestado-*` (6 Edge Functions) · `ATESTADO_HMAC_SECRET` · `bd_atestados_nonces_utilizados` · rota pública `/atestados-medicos`
→ É o único fluxo acessível sem login. O HMAC + nonce é a **única** barreira. Rotacionar o secret quebra links em trânsito.

---

## 🟡 NÍVEL 3 — Alteração tem efeito colateral não óbvio

### 3.1 Arquivos gerados (não editar manualmente)
- `src/integrations/supabase/client.ts` — *"This file is automatically generated. Do not edit it directly."*
- `src/integrations/supabase/types.ts` — 976 KB, regenerado pelo Supabase CLI
- `src/integrations/supabase/previewAuthStorage.ts` — gerado pelo Lovable

### 3.2 `index.html`
```html
<!-- IMPORTANT: DO NOT REMOVE THIS SCRIPT TAG OR THIS VERY COMMENT! -->
<script src="https://cdn.gpteng.co/gptengineer.js" type="module"></script>
```

### 3.3 `public/sw.js`
A lista `shouldBypass()` impede o cache de `*.supabase.co`, `/functions/v1/`, `/auth/` e `/version.json`. **Remover qualquer entrada dessa lista faz o Service Worker cachear tokens e respostas de API.**
`SW_VERSION` controla a invalidação de cache — alterar sem entender o ciclo deixa usuários com bundle antigo.

### 3.4 `vite.config.ts`
- `manualChunks` — alterar muda o cache do navegador de todos os usuários
- `esbuild.pure: ['console.log', ...]` em produção — **é a mitigação ativa de SEC-20** (logs com dados sensíveis). Remover reexpõe e-mails, salários e fluxo de senha no console de produção.
- `writeVersionJson()` alimenta `useAppVersionCheck`

### 3.5 Feature flags
| Flag | Efeito de mudar |
|---|---|
| `VITE_RBAC_LEGACY_FALLBACK_ENABLED` → `false` | **Corta 5 caminhos de fallback de permissão.** Usuários que dependem do RBAC legado perdem acesso. Exige análise prévia de `bd_permission_audit_logs`. |
| `VITE_CT3B_SOLICITACAO_PAGE_ENABLED` | Alterna entre a página nova e o modal legado da Central do Transporte |
| `VITE_DIARIAS_LOTES_UI_PREVIEW` | Painel de preview em Diárias |

Todas são **build-time** — exigem rebuild + redeploy.

### 3.6 Funções de manutenção destrutiva — **NUNCA executar sem autorização**
`merge_duplicate_funcionarios` · `merge_duplicate_funcionarios_by_email_normalized` · `merge_duplicate_funcionarios_normalized` · `consolidar_funcionarios_duplicados` · `delete_funcionario_with_admin_bypass` · `force_update_all_delivery_statuses` · `relatorio_correcao_status_massa` · `fn_aplicar_saneamento_auto` · `fn_reverter_saneamento_auto` · `sync_convocados_pre_valores` · `sync_presencas_valores_funcao` · `fn_arquivar_auditoria_log` · `fn_clear_user_admin_roles_secure` · `rbac_auto_migrate_user`

### 3.7 Edge Functions de alto privilégio
| Função | Por quê |
|---|---|
| `fix-empty-rbac-roles` | **Assina JWTs válidos** com `SUPABASE_JWT_SECRET` e concede papéis em massa |
| `create-gestor` (821 LOC) | Cria usuários e papéis |
| `delete-user` | Exclui usuários do Auth |
| `admin-confirm-email` | Confirma e-mail sem verificação |
| `definir-senha-dispositivo` | Define senha de dispositivo de ponto |
| `vincular-ccs-dispositivo` | Define o escopo de CC de um totem |

### 3.8 Secrets compartilhados
`LYTOTEC_API_KEY` autentica 5+ fluxos distintos e está distribuída em **totens físicos em campo** e no **site institucional (outro projeto Supabase)**. **Rotacionar essa chave quebra os cinco fluxos simultaneamente** e exige atualização física dos totens.

### 3.9 Legado intencional — não remover
| Item | Motivo |
|---|---|
| `/gestao-aprovacoes-diarias` → `RedirectLegacy` | deep links externos |
| `/_legacy/gestao-aprovacoes-diarias` | fallback interno declarado |
| `/gestao-rh/desligamentos` → redirect com querystring | deep links externos |
| `/gestao-maquinas/planejamento-macro` → redirect | fase 1/2 declarada |
| `/engenharia/ordem-diaria-campo*` → redirect | deep links |
| `src/pages/PontoDispositivo.tsx` + Edge `registrar-ponto-dispositivo-obra` | **`FROZEN`** — frente pausada, preservada por decisão |
| `mv_relatorio_diarias_legacy_20260514` | snapshot antes de mudança |
| `funcionarios_operacional_select` com `OR` das funções legadas | *"Fase 3C/Etapa 2: modo aditivo… Etapa 3 removerá após observação"* |
| `bd_rbac_legacy_map` + `vw_rbac_legacy_map_drift` | instrumentação do cutover |
| `src/utils/rbacLegacyTelemetry.ts`, `rbacLegacyWriteAudit.ts` | coleta de dados para o cutover |

### 3.10 Tabelas de auditoria
`bd_auditoria_log` · `bd_auditoria_log_archive` · `bd_security_audit_log` · `bd_permission_audit_logs` · `bd_permission_change_audit_logs` · `bd_backend_exec_auditoria` · `bd_storage_auditoria` · `bd_ativos_auditoria` · `bd_os_auditoria` · `bd_logistica_auditoria` · `bd_auditoria_leitura_funcionario_sensivel` · `bd_os_leituras_sensiveis` · `bd_auditoria_biometria` · `bd_ponto_audit_log`
→ **Nunca apagar registros.** `bd_permission_audit_logs` é a base de decisão do cutover de RBAC.

---

## 🔵 NÍVEL 4 — Requer verificação antes de qualquer mudança

| Item | Verificar |
|---|---|
| Buckets públicos (`funcionarios`, `apontamentos`, `tickets`, `sso-checklists`, `avatars`, `inspecao-fotos`, `veiculos`) | Tornar privado quebra URLs públicas já distribuídas (links em relatórios, PDFs, e-mails) |
| `bd_configuracoes_sistema` | Contém chaves de configuração runtime (`modo_engenharia_licitacoes` é lida por `pncp-sync`) |
| Jobs `pg_cron` | Não estão versionados; alterar sem consultar `cron.job` quebra rotinas |
| `mv_relatorio_diarias` | Refresh pode ser caro; medir antes de mudar a política |
| `bd_permissions.rota` | Alimenta `permissionRoutes` no `usePermission` |
| Índice vetorial de `bd_funcionarios_biometria_facial` | Sem ele, o totem degrada com o crescimento da base |
| `bd_atestados_nonces_utilizados` | Limpeza indevida permite replay de submissões |
| `device_session_token` / `device_session_expires_at` em `bd_ponto_dispositivos` | Invalidar sessões derruba totens em campo |

---

## Regra final

> **Qualquer item desta lista exige o protocolo completo de 13 etapas antes de qualquer alteração,
> incluindo o levantamento de volume de dados, o SQL de rollback e a autorização explícita.**
>
> Em caso de dúvida sobre se algo pertence a esta lista: **considere que pertence e pergunte.**
