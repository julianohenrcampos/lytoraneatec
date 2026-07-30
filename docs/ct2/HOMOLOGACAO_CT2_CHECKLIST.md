# Homologação CT-2 — checklist de tela (executar no ambiente real)

O ambiente automatizado não consegue autenticar neste projeto (Supabase externo,
sem sessão gerenciada). Os itens abaixo precisam ser confirmados por um usuário
com permissão `gestao_maquinas_central_transporte_view` + action `editar`.

Marque o resultado (OK / NOK) e anote o ativo usado.

| # | Passo | Resultado esperado | OK/NOK |
|---|---|---|---|
| 1 | Abrir Central do Transporte e localizar um ativo sem disponibilidade operacional (badge "SEM STATUS") | O ativo APARECE na lista (não é filtrado) | |
| 2 | Abrir a análise operacional desse ativo | Exibe bloqueio explicando que não há disponibilidade confirmada | |
| 3 | Tentar atender internamente | Ação indisponível/bloqueada; nenhuma mensagem com SQL cru | |
| 4 | Clicar em "Regularizar disponibilidade" | Modal abre com identificação do ativo e aviso de que a situação cadastral não é alterada | |
| 5 | Salvar com status "Disponível" | Toast de sucesso; a análise se atualiza SEM recarregar a página | |
| 6 | Repetir o atendimento interno | Agora liberado (match exato) ou pedindo justificativa (match parcial por unidade ausente) | |
| 7 | Conferir a listagem Veículos e Equipamentos | Duas colunas distintas: "Situação cadastral" e "Disponibilidade operacional", com valores coerentes com o passo 5 | |
| 8 | Editar capacidade/unidade do ativo e voltar à Central | O resultado de compatibilidade reflete a mudança sem recarregar | |
| 9 | Conferir o cadastro do ativo | A situação cadastral permanece inalterada após a regularização | |
| 10 | Usuário sem action `editar` | Botão de regularizar ausente ou operação recusada com mensagem de permissão | |

## Verificações já realizadas fora da tela

- Contrato fail-closed: `fn_ct_avaliar_disponibilidade` retorna `ok: false` com
  status `SEM_REGISTRO` quando não há linha operacional (definição viva conferida).
- Travas de gravação: em `fn_ct_atendimento_atribuir` e `fn_ct_atendimento_substituir`
  o bloqueio `CT2_DISPONIBILIDADE_SEM_REGISTRO` ocorre ANTES de qualquer escrita.
- `fn_ct_disponibilidade_upsert` valida permissão e escopo antes de gravar.
- Dados vivos: 182 linhas de disponibilidade (181 ALOCADO, 1 DISPONIVEL); nenhum
  ativo em MANUTENCAO/INDISPONIVEL hoje — o cenário 3 do contrato só pode ser
  confirmado em tela após uma regularização com esses status.
- Não foi possível EXECUTAR as funções pelo executor de consultas (somente leitura,
  sem EXECUTE nas funções CT-2): a avaliação por dados reais foi feita replicando
  a mesma lógica de desempate e decisão em SQL de leitura.
