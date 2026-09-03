# 02 — Inventário de Tabelas

> **Volumetria:** 167 tabelas em `public`, todas com RLS habilitado (458 policies). Esta seção lista todas as tabelas agrupadas por módulo, com colunas declaradas, finalidade resumida, sensibilidade LGPD e criticidade operacional. Schema técnico autoritativo: `src/integrations/supabase/types.ts` (gerado automaticamente pelo Supabase).

## Convenções

- **Sensibilidade:** `Pessoal` (PII), `Financeiro`, `Biométrico`, `Operacional`, `Configuração`, `Auditoria`.
- **Criticidade:** `Alta` (interrupção do ERP), `Média` (degrada módulo), `Baixa` (impacta relatórios).
- **Tipo:** `Mestre`, `Operacional`, `Auditoria`, `Configuração`, `Integração`, `Storage-meta`, `Histórico`, `Legado`.
- Toda tabela possui PK `id uuid` + `created_at`/`updated_at` salvo quando indicado.

## 1. RH — Funcionários

| Tabela | Tipo | # cols | Finalidade | Sensibilidade | Crítica |
|---|---|---|---|---|---|
| `bd_funcionarios` | Mestre | 54 | Cadastro principal de funcionários (nome, matrícula, função, CC, status). Joins com `bd_funcoes`, `bd_centros_custo`, `bd_empresas`, `bd_departamentos`, `bd_equipes`. | Pessoal | Alta |
| `bd_funcionarios_sensivel` | Mestre | 40 | Dados sensíveis segregados (CPF, RG, salário, dados bancários). Acesso restrito + auditoria via `bd_auditoria_leitura_funcionario_sensivel`. | Pessoal/Financeiro | Alta |
| `bd_funcionarios_biometria_facial` | Mestre | 17 | Embeddings faciais para identificação no totem. Bucket `biometria-facial`. | Biométrico | Alta |
| `bd_funcionario_status_historico` | Histórico | 8 | Histórico de transições de status (Ativo, Férias, INSS, Inativo...). | Pessoal | Média |
| `bd_historico_funcional` | Histórico | 18 | Histórico funcional: promoções, mudanças de função/CC. | Pessoal | Média |
| `bd_arquivo_morto` | Histórico | 10 | Preservação de dados de funcionários desligados (LGPD). | Pessoal | Média |
| `bd_funcionario_classificacao_solicitacoes` | Operacional | 25 | Itens de classificação individual (e por lote via `solicitacao_lote_id`). | Pessoal/Financeiro | Média |
| `bd_solicitacoes_classificacao` | Operacional | 17 | Cabeçalho de solicitação de classificação em lote (Fase 2 RH). | Pessoal | Média |
| `bd_aprovacoes_inclusao_funcionario` | Operacional | 10 | Fluxo de aprovação para inclusão de novo funcionário. | Pessoal | Média |
| `bd_solicitacoes_desligamento` | Operacional | 16 | Cabeçalho de lote de desligamento. | Pessoal | Alta |
| `bd_solicitacao_desligamento_itens` | Operacional | 16 | Itens (funcionários) do lote de desligamento. | Pessoal | Alta |
| `bd_desligamentos` | Operacional | 16 | Registro consolidado de desligamento aprovado. Edge `process-desligamentos`. | Pessoal | Alta |
| `bd_solicitacoes_transferencia` | Operacional | 16 | Cabeçalho de lote de transferência (CC/empresa). | Pessoal | Média |
| `bd_solicitacao_transferencia_itens` | Operacional | 19 | Itens de transferência. | Pessoal | Média |

## 2. Estrutura organizacional

| Tabela | Tipo | # cols | Finalidade |
|---|---|---|---|
| `bd_empresas` | Mestre | 38 | Empresas do grupo + locadoras + fornecedoras (PF/PJ). |
| `bd_empresas_locadoras` | Mestre | 8 | Subset/wrapper de empresas que atuam como locadoras. |
| `bd_centros_custo` | Mestre | 32 | Centros de custo (chave operacional `codigo_centro_custo` UPPER/TRIM). |
| `bd_departamentos` | Mestre | 6 | Departamentos. |
| `bd_diretorias` | Mestre | 8 | Diretorias e diretor responsável. |
| `bd_funcoes` | Mestre | 11 | Funções/cargos + valores de diária por função. |
| `bd_equipes` | Mestre | 8 | Equipes operacionais. |
| `bd_usinas` | Mestre | 8 | Usinas (produção de massa asfáltica). |
| `bd_portfolio_empresas` | Mestre | 17 | Portfólio técnico de empresas fornecedoras. |
| `bd_linhas_operacionais` | Mestre | 8 | Linhas operacionais por CC. |
| `bd_log_operacional_datas` | Histórico | 6 | Marcos operacionais por CC/data. |

## 3. Diárias

| Tabela | Tipo | # cols | Finalidade |
|---|---|---|---|
| `bd_diaria_solicitacoes` | Operacional | 33 | Solicitação semanal/extraordinária (`normal`/`extraordinaria`). |
| `bd_diaria_presencas` | Operacional | 30 | Presença por dia/funcionário/CC. |
| `bd_diaria_apontamentos` | Operacional | 12 | Apontamento de campo (consolidação diária). |
| `bd_diaria_aprovacoes` | Operacional | 7 | Aprovações por nível/etapa. |
| `bd_diaria_aditivos` | Operacional | 21 | Aditivos a uma solicitação aprovada. |
| `bd_diaria_status` | Configuração | 8 | Catálogo de status. |
| `bd_diaria_lotes_convocacao` | Operacional | 18 | Lote de convocação pré-solicitação. |
| `bd_diaria_lote_funcionarios` | Operacional | 18 | Funcionários do lote (convocados-pre). |
| `bd_diaria_excecao_solicitacoes` | Operacional | 12 | Exceções aprovadas (justificativa ≥20 chars). |
| `bd_diaria_calendario_operacional` | Configuração | 12 | Dias úteis/feriados por CC. |
| `bd_diaria_logs` | Auditoria | 7 | Log operacional do módulo. |
| `bd_diaria_relatorio_auditoria` | Auditoria | 13 | Quem gerou qual relatório. |
| `bd_feriados` | Configuração | 9 | Feriados (federal/estadual/municipal). |

## 4. Ponto Eletrônico

| Tabela | Tipo | # cols | Finalidade |
|---|---|---|---|
| `bd_ponto_batidas` | Operacional | 34 | Batidas (entrada/intervalo/saída) com GPS, score antifraude. |
| `bd_ponto_ajustes` | Operacional | 13 | Ajustes manuais por RH/gestão. |
| `bd_ponto_config` | Configuração | 32 | Configurações por CC (geofence, tolerâncias, turno noturno). |
| `bd_ponto_dispositivos` | Mestre | 21 | Totens/dispositivos cadastrados. |
| `bd_ponto_dispositivo_sessoes` | Operacional | 10 | Sessões ativas por dispositivo. |
| `bd_ponto_dispositivo_centros_custo` | Mestre | 8 | N:N dispositivo ↔ CC. |
| `bd_ponto_vinculos_operacionais` | Mestre | 11 | Vínculo funcionário ↔ CC operacional. |
| `bd_ponto_apontamento_integracao` | Integração | 4 | Sincronização ponto → apontamento de equipe. |
| `bd_ponto_diaria_integracao` | Integração | 14 | Sincronização ponto → diárias. |
| `bd_ponto_match_log` | Auditoria | 14 | Log de matching biométrico. |
| `bd_ponto_audit_log` | Auditoria | 9 | Log de mutações no módulo. |
| `bd_ponto_relatorio_auditoria` | Auditoria | 11 | Quem gerou relatório de ponto. |

## 5. SSO

| Tabela | Tipo | # cols | Finalidade |
|---|---|---|---|
| `bd_agendamentos_exames` | Operacional | 47 | Agendamento de exames ocupacionais (admissional, periódico, demissional, mudança de risco). |
| `bd_agendamentos_exames_anexos` | Storage-meta | 7 | Anexos (ASO, atestados). Bucket `exames_agendamentos`. |
| `bd_locais_atendimento` | Mestre | 19 | Clínicas credenciadas + janela de funcionamento. |
| `bd_vale_transporte` | Operacional | 26 | Vale-transporte por funcionário/CC. |
| `bd_sso_checklists` | Operacional | 20 | Checklists SSO. |
| `bd_sso_checklist_itens` | Operacional | 11 | Itens do checklist. |
| `bd_sso_itens_modelo` | Configuração | 6 | Modelos de itens. |
| `bd_registro_desvios_sso` | Operacional | 21 | Registro de desvios. |
| `bd_registro_desvios_fotos` | Storage-meta | 6 | Fotos de desvios. Bucket `sso-desvios`. |
| `bd_sso_ver_agir` | Operacional | 23 | Programa Ver & Agir. |

## 6. Máquinas, Equipamentos e Frota

| Tabela | Tipo | # cols | Finalidade |
|---|---|---|---|
| `bd_caminhoes_equipamentos` | Mestre | 39 | Veículos e equipamentos. |
| `bd_catalogo_equipamentos` | Mestre | 17 | Catálogo técnico. |
| `bd_catalogo_variacoes` | Mestre | 8 | Variações com constraint composta. |
| `bd_categorias_ativos` | Mestre | 6 | Categorias. |
| `bd_grupos_ativos` | Mestre | 7 | Grupos. |
| `bd_subcategorias_ativos` | Mestre | 7 | Subcategorias (sync com site externo). |
| `bd_tipos_equipamento` | Mestre | 12 | Tipos. |
| `bd_modelos` | Mestre | 6 | Modelos. |
| `bd_fabricantes` | Mestre | 5 | Fabricantes. |
| `bd_frotas` | Mestre | 8 | Frota. |
| `bd_disponibilidade_equipamentos` | Operacional | 11 | Status operacional. |
| `bd_localizacao_equipamentos` | Operacional | 7 | Geolocalização atual. |
| `bd_custos_equipamentos` | Configuração | 11 | Benchmark de custos. |
| `bd_ativos_auditoria` | Auditoria | 9 | Mutações de ativos. |

## 7. Solicitações de Equipamento

| Tabela | Tipo | # cols | Finalidade |
|---|---|---|---|
| `bd_solicitacoes_equipamento` | Operacional | 22 | Solicitação principal. |
| `bd_solicitacoes_equip_aprovacoes` | Operacional | 8 | Etapas de aprovação. |
| `bd_solicitacoes_itens` | Operacional | 20 | Itens solicitados. |
| `bd_solicitacoes_planejamento` | Operacional | 10 | Planejamento. |

## 8. Abastecimento

| Tabela | Tipo | # cols | Finalidade |
|---|---|---|---|
| `bd_abastecimentos` | Operacional | 35 | Registros de abastecimento. |
| `bd_abast_sync_log` | Integração | 11 | Log de sync com origem externa. |

## 9. Ordens de Serviço / Manutenção

| Tabela | Tipo | # cols | Finalidade |
|---|---|---|---|
| `bd_chamados_os` | Operacional | 15 | Chamados que viram OS. |
| `bd_ordens_servico` | Operacional | 28 | OS principal. |
| `bd_os_mao_obra` | Operacional | 8 | Mão de obra apontada. |
| `bd_os_materiais_utilizados` | Operacional | 8 | Materiais. |
| `bd_os_leituras_sensiveis` | Auditoria | 7 | Leituras sensíveis. |
| `bd_os_auditoria` | Auditoria | 8 | Mutações em OS. |
| `bd_registro_apontamento_inspecao` | Operacional | 22 | Inspeções de saída. |

## 10. Logística

| Tabela | Tipo | # cols | Finalidade |
|---|---|---|---|
| `bd_programacao_entrega` | Operacional | 10 | Programação macro. |
| `bd_lista_programacao_entrega` | Operacional | 16 | Itens da programação. |
| `bd_registro_cargas` | Operacional | 15 | Cargas pesadas/saídas. |
| `bd_carga_status_historico` | Histórico | 11 | Transições de status. |
| `bd_registro_apontamento_aplicacao` | Operacional | 33 | Aplicação no campo. |
| `bd_registro_aplicacao_detalhes` | Operacional | 30 | Detalhamento por rua. |
| `bd_registro_apontamento_cam_equipa` | Operacional | 15 | Apontamento de caminhão/equipe. |
| `bd_movimentacao_transporte` | Operacional | 11 | Transporte de ativos. |
| `bd_movimentacao_saida` | Operacional | 11 | Saídas. |
| `bd_movimentacoes` | Operacional | 18 | Movimentações genéricas. |
| `bd_logistica_auditoria` | Auditoria | 9 | Mutações logísticas. |
| `bd_auditoria_correcao_registros_carga` | Auditoria | 10 | Correções em cargas. |
| `bd_auditoria_correcao_volume_formula` | Auditoria | 9 | Correções de volume. |
| `bd_auditoria_volume_correcao` | Auditoria | 6 | Auditoria adicional. |

## 11. Apontamento de Equipe

| Tabela | Tipo | # cols | Finalidade |
|---|---|---|---|
| `bd_apontamento_equipe` | Operacional | 13 | Apontamento diário. |
| `bd_avaliacao_equipe` | Operacional | 15 | Avaliações. |
| `bd_auditoria_sync_equipe_funcionario` | Auditoria | 8 | Sincronização equipe ↔ funcionário. |

## 12. Planejamento Macro / Ordens Diárias

| Tabela | Tipo | # cols | Finalidade |
|---|---|---|---|
| `bd_planejamentos_obra` | Operacional | 13 | Planejamento de obra. |
| `bd_planejamento_atividades` | Operacional | 35 | Atividades WBS. |
| `bd_planejamento_atividade_equipe` | Operacional | 19 | Atividade ↔ equipe. |
| `bd_planejamento_recursos` | Operacional | 22 | Recursos alocados. |
| `bd_ordens_diarias_obra` | Operacional | 20 | OD de obra. |
| `bd_ordens_diarias_obra_itens` | Operacional | 24 | Itens da OD. |

## 13. Requisições

| Tabela | Tipo | # cols | Finalidade |
|---|---|---|---|
| `bd_requisicoes` | Operacional | 10 | Requisição-mãe. |
| `bd_ruas_requisicao` | Operacional | 14 | Ruas da requisição. |

## 14. Fluxos de Aprovação

| Tabela | Tipo | # cols | Finalidade |
|---|---|---|---|
| `bd_fluxos_aprovacao` | Configuração | 7 | Catálogo de fluxos. |
| `bd_fluxo_etapas` | Configuração | 12 | Etapas. |
| `bd_fluxo_centro_custo` | Configuração | 5 | Fluxo por CC. |
| `bd_fluxo_historico` | Histórico | 7 | Histórico de execução. |
| `bd_aprovacoes_fluxo_exec` | Operacional | 12 | Execução de aprovação. |
| `bd_aprovacoes_excecao` | Operacional | 11 | Exceções aprovadas. |
| `bd_envios` | Operacional | 7 | Envios para aprovação. |
| `bd_documentos_fluxo` | Storage-meta | 8 | Documentos do fluxo. |
| `bd_documentos_relacao` | Storage-meta | 3 | Relação documento ↔ entidade. |

## 15. Licitações / PNCP

| Tabela | Tipo | # cols | Finalidade |
|---|---|---|---|
| `bd_pncp_contratacoes` | Operacional | 31 | Contratações monitoradas. |
| `bd_pncp_todas_licitacoes` | Operacional | 21 | Universo de licitações sincronizadas. |
| `bd_pncp_config_monitoramento` | Configuração | 19 | Config de monitoramento. |
| `bd_pncp_perfis_busca` | Configuração | 16 | Perfis de busca. |
| `bd_pncp_sync_log` | Integração | 12 | Log de sync. |
| `bd_orgaos_publicos` | Mestre | 13 | Órgãos públicos. |
| `bd_orgaos_alias` | Mestre | 5 | Aliases normalizados. |
| `bd_orgaos_historico_metricas` | Histórico | 9 | Métricas históricas. |
| `bd_licitacoes_orgaos_pendentes` | Operacional | 9 | Órgãos pendentes de classificação. |
| `bd_matching_config` | Configuração | 7 | Calibração de matching. |
| `bd_matching_exclusoes` | Configuração | 5 | Exclusões. |

## 16. Cotações / Fornecedores

| Tabela | Tipo | # cols | Finalidade |
|---|---|---|---|
| `bd_cotacoes` | Operacional | 6 | Cotação-mãe. |
| `bd_cotacoes_itens` | Operacional | 5 | Itens. |
| `bd_cotacoes_propostas` | Operacional | 14 | Propostas. |
| `bd_integracao_fornecedores_log` | Integração | 10 | Log integração fornecedor (onboarding). |
| `bd_importacao_alterdata` | Integração | 17 | Importação Alterdata (folha). |

## 17. Notificações / Comunicação

| Tabela | Tipo | # cols | Finalidade |
|---|---|---|---|
| `bd_notificacoes` | Operacional | 9 | Catálogo de notificações. |
| `bd_notificacoes_usuarios` | Operacional | 6 | Entrega por usuário. |
| `bd_log_comunicacao` | Auditoria | 8 | Log de e-mails/notificações. |

## 18. Assinaturas Digitais

| Tabela | Tipo | # cols | Finalidade |
|---|---|---|---|
| `bd_assinaturas` | Operacional | 13 | Assinatura coletada (PNG + SHA-256 + IP). |
| `bd_assinaturas_usuarios` | Operacional | 11 | Assinatura por usuário/contexto. |

## 19. RBAC / Permissões

| Tabela | Tipo | # cols | Finalidade |
|---|---|---|---|
| `bd_roles` | Configuração | 6 | Papéis (SuperAdm, AdmRH...). |
| `bd_permissions` | Configuração | 10 | Catálogo de permissões (`codigo`, `rota`). |
| `bd_role_permissions` | Configuração | 4 | N:N role ↔ permission. |
| `bd_role_permission_actions` | Configuração | 5 | Permissão granular por ação. |
| `bd_user_roles` | Configuração | 4 | N:N usuário ↔ role. |
| `bd_user_permission_overrides` | Configuração | 7 | Allow/Deny override por usuário. |
| `bd_permissoes_acoes` | Configuração | 5 | Catálogo de ações por permissão. |
| `bd_permissoes` | Legado | 7 | **Legado** — manter até cutover do RBAC v1. |
| `bd_funcoes_permissao` | Legado | 7 | **Legado** — fallback histórico. |
| `bd_rbac_legacy_map` | Configuração | 7 | Mapa de migração legacy → novo. |
| `bd_permission_audit_logs` | Auditoria | 6 | Log de verificações de permissão. |
| `bd_permission_change_audit_logs` | Auditoria | 10 | Log de mudanças no catálogo. |

## 20. Auditoria transversal

| Tabela | Tipo | # cols | Finalidade |
|---|---|---|---|
| `bd_auditoria_log` | Auditoria | 9 | Auditoria genérica (JSONB anterior/novo). |
| `bd_auditoria_log_archive` | Auditoria | 10 | Arquivamento (cron diário). |
| `bd_auditoria_biometria` | Auditoria | 13 | Mutações em biometria. |
| `bd_auditoria_leitura_funcionario_sensivel` | Auditoria | 7 | Quem leu colunas sensíveis. |
| `bd_security_audit_log` | Auditoria | 11 | Eventos de segurança. |
| `bd_backend_exec_auditoria` | Auditoria | 19 | Execuções de funções backend. |
| `bd_bi_relatorios_auditoria` | Auditoria | 10 | Quem gerou relatórios BI. |
| `bd_storage_auditoria` | Auditoria | 9 | Acessos ao Storage. |

## 21. Suporte / Infra / Cache

| Tabela | Tipo | # cols | Finalidade |
|---|---|---|---|
| `bd_configuracoes_sistema` | Configuração | 7 | Parâmetros globais. |
| `bd_cache_enderecos` | Cache | 12 | Cache de geocoding (Mapbox). |
| `bd_geocoding_falhas` | Auditoria | 8 | Falhas de geocoding. |
| `_mv_relatorio_diarias_dirty` | Configuração | 3 | Flag de invalidação de MV (1 linha). |
| `profiles` | Mestre | 14 | Perfil de aplicação espelho de `auth.users`. |

## Observações de migração

- **Tabelas legadas (`bd_permissoes`, `bd_funcoes_permissao`)** devem permanecer durante migração e ser descomissionadas em release dedicada.
- **Tabelas append-only de auditoria** podem migrar para schema `audit` separado, particionado por mês.
- **`bd_funcionarios_sensivel`** exige criptografia at-rest no servidor próprio (pgcrypto coluna-a-coluna ou TDE no FS).
- **`bd_funcionarios_biometria_facial`** + bucket `biometria-facial`: dado biométrico (LGPD art. 11) — isolar fisicamente.
