# Relatório de Refatoração de Governança Documental

**Data:** 2025-04-24
**Responsável:** Equipe de Desenvolvimento — Sistema Corporativo LYTOTEC
**Tipo:** Limpeza estrutural de governança (sem alteração de regras de negócio)

---

## 🎯 Objetivo

Padronizar toda a documentação técnica em PT-BR, remover referências
indevidas (plataforma de desenvolvimento e nomes pessoais), centralizar
fallback de SuperAdm e aplicar template editorial nos READMEs principais.

## 📋 Escopo aprovado

- Documentação `.md` (todo o diretório `docs/` + `README.md` raiz).
- Comentários e logs em código (`src/`).
- Manutenção de **todas** as referências funcionais à infraestrutura
  (ex.: caminhos `/lovable-uploads/`, heurísticas de detecção de erro do
  iframe de preview, e-mails de SuperAdm como chave de autorização).
- **Sem alteração** de RLS, RBAC, RPCs, schema de banco ou regras de
  negócio.

## ✅ Mudanças aplicadas

### 1. Centralização do fallback SuperAdm

Criado o módulo único `src/config/superAdminEmails.ts` exportando
`SUPER_ADMIN_FALLBACK_EMAILS` e `isSuperAdminFallbackEmail()`. Todos os
hooks que faziam comparação literal com e-mails passam a consumir essa
constante.

| Arquivo | Antes | Depois |
|---------|-------|--------|
| `src/hooks/useAuthPermissionsStable.ts` | array literal inline | `isSuperAdminFallbackEmail(user.email)` |
| `src/hooks/useSimplePermissions.ts` (2 trechos) | comparação `===` literal | `isSuperAdminFallbackEmail(...)` |

### 2. Neutralização de comentários e logs

| Arquivo | Alteração |
|---------|-----------|
| `src/components/error/GlobalErrorBoundary.tsx` | Comentário "Detectar se é erro da plataforma Lovable" → "Detecta erros provenientes do iframe da plataforma de preview/editor". Log "🚨 Plataforma Lovable Error (IGNORADO)" → "🚨 Erro de plataforma de preview (ignorado)". Heurística `error.stack?.includes('lovable')` **preservada** (funcional). |

### 3. Atualização documental

| Arquivo | Alteração |
|---------|-----------|
| `README.md` | Reescrito sob o template padrão (Módulo / Responsabilidades / Integrações / Regras / Segurança / Observações). Removida seção de "Discord/comunidade" inventada, autoria genérica "Equipe de Desenvolvimento", branding "Sistema Corporativo LYTOTEC". |
| `docs/PERMISSION_SYSTEM_FIX.md` | Removida lista pessoal de e-mails SuperAdm; substituída por referência ao módulo centralizado `src/config/superAdminEmails.ts`. Seção "Contato" reescrita sem nomes pessoais. |
| `docs/rls-structure/README.md` | Adaptado ao template padrão; estatísticas movidas para seção "Segurança"; metadados de versão/data preservados. |

### 4. Referências preservadas (decisão arquitetural)

| Item | Local | Justificativa |
|------|-------|---------------|
| `/lovable-uploads/...` em `RelatorioMedicaoDetalhado.tsx` | `src/components/relatorio-medicao/` | Caminho real de asset no storage da plataforma; renomear quebraria o relatório em produção. |
| `error.stack?.includes('lovable')` | `GlobalErrorBoundary.tsx` | Heurística para isolar erros do iframe de preview/editor — não impacta produção, mas isola ruído em desenvolvimento. |
| `julianohcampos@yahoo.com.br` em `superAdminEmails.ts` | `src/config/` | E-mail real de SuperAdm; chave de autorização ativa. Centralizado conforme decisão "Extrair para constante". |

## 🧪 Validação

| Verificação | Resultado |
|-------------|-----------|
| `grep -ri "lovable" docs README.md` | ✅ 0 ocorrências em documentação |
| `grep -ri "juliano" docs README.md` | ✅ 0 ocorrências em documentação |
| `grep -ri "lovable" src/` | 2 ocorrências preservadas (funcionais, listadas acima) |
| `npx tsc --noEmit` | ✅ Sem erros |
| Quebra funcional | ✅ Nenhuma — RLS, RBAC, RPCs e schema intactos |

## 📁 Arquivos modificados

```
README.md
docs/PERMISSION_SYSTEM_FIX.md
docs/rls-structure/README.md
src/components/error/GlobalErrorBoundary.tsx
src/hooks/useAuthPermissionsStable.ts
src/hooks/useSimplePermissions.ts
```

## 📁 Arquivos criados

```
src/config/superAdminEmails.ts
docs/REFATORACAO_GOVERNANCA.md
```

## 🚦 Próximos passos sugeridos (fora deste escopo)

1. Aplicar o template padrão também aos demais `docs/*.md` (TECHNICAL,
   SECURITY, DEPLOYMENT, USER_GUIDE) em uma rodada futura — exige mais
   tempo e revisão de conteúdo de cada documento.
2. Mover futuramente o fallback de SuperAdm por e-mail para um campo
   `acesso_global` em `bd_user_roles` (já existe em parte do sistema),
   permitindo eliminar o fallback de código por completo.
3. Auditar headers e rodapés de PDFs gerados para garantir uso da
   identidade "Sistema Corporativo LYTOTEC" de forma consistente.
