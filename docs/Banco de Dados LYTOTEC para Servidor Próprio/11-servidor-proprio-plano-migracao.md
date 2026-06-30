# 11 — Preparação para Banco em Servidor Próprio

## Premissas

- A LYTOTEC pretende hospedar futuramente o ERP em servidor físico próprio.
- A migração será **gradual** e deve preservar o modelo de dados existente.
- Não há intenção de reescrever o ERP: o banco e a lógica SQL permanecem; apenas o **runtime** muda.

## Versão recomendada do PostgreSQL

- **PostgreSQL 17.x** (mesma versão major do Supabase atual: 17.6).
  - Compatibilidade 100% com schema, funções e triggers existentes.
  - Suporte continuado até nov/2029.
- Sistema operacional: **Ubuntu Server 24.04 LTS** ou **Rocky Linux 9**.
- Storage: NVMe RAID 10 com replicação síncrona para um secundário (hot standby).

## Extensões necessárias (instalar todas)

Já em uso (auditadas):

| Extensão | Versão atual | Finalidade |
|---|---|---|
| `plpgsql` | 1.0 | Funções e triggers |
| `pgcrypto` | 1.3 | Hash, UUID, criptografia de coluna |
| `uuid-ossp` | 1.1 | Geração de UUID |
| `unaccent` | 1.1 | Busca normalizada |
| `pg_stat_statements` | 1.11 | Telemetria de queries |
| `pg_cron` | 1.6 | Jobs (3 ativos) |
| `pg_net` | 0.20.0 | HTTP a partir de SQL (chamada de edges via cron) |
| `vector` | 0.8.0 | Vetores (usado pontualmente) |
| `supabase_vault` | 0.3.1 | Cofre de segredos — **avaliar substituto on-prem** |

Recomendadas a adicionar:

| Extensão | Por quê |
|---|---|
| `pgaudit` | Auditoria de leitura (cobre lacuna atual) |
| `pg_repack` | Manutenção online sem lock |
| `pg_partman` | Particionamento de tabelas de auditoria |
| `pgbouncer` (externo) | Pool de conexões |

## Estratégia de roles e usuários de banco

```
Roles de aplicação (espelhar GoTrue):
  - anon              → role para requisições não autenticadas (idealmente bloquear no on-prem)
  - authenticated     → role efetiva do usuário logado
  - service_role      → bypass total (edges/jobs)

Roles administrativas adicionais:
  - app_admin         → DDL de aplicação (migrations)
  - app_readonly      → BI / relatórios
  - app_backup        → backup operacional
  - app_replication   → replicação física
  - app_monitor       → pg_stat_statements + pgwatch
```

Usuários humanos: nunca usar role compartilhada. Cada DBA tem usuário próprio com membership.

## Estratégia de backup

| Camada | Ferramenta | Frequência | RPO | RTO |
|---|---|---|---|---|
| Lógico | `pg_dump --format=custom` por schema | Diário 02:00 | 24h | 6h |
| Físico | `pg_basebackup` + WAL archiving (`pgBackRest`) | Contínuo (WAL) | < 5 min | 30 min |
| PITR | WAL retido 30 dias | — | < 5 min | 30 min |
| Off-site | Espelhamento criptografado (rsync + GPG) para datacenter secundário | Diário | 24h | 8h |
| Storage (MinIO) | `mc mirror` para bucket de backup | Diário | 24h | 4h |
| Backup de configuração | Git versionado (`postgresql.conf`, `pg_hba.conf`, scripts) | A cada mudança | — | — |

## Estratégia de restore

- **Restore lógico** (cirúrgico): `pg_restore --schema=public --table=...`.
- **Restore físico full**: `pgBackRest restore` em standby + promote.
- **PITR**: `pgBackRest --type=time --target='2026-XX-XX HH:MM:SS BRT' restore`.
- **Drill mensal obrigatório**: restaurar em ambiente isolado e validar checksum + sample queries.

## Estratégia de logs

- `log_statement = 'ddl'` (mínimo).
- `log_min_duration_statement = 1000` (queries > 1s).
- `pg_stat_statements` ativado.
- `pgaudit.log = 'role, ddl, write, read'` para tabelas sensíveis (PII, financeiro).
- Centralização: rsyslog → ELK ou Loki + Grafana.
- Retenção: 90 dias quente + 12 meses morno.

## Estratégia de auditoria

- Manter as **16+ tabelas de auditoria existentes** (capítulo 04).
- **Adicionar `pgaudit`** para cobrir SELECTs em tabelas que hoje não têm.
- **Particionar `bd_auditoria_log`** por mês com `pg_partman`.
- Estender retenção para **5 anos** (CLT/fiscal) — alterar `fn_arquivar_auditoria_log`.

## Estratégia de Storage fora do Supabase

- **MinIO** em cluster (mínimo 4 nós, erasure coding).
- Buckets idênticos aos atuais (17 buckets, mesma topologia).
- Migração: `rclone sync supabase: minio:` durante janela de cutover.
- Atualizar URLs assinadas para apontar para `storage.lytoranea.local`.
- Audit log nativo MinIO substitui `bd_storage_auditoria` na cobertura total.
- Criptografia em repouso obrigatória nos buckets sensíveis (chave em HashiCorp Vault).

## Estratégia para substituir Supabase Auth

Três caminhos avaliados:

| Opção | Esforço | Compatibilidade |
|---|---|---|
| **A — GoTrue self-hosted** | Baixo | 100% (mesma API) — recomendado para Fase 1 |
| **B — Keycloak / Authelia** | Alto | Requer adapter para emular `auth.uid()` no banco |
| **C — Auth próprio com `jwt.claims`** | Alto | Total controle, mas reescreve front e RLS |

**Recomendação**: Fase 1 = GoTrue self-hosted (preserva `auth.uid()` e RLS atual sem reescrita).

## Estratégia para substituir Edge Functions

| Opção | Esforço | Observação |
|---|---|---|
| **A — Deno Deploy self-hosted** (container) | Baixo | Reaproveita 100% do código Deno |
| **B — Portar para Node.js (Hono/Fastify)** | Médio | Requer reescrever, mas tira dependência de Deno |
| **C — Mover lógica para PG functions + worker (BullMQ/RabbitMQ)** | Alto | Reduz superfície mas perde flexibilidade |

**Recomendação**: A para Fase 1. Avaliar B na Fase 2 para tirar dependência runtime.

## Estratégia para manter RLS

- **Manter RLS** (modelo atual funciona bem com GoTrue self-hosted).
- Alternativa: mover autorização para backend (API Gateway + JWT decoder) — **não recomendado** porque obrigaria reescrever 458 policies e 297 funções SECURITY DEFINER.

## Riscos técnicos

| # | Risco | Severidade | Mitigação |
|---|---|---|---|
| R1 | Substituir GoTrue quebra `auth.uid()` em todas as RLS | **Crítica** | GoTrue self-hosted preserva contrato |
| R2 | Storage signed URL muda formato | Alta | Atualizar wrapper único de geração de URL |
| R3 | `pg_cron` + `pg_net` indisponíveis | Média | Habilitar extensões; ambas suportadas em PG 17 |
| R4 | Funções legadas (`bd_funcoes_permissao`, `bd_permissoes`, `check_is_super_admin_hybrid`) ainda em uso | Alta | Descomissionar **antes** do cutover |
| R5 | MV `mv_relatorio_diarias` exige refresh frequente | Média | Manter cron 10 min; avaliar refresh concurrent |
| R6 | Volume de policies (458) dificulta troubleshooting | Média | Versionar via `pg_dump --schema-only` em Git |
| R7 | Biometria/exames são dados especialmente protegidos | **Crítica LGPD** | Isolar fisicamente, criptografia em repouso, auditoria de leitura |
| R8 | Edge `process-desligamentos` tem efeitos colaterais grandes | Alta | Migrar com dry-run + feature flag |
| R9 | `bd_storage_auditoria` é parcial | Média | Substituir por MinIO audit log nativo |
| R10 | Bypass `acesso_global` por conta não-SuperAdm | **Crítica** | Hardening Fase 3 aplicado; reauditar antes do cutover |

## Riscos operacionais

- **Janela de cutover** estimada: 4–8 h (dump + restore + sync de Storage + smoke test).
- **Treinamento DBAs** internos: SQL + PostgreSQL + RLS + RBAC LYTOTEC + procedimentos de backup/restore.
- **Documentação viva**: manter este conjunto de docs versionado e auditado a cada release.
- **Plano de rollback**: manter Supabase ativo em paralelo por 30 dias (read-only) para fallback.
- **Conformidade LGPD**: revisar contratos e DPIA antes da migração de dados biométricos/médicos.

## Checklist de migração

Ver arquivo `12-checklist-final.md`.
