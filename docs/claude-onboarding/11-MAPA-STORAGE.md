# 11 — MAPA DE STORAGE

> Auditoria READ-ONLY. Fonte: `INSERT INTO storage.buckets` nas migrations, `supabase/storage.sql`, policies em `storage.objects`, e referências no código.
> Buckets criados fora das migrations não têm visibilidade estática — marcados `[VERIFICAR NO BANCO]`.

---

## 1. Inventário de buckets

### 1.1 Criados via migration (19)

| Bucket | Público? | Migration de criação | Conteúdo |
|---|:--:|---|---|
| `apontamentos` | 🔴 **PÚBLICO** | `20250722172552` | Fotos/anexos de apontamento de equipe e caminhões |
| `avatars` | 🔴 **PÚBLICO** | `20250722172552` | Fotos de perfil (`profile-images/`) |
| `funcionarios` | 🔴 **PÚBLICO** | `20250722172552` | Documentos/fotos de funcionários |
| `inspecao-fotos` | 🔴 **PÚBLICO** | `20250722172552` | Fotos de inspeção de veículos |
| `tickets` | 🔴 **PÚBLICO** | `20250722172552` | Tickets de carga/balança |
| `veiculos` | 🔴 **PÚBLICO** | `20250722172552` | Fotos e documentos de veículos |
| `os_photos` | 🟢 privado | `20250722172552` | Fotos de OS — **era público, tornado privado** em `20260422201946` |
| `portfolio` | 🔴 **PÚBLICO** | `20250821150819` | Site institucional (legado) |
| `services` | 🔴 **PÚBLICO** | `20250821165752` | Site institucional (legado) |
| `empresas-logos` | 🔴 **PÚBLICO** | `20260327183303` | Logotipos de empresas |
| `sso-checklists` | 🔴 **PÚBLICO** | `20251119133217` | Anexos de checklists de SSO |
| `sso-desvios` | 🟢 privado | `20260122181757` | Fotos de desvios de segurança |
| `sso-ver-agir` | 🟢 privado | `20260206134336` | Anexos do Ver e Agir |
| `exames_agendamentos` | 🟢 privado | `20260126112824` | Anexos de exames ocupacionais |
| `documentos-rh` | 🟢 privado | `20260319132349` | Documentos de RH |
| `assinaturas` | 🟢 privado | `20260322140951` | Assinaturas |
| `assinaturas-funcionarios` | 🟢 privado | `20260426142901` | Assinaturas de funcionários (só SuperAdm) |
| `biometria-facial` | 🟢 privado | `20260420202330` | Imagens de referência facial |
| `ponto-fotos` | 🟢 privado | `20260415141223` | Fotos de registro de ponto |

### 1.2 Referenciados no código/policies mas **sem `CREATE` versionado** (4)

| Bucket | Onde aparece | Público? |
|---|---|---|
| `pops-documentos` | `_shared/pops-cors.ts` (`POPS_BUCKET`), 2 policies | **`[VERIFICAR]`** — pelo desenho das Edge (signed URL / blob proxy), deve ser privado |
| `atestados-medicos` | `atestado-*` functions (`BUCKET = "atestados-medicos"`) | **`[VERIFICAR]`** — deve ser privado (acesso via signed URL) |
| `ct-checklists` | 4 policies (`bucket_id='ct-checklists'`) | **`[VERIFICAR]`** |
| `chamados-internos-anexos` | 3 policies, migration `20260818114535` | **`[VERIFICAR]`** |

**`[VERIFICAR NO BANCO]` — inventário real e definitivo:**
```sql
select id, name, public, file_size_limit, allowed_mime_types, created_at
from storage.buckets
order by public desc, id;
```

---

## 2. Buckets públicos — análise de risco

Um bucket `public = true` no Supabase significa que **qualquer URL `/storage/v1/object/public/<bucket>/<path>` é servida sem autenticação**. As policies de `storage.objects` **não se aplicam** a esse caminho de leitura.

### 🔴 Risco alto
| Bucket | Por quê |
|---|---|
| **`funcionarios`** | Documentos e fotos de funcionários — PII. Se contiver RG/CPF/CTPS digitalizados, é exposição direta de dados pessoais. |
| **`apontamentos`** | Fotos de campo — podem conter pessoas identificáveis, placas, documentos de carga. |
| **`tickets`** | Tickets de balança contêm dados operacionais e comerciais (peso, cliente, obra). |
| **`sso-checklists`** | Documentos de segurança do trabalho podem conter nomes e situações de saúde/incidentes. |

### 🟡 Risco médio
| Bucket | Por quê |
|---|---|
| `avatars` | Fotos de perfil — exposição moderada, comum em SaaS. |
| `inspecao-fotos`, `veiculos` | Fotos de ativos — risco operacional (placas, localização implícita). |
| `empresas-logos` | Logotipos — público é aceitável. |

### ⚪ Risco baixo / esperado
`portfolio`, `services` — site institucional; leitura pública é o propósito (tabelas correspondentes têm policies "publicly readable").

### Precedente positivo
`os_photos` **já foi corrigido**: criado público em `20250722172552` e tornado privado em `20260422201946_c93b80a3-...`. Existe portanto um procedimento estabelecido para essa correção.

**`[VERIFICAR]` — teste de exposição (leitura, sem alterar nada):**
```bash
# Listar o que há em um bucket público exige a API de list (autenticada),
# mas o acesso direto a um objeto conhecido não exige nada:
curl -I "https://eexzgpmrousuxlkvqwkm.supabase.co/storage/v1/object/public/funcionarios/<path-conhecido>"
```
```sql
-- Quantos objetos e que tamanho há em cada bucket público
select b.id as bucket, b.public, count(o.id) as objetos,
       pg_size_pretty(sum((o.metadata->>'size')::bigint)) as tamanho
from storage.buckets b
left join storage.objects o on o.bucket_id = b.id
group by 1,2 order by b.public desc, 3 desc;

-- Amostra de extensões por bucket público (indica se há documentos, não só imagens)
select bucket_id, lower(regexp_replace(name, '^.*\.', '')) as ext, count(*)
from storage.objects
where bucket_id in ('funcionarios','apontamentos','tickets','sso-checklists','avatars','veiculos','inspecao-fotos')
group by 1,2 order by 1, 3 desc;
```

---

## 3. Policies em `storage.objects` (44 vivas)

Distribuição por bucket (menções a `bucket_id` nas policies):

| Menções | Bucket |
|---:|---|
| 17 | `sso-checklists` |
| 13 | `services` |
| 9 | `tickets`, `portfolio`, `os_photos` |
| 8 | `apontamentos` |
| 7 | `exames_agendamentos`, `avatars` |
| 5 | `sso-ver-agir` |
| 4 | `ct-checklists`, `veiculos`, `sso-desvios`, `inspecao-fotos`, `funcionarios`, `empresas-logos`, `biometria-facial`, `assinaturas-funcionarios` |
| 3 | `chamados-internos-anexos`, `assinaturas` |
| 2 | `pops-documentos`, `ponto-fotos`, `documentos-rh` |

### Exemplo de policy bem construída — `assinaturas-funcionarios` (`20260426142901`)
```sql
CREATE POLICY "assinaturas_func_select_admin" ON storage.objects FOR SELECT
USING (bucket_id = 'assinaturas-funcionarios' AND public.is_super_admin(auth.uid()));
```
4 policies (SELECT/INSERT/UPDATE/DELETE), todas exigindo `is_super_admin` (predicado **estrito**). Bucket privado. **Padrão correto.**

### Exemplo — `chamados-internos-anexos` (`20260818114535`)
```sql
... AND public.fn_chamado_interno_can_read(((storage.foldername(name))[1])::uuid) IS TRUE
```
Autorização por **convenção de path**: o primeiro segmento do nome é o UUID do chamado. Padrão bom, porém depende de o upload sempre respeitar a convenção.

### 🟠 Policy permissiva em `storage.buckets`
```sql
CREATE POLICY "Allow bucket creation" ON storage.buckets
FOR ALL TO authenticated USING (true) WITH CHECK (true);
```
_(migration `20250703183928-6e477a49-...`)_

**Qualquer usuário autenticado pode criar, renomear, tornar público ou apagar buckets.** Um usuário poderia tornar um bucket privado em público.

**`[VERIFICAR NO BANCO]`**
```sql
select policyname, cmd, roles, qual, with_check
from pg_policies where schemaname='storage' and tablename='buckets';
```

### `supabase/storage.sql` — arquivo avulso
Cria o bucket `avatars` (público) e 3 policies:
- `Allow public read access on avatars` — SELECT, **sem cláusula `TO`** ⇒ role `public`
- upload/update restritos a `authenticated` e `foldername(name)[1] = 'profile-images'`

Não há política de DELETE para `avatars`.

---

## 4. Funções de apoio ao Storage

| Função | Papel |
|---|---|
| `fn_storage_can_access(...)` | Predicado geral de leitura |
| `fn_storage_can_upload(...)` | Predicado geral de escrita |
| `fn_storage_audit_access(...)` | Grava em `bd_storage_auditoria` |
| `fn_storage_entity_id(...)`, `fn_storage_entity_type(...)`, `fn_storage_extract_uuid(...)` | Derivam a entidade a partir do path do objeto |
| `fn_os_storage_object_allowed(...)` | Específica de OS |
| `fn_chamado_interno_can_read(uuid)` | Usada nas policies de anexos de chamados |
| `fn_pop_anexar_arquivo_rascunho(...)` | POPs |

Tabela de auditoria: `bd_storage_auditoria` (`actor_user_id` **sem FK**).

---

## 5. Padrões de acesso a arquivos por módulo

| Módulo | Padrão | Observação |
|---|---|---|
| **POPs** | Edge Function como proxy (`pop-arquivo-blob`) e upload via Edge (`pop-upload-arquivo`, limite **20 MB**) com CORS por allowlist | 🟢 Mais seguro do projeto — o browser nunca fala direto com o Storage |
| **Atestados** | `atestado-criar-upload-url` (signed upload URL) → `atestado-submeter` → `atestado-arquivo-signed-url` / `atestado-arquivo-blob`, tudo com HMAC + nonce | 🟢 Correto para fluxo público |
| **Biometria facial** | Bucket privado + `cadastrar-biometria-facial` com `getClaims` | 🟢 |
| **Assinaturas de funcionários** | Bucket privado + policies exigindo `is_super_admin` | 🟢 |
| **Ponto (fotos)** | Bucket privado `ponto-fotos`; frontend acessa via `storage.from('ponto-fotos')` | 🟡 depende de policy |
| **Apontamentos** | Frontend acessa `storage.from('apontamentos')` direto; **bucket público** | 🔴 |
| **RH / SSO / veículos** | Upload direto do frontend | 🟡 a mapear caso a caso |

Componentes de upload no frontend: `react-dropzone`, `src/components/funcionarios/ImageUploader.tsx` (**órfão**), `FuncionarioImageUploadModal.tsx` (**órfão**), `src/components/assinatura/`, `src/components/sso*/`.

---

## 6. Limites e validação de upload

- `POPS_MAX_BYTES = 20 * 1024 * 1024` (20 MB) — **única constante de limite encontrada no código**.
- **Nenhum `file_size_limit` ou `allowed_mime_types`** é definido nas migrations de criação de bucket.

**`[VERIFICAR NO BANCO]`**
```sql
select id, public, file_size_limit, allowed_mime_types from storage.buckets order by 1;
```
Se `file_size_limit` e `allowed_mime_types` estiverem `NULL`, o projeto aceita **qualquer tipo de arquivo em qualquer tamanho** (até o limite global do plano) nos buckets sem validação em Edge Function — o que inclui HTML/SVG com script em buckets **públicos** (vetor de XSS armazenado servido do domínio do Supabase).

---

## 7. Riscos reais (apenas os que se sustentam nas evidências)

| # | Risco | Severidade | Evidência |
|---|---|---|---|
| S1 | Bucket `funcionarios` público pode expor documentos de PII sem autenticação | **ALTO** | `INSERT INTO storage.buckets ... ('funcionarios','funcionarios', true)` |
| S2 | Buckets `apontamentos`, `tickets`, `sso-checklists` públicos expõem dados operacionais e de segurança do trabalho | **ALTO** | idem |
| S3 | `Allow bucket creation` permite a qualquer autenticado criar/alterar/apagar buckets | **ALTO** | policy viva em `storage.buckets` |
| S4 | Ausência de `allowed_mime_types` em buckets públicos → XSS armazenado (SVG/HTML) | **MÉDIO** | nenhum `allowed_mime_types` nas migrations |
| S5 | Ausência de `file_size_limit` → abuso de armazenamento | **MÉDIO** | idem |
| S6 | 4 buckets sem `CREATE` versionado — o estado de `public` deles não é auditável pelo repositório | **MÉDIO** | `pops-documentos`, `atestados-medicos`, `ct-checklists`, `chamados-internos-anexos` |
| S7 | Bucket `avatars` sem policy de DELETE | **BAIXO** | `supabase/storage.sql` |
| S8 | Buckets `portfolio`/`services` de um site institucional que não existe mais no frontend | **INFORMATIVO** | nenhuma rota consome |

**Nenhuma correção foi aplicada.** Priorização consolidada em `14-RISCOS-SEGURANCA.md`.
