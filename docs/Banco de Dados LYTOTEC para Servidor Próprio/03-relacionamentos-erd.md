# 03 — Relacionamentos / ERD Textual

> Notação: `A → B (campo)` significa que `A` referencia `B`. Cardinalidade indicada quando não trivial.

## 1. Identidade

```
auth.users (Supabase Auth)
  └─ 1:1 → public.profiles (id = auth.users.id)
              └─ N:1 → bd_funcionarios (funcionario_id, opcional)
```

- `profiles.id` é o ponto de entrada para toda autorização.
- `profiles.acesso_global` (bool) é o ÚNICO bypass tolerado, hardened em `user_has_permission_action` (exige role `SuperAdm` ativa + `acesso_global=true`).

## 2. RH

```
bd_funcionarios
  ├─ N:1 → bd_funcoes (funcao_id)
  ├─ N:1 → bd_centros_custo (centro_custo_id)
  ├─ N:1 → bd_empresas (empresa_id)
  ├─ N:1 → bd_departamentos (departamento_id)
  ├─ N:1 → bd_equipes (equipe_id)
  ├─ 1:1 → bd_funcionarios_sensivel (funcionario_id)
  ├─ 1:N → bd_funcionario_status_historico
  ├─ 1:N → bd_historico_funcional
  ├─ 1:N → bd_funcionarios_biometria_facial
  ├─ 1:N → bd_funcionario_classificacao_solicitacoes
  └─ 0:1 → bd_arquivo_morto (após desligamento)

bd_solicitacoes_classificacao (cabeçalho lote)
  └─ 1:N → bd_funcionario_classificacao_solicitacoes (solicitacao_lote_id)

bd_solicitacoes_desligamento → 1:N → bd_solicitacao_desligamento_itens → bd_funcionarios
bd_solicitacoes_transferencia → 1:N → bd_solicitacao_transferencia_itens → bd_funcionarios
bd_desligamentos → N:1 → bd_funcionarios (e edge process-desligamentos)
```

## 3. Estrutura organizacional

```
bd_empresas
  └─ 1:N → bd_centros_custo
              └─ 1:N → bd_funcionarios

bd_diretorias → 1:N → bd_departamentos → 1:N → bd_funcionarios
bd_usinas → produção; CCs operacionais referenciam via configuração
```

## 4. Diárias

```
bd_diaria_lotes_convocacao → 1:N → bd_diaria_lote_funcionarios (convocados-pre)
       │
       └─ origem → bd_diaria_solicitacoes
                          ├─ 1:N → bd_diaria_presencas (dia × funcionário × CC)
                          ├─ 1:N → bd_diaria_apontamentos
                          ├─ 1:N → bd_diaria_aprovacoes
                          ├─ 1:N → bd_diaria_aditivos
                          ├─ 0:N → bd_diaria_excecao_solicitacoes (extraordinária)
                          └─ N:1 → bd_diaria_status
bd_diaria_calendario_operacional   ── parâmetros de cálculo por CC
bd_feriados                        ── feriados oficiais
bd_diaria_logs / bd_diaria_relatorio_auditoria ── auditoria
```

Cardinalidade-chave: 1 solicitação `normal` cobre Seg-Dom × N funcionários × 1 CC. Solicitação `extraordinaria` (Fase aprovada) suporta intervalo livre (até 30 dias) sem trava semanal.

## 5. Ponto Eletrônico

```
bd_ponto_dispositivos
  ├─ N:M → bd_ponto_dispositivo_centros_custo → bd_centros_custo
  └─ 1:N → bd_ponto_dispositivo_sessoes

bd_funcionarios
  ├─ 1:N → bd_ponto_vinculos_operacionais → bd_centros_custo
  ├─ 1:N → bd_ponto_batidas (com lat/long, score antifraude, foto)
  └─ 1:N → bd_funcionarios_biometria_facial

bd_ponto_batidas
  ├─ 1:N → bd_ponto_ajustes
  ├─ 1:N → bd_ponto_match_log
  └─ origem para → bd_ponto_apontamento_integracao → bd_apontamento_equipe
                 → bd_ponto_diaria_integracao   → bd_diaria_presencas

bd_ponto_config (por CC), bd_ponto_audit_log (mutações), bd_ponto_relatorio_auditoria (geração de relatórios)
```

## 6. SSO — Exames

```
bd_locais_atendimento (clínicas) → 1:N → bd_agendamentos_exames
bd_funcionarios → 1:N → bd_agendamentos_exames
bd_agendamentos_exames → 1:N → bd_agendamentos_exames_anexos (Storage)
bd_vale_transporte ↔ bd_funcionarios ↔ bd_centros_custo
```

Trigger `fn_processar_promocao` dispara fluxo de promoção quando exame "Mudança de Risco" é finalizado.

## 7. RBAC

```
auth.users → bd_user_roles → bd_roles → bd_role_permissions → bd_permissions
                                       ↘ bd_role_permission_actions (ação granular)

auth.users → bd_user_permission_overrides → bd_permissions (DENY/ALLOW por usuário)

bd_permissoes_acoes (catálogo de ações por permission)
bd_permissions.rota → mapeamento usado em src/constants/routePermissions.ts

Legado (em descomissionamento):
profiles.funcoes (array text) → bd_funcoes_permissao → bd_permissoes
bd_rbac_legacy_map ── ponte legacy → novo
```

Função arbiter: `public.user_has_permission_action(user_id, codigo, acao)`. Bypass administrativo exige `profiles.acesso_global=true` **E** role `SuperAdm` ativa em `bd_user_roles` (hardening aplicado).

## 8. Logística / Aplicação

```
bd_programacao_entrega → 1:N → bd_lista_programacao_entrega
                                  └─ 1:1 → bd_registro_cargas → 1:N → bd_carga_status_historico
                                                              → 1:N → bd_registro_apontamento_aplicacao
                                                                          └─ 1:N → bd_registro_aplicacao_detalhes
bd_caminhoes_equipamentos → 1:N → bd_registro_apontamento_cam_equipa
bd_requisicoes → 1:N → bd_ruas_requisicao
```

## 9. Storage ↔ Banco

```
storage.buckets / storage.objects (gerenciados por Supabase)
  ├─ avatars                  → profiles.avatar_url (path)
  ├─ funcionarios             → bd_funcionarios.foto_url, bd_funcionarios_sensivel.*_url
  ├─ biometria-facial         → bd_funcionarios_biometria_facial.embedding_path
  ├─ ponto-fotos              → bd_ponto_batidas.foto_url
  ├─ assinaturas / assinaturas-funcionarios → bd_assinaturas.png_path, bd_assinaturas_usuarios.*
  ├─ exames_agendamentos      → bd_agendamentos_exames_anexos.arquivo_path
  ├─ sso-desvios              → bd_registro_desvios_fotos.foto_url
  ├─ sso-checklists           → bd_sso_checklists.* (anexos)
  ├─ sso-ver-agir             → bd_sso_ver_agir.* (anexos)
  ├─ inspecao-fotos           → bd_registro_apontamento_inspecao.fotos[]
  ├─ apontamentos             → bd_registro_apontamento_aplicacao.* (evidências)
  ├─ os_photos                → bd_ordens_servico.* (anexos)
  ├─ veiculos                 → bd_caminhoes_equipamentos.foto_url (público)
  ├─ empresas-logos           → bd_empresas.logo_url (público)
  ├─ documentos-rh            → bd_documentos_relacao + bd_documentos_fluxo
  └─ tickets                  → bd_chamados_os.anexos
```

Auditoria de leituras críticas: `bd_storage_auditoria` (trigger `fn_storage_audit_access`).

## 10. Fluxos de Aprovação (motor genérico)

```
bd_fluxos_aprovacao
  ├─ 1:N → bd_fluxo_etapas
  └─ 1:N → bd_fluxo_centro_custo (escopo de aplicabilidade)

bd_envios → 1:N → bd_aprovacoes_fluxo_exec → registra cada decisão
                 → bd_aprovacoes_excecao (quando regra é quebrada com justificativa)
bd_fluxo_historico → snapshot append-only
bd_documentos_fluxo / bd_documentos_relacao ── anexos do fluxo
```

## 11. Auditoria ↔ tabelas auditadas

```
bd_auditoria_log (genérica, append-only)         ◄── triggers fn_auditoria_log em tabelas críticas
bd_auditoria_log_archive                         ◄── cron arquivar-auditoria-diario (fn_arquivar_auditoria_log)
bd_permission_audit_logs                         ◄── usePermission hook + checkUserAction
bd_permission_change_audit_logs                  ◄── fn_audit_permission_change (mudanças catálogo)
bd_ponto_audit_log                               ◄── fn_ponto_audit_trigger
bd_auditoria_biometria                           ◄── triggers em bd_funcionarios_biometria_facial
bd_auditoria_leitura_funcionario_sensivel       ◄── fn_audit_sensitive_read (read on bd_funcionarios_sensivel)
bd_ativos_auditoria                              ◄── fn_ativos_auditar_mutacao
bd_os_auditoria                                  ◄── fn_auditar_os_mutacao
bd_logistica_auditoria                           ◄── fn_auditar_logistica_mutacao
bd_storage_auditoria                             ◄── fn_storage_audit_access
bd_backend_exec_auditoria                        ◄── fn_backend_audit_event (RPCs administrativas)
bd_diaria_relatorio_auditoria                    ◄── fn_auditar_relatorio_diarias
bd_ponto_relatorio_auditoria                     ◄── fn_auditar_relatorio_ponto
bd_bi_relatorios_auditoria                       ◄── fn_auditar_bi_relatorio
bd_security_audit_log                            ◄── fn_backend_audit_event + edges sensíveis
vw_auditoria_log_completo                        ── visão unificada (security_invoker=true)
```

## 12. Integrações externas

```
PNCP (gov.br)            → edge pncp-sync → bd_pncp_todas_licitacoes → bd_pncp_contratacoes
Site Lytorânea           → edge sync-subcategorias-site / onboard-fornecedor
Mapbox geocoding         → edge geocode-proxy → bd_cache_enderecos / bd_geocoding_falhas
Alterdata (folha)        → bd_importacao_alterdata
SMTP/Notif               → bd_notificacoes_usuarios + bd_log_comunicacao
```
