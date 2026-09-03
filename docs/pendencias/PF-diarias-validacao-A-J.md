# Pendência operacional — Validar permission-first na primeira solicitação real de Diárias

**Origem:** encerramento técnico PF-1 (backend permission-first) + PF-2 (Central de Aprovações consumindo `fn_diaria_capacidades_aprovacao`).

**Motivo da pendência:** no momento do encerramento não existiam solicitações reais em `aguardando_aprovacao_gerente_adm`, `aguardando_aprovacao_diretor_operacional` ou `aguardando_aprovacao_diretor_adm` para validar os cenários A–J em produção. Nada foi seedado artificialmente.

**Escopo:** validar contra a **primeira** solicitação real que entrar em `aguardando_aprovacao_*` após esta data. Não bloqueia o desenvolvimento das próximas funcionalidades da Central.

**Não fazer:** criar fixture permanente, alterar registros de `documentos_gerados`, reabrir migration PF-1, executar Runbook 2A-2V.

## Checklist A–J

- [ ] **A.** Item aparece na Central de Aprovações.
- [ ] **B.** Usuário com a permissão da primeira etapa consegue decidir (aprovar/reprovar).
- [ ] **C.** Usuário sem a permissão da primeira etapa **não** consegue decidir (botões desabilitados, gate `user_has_permission_action` no backend nega).
- [ ] **D.** Aprovação exige assinatura digital (bloqueio quando `assinatura_url` ausente e etapa requer assinatura).
- [ ] **E.** Reprovação segue a RPC efetiva (`fn_diaria_reprovar_*` ou `rejeitar_etapa_dinamica`), com motivo persistido.
- [ ] **F.** Transição libera a etapa seguinte (`status` avança para o próximo `aguardando_aprovacao_*`).
- [ ] **G.** Cada etapa exige sua **própria** permissão — quem aprovou a etapa 1 não decide a etapa 2 se não tiver a permissão dela.
- [ ] **H.** Override DENY (`bd_user_permission_overrides.efeito='deny'`) é respeitado quando existir caso real.
- [ ] **I.** Central usa `canApprove` / `canReject` vindos de `fn_diaria_capacidades_aprovacao` (não role-based).
- [ ] **J.** Página legada (`/diarias/gestao-aprovacoes`) permanece funcional para os fluxos que ainda dependem dela.

**Preservação obrigatória:** histórico (`bd_diaria_auditoria`), assinaturas (`bd_assinaturas`) e documentos (`documentos_gerados`) intactos após cada decisão.

## Status

- **PF-1 (backend):** aplicada.
- **PF-2 (frontend):** aplicada.
- **Validação A–J:** PENDENTE — aguardando primeira solicitação real.

## Referências

- Migration: `2026_07_13_pf1_diarias_permission_first.sql`
- Provider: `src/services/central-aprovacoes/diariasProvider.ts`
- Hook: `src/hooks/diarias/useGestaoAprovacoesDiarias.ts` (flag `disableRoleAutoFilter`)
- UI: `src/pages/central-aprovacoes/CentralAprovacoes.tsx`, `src/components/central-aprovacoes/CentralDetalhePanel.tsx`
- RPC canônica: `public.fn_diaria_capacidades_aprovacao(uuid[])`
