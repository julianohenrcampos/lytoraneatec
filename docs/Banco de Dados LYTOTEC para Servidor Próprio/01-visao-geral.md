# 01 — Visão Geral

## Stack atual

| Camada | Tecnologia |
|---|---|
| Banco | PostgreSQL **17.6** gerenciado pelo Supabase |
| Autenticação | Supabase Auth (GoTrue) — esquema `auth` |
| Storage | Supabase Storage (esquema `storage`, backend S3) — 17 buckets |
| Edge Functions | Deno (Supabase Functions) — 26 funções |
| Realtime | Supabase Realtime (publicação `supabase_realtime`, atualmente sem tabelas inscritas) |
| Cron | `pg_cron` (3 jobs ativos) |
| HTTP em SQL | `pg_net` (chamadas a Edge Functions a partir do banco) |
| Vetores | `vector` (instalado, uso pontual) |
| Vault | `supabase_vault` (segredos de funções administrativas) |

## Como o banco se relaciona com o ERP LYTOTEC

O frontend React/Vite acessa o banco por **três caminhos**:

1. **PostgREST / Supabase JS** — leituras/escritas diretas, sempre filtradas por RLS.
2. **RPCs `SECURITY DEFINER`** — funções de domínio (diárias, ponto, RBAC, exames) que encapsulam regra de negócio crítica e bypass controlado de RLS.
3. **Edge Functions** — operações que exigem `service_role` (criar usuário, processar desligamentos, integrações externas) ou jobs disparados por cron.

A `auth.users` é a única fonte de identidade. A tabela espelho `public.profiles` carrega metadados de aplicação (nome, foto, vínculo com `bd_funcionarios`, flag `acesso_global`). Roles ficam **exclusivamente** em `bd_user_roles` — nunca em `profiles.funcoes` (campo legado em descomissionamento).

## Macro-divisão dos dados

| Categoria | Características | Exemplos de tabelas |
|---|---|---|
| **Operacional** | Alta volumetria, mutação frequente | `bd_diaria_presencas`, `bd_ponto_batidas`, `bd_registro_apontamento_aplicacao`, `bd_abastecimentos`, `bd_apontamento_equipe` |
| **Mestre / Cadastro** | Baixa volumetria, mutação rara | `bd_funcionarios`, `bd_empresas`, `bd_centros_custo`, `bd_funcoes`, `bd_departamentos`, `bd_diretorias`, `bd_caminhoes_equipamentos`, `bd_usinas` |
| **Configuração** | Parâmetros do sistema | `bd_configuracoes_sistema`, `bd_ponto_config`, `bd_matching_config`, `bd_pncp_config_monitoramento`, `bd_feriados`, `bd_diaria_calendario_operacional` |
| **RBAC** | Autorização granular | `bd_roles`, `bd_permissions`, `bd_role_permissions`, `bd_role_permission_actions`, `bd_user_roles`, `bd_user_permission_overrides` |
| **Auditoria** | Append-only, base para rastreabilidade | `bd_auditoria_log` (+ archive), `bd_permission_audit_logs`, `bd_permission_change_audit_logs`, `bd_ponto_audit_log`, `bd_security_audit_log`, `bd_ativos_auditoria`, `bd_os_auditoria`, `bd_logistica_auditoria`, `bd_storage_auditoria`, `bd_backend_exec_auditoria`, `bd_auditoria_biometria`, `bd_auditoria_leitura_funcionario_sensivel`, `bd_diaria_relatorio_auditoria`, `bd_ponto_relatorio_auditoria`, `bd_bi_relatorios_auditoria` |
| **Integrações** | Logs/estados de integrações externas | `bd_pncp_sync_log`, `bd_pncp_todas_licitacoes`, `bd_integracao_fornecedores_log`, `bd_abast_sync_log`, `bd_importacao_alterdata`, `bd_log_comunicacao`, `bd_geocoding_falhas`, `bd_cache_enderecos` |
| **Storage espelhado** | Metadados de arquivos | `bd_assinaturas`, `bd_agendamentos_exames_anexos`, `bd_registro_desvios_fotos`, `bd_documentos_relacao`, `bd_documentos_fluxo`, `bd_funcionarios_biometria_facial` |

## Módulos do ERP × tabelas

| Módulo | Tabelas principais (consultar `02-inventario-tabelas.md` para a lista completa) |
|---|---|
| **RH — Funcionários** | `bd_funcionarios`, `bd_funcionarios_sensivel`, `bd_funcionario_status_historico`, `bd_historico_funcional`, `bd_arquivo_morto`, `bd_funcionario_classificacao_solicitacoes`, `bd_solicitacoes_classificacao`, `bd_aprovacoes_inclusao_funcionario` |
| **RH — Desligamento** | `bd_desligamentos`, `bd_solicitacoes_desligamento`, `bd_solicitacao_desligamento_itens` |
| **RH — Transferência** | `bd_solicitacoes_transferencia`, `bd_solicitacao_transferencia_itens` |
| **Estrutura organizacional** | `bd_empresas`, `bd_empresas_locadoras`, `bd_centros_custo`, `bd_departamentos`, `bd_diretorias`, `bd_funcoes`, `bd_equipes`, `bd_usinas`, `bd_portfolio_empresas` |
| **Diárias** | `bd_diaria_solicitacoes`, `bd_diaria_presencas`, `bd_diaria_apontamentos`, `bd_diaria_aprovacoes`, `bd_diaria_aditivos`, `bd_diaria_status`, `bd_diaria_lotes_convocacao`, `bd_diaria_lote_funcionarios`, `bd_diaria_excecao_solicitacoes`, `bd_diaria_calendario_operacional`, `bd_diaria_logs`, `bd_diaria_relatorio_auditoria` |
| **Ponto eletrônico** | `bd_ponto_batidas`, `bd_ponto_ajustes`, `bd_ponto_config`, `bd_ponto_dispositivos`, `bd_ponto_dispositivo_sessoes`, `bd_ponto_dispositivo_centros_custo`, `bd_ponto_vinculos_operacionais`, `bd_ponto_apontamento_integracao`, `bd_ponto_diaria_integracao`, `bd_ponto_match_log`, `bd_ponto_audit_log`, `bd_ponto_relatorio_auditoria` |
| **Biometria** | `bd_funcionarios_biometria_facial`, `bd_auditoria_biometria` |
| **SSO — Exames** | `bd_agendamentos_exames`, `bd_agendamentos_exames_anexos`, `bd_locais_atendimento`, `bd_vale_transporte` |
| **SSO — Checklists / Desvios / Ver & Agir** | `bd_sso_checklists`, `bd_sso_checklist_itens`, `bd_sso_itens_modelo`, `bd_registro_desvios_sso`, `bd_registro_desvios_fotos`, `bd_sso_ver_agir` |
| **Máquinas / Equipamentos** | `bd_caminhoes_equipamentos`, `bd_catalogo_equipamentos`, `bd_catalogo_variacoes`, `bd_categorias_ativos`, `bd_grupos_ativos`, `bd_subcategorias_ativos`, `bd_tipos_equipamento`, `bd_modelos`, `bd_fabricantes`, `bd_frotas`, `bd_disponibilidade_equipamentos`, `bd_localizacao_equipamentos`, `bd_custos_equipamentos`, `bd_ativos_auditoria` |
| **Solicitações Equip.** | `bd_solicitacoes_equipamento`, `bd_solicitacoes_equip_aprovacoes`, `bd_solicitacoes_itens`, `bd_solicitacoes_planejamento` |
| **Abastecimento** | `bd_abastecimentos`, `bd_abast_sync_log` |
| **Manutenção / OS** | `bd_chamados_os`, `bd_ordens_servico`, `bd_os_mao_obra`, `bd_os_materiais_utilizados`, `bd_os_leituras_sensiveis`, `bd_os_auditoria`, `bd_registro_apontamento_inspecao` |
| **Logística — Programação / Cargas / Aplicação** | `bd_programacao_entrega`, `bd_lista_programacao_entrega`, `bd_registro_cargas`, `bd_carga_status_historico`, `bd_registro_apontamento_aplicacao`, `bd_registro_aplicacao_detalhes`, `bd_registro_apontamento_cam_equipa`, `bd_movimentacao_transporte`, `bd_movimentacao_saida`, `bd_movimentacoes`, `bd_logistica_auditoria` |
| **Apontamento de equipe** | `bd_apontamento_equipe`, `bd_avaliacao_equipe`, `bd_auditoria_sync_equipe_funcionario` |
| **Planejamento Macro** | `bd_planejamentos_obra`, `bd_planejamento_atividades`, `bd_planejamento_atividade_equipe`, `bd_planejamento_recursos`, `bd_ordens_diarias_obra`, `bd_ordens_diarias_obra_itens`, `bd_linhas_operacionais`, `bd_log_operacional_datas` |
| **Requisições / Ruas** | `bd_requisicoes`, `bd_ruas_requisicao` |
| **Fluxos / Aprovações** | `bd_fluxos_aprovacao`, `bd_fluxo_etapas`, `bd_fluxo_historico`, `bd_fluxo_centro_custo`, `bd_aprovacoes_fluxo_exec`, `bd_aprovacoes_excecao`, `bd_envios`, `bd_documentos_fluxo`, `bd_documentos_relacao` |
| **Licitações / PNCP** | `bd_pncp_contratacoes`, `bd_pncp_todas_licitacoes`, `bd_pncp_config_monitoramento`, `bd_pncp_perfis_busca`, `bd_pncp_sync_log`, `bd_orgaos_publicos`, `bd_orgaos_alias`, `bd_orgaos_historico_metricas`, `bd_licitacoes_orgaos_pendentes`, `bd_matching_config`, `bd_matching_exclusoes` |
| **Cotações** | `bd_cotacoes`, `bd_cotacoes_itens`, `bd_cotacoes_propostas`, `bd_integracao_fornecedores_log` |
| **Notificações / Comunicação** | `bd_notificacoes`, `bd_notificacoes_usuarios`, `bd_log_comunicacao` |
| **Assinaturas digitais** | `bd_assinaturas`, `bd_assinaturas_usuarios` |
| **Administração / RBAC** | `bd_roles`, `bd_permissions`, `bd_role_permissions`, `bd_role_permission_actions`, `bd_user_roles`, `bd_user_permission_overrides`, `bd_permissoes_acoes`, `bd_permissoes` (legado), `bd_funcoes_permissao` (legado), `bd_rbac_legacy_map`, `bd_permission_audit_logs`, `bd_permission_change_audit_logs` |
| **Auditoria transversal** | ver tabela "Macro-divisão" acima |

## Separação lógica recomendada para servidor próprio

- **Banco operacional** (1 banco) com schemas: `app` (atual `public`), `audit` (mover logs append-only), `auth_local` (substituto GoTrue se aplicável), `storage_meta`.
- **Banco de read-replica** para BI/relatórios (views `vw_bi_*` e MVs).
- **Object storage** isolado (MinIO/S3) com mesma topologia de buckets atual.
