# 13 — FLUXOS CRÍTICOS (USUÁRIO → EFEITOS COLATERAIS)

> Auditoria READ-ONLY. Fluxos reconstruídos a partir do código real (imports, chamadas `.rpc()`/`.from()`, policies e triggers).
> Etapas marcadas `[VERIFICAR NO BANCO]` não puderam ser confirmadas sem acesso ao banco.

---

## 0. Fluxo transversal — Autenticação e carga de permissões

```
USUÁRIO abre qualquer rota protegida
   ↓
COMPONENTE      App.tsx → <Secure permission="x">
   ↓
GUARD 1         SimpleAuthGuard → useAuth()
                   └── supabase.auth.getSession()          [Supabase Auth]
   ↓
GUARD 2         SimplePermissionGuard → usePermission()
   ↓
HOOK            usePermission.loadPermissions()  (cache de módulo 60 s)
                   A. supabase.auth.getSession() → app_metadata.funcoes / acesso_global
                   B. localStorage['user_offline_context']  (24 h, NÃO assinado)
                   C. SELECT profiles(id, funcoes, acesso_global)   [timeout 3 s]
                   D. SELECT bd_user_roles → bd_roles
                      SELECT bd_role_permission_actions → bd_permissions
                      SELECT bd_user_permission_overrides
                   D3/D4. fallbacks legados (bd_role_permissions, bd_funcoes_permissao)
   ↓
RLS             policies de bd_user_roles / bd_roles / bd_permissions
                   (predicados fn_can_read_permission_row, fn_can_view_permission_admin)
   ↓
GUARD 3         SecureRouteGuard → hasPermission / hasActionPermission
   ↓
EFEITOS COLATERAIS
   • updateUserOfflineContext() → grava localStorage (24 h)
   • emitRbacFallbackEvent()    → INSERT bd_permission_audit_logs (fire-and-forget)
   • logLegacyUsage()           → telemetria de uso legado
```

**Pontos de atenção:** 4 caminhos podem produzir `permissions = ['*']` sem consultar o RBAC (A, B, C, E2). Ver `06-MAPA-RBAC.md` §6.1.

---

## 1. Solicitação de Diária (fluxo financeiro — o mais sensível do ERP)

```
USUÁRIO (Engenheiro/Encarregado)
   ↓  /requisicoes/diarias/solicitacoes
COMPONENTE   DiariasSolicitacoes → components/diarias/*
   ↓
HOOK         useSolicitacoesDiaria  (React Query: ~10 useQuery + ~6 useMutation)
             useDiariasDataScope · useFuncionarioElegibilidade · useFeriados
   ↓
SERVICE      services/diarias/solicitacoesService.ts (1.000+ LOC)
   ├── rpc fn_is_super_admin              (3 chamadas — decide escopo de leitura)
   ├── rpc fn_diaria_can_create           (gate de criação)
   ├── rpc generate_numero_solicitacao    (numeração sequencial)
   ├── rpc verificar_duplicidade_solicitacao
   └── from bd_diaria_solicitacoes / bd_diaria_aprovacoes / bd_diaria_apontamentos / bd_diaria_presencas
   ↓
RLS          bd_diaria_solicitacoes (7 policies) via
             fn_diaria_can_select_row · fn_diaria_can_update_row · fn_diaria_can_manage_row
             fn_diaria_scope_centros_custo · fn_diaria_has_global_access
   ↓
TABELAS      bd_diaria_solicitacoes (raiz, 17 FKs de entrada)
             └── bd_diaria_lotes_convocacao → bd_diaria_lote_funcionarios
             └── bd_diaria_presencas → bd_diaria_apontamentos
             └── bd_diaria_aditivos · bd_diaria_excecao_solicitacoes
             └── bd_diaria_aprovacoes · bd_diaria_status · bd_diaria_logs
   ↓
TRIGGERS     bd_diaria_solicitacoes: 8 triggers
             bd_diaria_presencas: 6 triggers
             • update_updated_at_column
             • _mark_mv_relatorio_diarias_dirty   → invalida mv_relatorio_diarias
             • cálculo de valor (calcular_valor_diaria / fn_calcular_diaria_aplicada / fn_resolver_base_diaria)
   ↓
EFEITOS COLATERAIS
   • mv_relatorio_diarias marcada suja → refresh_relatorio_diarias(p_force)
   • bd_diaria_logs (histórico)
   • bd_notificacoes + bd_notificacoes_usuarios via fn_notificacao_emitir_core
     (services/diarias/diariaNotificationService.ts)
   • bd_diaria_relatorio_auditoria em geração de relatório (fn_auditar_relatorio_diarias)
```

### Fluxo de aprovação (dois motores coexistindo)

```
enviar_lote_para_aprovacao
   ├── MOTOR DINÂMICO
   │     bd_fluxos_aprovacao → bd_fluxo_etapas → bd_fluxo_centro_custo
   │     iniciar_fluxo_dinamico → verificar_etapa_disponivel
   │     → aprovar_etapa_dinamica / rejeitar_etapa_dinamica
   │     → liberar_proxima_etapa_dinamica → bd_aprovacoes_fluxo_exec + bd_fluxo_historico
   │     fn_motor_aprovacao_corporativo_disponivel decide se este motor está ativo
   │
   └── MOTOR HARDCODED POR CARGO
         aprovar_gerente_adm · aprovar_diretor_adm · aprovar_diretor_operacional
         reprovar_gerente_adm · reprovar_diretor_adm · reprovar_diretor_operacional
         _map_tipo_aprovador_to_role · _map_tipo_aprovador_to_status
```
→ Ver duplicidade em `16-LEGADO-DUPLICIDADES.md`.

### Segregação de acesso a valores
`fn_can_access_diarias_operacional` · `_gerencial` · `_financeiro`
Views: `vw_diarias_operacional_campo` / `vw_diarias_aprovacao_gerencial` / `vw_diarias_financeiro_dp`
Frontend: `src/services/diarias/secureRelatorioAccess.ts`

---

## 2. Registro de Ponto (PWA pessoal)

```
USUÁRIO no celular  →  /ponto  (PontoDireto.tsx)
   ↓
COMPONENTE   PontoDireto → captura GPS + foto
   ↓
HOOK         hooks/ponto/* · lib/ponto/verificarCooldownBatida.ts
   ↓
SERVICE      supabase.functions.invoke('registrar-ponto')
   ↓
EDGE         registrar-ponto (609 LOC, verify_jwt=false, faz getUser() próprio)
   ├── SELECT profiles                       (identidade)
   ├── SELECT bd_funcionarios                (vínculo)
   ├── SELECT bd_ponto_vinculos_operacionais (CC permitido: fixo/temporario/mobilizado/compartilhado)
   ├── SELECT bd_centros_custo               (latitude, longitude, raio_ponto_metros → cerca geográfica)
   ├── _shared/ponto-validators.ts           (_validar_gps, cooldown, sequência de batida)
   └── INSERT bd_ponto_batidas               (service_role)
   ↓
TRIGGERS     fn_ponto_audit_trigger → bd_ponto_audit_log
   ↓
STORAGE      bucket privado ponto-fotos
   ↓
EFEITOS COLATERAIS
   • bd_ponto_match_log (quando há biometria)
   • integração Ponto→Diárias:
       fn_ponto_diaria_integrar_batida / _lote  →  bd_ponto_diaria_integracao
       modo SHADOW: Edge ponto-diaria-shadow → vw_ponto_diaria_shadow
                    (roda em paralelo SEM efeito, auditável em /requisicoes/diarias/auditoria-ponto-shadow)
   • bd_ponto_apontamento_integracao
```

### Variante Totem / Dispositivo de obra

```
PontoTotemLogin → Edge login-dispositivo-totem  (codigo + senha bcrypt)
                    └── bd_ponto_dispositivos.senha_hash
                    └── emite device_session_token (+ expires_at)
   ↓  header x-device-secret
PontoTotem  →  face-api.js no browser (models em /public/models) → descriptor de 128 floats
   ↓
Edge identificar-funcionario-por-face
   ├── valida dispositivo + sessão + expiração
   ├── resolve config por CC (bd_ponto_dispositivos.centro_custo_id → bd_ponto_dispositivo_centros_custo → defaults)
   ├── rpc identificar_funcionario_por_descriptor (v1/v2) — pgvector sobre bd_funcionarios_biometria_facial
   └── INSERT bd_ponto_match_log
   ↓ (ambiguidade)
Edge confirmar-match-totem  →  UPDATE bd_ponto_match_log.funcionario_confirmado_id
   ↓
Edge registrar-ponto-totem  →  INSERT bd_ponto_batidas
   ↓
EFEITOS: bd_auditoria_biometria (registrar_evento_auditoria_biometria), bd_ponto_audit_log
```

**Modo offline:** `useOfflineSync` acumula batidas → `sync-ponto-offline` (443 LOC) reprocessa em lote; `ponto_status_sync` ∈ {`sincronizado`, `pendente_sync`, `erro_sync`}.

---

## 3. Registro de Aplicação (CBUQ — cálculo de massa)

```
USUÁRIO (Apontador)  →  /registro-aplicacao
   ↓
COMPONENTE   RegistroAplicacao → components/registro-aplicacao/**
   ↓
HOOK         hooks/registro-aplicacao/*   (React Query)
   ↓
SERVICE      services/registro-aplicacao/*
   ├── rpc criar_aplicacao_por_rua
   ├── rpc fn_criar_registro_aplicacao_manual / _v2
   ├── rpc garantir_registro_aplicacao_principal
   ├── rpc calcular_massa_remanescente / _aplicacao / _em_tempo_real
   ├── rpc calcular_espessura_aplicacao · converter_kg_para_toneladas
   ├── rpc finalizar_carga_aplicacao / finalizar_carga_manual
   └── rpc sincronizar_hora_saida_aplicacao
   ↓
RLS          fn_logistica_can_access_* (9 predicados) + vw_registro_aplicacao_seguro
   ↓
TABELAS      bd_registro_apontamento_aplicacao (5 triggers)
             bd_registro_aplicacao_detalhes    (9 triggers ← maior concentração do ERP)
             bd_registro_aplicacao_ruas        (3 triggers)
             bd_registro_cargas                (4 triggers)
             bd_lista_programacao_entrega
   ↓
TRIGGERS     calculate_tonelada_real · calculate_aplicacao_area · calculate_rua_area/values
             trigger_atualizar_massa_remanescente_aplicacao_corrigido
             trigger_finalizar_hora_saida
             atualizar_registro_principal_aplicacao
             atualizar_status_entrega_automatico
   ↓
EFEITOS COLATERAIS
   • bd_carga_status_historico (histórico de status da carga)
   • bd_relatorio_aps_carimbos (carimbo de relatório)
   • bd_logistica_auditoria (fn_auditar_logistica_mutacao — 10 triggers)
   • Relatório APS / Relatório de Aplicação Diária
```

⚠️ **Este é o fluxo com maior lógica implícita no banco**: 9 triggers encadeados em `bd_registro_aplicacao_detalhes` fazem cálculos em cascata. Alterar uma coluna dessa tabela pode disparar recálculo de massa remanescente em toda a cadeia.

---

## 4. Central do Transporte — Mobilização/Viagem

```
USUÁRIO (Planejador)  →  /gestao-maquinas/central-transporte
                         permissão gestao_maquinas_central_transporte_view + action visualizar/criar
   ↓
COMPONENTE   CentralTransporte / CentralTransporteSolicitacao (flag CT3B) / MovimentacaoNova (CT-4)
   ↓
HOOK         hooks/central-transporte/*  ·  lib/central-transporte/*  ·  utils/central-transporte/*
   ↓
SERVICE      chamadas diretas a RPC (60 funções fn_ct_*)
   ├── fn_ct_cap / fn_ct_cap_admin              (capacidades — o frontend pergunta antes de renderizar)
   ├── fn_ct_avaliar_disponibilidade · fn_ct_avaliar_match
   ├── fn_ct_mobilizacao_salvar_rascunho → _programar → _estado → _nova_revisao / _cancelar
   ├── fn_ct_mob_validar_viagem · fn_ct_mob_command_hash · fn_ct_mob_content_hash  (idempotência)
   ├── fn_ct_viagem_iniciar → fn_ct_parada_registrar_chegada → fn_ct_viagem_registrar_chegada
   ├── fn_ct_checklist_saida_salvar
   ├── fn_ct_recebimento_finalizar
   └── fn_ct_registrar_assinatura
   ↓
RLS          fn_ct_pode_ver_viagem · fn_ct_pode_ver_puxada · fn_ct_ativo_edicao_permitida
   ↓
TABELAS      bd_ct_viagens (4 FKs de entrada) → bd_ct_viagem_paradas
             bd_ct_puxadas → bd_ct_puxada_caminhoes
             bd_ct_recebimentos → bd_ct_recebimento_itens
             bd_ct_checklists · bd_ct_comando_requests
             bd_disponibilidade_equipamentos · bd_localizacao_equipamentos
   ↓
TRIGGERS     fn_ct_touch_updated_at (4)
   ↓
GEO          geocode-proxy → Mapbox → bd_cache_enderecos
   ↓
EFEITOS COLATERAIS
   • fn_notificacao_ct_viagem_evento → bd_notificacoes
   • bd_ativos_auditoria (fn_ativos_auditar_mutacao — 7 triggers)
   • fn_reconciliar_estado_manutencao_ativo
   • bd_ct_comando_requests (fila de comandos com hash de idempotência)
```

**Ponto forte:** é o único módulo com **idempotência explícita** (`fn_ct_mob_command_hash`, `fn_ct_mob_content_hash`) e **capacidades consultáveis** (`fn_ct_cap`) — o frontend não adivinha o que pode fazer.

---

## 5. Chamado Interno → Ordem de Serviço

```
USUÁRIO  →  /chamados-internos/abrir
   ↓
RPC fn_chamado_interno_can_open_cc  (gate por CC)
RPC fn_chamado_interno_listar_ccs_abertura
   ↓
RPC fn_chamado_interno_abrir  →  INSERT bd_chamados_internos
   ↓
TRIGGERS + bd_chamado_interno_eventos (fn_ct_chi_evento / fn_chamado_interno_registrar_evento_operacional)
   ↓
REALTIME  useChamadosInternosRealtime (postgres_changes) → atualiza a fila em tempo real
   ↓
ATENDIMENTO
   fn_chamado_interno_can_attend → fn_chamado_interno_assumir
   → _responder / _solicitar_informacao / _adicionar_nota_interna
   → fn_chamado_interno_resolver → fn_chamado_interno_avaliar / bd_chamado_interno_avaliacoes
   ↓
INTEGRAÇÕES CRUZADAS
   • convert_chamado_para_os               → bd_ordens_servico
   • fn_chamado_interno_abrir_solic_equipamento → bd_solicitacoes_equipamento
   • fn_chamados_acoes_integradas_disponivel (decide quais ações aparecem)
   ↓
STORAGE   bucket chamados-internos-anexos, autorizado por
          fn_chamado_interno_can_read((storage.foldername(name))[1]::uuid)
   ↓
EFEITOS   bd_notificacoes · dashboards (fn_chamado_interno_dash_kpis / _series / _fila_risco)
```

---

## 6. Atestado Médico (fluxo PÚBLICO — sem sessão)

```
FUNCIONÁRIO (sem login)  →  /atestados-medicos   [rota SEM guard, por design]
   ↓
Edge atestado-validar-matricula   (verify_jwt=false, HMAC)
   ├── valida matrícula em bd_funcionarios
   └── fn_registrar_nonce_atestado → bd_atestados_nonces_utilizados  (anti-replay)
   ↓
Edge atestado-criar-upload-url    (HMAC) → signed upload URL para bucket atestados-medicos
   ↓
Upload direto do browser → Storage (signed URL)
   ↓
Edge atestado-submeter (508 LOC, HMAC + nonce)
   ├── fn_gerar_protocolo_atestado
   ├── INSERT bd_atestados_medicos
   └── Resend → EMAIL_DP ("ronald.ventura@lytoranea.com.br", hardcoded)
   ↓
PAINEL INTERNO  /sso/atestados  (saude_atestados_view)
   ├── fn_atestado_marcar_lido
   └── Edge atestado-arquivo-signed-url / atestado-arquivo-blob para ver o PDF
   ↓
EFEITOS  bd_envios · bd_log_comunicacao · atestado-notificar-reenvio
```

**Avaliação:** é o fluxo público mais bem protegido do sistema — HMAC + nonce + signed URLs + bucket privado + rota sem guard **por design consciente**.

---

## 7. Ordem do Dia (Engenharia)

```
PLANEJAMENTO   /engenharia/planejamento-macro
   ├── bd_planejamentos_obra → bd_planejamento_atividades → bd_planejamento_recursos
   ├── fn_designar_equipe_atividade → bd_planejamento_atividade_equipe
   ├── fn_detectar_conflito_designacao  (impede alocação dupla)
   └── fn_planejamento_tornar_vigente
   ↓
GERAÇÃO        fn_gerar_ordem_diaria_rascunho → bd_ordens_diarias_obra (status rascunho)
               fn_ordem_diaria_build_item_snapshot → bd_ordens_diarias_obra_itens
               fn_ordem_diaria_resolver_responsavel
   ↓
EMISSÃO        fn_emitir_ordem_diaria
               TRIGGER fn_ordens_diarias_guard_emitida  ← 🔒 bloqueia alteração após emissão
   ↓
CAMPO          /engenharia/ordem-do-dia  (OrdemDiariaCampoGuard)
               fn_has_ordem_diaria_campo_access · fn_can_view_ordem_diaria_item_campo
               fn_is_responsavel_ordem_diaria · fn_is_responsavel_item_ordem_diaria
   ↓
APONTAMENTO    fn_registrar_apontamento_item_ordem_diaria
               → bd_ordens_diarias_obra_apontamentos
               → vw_ordem_diaria_item_ultimo_apontamento
   ↓
EFEITOS        fn_atualizar_progresso_manual_atividade · fn_corrigir_quantitativo_atividade
               fn_apontar_manutencao_ativo_dia / _diario
               bd_log_operacional_datas
```

---

## 8. Notificações (transversal)

```
Qualquer RPC de domínio
   ↓
fn_notificacao_emitir_core
   ├── fn_notificacao_dest_profiles         (destinatários diretos)
   └── fn_notificacao_dest_centros_custo    (destinatários por escopo de CC)
   ↓
INSERT bd_notificacoes  +  bd_notificacoes_usuarios (N:N)
   ↓
FRONTEND  useNotifications → Realtime (postgres_changes)
          services/notifications/recipientsService.ts
```

⚠️ `bd_notificacoes_usuarios` tem policy `INSERT WITH CHECK (true)` para autenticados — qualquer usuário pode criar vínculos de notificação.

---

## 9. Auditoria (transversal)

Toda mutação relevante passa por um destes caminhos:

| Gatilho | Destino |
|---|---|
| `fn_auditar_logistica_mutacao` (10 triggers) | `bd_logistica_auditoria` |
| `fn_ativos_auditar_mutacao` (7) | `bd_ativos_auditoria` |
| `fn_auditar_os_mutacao` (7) | `bd_os_auditoria` |
| `fn_audit_permission_change` (6) | `bd_permission_change_audit_logs` |
| `fn_ponto_audit_trigger` (5) | `bd_ponto_audit_log` |
| `fn_auditoria_log` (2) | `bd_auditoria_log` |
| `fn_log_sensitive_read` / `fn_audit_sensitive_read` | `bd_auditoria_leitura_funcionario_sensivel`, `bd_os_leituras_sensiveis` |
| `fn_storage_audit_access` | `bd_storage_auditoria` |
| `auditBackendEvent()` (Edge) | `bd_backend_exec_auditoria` |
| `emitRbacFallbackEvent()` (frontend) | `bd_permission_audit_logs` |

Consolidação: `vw_auditoria_log_completo`, `vw_auditoria_sistema`, `get_auditoria_sistema`, `get_auditoria_alertas_24h`, página `/admin/auditoria`.
Arquivamento: `fn_arquivar_auditoria_log` → `bd_auditoria_log_archive`.

⚠️ 4 tabelas de auditoria (`bd_auditoria_correcao_*`, `bd_auditoria_volume_correcao`, `bd_auditoria_sync_equipe_funcionario`) têm policy `FOR ALL USING(true)` — **graváveis e apagáveis por qualquer autenticado**.

---

## 10. Resumo dos efeitos colaterais que um desenvolvedor precisa conhecer

| Ao mexer em… | Dispara… |
|---|---|
| `bd_diaria_*` | invalidação de `mv_relatorio_diarias`, recálculo de valor, notificação, log |
| `bd_registro_aplicacao_detalhes` | 9 triggers de cálculo em cascata (massa, área, espessura, status de entrega) |
| `bd_ordens_servico` / `bd_os_*` | recálculo de custo total (`fn_recalcula_total_os_from_row`), auditoria de OS |
| `bd_funcionarios` | 9 triggers: auditoria, geocoding (2 guardas), sincronização com `profiles` |
| `bd_centros_custo` | 4 triggers; afeta **40 tabelas** por FK e todo o escopo de RLS |
| `profiles` | 5 triggers; `sync_profile_funcao_sistema`, `compute_funcao_sistema` |
| `bd_ordens_diarias_obra` | `fn_ordens_diarias_guard_emitida` bloqueia após emissão |
| `bd_pops` | `fn_pop_bloquear_mutacao_destrutiva` |
| `bd_user_permission_overrides` | 3 triggers de auditoria de RBAC |
| Qualquer tabela de CT | `fn_ct_touch_updated_at` + reconciliação de estado de ativo |
