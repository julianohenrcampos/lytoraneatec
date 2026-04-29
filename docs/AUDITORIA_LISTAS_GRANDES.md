# Auditoria — Listas Grandes / `.select('*')` sem `.limit()`

> **Documento somente diagnóstico.** Nenhum código foi alterado.
> Gerado em 2026-04-28. Use como roteiro para futuras refatorações
> graduais (uma página por vez), seguindo o padrão já validado em
> `useFuncionariosBuscaAtivos` (busca server-side com paginação).

## Critério

Foram listadas chamadas `.select('*')` em `src/services/` e `src/pages/`
sem `.limit()` próximo. Algumas são legítimas (CRUD pontual após
`insert/update/upsert`, leituras de tabelas pequenas como configurações).
Marquei prioridade pelo risco real de carregar muitos registros.

## Alta prioridade — listas operacionais que podem crescer indefinidamente

| Arquivo | Linha | Tabela aproximada | Observação |
|---|---|---|---|
| `src/pages/ArquivoMorto.tsx` | 20 | `bd_arquivo_morto` | Lista cresce com o tempo; aplicar paginação server-side. |
| `src/services/empresaService.ts` | 7, 38 | `bd_empresas` | Carrega todas as empresas — filtrar por status/escopo. |
| `src/services/diarias/relatorioService.ts` | 61, 65, 69 | dados de diárias | Verificar se já existe filtro por período antes do `.select`. |
| `src/services/requisicaoService.ts` | 74, 393 | `bd_requisicoes` | Adotar paginação por status + range. |
| `src/services/ordemServicoService.ts` | 362, 374, 700 | `bd_ordens_servico` | Lista grande; paginação por status. |
| `src/services/apontamentoCaminhoesService.ts` | 158 | apontamentos | Adicionar `.limit()` ou filtro de período. |

## Média prioridade — pode crescer mas hoje é controlado

| Arquivo | Linha | Observação |
|---|---|---|
| `src/services/diarias/solicitacoesService.ts` | 855 | Provável re-leitura pós-mutation; revisar contexto. |
| `src/services/diarias/presencasService.ts` | 423 | Verificar se já há filtro por solicitação. |
| `src/services/diarias/fluxoAprovacaoService.ts` | 80, 91 | Idem. |
| `src/services/diarias/antiFraudeService.ts` | 223 | Validar escopo do anti-fraude. |
| `src/services/sso/ssoItemService.ts` | 9, 66 | Itens SSO por checklist; provavelmente OK. |
| `src/services/convertChamadoService.ts` | 54 | Pontual após mutation. |
| `src/services/alterdataImportService.ts` | 325, 413, 627, 737 | Importação batch — comportamento esperado. |

## Baixa prioridade — leituras de configuração / dropdowns pequenos

| Arquivo | Linha | Observação |
|---|---|---|
| `src/services/configService.ts` | 24 | Configurações globais, tabela pequena. |
| `src/services/fluxoExecucaoService.ts` | 54 | Configuração. |
| `src/services/valeTransporte/valeTransporteService.ts` | 27 | Por funcionário/mês. |
| `src/services/ssoAgendamentoExames/locaisAtendimentoService.ts` | 19, 29, 40 | Lista finita. |
| `src/services/ssoDesvios/ssoDesvioFotoService.ts` | 9 | Anexos por desvio. |
| `src/services/permissoes/unifiedPermissionsService.ts` | 135 | RBAC, lista finita. |
| `src/services/rbac/actionPermissionsCRUD.ts` | 30 | RBAC, lista finita. |

## Padrão recomendado para futuras refatorações

1. Criar hook tipo `useXxxBuscaPaginada({ search, page, pageSize, filters })`
   reaproveitando `react-query` + `range(from, to)`.
2. Mover filtro/busca para o servidor (`.ilike`, `.eq`, `.in`).
3. Manter o componente de tabela exatamente como está; trocar apenas o
   hook de origem dos dados.

## Não fazer agora

- Não alterar nenhum arquivo listado neste documento sem solicitação
  explícita.
- Não introduzir novos hooks/services antes de definir prioridade caso
  a caso com o time de produto.
