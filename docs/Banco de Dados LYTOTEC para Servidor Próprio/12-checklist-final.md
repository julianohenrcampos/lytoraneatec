# 12 — Checklist Final de Migração

Sequência sugerida para o cutover Supabase → servidor próprio. Cada item deve ser checado em ambiente de homologação **antes** de ser executado em produção.

## Fase 0 — Pré-migração (T-90 dias)

- [ ] Provisionar hardware (servidor primário + standby + storage MinIO + Vault).
- [ ] Instalar Ubuntu 24.04 LTS / Rocky 9 com hardening (CIS Benchmark).
- [ ] Instalar PostgreSQL **17.6** (mesma versão do Supabase atual).
- [ ] Instalar extensões: `plpgsql`, `pgcrypto`, `uuid-ossp`, `unaccent`, `pg_stat_statements`, `pg_cron`, `pg_net`, `vector` + adicionar `pgaudit`, `pg_partman`, `pg_repack`.
- [ ] Configurar `postgresql.conf` (memória, WAL, checkpoint, autovacuum) e `pg_hba.conf` (TLS obrigatório).
- [ ] Provisionar MinIO em cluster (mínimo 4 nós, erasure coding).
- [ ] Provisionar HashiCorp Vault (substituto do Supabase Vault).
- [ ] Instalar GoTrue self-hosted (substituto Supabase Auth).
- [ ] Configurar Deno Deploy self-hosted ou container Deno para Edge Functions.
- [ ] Configurar `pgBackRest` + repositório de backup remoto.
- [ ] Configurar observabilidade (Prometheus + Grafana + Loki + pgwatch2).

## Fase 1 — Hardening pré-migração (T-60 dias)

- [ ] **R10**: Reauditar todos os perfis com `acesso_global=true` — somente SuperAdms.
- [ ] **R4**: Descomissionar fallback legado RBAC: `VITE_RBAC_LEGACY_FALLBACK_ENABLED=false` em produção (release B2).
- [ ] **R4**: Resolver hardcode `gestao_abastecimento_view` no `guardian-web-proxy`.
- [ ] **R4**: Remover usos restantes de `profiles.funcoes`, `bd_funcoes_permissao`, `bd_permissoes`.
- [ ] **R4**: Avaliar remoção de `check_is_super_admin()` / `check_is_super_admin_hybrid()`.
- [ ] Revisar policies permissivas em `bd_funcionarios`, `bd_assinaturas`, `bd_desligamentos`, `bd_arquivo_morto`.
- [ ] Habilitar `pgaudit` (READ class) em tabelas críticas (PII, financeiro, médico).
- [ ] Particionar `bd_auditoria_log` por mês via `pg_partman`.
- [ ] Estender retenção de auditoria para 5 anos (alterar `fn_arquivar_auditoria_log`).
- [ ] Versionar schema atual em Git (`pg_dump --schema-only`).
- [ ] Versionar matriz role × permission × ação como seed.

## Fase 2 — Dry-run em homologação (T-30 dias)

- [ ] Restore lógico completo do Supabase em ambiente HML.
- [ ] Validar 167 tabelas + 458 policies + 297 funções SECURITY DEFINER.
- [ ] Validar 63 views + 2 MVs (refresh manual).
- [ ] Validar 3 cron jobs (`pg_cron`).
- [ ] Validar 26 Edge Functions (rodar suite de testes Deno).
- [ ] Sync Storage completo via `rclone sync` para MinIO HML.
- [ ] Smoke test E2E nos módulos críticos: RH, Diárias, Ponto, SSO, Logística, Licitações.
- [ ] Teste de carga (k6/JMeter) com 2× volume atual.
- [ ] Drill de restore PITR.
- [ ] Validar GoTrue self-hosted com login dos 10 perfis principais.

## Fase 3 — Janela de cutover (D-Day)

- [ ] T-2h: Comunicar usuários (banner + e-mail).
- [ ] T-1h: Ativar modo somente-leitura no Supabase.
- [ ] T-0:00: `pg_dump --format=custom` da produção Supabase.
- [ ] T+0:30: Sync incremental final de Storage (`mc mirror --watch` complementa).
- [ ] T+1:00: `pg_restore` no servidor próprio.
- [ ] T+2:00: Validar contagens (sample por tabela crítica).
- [ ] T+2:30: Apontar DNS / Load Balancer para novo backend.
- [ ] T+3:00: Smoke test em produção (3 usuários piloto).
- [ ] T+4:00: Liberar para todos.
- [ ] T+24h: Validar backup completo do novo ambiente.

## Fase 4 — Pós-migração (D+1 a D+30)

- [ ] Manter Supabase em paralelo (read-only) por 30 dias como fallback.
- [ ] Monitorar `pg_stat_statements`, `pgwatch2`, logs MinIO.
- [ ] Validar todos os cron jobs executando no novo ambiente.
- [ ] Auditar `bd_permission_audit_logs` para detectar denies inesperados.
- [ ] Validar primeira execução mensal de `fn_arquivar_auditoria_log`.
- [ ] Validar primeira folha de pagamento completa.
- [ ] D+30: Decommission do Supabase após go/no-go formal.

## Critérios de go/no-go para decomissionamento

- 30 dias sem incidentes P1/P2.
- Backups validados (3 drills bem sucedidos).
- LGPD: relatório de acesso a dados sensíveis revisado e arquivado.
- Auditoria interna validou trilha completa de mutações.
- Treinamento DBA concluído (mínimo 2 DBAs habilitados).

## Documentos vivos a atualizar continuamente

- `01-visao-geral.md` — atualizar contagens.
- `02-inventario-tabelas.md` — atualizar a cada migration.
- `06-rls-seguranca.md` — atualizar a cada nova policy.
- `10-edge-functions.md` — atualizar a cada nova/alterada edge.
- `12-checklist-final.md` — versionar com data e responsável de cada item marcado.
