# Banco de Dados LYTOTEC para Servidor Próprio

Documentação técnica completa do banco de dados atual do ERP LYTOTEC (hoje hospedado em Supabase / PostgreSQL 17) preparada para servir de base à futura migração para servidor próprio físico da empresa.

> **Premissa fundamental do projeto:** antes de propor qualquer nova tabela, coluna, bucket, função, trigger, RPC ou Edge Function, é OBRIGATÓRIO consultar este inventário e reaproveitar a estrutura existente. Nenhuma duplicação será aceita.

## Snapshot da auditoria

| Item | Quantidade |
|---|---|
| PostgreSQL | **17.6** (aarch64) |
| Tabelas em `public` | **167** |
| RLS habilitado | **167 / 167 (100%)** |
| Policies ativas | 458 |
| Triggers (não internos) | 214 |
| Funções/RPCs em `public` | 476 (297 `SECURITY DEFINER`) |
| Índices | 535 |
| Views | 63 |
| Materialized Views | 2 |
| Buckets de Storage | 17 (3 públicos / 14 privados) |
| Edge Functions | 26 |
| Cron jobs (pg_cron) | 3 |
| Extensões | plpgsql, pg_cron, pg_stat_statements, pgcrypto, supabase_vault, unaccent, uuid-ossp, vector, pg_net |

## Como navegar

| Arquivo | Conteúdo |
|---|---|
| `01-visao-geral.md` | Stack atual, módulos do ERP × grupos de tabelas, separação operacional/auditoria/config/Storage. |
| `02-inventario-tabelas.md` | Inventário completo das 167 tabelas, agrupadas por módulo. |
| `03-relacionamentos-erd.md` | ERD textual dos vínculos principais entre tabelas. |
| `04-auditoria.md` | Tabelas de auditoria + matriz Módulo × Cobertura × Lacuna. |
| `05-storage.md` | Buckets, paths, signed URLs, riscos LGPD e plano para storage próprio. |
| `06-rls-seguranca.md` | Modelo RLS atual, padrões de policy, pontos de hardening. |
| `07-funcoes-rpcs-triggers.md` | Catálogo de funções, RPCs e triggers por categoria. |
| `08-rbac-permissionamento.md` | Arquitetura RBAC (roles, permissions, overrides, SuperAdm). |
| `09-relatorios-views-materialized.md` | Views/MVs, refresh, jobs e impacto. |
| `10-edge-functions.md` | Edge Functions atuais e dependências. |
| `11-servidor-proprio-plano-migracao.md` | Plano técnico de migração para servidor próprio. |
| `12-checklist-final.md` | Checklist sequencial de cutover. |

## Escopo da auditoria

- Somente leitura (`SELECT`) sobre catálogos do PostgreSQL e `storage.buckets`.
- Nenhum dado pessoal sensível foi lido — apenas metadados estruturais.
- **Nenhuma alteração** foi feita em schema, RLS, triggers, funções, Storage, Edge Functions ou frontend.
- Snapshot temporal: a estrutura pode evoluir depois desta geração; reauditar antes do cutover.

## Última atualização

2026-06-26 — geração inicial após aprovação do plano de auditoria.
