# 17 — DEPENDÊNCIAS ENTRE MÓDULOS

> Auditoria READ-ONLY. Objetivo: identificar o que **quebra em outro lugar** quando se mexe em um módulo.

---

## 1. Camadas transversais — tocam TODOS os módulos

Qualquer alteração nestes pontos tem impacto global:

| Camada | Artefatos | Consumidores |
|---|---|---|
| **RBAC / Permissões** | `usePermission.ts`, `routePermissions.ts`, `bd_permissions`, `fn_has_permission`, `fn_has_action`, `fn_is_super_admin` | **116** importadores do hook; **378 + 219 + 80 + 67** chamadas dos predicados em policies |
| **Auth** | `useAuth.ts`, `SimpleAuthGuard`, `supabase/client.ts` | 19 importadores diretos; toda rota protegida |
| **Escopo por Centro de Custo** | `bd_centros_custo`, `useEscopoCentrosCusto`, `useEscopoOperacional`, `fn_*_scope_centros_custo`, `fn_*_can_access_centro_custo` | **40 tabelas** por FK; policies de praticamente todos os módulos |
| **Identidade** | `profiles`, `bd_funcionarios` | **47 + 50 FKs** de entrada |
| **Notificações** | `fn_notificacao_emitir_core`, `bd_notificacoes(_usuarios)`, `useNotifications` | Diárias, CT, Chamados, Solicitações, Aprovações |
| **Auditoria** | 13 tabelas + 10 funções de trigger | 106 tabelas com trigger |
| **Layout / Menu** | `MainLayout` (64 importadores), `AppSidebar`, `menuStructure.ts` | todas as páginas |
| **Storage** | `fn_storage_can_access/_can_upload`, 44 policies em `storage.objects` | RH, SSO, OS, POPs, Atestados, Ponto, CT, Veículos |
| **UI base** | `src/components/ui/` (shadcn) | todo o frontend |
| **Tipos gerados** | `src/integrations/supabase/types.ts` | tudo que fala com o Supabase |

---

## 2. Grafo de dependências entre módulos funcionais

```
                          ┌─────────────────────────────────┐
                          │  RBAC · AUTH · ESCOPO POR CC     │
                          │  (transversal — toca tudo)       │
                          └───────────────┬─────────────────┘
                                          │
   ┌──────────────────────────────────────┼──────────────────────────────────────┐
   │                                      │                                      │
┌──▼──────────────┐              ┌────────▼─────────┐                 ┌──────────▼────────┐
│  GESTÃO DE RH   │              │ VEÍCULOS/ATIVOS  │                 │  ENGENHARIA       │
│ bd_funcionarios │◄────────────►│ bd_caminhoes_    │◄───────────────►│ bd_planejamentos_ │
│ bd_centros_custo│              │  equipamentos    │                 │  obra             │
│ bd_equipes      │              │ bd_disponibilid. │                 │ bd_ordens_diarias │
│ bd_funcoes      │              │ bd_catalogo_*    │                 │  _obra            │
└──┬───┬───┬──────┘              └───┬────┬────┬────┘                 └────┬──────────────┘
   │   │   │                         │    │    │                           │
   │   │   │                         │    │    └──────────────┐            │
   │   │   │      ┌──────────────────┘    │                   │            │
   │   │   │      │                       │                   │            │
┌──▼───▼───▼──────▼───┐   ┌───────────────▼──────┐   ┌────────▼────────┐   │
│      DIÁRIAS        │   │ CENTRAL DO TRANSPORTE│   │ ORDENS DE       │   │
│ bd_diaria_*  (12)   │   │ bd_ct_* (8 tabelas)  │   │ SERVIÇO         │   │
│ mv_relatorio_diarias│   │ 60 RPCs fn_ct_*      │   │ bd_ordens_servico│  │
└──┬──────────────────┘   └───────┬──────────────┘   └────────▲────────┘   │
   │                              │                           │            │
   │  ┌───────────────────────────┘                           │            │
   │  │                                                       │            │
┌──▼──▼──────────┐   ┌────────────────────┐   ┌───────────────┴─────┐     │
│ PONTO          │   │ REQUISIÇÕES /      │   │ CHAMADOS INTERNOS   │     │
│ ELETRÔNICO     │   │ LOGÍSTICA (CBUQ)   │   │ bd_chamados_internos│◄────┘
│ bd_ponto_* (12)│   │ bd_requisicoes …   │   │ 35 RPCs             │
│ biometria      │   │ registro_aplicacao │   └──────┬──────────────┘
└────────────────┘   └────────────────────┘          │
                                                     ├──► SOLICITAÇÕES DE EQUIPAMENTO
                                                     └──► ORDENS DE SERVIÇO

┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  SSO         │  │  LICITAÇÕES  │  │  POPs        │  │ ADMINISTRAÇÃO│
│ (isolado,    │  │  (isolado,   │  │ (isolado,    │  │ (RBAC, fluxos│
│  usa RH+CC)  │  │   PNCP)      │  │  usa depto)  │  │  auditoria)  │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
```

---

## 3. Dependências fortes (alteração propaga)

### 3.1 `bd_centros_custo` → **40 tabelas + toda a RLS + cerca do ponto**
Alterar estrutura, coordenadas ou responsáveis de CC afeta:
- **RLS de praticamente todos os módulos** (`fn_*_scope_centros_custo`, `fn_*_can_access_centro_custo`)
- **Cerca geográfica do ponto eletrônico** (`latitude`, `longitude`, `raio_ponto_metros` lidos por `registrar-ponto`)
- **Escopo de aprovação de diárias** (`aprovador_diarias_id`)
- **Escopo de engenharia** (`engenheiro_responsavel_id`, `planejador_responsavel_id`)
- **Escopo administrativo** (`adm_obra_funcionario_id`, `adm_sede_funcionario_id`, `get_admsede_centros_custo`, `is_admsede_for_cc`)
- Dispositivos de ponto (`bd_ponto_dispositivo_centros_custo`)
- Fluxos de aprovação (`bd_fluxo_centro_custo`)
- Chamados internos (`fn_chamado_interno_can_open_cc`)

⚠️ **Armadilha:** `planejador_responsavel_id` aponta para `profiles`; os outros quatro apontam para `bd_funcionarios`.

### 3.2 `bd_funcionarios` → 50 FKs + 9 triggers + `profiles`
Alterar colunas afeta: Diárias (presenças, aditivos), Ponto (batidas, vínculos, biometria), Equipes (apontador/encarregado), OS (mecânico), CT (motorista, recebedor), SSO (atestados, exames, ver-e-agir), Desligamentos, Transferências, Ordem do Dia (responsável), Chamados (solicitante), Arquivo Morto, Histórico Funcional, Classificações.
Triggers: auditoria, geocoding (2 guardas), sincronização com `profiles`.

### 3.3 `profiles` → 47 FKs + RBAC + 5 triggers
As colunas `funcoes`, `funcao_sistema`, `funcao_permissao`, `acesso_global` são lidas por `fn_is_super_admin` (usado em **378 pontos**) e pelo `usePermission` (Camadas C, D1, D2, E2). **Alterar qualquer uma dessas 4 colunas altera a autorização de todo o sistema.**

### 3.4 `bd_diaria_solicitacoes` → 17 FKs + MV + notificações
Raiz do agregado de Diárias. Toda alteração invalida `mv_relatorio_diarias` (via `_mark_mv_relatorio_diarias_dirty`) e pode disparar notificações.

### 3.5 `bd_caminhoes_equipamentos` → 14 FKs + CT + OS + Logística
Ativos aparecem em: OS, CT (viagens, puxadas, mobilizações), disponibilidade, localização, movimentações, custos, importador, desmobilização, programação de entrega.

---

## 4. Integrações cruzadas entre módulos (RPCs que atravessam domínios)

| RPC | Origem → Destino |
|---|---|
| `convert_chamado_para_os` | Chamados Internos → Ordens de Serviço |
| `fn_chamado_interno_abrir_solic_equipamento` | Chamados Internos → Solicitações de Equipamento |
| `fn_chamados_acoes_integradas_disponivel` | Chamados Internos → decide ações cruzadas disponíveis |
| `integrar_ponto_com_diaria`, `fn_ponto_diaria_integrar_batida`, `fn_ponto_diaria_integrar_lote` | Ponto → Diárias |
| `fn_ponto_diaria_simular_batida` / `_lote` | Ponto → Diárias (modo shadow, sem efeito) |
| `fn_apontar_manutencao_ativo_dia`, `fn_apontar_manutencao_diario` | Ordem do Dia → Ativos |
| `fn_reconciliar_estado_manutencao_ativo` | CT/OS → Ativos |
| `fn_ct_avaliar_disponibilidade`, `fn_ct_avaliar_match` | CT → Ativos/Disponibilidade |
| `fn_desmob_aplicar_previsao`, `fn_desmobilizacao_*` | Solicitações → Ativos |
| `fn_transferencia_*` | RH → Centros de Custo |
| `fn_efetivar_classificacao` | Classificação → RH/Funcionários |
| `fn_atualizar_progresso_manual_atividade` | Ordem do Dia → Planejamento Macro |
| `fn_relatorio_aps_*` | Registro de Aplicação → Relatório APS |
| `fn_notificacao_emitir_core` | qualquer módulo → Notificações |

---

## 5. Dependências do frontend (imports mais compartilhados)

| Artefato | Importadores |
|---|---:|
| `@/hooks/usePermission` | **116** |
| `@/components/layout/MainLayout` | **64** |
| `@/hooks/useAuth` | **19** |
| `@/hooks/usePermissionGuard` | 10 |
| `@/constants/menuStructure` | 6 |
| `@/integrations/supabase/client` | (praticamente todos os services e hooks) |
| `@/components/ui/*` | (todo o frontend) |

**Implicação:** alterar a **assinatura de retorno** de `usePermission()` é uma mudança de 116 arquivos. Alterar `MainLayout` afeta 64 páginas.

---

## 6. Módulos relativamente isolados (menor risco de propagação)

| Módulo | Acoplamento |
|---|---|
| **Licitações / PNCP** | Só depende de RBAC. Tabelas `bd_pncp_*`, `bd_orgaos_*`, `bd_matching_*`, `bd_cotacoes*` não são referenciadas por outros módulos. **É o módulo mais isolado.** |
| **POPs** | Depende de `bd_departamentos` (`setor_id`) e RBAC. Isolado. |
| **SSO** | Depende de `bd_funcionarios` e `bd_centros_custo` (leitura). Escreve só em tabelas próprias. |
| **Chamados Internos** | Escreve em tabelas próprias; integra com OS e Solicitações **por RPC explícita** (não por FK) — bom desacoplamento. |
| **Atestados Médicos** | Fluxo público isolado por Edge Functions + HMAC. Toca `bd_funcionarios` só para validar matrícula. |

---

## 7. Acoplamentos indesejados identificados

| # | Acoplamento | Risco |
|---|---|---|
| A1 | `usePermission.ts` (937 LOC) concentra **7 estratégias de autorização** e é importado por 116 arquivos | Qualquer bug ali é sistêmico |
| A2 | `fn_is_super_admin` lê `profiles.funcoes` + `funcao_sistema` + `acesso_global` + `bd_funcoes_permissao` **e** é usada em 378 policies | Alterar uma coluna de `profiles` altera a segurança de 378 pontos |
| A3 | `bd_centros_custo` acumula 5 papéis de responsabilidade + geocoding + escopo de RLS | Tabela sobrecarregada — mudança estrutural tem raio enorme |
| A4 | `LYTOTEC_API_KEY` compartilhada entre Ponto, Fornecedores, Diárias, Desligamentos, Catálogo | Rotação da chave quebra 5 fluxos simultaneamente |
| A5 | `bd_funcionarios` acumula dados operacionais **e** financeiros/PII, apesar de existir `bd_funcionarios_sensivel` | Impede segregação de acesso |
| A6 | `types.ts` (976 KB) é regenerado inteiro a cada mudança de schema | Diffs enormes; conflitos de merge |
| A7 | `MainLayout` importado por 64 páginas sem camada intermediária | Mudança de layout é mudança de 64 arquivos |
| A8 | Ordem do Dia depende de Planejamento Macro **e** de Ativos **e** de Equipes **e** de CC | Módulo com 4 dependências fortes |

---

## 8. Matriz de impacto — "se eu mexer aqui, verifico ali"

| Alteração | Verificar obrigatoriamente |
|---|---|
| Coluna de `profiles` | `fn_is_super_admin` (378 policies), `usePermission` Camadas C/D1/D2/E2, `sync_profile_funcao_sistema`, `compute_funcao_sistema`, 5 triggers |
| Coluna de `bd_funcionarios` | 50 FKs, 9 triggers, `bd_funcionarios_sensivel`, `vw_funcionarios_*`, `fn_funcionarios_can_select_row`, geocoding |
| Coluna de `bd_centros_custo` | 40 FKs, RLS de todos os módulos, cerca do ponto, `bd_ponto_dispositivo_centros_custo`, `bd_fluxo_centro_custo` |
| Qualquer `fn_*_can_*` | Todas as policies que a chamam **e** todas as chamadas `.rpc()` do frontend |
| `bd_permissions` / `bd_roles` | `usePermission`, `SecureRouteGuard`, `menuStructure`, `routePermissions`, `services/rbac/*`, `bd_rbac_legacy_map` |
| Retorno de `usePermission()` | 116 arquivos |
| `MainLayout` | 64 páginas |
| `menuStructure.ts` | `AppSidebar` + `routePermissions.ts` (manter sincronizados) |
| Rota em `App.tsx` | `menuStructure.ts`, `routePermissions.ts`, `bd_permissions.rota` |
| Nova permissão | `bd_permissions`, `bd_permissoes_acoes`, `bd_role_permission_actions`, `routePermissions.ts`, `menuStructure.ts`, `bd_rbac_legacy_map` |
| Bucket de Storage | policies de `storage.objects`, `fn_storage_*`, componentes de upload/download, Edge Functions do módulo |
| Edge Function | `supabase/config.toml` (`verify_jwt`), secrets, `fn_backend_can_invoke`, `bd_backend_exec_auditoria`, chamadores externos (totens, cron, site) |
| Trigger de cálculo | toda a cadeia a jusante (ver `13-FLUXOS-CRITICOS.md` §10) |
| `bd_diaria_*` | `mv_relatorio_diarias`, `refresh_relatorio_diarias`, `_mv_relatorio_diarias_dirty`, views `vw_diaria*`/`vw_bi_diarias*` |

---

## 9. Ordem recomendada de leitura para quem for mexer em algo

1. `13-FLUXOS-CRITICOS.md` — entender o caminho completo do dado
2. Este documento (§8) — descobrir o raio de impacto
3. `19-PONTOS-QUE-NAO-DEVEM-SER-ALTERADOS-SEM-AUTORIZACAO.md` — verificar se é zona proibida
4. `06-MAPA-RBAC.md` / `08-MAPA-RLS.md` — se houver qualquer aspecto de autorização
5. `18-REGRAS-PARA-DESENVOLVIMENTO-FUTURO.md` — seguir o protocolo
