# Fase 1B-4E — Decisão técnica sobre escrita em `convocados_pre`

**Status:** Encerrada documentalmente, sem alteração de código funcional.
**Data:** 2026-05-11
**Escopo:** Auditoria de escrita do jsonb `bd_diaria_solicitacoes.convocados_pre`.

---

## 1B-4E-B — Snapshot: criação nova de convocado

- **RPC:** `gerenciar_convocado_diaria` (modo create)
- **Origem:** `SolicitacaoFormModal.tsx` → `solicitacoesService.ts` → `adicionarFuncionarioConvocado`
- **Payload TS conhecido:**
  - `funcionario_id`
  - `funcao_id`
  - `nome_funcionario`
  - `nome_funcao`
  - `cpf`
  - `matricula`
  - `valor_diaria`
  - `valor_diaria_exclusiva`
  - `valor_refeicao`
- **Campos NÃO enviados pelo TS:**
  - `usar_diaria_exclusiva` — não consta na interface `FuncionarioConvocadoData`; é definido server-side pela RPC.
- **Formato final em `convocados_pre`:** array jsonb construído pela RPC; o client não monta o jsonb diretamente.

---

## 1B-4E-C — Snapshot: edição de convocado

- **RPCs:** `removerFuncionarioConvocado` + `adicionarFuncionarioConvocado` (diff aplicado pelo modal).
- **Sincronização:** `sincronizarConvocadosPreControlado` mantém ordem e idempotência de itens preservados.
- **Sem update direto:** nenhum `update({ convocados_pre: ... })` no client. Toda mutação passa pela RPC.

---

## 1B-4E-D — Snapshot: complemento `apontamento_dia`

- **RPC:** `gerenciar_convocado_diaria_no_dia`
- **Campos extras gerenciados server-side:**
  - `data` (data específica do complemento)
  - `origem_inclusao = 'apontamento_dia'`
- **Incompatibilidade arquitetural:** o adapter `gravarConvocadosPre` deduplica por `funcionario_id`, o que é incompatível com o caso `apontamento_dia` (N datas para o mesmo funcionário no mesmo array).

---

## 1B-4E-E — Decisão formal

> A escrita de `convocados_pre` permanece exclusivamente via RPCs server-side
> (`gerenciar_convocado_diaria` e `gerenciar_convocado_diaria_no_dia`). O writer
> `gravarConvocadosPre` permanece **sem caller** em produção, reservado para a
> Fase 2 (modelo relacional/lotes), pelas seguintes razões técnicas:
>
> 1. **Governança:** as RPCs são a camada semântica de validação, autorização e
>    auditoria. Bypass via update direto violaria o contrato de governança
>    estabelecido para diárias.
> 2. **Dedup incompatível:** `gravarConvocadosPre` deduplica por
>    `funcionario_id`, incompatível com `apontamento_dia`, que admite múltiplas
>    datas para o mesmo funcionário.
> 3. **Contrato canônico restrito:** campos como `usar_diaria_exclusiva`, `data`
>    e `origem_inclusao` não pertencem ao contrato canônico do adapter.
>    Empacotá-los manualmente em `extras` em cada caller aumentaria o risco de
>    divergência sem ganho arquitetural na Fase 1.

---

## Confirmação de encerramento da Fase 1B-4

| Microetapa | Alvo | Status |
|---|---|---|
| 1B-4A | hook de leitura | concluído |
| 1B-4B | `DiariasApontamentoCampo` (leitura) | concluído |
| 1B-4C | `ApontamentoDiariasModal` (leitura) | concluído |
| 1B-4D | `presencasService.editarHoraSaida` (fallback) | concluído |
| 1B-4E | escrita | **decidido NÃO implementar**, encerrada documentalmente |

**Arquivos funcionais alterados nesta fase 1B-4E:** nenhum.
**Arquivos de documentação/memória alterados:**
- `docs/diarias/FASE_1B_4E_DECISAO_ESCRITA.md` (novo)
- `mem://features/diarias/escrita-convocados-pre` (novo)
- `mem://index.md` (linha adicionada)

**Banco / RLS / RPC / trigger / schema / função SQL / fluxo de aprovação / fluxo de apontamento / PDF / relatório / payload das RPCs / formato gravado em `convocados_pre`:** inalterados.
