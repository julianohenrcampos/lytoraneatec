# CT-2 / M3 — artefato substituído

## Artefato substituído (NUNCA APLICADO)

| Item | Valor |
|---|---|
| Arquivo | `docs/ct2/20260728201000_ct2_m3_central_transporte_rbac_SUPERSEDED_NAO_APLICADA.sql` |
| Nome anterior | `20260728201000_ct2_m3_central_transporte_rbac.sql` |
| SHA-256 | `9feff1dfd3e5105f1f79e4756c65685a57a6ec53150cf0931b5d02d0813efce1` |
| Bytes | 11.257 |
| Linhas | 265 |
| Estado | **superseded — nunca aplicado em nenhum banco (vivo ou homologação)** |

Somente o nome do arquivo mudou. Conteúdo e SHA-256 permanecem idênticos.

## Artefato vigente

`docs/ct2/20260728202000_ct2_m3r3_central_transporte_rbac.sql` (M3 R3), que corrige:

- matriz definitiva de 10 roles / 22 pares role×action (Planejador e demais sem nenhuma action);
- `modulo = NULL` (paridade com as permissions irmãs reais);
- preflight com quatro cenários (A `create`, B `validate_only`, C/D `RAISE EXCEPTION`);
- `validate_only` sem nenhum DML, incluindo ausência de `SET LOCAL session_replication_role`;
- postflight por `EXCEPT` bidirecional para actions e grants, mais snapshot de overrides.

## Regra de ledger

O arquivo superseded é mantido apenas como histórico. Não deve ser executado,
promovido para `supabase/migrations` nem servir de base para novas revisões.
