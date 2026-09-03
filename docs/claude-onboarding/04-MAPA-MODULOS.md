# 04 — MAPA DOS MÓDULOS FUNCIONAIS

> Auditoria READ-ONLY. Classificação derivada de: presença em `menuStructure.ts`, presença de rota em `App.tsx`, existência de hooks/services ativos, e contagem de importadores.
>
> **Legenda**
> `ATIVO` · `LEGADO AINDA UTILIZADO` · `LEGADO SEM USO APARENTE` · `EM MIGRAÇÃO` · `EXPERIMENTAL` · `DESCONHECIDO`
>
> **Nada foi removido.** Classificação é diagnóstica, não uma recomendação de exclusão.

---

## 1. GESTÃO DE RH — `ATIVO`

| Item | Valor |
|---|---|
| Rotas | `/dashboard-rh`, `/gestao-rh/{empresas,diretorias,departamentos,centros-custo,funcoes,funcionarios,equipes,arquivo-morto,central-aprovacoes,desligamentos→redirect}` |
| Páginas | `DashboardRH`, `GestaoEmpresas`, `GestaoDiretorias`, `GestaoDepartamentos`, `GestaoCentrosCusto`, `GestaoFuncoes`, `GestaoFuncionarios`, `GestaoEquipes`, `ArquivoMorto`, `GestaoDesligamentos`, `central-aprovacoes/CentralAprovacoes` |
| Componentes | `components/{funcionarios,empresas,departamentos,centrosCusto,centroCusto,diretorias,funcoes,equipes,desligamento,central-aprovacoes}` |
| Hooks | `hooks/rh/`, `hooks/funcionarios/`, `hooks/dashboard/` |
| Services | `services/rh/`, `services/centrosCusto/`, `services/equipe/` |
| Tabelas | `bd_funcionarios`, `bd_funcionarios_sensivel`, `bd_empresas`, `bd_departamentos`, `bd_centros_custo`, `bd_diretorias`, `bd_funcoes`, `bd_equipes`, `bd_arquivo_morto`, `bd_desligamentos`, `bd_solicitacoes_desligamento`, `bd_solicitacao_desligamento_itens`, `bd_solicitacoes_transferencia`, `bd_solicitacao_transferencia_itens`, `bd_historico_funcional`, `bd_funcionario_status_historico`, `bd_vale_transporte`, `bd_importacao_alterdata`, `bd_aprovacoes_inclusao_funcionario` |
| RPCs | `fn_rh_funcionarios_listar`, `create_funcionario`, `fn_funcionarios_can_select_row`, `fn_can_access_funcionario_sensitive`, `fn_get_funcionario_sensitive`, `merge_duplicate_funcionarios*` (3 variantes), `listar_ghost_funcionarios`, `link_profile_to_funcionario_by_email`, `get_status_funcionario_na_data` |
| Permissões | `gestao_rh_*_view`, `central_aprovacoes_view`, `acesso_gestao_aprovacoes` |
| Integrações | Storage `documentos-rh`, `funcionarios`, `assinaturas-funcionarios`; Edge `process-desligamentos` |
| Observações | **Duplicidade histórica de funcionários** — existem 3 RPCs de merge e uma RPC `listar_ghost_funcionarios`, indicando problema recorrente de cadastros duplicados. Ver `05-MAPA-BANCO-DADOS.md` §7. |

---

## 2. ENGENHARIA — `ATIVO` (fase recente)

| Item | Valor |
|---|---|
| Rotas | `/engenharia/planejamento-macro`, `/engenharia/ordem-do-dia`, `/engenharia/ordem-do-dia/:ordemId/item/:itemId` |
| Redirects | `/gestao-maquinas/planejamento-macro` → `/engenharia/planejamento-macro`; `/engenharia/ordem-diaria-campo*` → `/engenharia/ordem-do-dia` |
| Páginas | `PlanejamentoMacroObra`, `OrdemDiariaCampo`, `OrdemDiariaCampoDetalhe` |
| Guard próprio | `OrdemDiariaCampoGuard` (66 LOC) |
| Tabelas | `bd_planejamentos_obra`, `bd_planejamento_atividades`, `bd_planejamento_atividade_equipe`, `bd_planejamento_recursos`, `bd_solicitacoes_planejamento`, `bd_ordens_diarias_obra`, `bd_ordens_diarias_obra_itens`, `bd_ordens_diarias_obra_apontamentos`, `bd_log_operacional_datas` |
| RPCs | `fn_gerar_ordem_diaria_rascunho`, `fn_emitir_ordem_diaria`, `fn_cancelar_ordem_diaria`, `fn_atualizar_ordem_diaria_rascunho`, `fn_registrar_apontamento_item_ordem_diaria`, `fn_ordem_diaria_build_item_snapshot`, `fn_ordem_diaria_resolver_responsavel`, `fn_designar_equipe_atividade`, `fn_detectar_conflito_designacao`, `fn_planejamento_tornar_vigente`, `fn_planejamento_scope_centros_custo` |
| View | `vw_ordem_diaria_item_ultimo_apontamento` |
| Observações | Módulo migrado de "Gestão Máquinas" para "Engenharia" com redirects preservando deep links. Existe `MockBadge.tsx` órfão em `components/planejamento-macro/` (resíduo de prototipagem). |

---

## 3. GESTÃO DE VEÍCULOS E EQUIPAMENTOS — `ATIVO`

| Item | Valor |
|---|---|
| Rotas | `/dashboard-maquinas`, `/gestao-maquinas/{caminhoes,usinas,relatorio-medicao,abastecimento,solicitacoes-equipamentos,disponibilidade,portfolio-empresas,linhas-operacionais,mapa-operacional}`, `/minhas-mobilizacoes`, `/gestao-maquinas/checklist-saida/:movimentacaoId` |
| Tabelas | `bd_caminhoes_equipamentos`, `bd_usinas`, `bd_frotas`, `bd_grupos_ativos`, `bd_linhas_operacionais`, `bd_categorias_ativos`, `bd_subcategorias_ativos`, `bd_tipos_equipamento`, `bd_fabricantes`, `bd_modelos`, `bd_catalogo_equipamentos`, `bd_catalogo_variacoes`, `bd_disponibilidade_equipamentos`, `bd_custos_equipamentos`, `bd_localizacao_equipamentos`, `bd_portfolio_empresas`, `bd_empresas_locadoras`, `bd_abastecimentos`, `bd_abast_sync_log`, `bd_movimentacoes`, `bd_movimentacao_saida`, `bd_movimentacao_transporte`, `bd_solicitacoes_equipamento`, `bd_solicitacoes_equip_aprovacoes`, `bd_solicitacoes_itens`, `bd_solicitacao_item_atendimentos`, `bd_solicitacoes_desmobilizacao`, `bd_importador_v2_execucoes`, `bd_importador_v2_linhas_processadas` |
| RPCs | `fn_ativos_*` (10), `fn_solic_equip_*` (10), `fn_desmobilizacao_*` (5), `fn_veiculos_alocacao_atual`, `fn_importador_v2_*`, `fn_importador_ativos_*`, `fn_mapa_operacional_ultimas_localizacoes`, `fn_reconciliar_estado_manutencao_ativo`, `buscar_equipamentos_disponiveis`, `verificar_equipamento_duplicado` |
| Views | `vw_ativos_operacional`, `vw_ativos_logistica_manutencao`, `vw_localizacao_equipamentos_controlada`, `vw_portfolio_tecnico_seguro`, `vw_solicitacoes_equipamento_{operacional,financeiro}`, `vw_custos_equipamentos_seguro` |
| Integrações | **Mapbox** (mapa operacional), **Guardian Web** (abastecimento) |
| Observações | **Importador em 3 gerações coexistindo**: `services/veiculo/import/` (V1/V2), `services/veiculo/importV3/` (34 arquivos + 14 testes), `ImportadorV2Wizard.tsx` + `ImportadorV3Modal.tsx`, hooks `useEquipamentosImportV3` e `useEquipamentosImportV3Simplificado`. Ver `16-LEGADO-DUPLICIDADES.md`. |

---

## 4. CENTRAL DO TRANSPORTE (CT) — `ATIVO` / `EM MIGRAÇÃO`

O módulo mais complexo do ERP: **60 RPCs `fn_ct_*`**, 6 arquivos de tipos, 13 testes em `lib/central-transporte/__tests__`, 11 em `utils/central-transporte/__tests__`.

| Item | Valor |
|---|---|
| Rotas | `/gestao-maquinas/central-transporte`, `/central-transporte/solicitacao/:solicitacaoId`, `/central-transporte/movimentacao/nova`, `/central-transporte/movimentacao/:viagemId` |
| Permissão | `gestao_maquinas_central_transporte_view` com **actions granulares** (`visualizar`, `criar`) — único módulo com esse nível |
| Tabelas | `bd_ct_viagens`, `bd_ct_viagem_paradas`, `bd_ct_puxadas`, `bd_ct_puxada_caminhoes`, `bd_ct_recebimentos`, `bd_ct_recebimento_itens`, `bd_ct_checklists`, `bd_ct_comando_requests`, `bd_cache_enderecos`, `bd_geocoding_falhas` |
| Fases identificadas no código | **CT-2** (modal legado), **CT-3B** (página dedicada, atrás da flag `CT3B_SOLICITACAO_PAGE_ENABLED`), **CT-4** (movimentação direta), **CT-5** (puxadas), **CT-6** (transport builder — visto nos testes) |
| Flag | `VITE_CT3B_SOLICITACAO_PAGE_ENABLED` = `true` no `.env` |
| Integrações | **Mapbox** via `geocode-proxy` |
| Órfãos no módulo | 11 componentes nunca importados: `AtivosMovimentacaoPanel`, `CaminhoesPuxadaEditor`, `CriarMovimentacaoModal`, `CtChecklistItemRow`, `DecisaoTransporteDialog`, `EtapaItens`, `EtapaSelecao`, `ParadasSelector`, `RecursosArrastaveisPanel`, `SecaoNumerada`, `SelecaoItemVazio` |
| Planos Lovable | `.lovable/plan-ct-2-2-*`, `plan-ct-3-auditoria-read-only-*`, `plan-homologação-ct-2-g0-g3-*` |

---

## 5. REQUISIÇÕES E LOGÍSTICA (CBUQ) — `ATIVO`

| Item | Valor |
|---|---|
| Rotas | `/dashboard-cbuq`, `/requisicoes/cadastro`, `/programacao-entrega`, `/requisicoes/registro-cargas`, `/registro-aplicacao`, `/requisicoes/apontamento-equipe`, `/relatorio-aplicacao-diaria` |
| Tabelas | `bd_requisicoes`, `bd_ruas_requisicao`, `bd_programacao_entrega`, `bd_lista_programacao_entrega`, `bd_registro_cargas`, `bd_carga_status_historico`, `bd_registro_apontamento_aplicacao`, `bd_registro_aplicacao_detalhes`, `bd_registro_aplicacao_ruas`, `bd_apontamento_equipe`, `bd_avaliacao_equipe`, `bd_relatorio_aps_carimbos` |
| RPCs | `calcular_massa_remanescente` (3 variantes), `calcular_espessura_aplicacao`, `converter_kg_para_toneladas`, `criar_aplicacao_por_rua`, `finalizar_carga_aplicacao`, `finalizar_carga_manual`, `garantir_registro_aplicacao_principal`, `sincronizar_hora_saida_aplicacao`, `atualizar_status_entrega_automatico`, `force_update_all_delivery_statuses`, `fn_criar_registro_aplicacao_manual` (+ `_v2`), `fn_logistica_can_*` (9) |
| Views | `vw_requisicoes_operacional_segura`, `vw_programacao_entrega_segura`, `vw_lista_programacao_entrega_segura`, `vw_registro_cargas_seguro`, `vw_registro_aplicacao_seguro`, `vw_apontamento_equipe*`, `vw_logistica_relatorio_gerencial_seguro` |
| Órfãos | `RegistroAplicacaoStable.tsx` (página), `fetchEntregasStable.ts`, `RegistroAplicacaoTable.tsx`, `EntregasTable.tsx`, `NovoApontamentoModal.tsx`, `CargaApplicationHistory.tsx`, `NovoRegistroDadosTecnicosTab.tsx`, pasta inteira `components/registro-aplicacoes/` (plural) |
| Observação | **Duas pastas de componentes**: `registro-aplicacao/` (ativa) e `registro-aplicacoes/` (órfã). Também `manualFinalizationService.ts` e `registroAplicacaoService.ts` órfãos. |

---

## 6. DIÁRIAS — `ATIVO`

| Item | Valor |
|---|---|
| Rotas | `/requisicoes/diarias/{dashboard,solicitacoes,relatorio,apontamento-campo}`, `/requisicoes/diarias/auditoria-ponto-shadow` (`__superadmin_only__`) |
| Tabelas (12) | `bd_diaria_solicitacoes`, `bd_diaria_apontamentos`, `bd_diaria_presencas`, `bd_diaria_aprovacoes`, `bd_diaria_aditivos`, `bd_diaria_status`, `bd_diaria_logs`, `bd_diaria_lotes_convocacao`, `bd_diaria_lote_funcionarios`, `bd_diaria_excecao_solicitacoes`, `bd_diaria_calendario_operacional`, `bd_diaria_relatorio_auditoria` |
| RPCs | `criar_lote_diaria`, `adicionar_item_lote`, `atualizar_item_lote`, `remover_item_lote`, `enviar_lote_para_aprovacao`, `rejeitar_lote_diaria`, `cancelar_lote_diaria`, `calcular_valor_diaria`, `fn_calcular_diaria_aplicada`, `fn_diaria_*` (11), `solicitar_aditivo_dia`, `solicitar_aditivo_funcionario`, `aprovar_aditivo`, `reprovar_aditivo`, `cancelar_aditivo`, `gerenciar_convocado_diaria(_no_dia)`, `get_relatorio_diarias(_full)`, `refresh_relatorio_diarias`, `integrar_ponto_com_diaria` |
| MV | `mv_relatorio_diarias` (+ `_dirty` + `_legacy_20260514`) |
| Views | `vw_diaria_aprovacoes_efetivas`, `vw_diaria_relatorio_financeiro`, `vw_diarias_{aprovacao_gerencial,financeiro_dp,operacional_campo}`, `vw_relatorio_diarias_folha`, `vw_bi_diarias_*` (3) |
| Flag | `DIARIAS_LOTES_UI_PREVIEW` (default `false`) |
| Órfãos | `InclusaoAprovacaoModal.tsx`, `StatusFuncionarioAlert.tsx`, `components/diarias/index.ts` |
| Segregação de acesso | 3 níveis: `fn_can_access_diarias_{operacional,gerencial,financeiro}` |

### Central de Aprovações — `EM MIGRAÇÃO`
- Nova: `/gestao-rh/central-aprovacoes` → `central-aprovacoes/CentralAprovacoes`
- Legada: `/gestao-aprovacoes-diarias` → **redirect** (`RedirectLegacy.tsx`)
- Fallback preservado: `/_legacy/gestao-aprovacoes-diarias` → `diarias/GestaoAprovacoesDiarias` (**não linkado no menu**)
- `services/central-aprovacoes/index.ts` é órfão

---

## 7. PONTO ELETRÔNICO — `ATIVO` (com uma frente `EM MIGRAÇÃO` congelada)

| Item | Valor |
|---|---|
| Rotas ativas | `/ponto` (PWA pessoal), `/ponto-totem-login`, `/ponto-totem`, `/admin/gestao-ponto`, `/admin/ponto-dispositivos`, `/admin/biometria-facial`, `/admin/auditoria-biometria` |
| Rota congelada | `/ponto-dispositivo` — **comentada em `App.tsx`** (`FROZEN`), página e Edge Function preservadas |
| Tabelas (12) | `bd_ponto_batidas`, `bd_ponto_ajustes`, `bd_ponto_config`, `bd_ponto_dispositivos`, `bd_ponto_dispositivo_sessoes`, `bd_ponto_dispositivo_centros_custo`, `bd_ponto_vinculos_operacionais`, `bd_ponto_audit_log`, `bd_ponto_match_log`, `bd_ponto_diaria_integracao`, `bd_ponto_apontamento_integracao`, `bd_ponto_relatorio_auditoria` + `bd_funcionarios_biometria_facial`, `bd_auditoria_biometria` |
| Enums | `ponto_modo_registro` (`pwa_pessoal`\|`totem`\|`dispositivo_obra`), `ponto_status_sync`, `ponto_status_validacao`, `ponto_tipo_batida`, `ponto_tipo_vinculo` |
| Edge Functions (9) | `registrar-ponto`, `registrar-ponto-totem`, `registrar-ponto-dispositivo-obra`, `sync-ponto-offline`, `login-dispositivo-totem`, `definir-senha-dispositivo`, `heartbeat-dispositivo`, `vincular-ccs-dispositivo`, `ponto-diaria-shadow` + `identificar-funcionario-por-face`, `identificar-funcionario-manual`, `confirmar-match-totem`, `cadastrar-biometria-facial` |
| Views | `vw_ponto_batidas_{pessoal,gestao,rh}`, `vw_ponto_dispositivos_{seguro,admin}`, `vw_ponto_logs_antifraude_seguro`, `vw_ponto_diaria_shadow` |
| Integração | **face-api.js** no browser + `pgvector` no banco; modelos em `public/models/` |
| Modo shadow | `ponto-diaria-shadow` + `PontoShadowAuditoria` page: integração Ponto→Diárias rodando em paralelo sem efeito, para validação |

---

## 8. SSO — SEGURANÇA E SAÚDE OCUPACIONAL — `ATIVO`

| Item | Valor |
|---|---|
| Rotas | `/sso/{checklists,checklists/dashboard,desvios,ver-e-agir,agendamento-exames,clinicas,atestados}` |
| Tabelas | `bd_sso_checklists`, `bd_sso_checklist_itens`, `bd_sso_itens_modelo`, `bd_sso_ver_agir`, `bd_registro_desvios_sso`, `bd_registro_desvios_fotos`, `bd_agendamentos_exames`, `bd_agendamentos_exames_anexos`, `bd_locais_atendimento`, `bd_atestados_medicos`, `bd_atestados_nonces_utilizados` |
| RPCs | `fn_desvio_can_select_row`, `has_sso_permission`, `has_sso_full_access`, `get_sso_admin_users`, `check_is_admsso`, `check_vistorias_sso_pendentes`, `fn_calcular_nota_checklist`, `can_delete_agendamento_exame`, `fn_pode_ver_agendamento_exame_por_cc` |
| Buckets | `sso-checklists` (**público**), `sso-desvios` (privado), `sso-ver-agir` (privado), `exames_agendamentos` (privado) |

### Atestados Médicos — `ATIVO` (fluxo público)
- **Rota pública sem guard**: `/atestados-medicos` (`AtestadosMedicos.tsx`)
- Painel interno: `/sso/atestados` (`sso/AtestadosMedicosPainel`, permissão `saude_atestados_view`)
- 6 Edge Functions dedicadas, todas `verify_jwt = false`, protegidas por **HMAC** (`ATESTADO_HMAC_SECRET`) + nonce (`bd_atestados_nonces_utilizados`): `atestado-validar-matricula`, `atestado-criar-upload-url`, `atestado-submeter`, `atestado-arquivo-signed-url`, `atestado-arquivo-blob`, `atestado-notificar-reenvio`
- Bucket `atestados-medicos` (não versionado em migrations)
- E-mail via **Resend**; destinatário DP hardcoded: `ronald.ventura@lytoranea.com.br` (`atestado-submeter/index.ts:37`)

---

## 9. CHAMADOS INTERNOS — `ATIVO` (módulo mais novo)

| Item | Valor |
|---|---|
| Rotas | `/chamados-internos`, `/abrir`, `/atendimento`, `/dashboard`, `/admin`, `/:chamadoId` |
| Tabelas | `bd_chamados_internos`, `bd_chamado_interno_anexos`, `bd_chamado_interno_atendentes`, `bd_chamado_interno_avaliacoes`, `bd_chamado_interno_categorias`, `bd_chamado_interno_eventos` |
| Enums | `chamado_interno_status`, `chamado_interno_prioridade` (`baixa\|normal\|alta\|critico`), `chamado_interno_setor`, `chamado_interno_evento_tipo` |
| RPCs | **35** `fn_chamado_interno_*` — o domínio com maior densidade de RPC por tabela |
| Realtime | `src/hooks/useChamadosInternosRealtime.ts` (`postgres_changes`) |
| Bucket | `chamados-internos-anexos` (não versionado em migrations) |
| Integração cruzada | `convert_chamado_para_os`, `fn_chamado_interno_abrir_solic_equipamento`, `fn_chamados_acoes_integradas_disponivel` |
| Plano Lovable | `.lovable/plan-correção-dos-3-problemas-reportados-rh-chamados-internos-2026-07-30.md` |

---

## 10. ORDENS DE SERVIÇO / MANUTENÇÃO — `ATIVO`

| Item | Valor |
|---|---|
| Rotas | `/requisicoes/chamados-os`, `/requisicoes/gestao-os` |
| Tabelas | `bd_chamados_os`, `bd_ordens_servico`, `bd_os_mao_obra`, `bd_os_materiais_utilizados`, `bd_os_auditoria`, `bd_os_leituras_sensiveis` (+ `bd_os_movimentacoes`, presente em policies mas **ausente de `types.ts`**) |
| RPCs | `fn_os_can_*` (10), `fn_recalcula_total_os`, `convert_chamado_para_os`, `fn_registrar_leitura_os_sensivel`, `fn_os_storage_object_allowed` |
| Views | `vw_ordens_servico_{admin,operacional}_seguro`, `vw_os_custos_resumido_seguro`, `vw_os_resumo_financeiro`, `vw_chamados_os_operacional_seguro` |
| Bucket | `os_photos` (**era público, tornado privado** em `20260422201946`) |
| Órfãos | `ConvertToOSModal.tsx` (chamados-os) e `ConvertToOsModal.tsx` (ordens-servico) — **duas grafias, ambas órfãs**; `SimpleOsDetailsModal.tsx` |

---

## 11. LICITAÇÕES / PNCP — `ATIVO`

| Item | Valor |
|---|---|
| Rotas | `/licitacoes/{dashboard,monitoramento-pncp,configuracoes-pncp,orgaos-pendentes,configuracoes-matching,relatorio}` |
| Tabelas | `bd_pncp_contratacoes`, `bd_pncp_todas_licitacoes`, `bd_pncp_perfis_busca`, `bd_pncp_config_monitoramento`, `bd_pncp_sync_log`, `bd_orgaos_publicos`, `bd_orgaos_alias`, `bd_orgaos_historico_metricas`, `bd_licitacoes_orgaos_pendentes`, `bd_matching_config`, `bd_matching_exclusoes`, `bd_cotacoes`, `bd_cotacoes_itens`, `bd_cotacoes_propostas` |
| Edge Function | `pncp-sync` (917 LOC) — consome `https://pncp.gov.br` |
| Views | `vw_pncp_contratacoes_{operacional,estrategico}`, `vw_bi_licitacoes_indicadores` |
| Observação | `/licitacoes/dashboard` e `/licitacoes/relatorio` apontam para **o mesmo componente** `RelatorioLicitacoes` com permissões distintas (`dashboard_licitacoes_view` × `relatorio_licitacoes_view`). Rotas `orgaos-pendentes` e `configuracoes-matching` **não estão no menu**. |

---

## 12. POPs (Procedimentos Operacionais Padrão) — `ATIVO` (recente)

| Item | Valor |
|---|---|
| Rotas | `/pops` (Biblioteca), `/pops/gestao` — ambas com `pops_view` |
| Tabelas | `bd_pops`, `bd_pop_rascunhos` |
| RPCs | `fn_pop_criar`, `fn_pop_atualizar_rascunho`, `fn_pop_publicar_rascunho`, `fn_pop_iniciar_revisao`, `fn_pop_descartar_rascunho`, `fn_pop_excluir`, `fn_pop_reativar`, `fn_pop_tornar_obsoleto`, `fn_pop_anexar_arquivo_rascunho`, `fn_pop_gate_homologacao(_ator)` |
| Edge Functions | `pop-upload-arquivo`, `pop-arquivo-blob`, `pop-descartar-rascunho`, `pop-excluir` |
| Bucket | `pops-documentos` (privado; não versionado em migrations) |
| Observação | Ambas as rotas usam a **mesma permissão** `pops_view` — a Gestão de POPs não tem gate próprio no router (a autorização real ocorre nas RPCs). |

---

## 13. ADMINISTRAÇÃO — `ATIVO`

| Rota | Página | Permissão |
|---|---|---|
| `/admin/permissoes` | `GestaoPermissoes` | `admin_permissoes_view` |
| `/admin/gestao-fluxos` | `admin/GestaoFluxos` | `admin_gestao_fluxos_view` |
| `/admin/auditoria` | `admin/AuditoriaSistema` | `admin_auditoria_view` |
| `/admin/configuracoes-sistema` | `admin/ConfiguracoesSistema` | `admin_permissoes_view` (reuso) |
| `/admin/ponto-dispositivos` | `admin/PontoDispositivos` | `admin_permissoes_view` (reuso) |
| `/admin/biometria-facial` | `admin/BiometriaFacial` | `biometria_facial_gerenciar` |
| `/admin/auditoria-biometria` | `admin/AuditoriaBiometria` | `admin_auditoria_view` |
| `/admin/gestao-ponto` | `admin/GestaoPonto` | `biometria_facial_gerenciar` |
| `/admin/qualidade-cadastral` | `admin/QualidadeCadastral` | `__superadmin_only__` (sintética) |

Tabelas: `bd_configuracoes_sistema`, `bd_roles`, `bd_permissions`, `bd_role_permissions`, `bd_role_permission_actions`, `bd_user_roles`, `bd_user_permission_overrides`, `bd_permissoes`, `bd_permissoes_acoes`, `bd_funcoes_permissao`, `bd_rbac_legacy_map`, `bd_fluxos_aprovacao` e correlatas.

Qualidade Cadastral: `vw_qc_pendencias`, `vw_qc_pendencias_raw`, `vw_qc_registros`, `vw_qc_cc_ctx`, `fn_qualidade_cadastral_{estrutura,pendencias,resumo}`, `fn_aplicar_saneamento_auto`, `fn_reverter_saneamento_auto`.

---

## 14. ABASTECIMENTO — `ATIVO` (integração externa)

| Item | Valor |
|---|---|
| Rota | `/gestao-maquinas/abastecimento` → `GestaoAbastecimento` |
| Tabelas | `bd_abastecimentos`, `bd_abast_sync_log` |
| Integração | **Guardian Web** (`https://www.guardianweb.online/webservicev1gw`) via Edge Function `guardian-web-proxy` |
| Hooks | `hooks/abastecimento/useAbastecimentos.ts`, `useGuardianWebAuth.ts` |
| Legado | `api/proxy_server.py` e `src/components/reabastecimento/proxy_server.py` — **arquivos Python idênticos** (proxy Flask local, substituído pela Edge Function). O de `src/` está dentro do bundle path do Vite. |
| Órfãos | páginas `abastecimento.tsx`, `reabastecimentos.tsx`, `components/relatorio-reabastecimento/reabastecimentos.tsx` |

---

## 15. PORTAL / DASHBOARD INICIAL — `ATIVO`

`/` → `Portal.tsx` (import **síncrono**, junto de `SimpleLogin` e `NotFound`). Componentes em `components/portal/`.

**Páginas de dashboard órfãs**: `Dashboard.tsx`, `Dashboard1.tsx` — `LEGADO SEM USO APARENTE`.

---

## 16. Módulos/áreas `LEGADO SEM USO APARENTE`

| Área | Evidência |
|---|---|
| **Site institucional** | `HeroSection.tsx`, `Footer.tsx`, `ServiceCard.tsx`, `Contact.tsx`, `Privacy.tsx`, `IntegrityChannel.tsx`, `AdminPortfolioProjectGrid.tsx` + tabelas `portfolio_categories`, `portfolio_images`, `portfolio_projects`, `services` (policies "publicly readable") + buckets `portfolio`, `services`. **Nenhuma rota no App.tsx.** Provável resíduo de um site público que já viveu no mesmo projeto Supabase. |
| **Catálogo de Equipamentos (UI)** | `CatalogoEquipamentos.tsx`, `CatalogoSugestoes.tsx` órfãs — mas as tabelas `bd_catalogo_*` são usadas por outros fluxos ⇒ **`LEGADO SEM USO APARENTE` no frontend, `ATIVO` no banco** |
| **Gestão de Frotas (UI)** | `GestaoFrotas.tsx` órfã; tabela `bd_frotas` ativa |
| **Login antigo** | `Login.tsx` órfã (substituída por `SimpleLogin.tsx`) |
| **Apontamento seguro** | `SecureApontamentoEquipe.tsx` órfã |
| **Debug de permissões** | `PermissionDebugModal.tsx`, `PermissionDebugPanel.tsx`, `UserRoleIndicator.tsx`, `AuthDebugPanel.tsx` — `EXPERIMENTAL`/órfãos |

---

## 17. Módulos `DESCONHECIDO` (existem no banco, origem não determinada no frontend)

| Tabela | Situação |
|---|---|
| `bd_assinaturas`, `bd_assinaturas_usuarios` | Buckets `assinaturas`/`assinaturas-funcionarios` existem; `AssinaturaPreviewCard.tsx` é órfão. `components/assinatura/` parcialmente ativo. |
| `bd_integracao_fornecedores_log` | Alimentada por `onboard-fornecedor` (Edge, `LYTOTEC_API_KEY`) — **nenhuma UI encontrada** |
| `bd_envios`, `bd_log_comunicacao` | Camada de e-mail; sem UI dedicada |
| `bd_feriados`, `bd_diaria_calendario_operacional` | Usadas por Diárias (`useFeriados`) |
| `bd_solicitacoes_classificacao`, `bd_funcionario_classificacao_solicitacoes` | RPCs `fn_aprovar/reprovar/cancelar_classificacao_solicitacao`, `fn_efetivar_classificacao`, `fn_get_classificacao_reimpressao_payload` — fluxo de reclassificação de cargo; UI não localizada com certeza |
| `bd_aprovacoes_excecao`, `bd_diaria_excecao_solicitacoes` | Fluxo de exceção de diárias |
| `bd_rate_limit_tentativas` | Rate limit; consumidores não confirmados |
| `bd_cotacoes`, `bd_cotacoes_itens`, `bd_cotacoes_propostas` | Cotações — sem rota dedicada identificada |

**`[VERIFICAR NO BANCO]`** — volume real por tabela para separar "vivo" de "morto":
```sql
select relname, n_live_tup
from pg_stat_user_tables
where schemaname = 'public'
order by n_live_tup desc;
```
