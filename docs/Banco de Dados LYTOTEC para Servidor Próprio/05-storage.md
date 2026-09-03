# 05 — Storage

## Inventário de buckets (17)

| Bucket | Público | File size limit | Finalidade | Tabela espelho | Quem faz upload | Quem lê | Sensibilidade |
|---|---|---|---|---|---|---|---|
| `avatars` | ❌ | — | Fotos de perfil do usuário | `profiles.avatar_url` | Próprio usuário | Próprio usuário + admin | Baixa |
| `funcionarios` | ❌ | — | Foto de funcionário + documentos RH | `bd_funcionarios.foto_url` | RH | RH + escopo departamental | Pessoal (LGPD) |
| `biometria-facial` | ❌ | — | Embeddings e fotos para reconhecimento | `bd_funcionarios_biometria_facial` | Edge `cadastrar-biometria-facial` (service_role) | Edge `identificar-funcionario-*` | **Biométrico (LGPD art. 11)** |
| `ponto-fotos` | ❌ | — | Foto registrada em cada batida | `bd_ponto_batidas.foto_url` | Edges `registrar-ponto-*` | RH/Gestão escopo CC | Pessoal |
| `assinaturas` | ❌ | — | Assinaturas PNG capturadas | `bd_assinaturas.png_path` | Usuário autenticado | Auditoria + RH | Pessoal |
| `assinaturas-funcionarios` | ❌ | — | Assinatura do funcionário em documentos | `bd_assinaturas_usuarios` | Usuário autenticado | Auditoria + RH | Pessoal |
| `exames_agendamentos` | ❌ | — | Anexos médicos (ASO, atestados) | `bd_agendamentos_exames_anexos` | RH/SSO | RH/SSO + escopo | **Sensível médico (LGPD art. 11)** |
| `sso-desvios` | ❌ | — | Fotos de desvios SSO | `bd_registro_desvios_fotos` | SSO/Encarregado | SSO + gestão | Operacional |
| `sso-checklists` | ❌ | 10 MB | Anexos de checklists SSO | `bd_sso_checklists` | SSO/operacional | SSO + gestão | Operacional |
| `sso-ver-agir` | ❌ | — | Anexos do programa Ver & Agir | `bd_sso_ver_agir` | SSO | SSO + gestão | Operacional |
| `inspecao-fotos` | ❌ | — | Fotos do checklist de saída | `bd_registro_apontamento_inspecao.fotos` | Apontador | Manutenção/Logística | Operacional |
| `apontamentos` | ❌ | — | Evidências de aplicação | `bd_registro_apontamento_aplicacao` | Encarregado/Apontador | Operacional | Operacional |
| `os_photos` | ❌ | — | Anexos de OS | `bd_ordens_servico` | Manutenção | Manutenção | Operacional |
| `tickets` | ❌ | — | Anexos de chamados | `bd_chamados_os` | Operacional | Manutenção | Operacional |
| `documentos-rh` | ❌ | — | Documentos administrativos RH | `bd_documentos_relacao` + `bd_documentos_fluxo` | RH | RH + dirigentes | **Pessoal/Confidencial** |
| `veiculos` | ✅ | — | Foto pública de veículo/equipamento | `bd_caminhoes_equipamentos.foto_url` | Frota | Público (ERP exibe sem assinar URL) | Baixa |
| `empresas-logos` | ✅ | — | Logos para PDFs e UI | `bd_empresas.logo_url` | Admin empresas | Público | Baixa |

## Como os paths são gravados

- Padrão geral: `{recurso}/{id_ou_uuid}/{arquivo}.{ext}`.
- Avatars: `profile-images/{user_id}.{ext}` (validado em policy storage).
- Funcionários: `{funcionario_id}/foto.{ext}` ou `{funcionario_id}/docs/{tipo}.pdf`.
- Ponto: `{ano}/{mes}/{funcionario_id}/{batida_id}.jpg`.
- Anexos exames/desvios/ver-agir: `{registro_id}/{uuid}.{ext}`.

## Políticas atuais (resumo)

- Buckets **privados**: acesso somente via signed URL (TTL curto) gerado por client autenticado ou edge.
- Buckets **públicos** (`veiculos`, `empresas-logos`): leitura anônima permitida — apenas conteúdo não-sensível.
- Função `fn_storage_audit_access` é chamada explicitamente por código de aplicação para registrar leituras em `bd_storage_auditoria`.

## Riscos LGPD

| Risco | Buckets impactados | Mitigação atual | Recomendação para servidor próprio |
|---|---|---|---|
| Signed URL vazada permite acesso sem RLS | Todos privados | TTL curto + auditoria parcial | Reduzir TTL para ≤ 5 min; logar emissão em `bd_storage_auditoria` |
| Dados biométricos em backend de terceiro | `biometria-facial` | Bucket privado + edge dedicada | **Migrar para storage local on-prem criptografado** |
| Anexos médicos retidos sem política | `exames_agendamentos` | Bucket privado | Definir retenção (ex.: 20 anos pós-desligamento por NR-7) e rotina de purga |
| Foto de ponto contém PII visível | `ponto-fotos` | Bucket privado | Mesma política de retenção da CLT (5 anos) |
| Assinatura digital pode ser baixada | `assinaturas*` | Privado + hash SHA-256 em `bd_assinaturas` | Manter; assinatura é evidência legal |
| Buckets públicos podem ser indexados | `veiculos`, `empresas-logos` | Conteúdo controlado | Confirmar que nenhum upload acidental contém PII |

## Análise por categoria

### Documentos de funcionários (`funcionarios`, `documentos-rh`)
- Quem lê: RH e gestão dentro do escopo departamental.
- Risco: download em massa por administrador.
- Recomendação on-prem: bucket dedicado, criptografia em repouso (SSE-S3 / MinIO + KMS), watermark dinâmico opcional em PDF.

### Fotos de ponto (`ponto-fotos`)
- Volumetria alta (1 foto / batida × milhares por mês).
- Recomendação: storage com lifecycle (mover > 90 dias para tier frio).

### Biometria (`biometria-facial`)
- **Não pode ser exportado para terceiros sem base legal**.
- Recomendação: dedicar volume on-prem, criptografia de coluna do embedding (`pgcrypto` ou KMS), proibir acesso direto fora das edges autorizadas.

### PDFs gerados (relatórios de diárias, folha, classificação, desligamento, transferência, VT, ponto)
- Atualmente gerados client-side (jsPDF) e armazenados em `documentos-rh` ou similar quando persistidos.
- Recomendação: padronizar bucket `relatorios/` com retenção alinhada ao tipo (financeiro 5 anos, RH 20 anos, operacional 1 ano).

### Anexos de exames/desligamento
- Possuem dados médicos.
- Recomendação: criptografia + acesso somente RH/SSO + log obrigatório.

### Documentos administrativos (`documentos-rh`, `tickets`, `os_photos`)
- Vínculo via `bd_documentos_relacao`.
- Recomendação: manter modelo de relacionamento, padronizar nomenclatura.

## Recomendações para servidor próprio (resumo)

1. **Substituir Supabase Storage por MinIO** (compatível S3) ou armazenamento dedicado on-prem.
2. **Manter topologia atual de buckets** (17 buckets, mesmos nomes) — zero impacto em código.
3. **Migrar dados via `rclone sync` ou `mc mirror`** durante janela de cutover.
4. **Atualizar geração de signed URL** para apontar para domínio interno (`storage.lytoranea.local`).
5. **Habilitar audit log nativo do MinIO** (substitui `bd_storage_auditoria` na cobertura completa).
6. **Criptografia em repouso obrigatória** para buckets sensíveis (biometria, exames, documentos-rh, ponto-fotos, assinaturas).
7. **Backup independente do banco** — Storage em rotina dedicada (snapshot + cópia off-site).
