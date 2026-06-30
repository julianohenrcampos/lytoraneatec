# 10 — Edge Functions

## Inventário (26)

| Função | `verify_jwt` (config.toml) | Finalidade | Tabelas / Buckets / Segredos |
|---|---|---|---|
| `admin-confirm-email` | default true | Confirma e-mail manualmente para usuário admin | `auth.users` (service_role); segredo: `SUPABASE_SERVICE_ROLE_KEY` |
| `auto-finalizar-diarias` | `false` (cron 16h) | Finaliza solicitações de diárias pendentes do dia | `bd_diaria_solicitacoes`, `bd_diaria_presencas`, `bd_diaria_logs`; service_role |
| `cadastrar-biometria-facial` | `false` | Recebe upload de embedding facial | `bd_funcionarios_biometria_facial`, bucket `biometria-facial`, `bd_auditoria_biometria`; service_role |
| `confirmar-match-totem` | `false` | Confirma identidade após match facial no totem | `bd_ponto_match_log`, `bd_ponto_batidas`; service_role |
| `create-gestor` | `false` | Cria usuário gestor com role pré-definida | `auth.users`, `profiles`, `bd_user_roles` via `fn_assign_user_role_secure`; service_role |
| `definir-senha-dispositivo` | `false` | Define hash de senha do dispositivo de obra | `bd_ponto_dispositivos` (col `senha_hash`); service_role + segredo crypto |
| `delete-user` | `false` | Deleta usuário com cascade controlado | `auth.users`, `profiles`, `bd_user_roles`; service_role |
| `fix-empty-rbac-roles` | `false` | Migração / corretivo de RBAC | `bd_user_roles`, `bd_role_permissions`; service_role |
| `geocode-proxy` | default true | Proxy Mapbox para esconder token | `bd_cache_enderecos`, `bd_geocoding_falhas`; segredo: `MAPBOX_TOKEN` |
| `get-mapbox-public-token` | default true | Retorna token público (rotacionável) | segredo: `MAPBOX_PUBLIC_TOKEN` |
| `guardian-web-proxy` | default true | Proxy de chamadas BI / Guardian externo | RBAC fallback hardcoded `gestao_abastecimento_view` (pendência documentada); segredo: `GUARDIAN_API_KEY` |
| `heartbeat-dispositivo` | `false` | Heartbeat de dispositivo de obra | `bd_ponto_dispositivo_sessoes`; service_role |
| `identificar-funcionario-manual` | default true | Identificação manual quando biometria falha | `bd_funcionarios`, `bd_ponto_match_log`; service_role |
| `identificar-funcionario-por-face` | default true | Match facial server-side | `bd_funcionarios_biometria_facial`, `bd_ponto_match_log`; bucket `biometria-facial`; service_role |
| `login-dispositivo-totem` | `false` | Login do totem (par device_id + senha) | `bd_ponto_dispositivos`, `bd_ponto_dispositivo_sessoes`; service_role |
| `onboard-fornecedor` | `false` | Onboarding unificado (upsert por CNPJ) | `bd_empresas`, `bd_portfolio_empresas`, `bd_integracao_fornecedores_log`; segredo: `LYTOTEC_API_KEY` |
| `pncp-sync` | `false` | Sincroniza universo PNCP | `bd_pncp_todas_licitacoes`, `bd_pncp_contratacoes`, `bd_pncp_sync_log`, `bd_orgaos_publicos`, `bd_orgaos_alias`; service_role |
| `ponto-diaria-shadow` | `false` | Shadow mode da integração ponto → diária | `bd_ponto_diaria_integracao`, `vw_ponto_diaria_shadow`; service_role |
| `process-desligamentos` | `false` | Processa lote de desligamentos aprovados | `bd_solicitacoes_desligamento`, `bd_solicitacao_desligamento_itens`, `bd_desligamentos`, `bd_arquivo_morto`, `bd_funcionarios`; service_role; pode enviar e-mail |
| `registrar-ponto` | `false` | Registra batida via app | `bd_ponto_batidas`, `bd_ponto_config`, bucket `ponto-fotos`; service_role |
| `registrar-ponto-dispositivo-obra` | default true | Registra batida via dispositivo de obra | Análoga + `bd_ponto_dispositivo_sessoes` |
| `registrar-ponto-totem` | `false` | Registra batida no totem | Análoga + `bd_ponto_match_log` |
| `sync-ponto-offline` | `false` | Sincroniza lote PWA offline | `bd_ponto_batidas` (idempotente); service_role |
| `sync-subcategorias-site` | `false` | Sync com site Lytorânea | `bd_subcategorias_ativos`, `bd_categorias_ativos`; segredo: `LYTOTEC_API_KEY` |
| `vincular-ccs-dispositivo` | `false` | Vincula CCs ao dispositivo | `bd_ponto_dispositivo_centros_custo`; service_role |
| `_shared/` | n/a | Módulos compartilhados (security, calculoDiaria mirror, integração diária) | — |

## Padrões observados

- **Service role** usado server-side via `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')` — bypass de RLS controlado.
- **Validação de payload** via Zod (recomendado em `_shared/backend-security.ts`).
- **Try/catch** envolvendo loops em jobs longos.
- **Auditoria** via `fn_backend_audit_event` para eventos sensíveis.

## Riscos para servidor próprio

| Risco | Detalhe | Mitigação |
|---|---|---|
| Edge Functions rodam em runtime Deno gerenciado pelo Supabase | Não há equivalente direto on-prem | Migrar para **Deno Deploy self-hosted** OU portar para **Node.js (Fastify/Hono) em container** OU **PostgreSQL functions + worker em Bull/RabbitMQ** |
| `pg_cron` chama `net.http_post` para URL Supabase | Quebra no cutover | Atualizar URL para domínio interno + token rotacionado |
| Segredos hoje em Supabase Vault | Migrar para Vault on-prem (HashiCorp Vault, AWS Secrets Manager local, ou Doppler) |  |
| `verify_jwt=false` em 17 funções | Necessário para totens/webhooks/cron | Validar autorização via outros mecanismos (HMAC, mTLS, API key) |
| Edge `cadastrar-biometria-facial` + `identificar-funcionario-por-face` lidam com dado biométrico | LGPD art. 11 | Migrar primeiro com isolamento de rede; auditar logs |
| Edge `process-desligamentos` modifica vários módulos | Risco operacional alto | Migrar com dry-run + feature flag |
| Edge `pncp-sync` chama API externa gov.br | Dependência externa | Manter token + retry policy |
| Edge `guardian-web-proxy` tem fallback RBAC hardcoded | Documentado em `docs/RBAC_HARDCODES_PENDENTES.md` | Resolver antes da migração |

## Mapeamento Edge → Tabela / Bucket (resumido)

```
Edge                                   →  Tabelas (escrita)                               → Buckets
─────────────────────────────────────────────────────────────────────────────────────────────────────
auto-finalizar-diarias                 →  bd_diaria_solicitacoes, bd_diaria_logs           —
cadastrar-biometria-facial             →  bd_funcionarios_biometria_facial,                 biometria-facial
                                          bd_auditoria_biometria
identificar-funcionario-por-face       →  bd_ponto_match_log                                biometria-facial (leitura)
identificar-funcionario-manual         →  bd_ponto_match_log                                —
registrar-ponto / -totem / -obra       →  bd_ponto_batidas, bd_ponto_dispositivo_sessoes    ponto-fotos
sync-ponto-offline                     →  bd_ponto_batidas (upsert idempotente)             ponto-fotos
ponto-diaria-shadow                    →  bd_ponto_diaria_integracao                        —
heartbeat-dispositivo                  →  bd_ponto_dispositivo_sessoes                      —
login-dispositivo-totem                →  bd_ponto_dispositivo_sessoes                      —
definir-senha-dispositivo              →  bd_ponto_dispositivos                             —
vincular-ccs-dispositivo               →  bd_ponto_dispositivo_centros_custo                —
confirmar-match-totem                  →  bd_ponto_batidas, bd_ponto_match_log              —
admin-confirm-email / delete-user      →  auth.users, profiles                              —
create-gestor                          →  auth.users, profiles, bd_user_roles               —
fix-empty-rbac-roles                   →  bd_user_roles, bd_role_permissions                —
process-desligamentos                  →  bd_solicitacoes_desligamento*,                    documentos-rh (eventual)
                                          bd_desligamentos, bd_funcionarios,
                                          bd_arquivo_morto
onboard-fornecedor                     →  bd_empresas, bd_portfolio_empresas,               empresas-logos (eventual)
                                          bd_integracao_fornecedores_log
sync-subcategorias-site                →  bd_subcategorias_ativos, bd_categorias_ativos     —
pncp-sync                              →  bd_pncp_todas_licitacoes,                         —
                                          bd_pncp_contratacoes, bd_pncp_sync_log,
                                          bd_orgaos_publicos, bd_orgaos_alias
geocode-proxy                          →  bd_cache_enderecos, bd_geocoding_falhas           —
get-mapbox-public-token                →  —                                                  —
guardian-web-proxy                     →  (read-only proxy)                                  —
```
