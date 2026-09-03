# 20 — RESUMO EXECUTIVO

**Auditoria READ-ONLY do ERP LYTOTEC — 2026-08-31**

> **ALTERAÇÕES REALIZADAS NA APLICAÇÃO: 0**
> **ALTERAÇÕES REALIZADAS NO BANCO: 0**
> **MIGRATIONS APLICADAS: 0**
> **DEPLOYS REALIZADOS: 0**
> Único artefato criado: esta pasta `docs/claude-onboarding/` (20 documentos, sem efeito em runtime).

---

## 1. O que é o sistema

ERP corporativo em produção da **Lytorânea Construtora**, com usuários reais, dados reais e operação de campo (obras, ponto eletrônico, logística de asfalto).

| Dimensão | Número |
|---|---:|
| Linhas de código (`src/`) | **~358.400** |
| Arquivos `.ts`/`.tsx` | 1.814 |
| Rotas | 95 |
| Módulos funcionais | 11 grupos de menu, ~60 telas |
| Tabelas (Postgres) | **194** |
| Views + materialized views | **70** |
| Funções expostas como RPC | **452** |
| Definições de função no banco | 593 (499 `SECURITY DEFINER`) |
| Triggers vivos | **219** em 106 tabelas |
| Policies RLS vivas | **684** |
| Índices | 434 |
| Migrations | **869** (6,8 MB) |
| Edge Functions | **36** |
| Buckets de Storage | 23 |
| Commits | 11.369 (99,9% gerados pelo Lovable) |

**Stack:** React 18 + TypeScript 5.5 + Vite 5 + Tailwind + shadcn/ui + Supabase (PostgreSQL 17) + Mapbox + face-api.js + PWA. Deploy em Netlify a partir de `main`.

---

## 2. A característica arquitetural mais importante

**A lógica de negócio do ERP mora no banco, não no TypeScript.**

O frontend faz **217 chamadas `.rpc()`** contra **180 acessos diretos a tabela**. Existem 452 RPCs, 219 triggers e uma família consistente de predicados de autorização (`fn_<dominio>_can_<acao>_<entidade>`) reutilizados tanto dentro das policies RLS quanto como RPC consultável pelo frontend.

**Consequência prática:** corrigir um comportamento de negócio quase sempre significa alterar uma função PL/pgSQL, não um componente React. Isso torna o protocolo de banco (`18-REGRAS-PARA-DESENVOLVIMENTO-FUTURO.md` §4) obrigatório na maioria das tarefas.

---

## 3. O que está muito bem feito

1. **RLS habilitado em 100% das 194 tabelas** — sem exceção.
2. **484 de 499 funções `SECURITY DEFINER` com `SET search_path`** — postura correta contra hijacking.
3. **Nenhum `service_role` no frontend.** Nenhum secret hardcoded em Edge Functions.
4. **Arquitetura madura de escopo por centro de custo**, coerente entre 40 tabelas e todos os módulos.
5. **13 tabelas de auditoria**, incluindo auditoria de **leitura** de dados sensíveis — raro e valioso.
6. **Segregação de client nas Edge Functions**: autorização com o JWT do usuário, efeito colateral com `service_role` (exemplo exemplar: `pop-excluir`).
7. **Fluxo público de atestados com HMAC + nonce + signed URLs** — o fluxo público mais bem protegido do sistema.
8. **Service Worker defensivo** — bypass explícito de `*.supabase.co`, `/functions/v1/`, `/auth/`. Nenhum token cacheado.
9. **Migrações feitas em modo aditivo e reversível**: redirects que preservam deep links, rotas `_legacy` como fallback, `ponto-diaria-shadow` rodando em paralelo sem efeito, frente `FROZEN` documentada.
10. **Telemetria de cutover de RBAC já instalada e coletando** (`bd_permission_audit_logs`) — o ativo mais valioso para consolidar o RBAC com segurança.
11. **Code splitting agressivo** (6 imports síncronos, 10 `manualChunks`), `console.*` removido do bundle de produção.
12. **113 arquivos de teste** concentrados exatamente nas áreas mais complexas (Central do Transporte, importador de veículos, Diárias).

---

## 4. Os problemas que exigem decisão imediata

### 🔴 P1 — `bd_funcionarios` provavelmente exposta a qualquer pessoa na internet
Três policies vivas de `SELECT ... USING (true)` — duas para o role **`anon`**. A tabela contém `cpf`, `salario_base`, `chave_pix`, `conta_corrente`, `banco`, `agencia`, `data_nascimento`, endereço completo e coordenadas GPS de todos os funcionários.

O comentário na migration afirma que "não expõe dados sensíveis pois o código da aplicação filtra apenas email, nome_completo e status" — **RLS filtra linhas, não colunas**. A `anon key` é pública por design e está no bundle.

Como as policies são **PERMISSIVE** (combinam por OR) e só existe **1 policy RESTRICTIVE** em todo o projeto, toda a arquitetura de proteção de funcionários (`bd_funcionarios_sensivel`, `vw_funcionarios_*`, `fn_funcionarios_can_select_row`, auditoria de leitura sensível) fica **inoperante**.

→ `14-RISCOS-SEGURANCA.md` SEC-01. **Verificação em uma consulta.**

### 🔴 P2 — `pncp-sync`: autenticação contornável por um campo do corpo
`{"source":"cron"}` no body dispensa qualquer autenticação; e quando há `Authorization`, ele nunca é validado. A função então opera com `service_role`.
→ SEC-02.

### 🟠 P3 — `geocode-proxy` sem nenhuma autenticação
Proxy Mapbox aberto com `service_role`, gravando em `bd_cache_enderecos` — cache que alimenta o geocoding de centros de custo e, por consequência, a **cerca geográfica do ponto eletrônico**.
→ SEC-03.

### 🟠 P4 — Elevação de privilégio na UI via `localStorage`
`user_offline_context` não é assinado. Gravar `{"isSuperAdmin":true,"permissions":["*"],"validatedFromServer":true}` libera a interface administrativa completa. O RLS ainda protege os dados — **exceto** nas 93 tabelas com policies `USING(true)`.
→ SEC-04, combinado com SEC-05.

### 🟠 P5 — 93 policies permissivas anulam o desenho de RLS
Escrita irrestrita para qualquer autenticado em `bd_centros_custo` (eixo de escopo de 40 tabelas e da cerca do ponto), `bd_caminhoes_equipamentos`, `bd_empresas`, `bd_departamentos`, `bd_equipes`, `bd_ordens_servico`, catálogos de ativos e mais. Inclui policies com nome `"Allow all access to X during development"` ainda vivas em produção.
→ SEC-05, inventário completo em `08-MAPA-RLS.md` §5.

### 🟠 P6 — Buckets públicos com PII e `Allow bucket creation`
`funcionarios`, `apontamentos`, `tickets`, `sso-checklists` são públicos (objetos servidos sem autenticação). E qualquer usuário autenticado pode **criar, tornar público ou apagar buckets** — inclusive `documentos-rh`, `biometria-facial` e `atestados-medicos`.
→ SEC-06, SEC-07.

---

## 5. A dívida técnica estrutural

### 5.1 Dois sistemas de RBAC ativos simultaneamente
| RBAC NOVO | RBAC LEGADO |
|---|---|
| `bd_roles` / `bd_permissions` / `bd_role_permission_actions` / `bd_user_roles` / `bd_user_permission_overrides` | `bd_permissoes` / `bd_funcoes_permissao` + `profiles.{funcoes, funcao_sistema, funcao_permissao, acesso_global}` |
| `src/services/rbac/` | `src/services/permissoes/` |
| `fn_has_action` | ramo `legacy_allow` dentro de `fn_has_permission` |

Somando os caminhos do frontend, existem **7 fontes de autoridade** avaliadas em OR, das quais 4 podem produzir `permissions = ['*']` sem consultar o RBAC.

E existem **9 predicados de SuperAdmin** — sendo que `is_super_admin` (estrita, só `bd_user_roles`) e `fn_is_super_admin` (ampla, 4 fontes) **divergem**: um usuário com `profiles.acesso_global = true` mas sem papel em `bd_user_roles` tem acesso a 378 policies e é rejeitado por 2 Edge Functions.

**Ponto positivo:** a transição está instrumentada (flag `RBAC_LEGACY_FALLBACK_ENABLED`, `bd_rbac_legacy_map`, `vw_rbac_legacy_map_drift`, telemetria em `bd_permission_audit_logs`). **O cutover é viável e mensurável — falta executá-lo.**

### 5.2 Segregação de dados sensíveis inacabada
`bd_funcionarios_sensivel` existe, com colunas de hash — mas **os mesmos dados continuam em `bd_funcionarios`**. Migração aditiva iniciada e nunca concluída.

### 5.3 161 arquivos órfãos (~9% de `src/`)
Inclui 12 páginas sem rota, 7 hooks de permissão mortos, 2 guards mortos, o diretório inteiro **duplicado** `src/components/funcionarios/funcionarios/`, 9 componentes de Relatório de Medição, 11 da Central do Transporte, 11 componentes shadcn nunca usados.

### 5.4 Outras duplicidades
Dois motores de aprovação (dinâmico × hardcoded por cargo) · três gerações do importador de veículos · dois motores de gráfico (`recharts` + `apexcharts`) · três lockfiles · dois utilitários de duração · duas implementações de toast.

### 5.5 Higiene de repositório e build
- `.env` rastreado no Git e ausente do `.gitignore`
- `package.json` **sem scripts `test` e `typecheck`**, apesar de 113 testes e `vitest.config.ts`
- Sem CI/CD (`.github/` ausente)
- `tsconfig` totalmente permissivo (`strict: false`, `strictNullChecks: false`, `noImplicitAny: false`)
- `netlify.toml` fixa `NODE_VERSION=18` enquanto `.nvmrc` pede `22.18.0`
- Sem CSP nem SRI; scripts de CDNs externas (`cdn.gpteng.co`, `cdnjs.cloudflare.com`)
- Auth configurado em `http://` (não `https://`)
- Proxy Python legado versionado, com `.pyc` de um arquivo que não existe mais
- Arquivos vazios e artefatos temporários na raiz

---

## 6. Limitação relevante desta auditoria

O MCP Supabase disponível nesta sessão aponta para o projeto **`zoruxlcqkagcqrmevmrk`** — um SaaS de licitações/PNCP **não relacionado** ao ERP. O projeto real do LYTOTEC é **`eexzgpmrousuxlkvqwkm`**.

**Toda a auditoria de banco foi feita estaticamente**, por replay cronológico das 869 migrations e leitura do schema gerado em `types.ts`. Isso é confiável para estrutura, mas **não confirma o estado real de policies, volume de dados, buckets, jobs `pg_cron` e objetos criados fora das migrations**.

Cada item que exige confirmação está marcado `[VERIFICAR NO BANCO]` com a consulta SQL correspondente.

**Verificações da Parte 16 (typecheck / lint / testes / build) NÃO foram executadas** porque `node_modules/` não existe e instalá-lo violaria a regra absoluta desta auditoria ("instalar bibliotecas"). Os comandos estão em `16-LEGADO-DUPLICIDADES.md` §10.

---

## 7. Recomendações para a transição Lovable → Claude Code

### Fase 0 — Verificação (antes de qualquer código)
1. Conectar o MCP ao projeto correto (`eexzgpmrousuxlkvqwkm`) ou fornecer acesso read-only.
2. Rodar as consultas `[VERIFICAR NO BANCO]` de `08-MAPA-RLS.md` §4 e `14-RISCOS-SEGURANCA.md` — **especialmente SEC-01**.
3. Confirmar se `github.com/julianohenrcampos/lytoranea` é público ou privado.
4. Confirmar se `lytotec.com.br` redireciona para HTTPS.
5. Rodar `bun install` + `tsc --noEmit` + `vitest run` + `lint` + `build` para estabelecer a linha de base.

### Fase 1 — Segurança (com plano aprovado item a item)
Ordem sugerida: P1 → P2 → P3 → P6 → P4 → P5.
> ⚠️ P5 (as 93 policies) **não é uma remoção simples**: cada policy `USING(true)` pode estar sustentando um fluxo em produção. Cada remoção exige mapear quem lê/escreve a tabela e escrever a policy substituta correta antes.

### Fase 2 — Fundação de qualidade
- Adicionar `.env` ao `.gitignore` e criar `.env.example`
- Adicionar scripts `test` e `typecheck` ao `package.json`
- Adicionar CI (GitHub Actions: typecheck + lint + test + build em PR)
- Alinhar `NODE_VERSION` entre `.nvmrc` e `netlify.toml`
- Escolher **um** gerenciador de pacotes e remover os lockfiles restantes
- Adicionar headers de segurança em `netlify.toml` (CSP, X-Frame-Options, Referrer-Policy)

### Fase 3 — Consolidação do RBAC (projeto próprio, com plano dedicado)
1. Extrair e analisar 60–90 dias de `bd_permission_audit_logs` (consulta em `06-MAPA-RBAC.md` §6.2)
2. Identificar quais ramos legados ainda são realmente exercidos e por quais usuários
3. Migrar esses usuários para `bd_user_roles` + `bd_role_permission_actions`
4. Desligar `RBAC_LEGACY_FALLBACK_ENABLED` em ambiente de homologação e observar
5. Unificar os 9 predicados de SuperAdmin — **com decisão explícita** sobre a semântica correta
6. Só então remover os ramos legados de `fn_has_permission` e do `usePermission`

### Fase 4 — Higiene (baixo risco, alto ganho de legibilidade)
Remoção dos 161 órfãos e do diretório duplicado, **um módulo por vez, com aprovação por lote**.

### Fase 5 — Desacoplamento do Lovable (quando decidido)
`previewAuthStorage`, `lovable-tagger`, script `gptengineer.js`, `.lovable/`, `og:url`. **Nada disso deve ser removido antes de a equipe abandonar de fato o editor Lovable.**

---

## 8. Como usar esta documentação

| Preciso de… | Leia |
|---|---|
| Visão geral e stack | `01-ARQUITETURA-GERAL.md` |
| Onde fica a tela X | `02-MAPA-FRONTEND.md`, `04-MAPA-MODULOS.md` |
| Onde fica a tabela/RPC Y | `03-MAPA-BACKEND-SUPABASE.md`, `05-MAPA-BANCO-DADOS.md`, `09-MAPA-RPCS-FUNCOES-TRIGGERS.md` |
| Entender permissões | `06-MAPA-RBAC.md`, `07-MAPA-AUTH.md`, `08-MAPA-RLS.md` |
| Entender um fluxo de ponta a ponta | `13-FLUXOS-CRITICOS.md` |
| Saber o que quebra se eu mexer aqui | `17-DEPENDENCIAS-ENTRE-MODULOS.md` §8 |
| Saber se posso mexer | `19-PONTOS-QUE-NAO-DEVEM-SER-ALTERADOS-SEM-AUTORIZACAO.md` |
| Como trabalhar neste projeto | `18-REGRAS-PARA-DESENVOLVIMENTO-FUTURO.md` |
| Riscos | `14-RISCOS-SEGURANCA.md`, `15-RISCOS-PERFORMANCE.md` |
| O que é legado | `16-LEGADO-DUPLICIDADES.md` |
| Integrações e secrets | `10-MAPA-EDGE-FUNCTIONS.md`, `11-MAPA-STORAGE.md`, `12-MAPA-INTEGRACOES.md` |

> Também existe documentação anterior em `docs/` (20 arquivos + 6 subpastas: `ct2/`, `diarias/`, `pendencias/`, `planejamento-macro/`, `qa/`, `rls-structure/`) e 6 planos em `.lovable/`. **Consultá-los antes de redescobrir contexto.**

---

## 9. Conclusão

O ERP LYTOTEC é um sistema **grande, maduro e bem arquitetado no essencial**: RLS integral, predicados de autorização por domínio bem desenhados, auditoria extensa, migrações aditivas e reversíveis, e uma transição de RBAC já instrumentada com telemetria.

Os problemas encontrados **não são de arquitetura** — são de **conclusão**: migrações iniciadas em modo aditivo e nunca finalizadas (RBAC, segregação de PII), e policies de conveniência criadas durante o desenvolvimento que permaneceram em produção e hoje anulam boa parte do desenho de segurança.

O achado **P1** (exposição de `bd_funcionarios`) precisa ser verificado no banco real com prioridade máxima. Se confirmado, é um incidente de proteção de dados pessoais, não apenas um débito técnico.

**AUDITORIA CONCLUÍDA: SIM**
**ALTERAÇÕES REALIZADAS NA APLICAÇÃO: 0**
**ALTERAÇÕES REALIZADAS NO BANCO: 0**
**MIGRATIONS APLICADAS: 0**
**DEPLOYS REALIZADOS: 0**
