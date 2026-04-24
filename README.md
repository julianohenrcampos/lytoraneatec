# Sistema Corporativo LYTOTEC — Gestão Integrada de Pavimentação Asfáltica 🛣️

[![Versão](https://img.shields.io/badge/versão-4.0.0-blue.svg)](CHANGELOG.md)
[![React](https://img.shields.io/badge/React-18.3+-61DAFB.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6.svg)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-00D588.svg)](https://supabase.com/)
[![PWA](https://img.shields.io/badge/PWA-Ready-orange.svg)](docs/PWA.md)

---

### 📌 Nome do Módulo

**Sistema Corporativo LYTOTEC** — plataforma corporativa de gestão integrada para
operações de pavimentação asfáltica, cobrindo Recursos Humanos, Equipamentos e
Frota, Logística de Usina, Diárias, SSO, Solicitações de Equipamento, Ordens de
Serviço, Relatórios de Medição e Business Intelligence operacional.

A aplicação é um **Progressive Web App (PWA)** com modo offline, sincronização
automática e fluxo integrado de retorno de massa.

### ⚙️ Responsabilidades

- Centralizar o ciclo operacional de obras: requisição → programação →
  registro de carga → aplicação → medição.
- Gerenciar o ciclo de vida do ativo: cadastro mestre, disponibilidade,
  catálogo técnico, solicitações, ordens de serviço e custos.
- Gerenciar o ciclo de vida do colaborador: cadastro, equipes, presenças,
  diárias, SSO, desligamentos e arquivo morto.
- Operar regras de negócio críticas (cálculo de diárias por feriado/ponte,
  matching de equipamentos, governança de fornecedores) com auditoria.
- Disponibilizar relatórios oficiais em Excel e PDF padronizados.

### 🔗 Integrações

- **Supabase** — Banco de dados PostgreSQL, Auth (JWT), Storage e Edge Functions.
- **Mapbox** — geocoding via Edge Function dedicada (`geocode-proxy`).
- **PNCP** — sincronização de licitações públicas (módulo Licitações).
- **Onboarding de fornecedores** — Edge Function `onboard-fornecedor` com
  cabeçalho de segurança padronizado entre projetos.
- **Service Worker / PWA** — cache offline e sincronização em background.

Tabelas e views principais seguem os prefixos `bd_` (tabelas) e `vw_` (views).
A documentação completa de schema está em [`docs/DATABASE.md`](docs/DATABASE.md)
e o detalhamento de RLS em [`docs/rls-structure/`](docs/rls-structure/README.md).

### 🧠 Regras de Negócio

- **Diárias** operam em ciclos semanais (segunda → domingo); auto-save por
  data permite sobrepor `tipo_dia` (`normal | feriado | ponte`) sem botão
  explícito, com rollback visual em caso de falha.
- **Equipamentos** seguem catálogo técnico unificado por subcategoria +
  capacidade, com controle anti-fraude no cadastro mestre.
- **Diárias e Equipamentos** delegam visibilidade ao RLS para perfis
  compostos (SuperAdm, AdmOBRA, GerenteRegional) — o frontend não impõe
  filtros mais restritivos que o banco.
- **Funcionários ativos** são pré-requisito para a maioria das operações
  (Ativo ou Ativo sem Registro).
- **SSO** padroniza agendamentos por tipo de exame para reduzir redundância.
- **Relatórios de Medição** calculam aluguel base 200h (equipamentos) e
  base 30 dias (caminhões), com descontos de manutenção e desmobilização.

### 🛡️ Segurança

- **Row-Level Security (RLS)** habilitado nas tabelas críticas, com funções
  `SECURITY DEFINER` (ex.: `fn_diaria_can_select_row`, `has_role`).
- **RBAC granular** por ação (`visualizar`, `criar`, `editar`, `excluir`,
  `aprovar`) governado por `bd_user_roles` + `profiles.funcoes`, sem armazenar
  papéis na tabela `profiles`.
- **Fallback SuperAdm por e-mail** centralizado em
  [`src/config/superAdminEmails.ts`](src/config/superAdminEmails.ts) — sem
  e-mails pessoais espalhados pelos hooks.
- **Assinatura digital** com rubricas PNG no bucket `assinaturas` e captura
  de IP via Edge Function.
- **Auditoria** centralizada em `bd_auditoria_log` para criações,
  modificações e exclusões.

### 📊 Observações Técnicas

- **Frontend**: React 18 + TypeScript 5 + Vite 5 + Tailwind CSS v3 +
  shadcn/ui + TanStack Query + React Hook Form + Zod.
- **Backend**: Supabase (PostgreSQL + Edge Functions Deno).
- **Performance**: code splitting por rota, lazy loading de módulos
  pesados, memoização e índices estratégicos no banco.
- **PWA**: service worker com cache inteligente e fila offline; UTC-3
  (Brasília) é a referência única de tempo (`timezoneUtils`).
- **Tema**: design system baseado em tokens semânticos HSL (`index.css` +
  `tailwind.config.ts`); componentes não devem usar cores literais.

---

## 📦 Instalação e Configuração

### Pré-requisitos

- Node.js 18+
- npm, bun ou yarn
- Projeto Supabase provisionado

### 1. Instalar dependências

```bash
npm install
```

### 2. Variáveis de ambiente

A integração com Supabase é configurada via cliente em
`src/integrations/supabase/client.ts`. Chaves publicáveis (anon) podem ficar
no código; segredos sensíveis devem ser cadastrados como secrets do projeto
e consumidos por Edge Functions.

### 3. Executar em desenvolvimento

```bash
npm run dev
```

A aplicação ficará disponível em `http://localhost:5173`.

### 4. Build de produção

```bash
npm run build
```

---

## 📚 Documentação

| Documento | Descrição |
|-----------|-----------|
| [Guia do Usuário](docs/USER_GUIDE.md) | Uso funcional dos módulos |
| [Documentação Técnica](docs/TECHNICAL.md) | Arquitetura e padrões |
| [Banco de Dados](docs/DATABASE.md) | Schema, views e funções |
| [Estrutura RLS](docs/rls-structure/README.md) | Políticas de segurança |
| [RBAC Administrativo](docs/RBAC_ADMIN_ARQUITETURA.md) | Permissões e perfis |
| [Sistema de Permissões](docs/PERMISSION_SYSTEM_FIX.md) | Histórico do fix de permissões |
| [Segurança](docs/SECURITY.md) | Diretrizes de segurança |
| [PWA](docs/PWA.md) | Modo offline e instalação |
| [Mobile](docs/MOBILE.md) | Considerações mobile-first |
| [Deploy](docs/DEPLOYMENT.md) | Processo de publicação |
| [Troubleshooting](docs/TROUBLESHOOTING.md) | Problemas conhecidos |

---

## 🗂️ Módulos Principais

- **Gestão de RH** — funcionários, equipes, apontamentos, avaliações,
  desligamentos e arquivo morto.
- **Gestão de Veículos e Equipamentos** — cadastro mestre, frotas,
  disponibilidade, portfólio técnico, solicitações de equipamento.
- **Logística de Usina** — requisições, programação de entregas,
  registro de cargas, aplicação de asfalto e retorno de massa.
- **Diárias** — solicitação semanal, presenças, aprovação dinâmica e
  relatórios financeiros/operacionais.
- **SSO** — agendamentos de exames, vale transporte e admissão.
- **Ordens de Serviço** — chamados, OS, mão de obra e materiais.
- **Relatórios de Medição** — cálculo automático de locação.
- **Licitações (PNCP)** — busca inteligente e normalização de órgãos.
- **Administração** — RBAC granular, gestão de permissões, auditoria.

---

## 🤝 Convenções de Contribuição

- **Commits**: [Conventional Commits](https://www.conventionalcommits.org/).
- **Code style**: ESLint + Prettier.
- **TypeScript estrito**: tipagem obrigatória.
- **Nomenclatura**:
  - Backend (SQL, RPCs, colunas): `snake_case`.
  - Frontend (variáveis, funções, hooks): `camelCase`.
  - Tabelas: prefixo `bd_`.
  - Views: prefixo `vw_`.
- **Tema**: usar exclusivamente tokens semânticos do design system.

---

## 📄 Licença

Uso interno corporativo. Consulte o arquivo [LICENSE](LICENSE) quando
disponível.

---

<div align="center">

**Sistema Corporativo LYTOTEC — Gestão Integrada de Pavimentação Asfáltica**

Mantido pela Equipe de Desenvolvimento

</div>
