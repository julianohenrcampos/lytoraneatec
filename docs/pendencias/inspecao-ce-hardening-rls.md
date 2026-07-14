# Pendência de segurança — Hardening RLS `bd_registro_apontamento_inspecao`

Registrada em: 2026-07-13
Origem: Fase 0 — Apontamento C&E + Inspeção (RPCs transacionais)

## Estado atual (após Fase 0)

- Tabela: `public.bd_registro_apontamento_inspecao`.
- Policy única em vigor: `FOR ALL USING (true) TO authenticated`.
- Grants DML: `SELECT, INSERT, UPDATE, DELETE` para `authenticated`.
- Escrita **oficial** do frontend: exclusivamente via
  `public.fn_salvar_apontamento_ce_com_inspecao` e
  `public.fn_excluir_apontamento_ce_com_inspecao` (`SECURITY DEFINER`,
  `search_path = pg_catalog, public`, `EXECUTE` apenas a `authenticated`).
- Cabeçalho `bd_registro_apontamento_cam_equipa` já possui policies granulares
  (INSERT/UPDATE/DELETE) baseadas em `fn_logistica_*`, replicadas dentro da RPC.

## Risco

A policy permissiva mantém a possibilidade **técnica** de qualquer usuário
autenticado com JWT válido escrever diretamente em
`bd_registro_apontamento_inspecao` (bypassing a validação de checklist,
`inspecao_aprovada` derivada e vínculo autorizado com o cabeçalho).
A Fase 0 **não afirma** que a RLS foi corrigida — apenas centraliza o
caminho oficial do produto.

## Plano proposto (Fase futura)

1. Substituir a policy `FOR ALL USING(true)` por quatro policies distintas
   (`SELECT`, `INSERT`, `UPDATE`, `DELETE`), todas atadas ao cabeçalho via
   `public.fn_logistica_can_access_apontamento_cam(apontamento_caminhao_equipamento_id)`.
2. Avaliar `REVOKE INSERT, UPDATE, DELETE ON public.bd_registro_apontamento_inspecao FROM authenticated`,
   mantendo apenas `SELECT` direto e obrigando escritas via RPC.
3. Auditar callers (relatórios, exportações, importações históricas) antes de
   revogar DML.
4. Adicionar teste de regressão que tente `INSERT` direto com JWT válido e
   espere `42501` após o hardening.

## Fora do escopo desta pendência

- Alteração de grants ou policies da tabela `bd_registro_apontamento_cam_equipa`.
- Alteração das funções `fn_logistica_*`.
- Introdução de GPS, turno, local/frente, checklist dinâmico ou mapa
  operacional (planejados em fases posteriores).
