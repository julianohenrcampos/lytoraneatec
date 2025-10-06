# Documentação Técnica - Construtora Lytorânea

## 📋 Visão Geral do Sistema

Este documento contém a documentação técnica completa do website da Construtora Lytorânea, incluindo arquitetura, estrutura de dados, componentes e processos de desenvolvimento.

## 🏗️ Arquitetura do Sistema

### Stack Tecnológica
- **Frontend Framework:** React 18 com TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS + shadcn/ui
- **Backend:** Supabase (PostgreSQL)
- **Storage:** Supabase Storage
- **Roteamento:** React Router DOM v6
- **Estado:** React Query + React Hooks
- **Deploy:** Cloud Platform

### Estrutura de Componentes

```
src/
├── components/
│   ├── ui/                    # Componentes base do shadcn/ui
│   │   ├── button.tsx         # Componente de botão
│   │   ├── card.tsx          # Componente de cartão
│   │   ├── carousel.tsx      # Componente de carrossel
│   │   └── ...               # Outros componentes UI
│   ├── Header.tsx            # Cabeçalho principal
│   ├── Footer.tsx            # Rodapé da aplicação
│   ├── HeroSection.tsx       # Seção hero da homepage
│   ├── ServiceCard.tsx       # Card para exibir serviços
│   └── PortfolioGrid.tsx     # Grid de projetos do portfólio
├── pages/                    # Páginas da aplicação
│   ├── Index.tsx            # Página inicial (/)
│   ├── Services.tsx         # Listagem de serviços (/servicos)
│   ├── ServiceDetail.tsx    # Detalhes do serviço (/servicos/:slug)
│   ├── Portfolio.tsx        # Galeria de projetos (/portfolio)
│   ├── PortfolioDetail.tsx  # Detalhes do projeto (/portfolio/:slug)
│   ├── About.tsx           # Sobre a empresa (/sobre)
│   ├── Contact.tsx         # Contato (/contato)
│   ├── Privacy.tsx         # Política de privacidade (/privacidade)
│   ├── IntegrityChannel.tsx # Canal de integridade (/canal-integridade)
│   └── NotFound.tsx        # Página 404
├── hooks/                   # Custom hooks
│   ├── useServices.ts      # Hook para buscar serviços
│   ├── usePortfolio.ts     # Hook para buscar projetos
│   └── use-toast.ts        # Hook para notificações
├── integrations/           # Integrações externas
│   └── supabase/          # Configuração do Supabase
│       ├── client.ts      # Cliente do Supabase
│       └── types.ts       # Tipos TypeScript gerados
├── lib/                   # Utilitários e configurações
│   ├── utils.ts          # Funções utilitárias
│   └── site.config.ts    # Configurações do site
└── assets/               # Recursos estáticos
    └── *.jpg            # Imagens locais
```

## 🔄 Fluxo de Dados

### 1. Serviços
```
useServices() → Supabase.services → ServiceCard/ServiceDetail
```

### 2. Portfólio
```
usePortfolio() → Supabase.portfolio_projects → PortfolioGrid/PortfolioDetail
                 ↓
               portfolio_images → Galeria de imagens
                 ↓
               portfolio_categories → Filtros por categoria
```

### 3. Imagens
```
Supabase Storage → URL pública → Componentes de imagem
```

## 📊 Estrutura do Banco de Dados

### Tabelas Principais

#### `services`
- **id:** UUID (PK)
- **title:** Título do serviço
- **slug:** URL amigável
- **short_description:** Descrição resumida
- **full_description:** Descrição completa
- **image_url:** URL da imagem principal
- **icon:** Ícone do serviço
- **display_order:** Ordem de exibição
- **created_at/updated_at:** Timestamps

#### `portfolio_projects`
- **id:** UUID (PK)
- **title:** Nome do projeto
- **slug:** URL amigável
- **description:** Descrição do projeto
- **client:** Nome do cliente
- **year:** Ano de realização
- **location:** Localização da obra
- **category_id:** UUID (FK → portfolio_categories)
- **main_image_url:** Imagem principal
- **created_at/updated_at:** Timestamps

#### `portfolio_categories`
- **id:** UUID (PK)
- **name:** Nome da categoria
- **slug:** URL amigável
- **created_at:** Timestamp

#### `portfolio_images`
- **id:** UUID (PK)
- **project_id:** UUID (FK → portfolio_projects)
- **image_url:** URL da imagem
- **alt_text:** Texto alternativo
- **is_main:** Se é imagem principal
- **display_order:** Ordem de exibição
- **created_at:** Timestamp

## 🔐 Configurações de Segurança

### Row Level Security (RLS)
Todas as tabelas possuem RLS habilitado com políticas de leitura pública:

```sql
-- Exemplo para services
CREATE POLICY "Services are publicly readable" 
ON services FOR SELECT 
USING (true);
```

### Storage Buckets
- **services:** Público, para imagens de serviços
- **portfolio:** Público, for imagens de projetos

## 📱 Responsividade

O sistema utiliza Tailwind CSS com breakpoints:
- **sm:** 640px (mobile landscape)
- **md:** 768px (tablet)
- **lg:** 1024px (desktop)
- **xl:** 1280px (desktop large)

### Componentes Responsivos
- Header: Menu hambúrguer em mobile
- Hero: Layout adaptável
- Portfolio Grid: 1/2/3 colunas conforme tela
- Cards: Stack vertical em mobile

## 🎨 Sistema de Design

### Paleta de Cores (Tailwind CSS)
```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 142 76% 36%;      /* Verde principal */
  --primary-foreground: 355.7 100% 97.3%;
  --secondary: 210 40% 98%;
  --accent: 210 40% 96%;
  /* ... outras cores */
}
```

### Tipografia
- **Fonte Principal:** Inter (Google Fonts)
- **Hierarquia:** h1-h6 com tamanhos responsivos
- **Espaçamento:** Sistema baseado em 4px

### Componentes
Todos os componentes seguem o design system do shadcn/ui com customizações específicas.

## 🔧 Desenvolvimento

### Scripts Disponíveis
```bash
npm run dev          # Servidor de desenvolvimento
npm run build        # Build de produção
npm run preview      # Preview do build
npm run lint         # Verificação de código
```

### Hooks Customizados

#### `useServices()`
```typescript
// Busca todos os serviços
const { data: services, isLoading, error } = useServices();

// Busca serviço específico por slug
const { data: service } = useService(slug);
```

#### `usePortfolio()`
```typescript
// Busca todos os projetos
const { data: projects } = usePortfolio();

// Busca projeto específico por slug
const { data: project } = usePortfolioProject(slug);
```

### Padrões de Código
- **TypeScript:** Tipagem forte obrigatória
- **ESLint:** Configuração padrão React + TypeScript
- **Imports:** Paths absolutos com `@/`
- **Componentes:** Functional components com hooks
- **Props:** Interfaces tipadas explícitas

## 📈 Performance

### Otimizações Implementadas
- **Lazy Loading:** Imagens carregadas sob demanda
- **React Query:** Cache inteligente de dados
- **Code Splitting:** Divisão automática pelo Vite
- **Image Optimization:** Supabase Storage com CDN

### Métricas Esperadas
- **First Contentful Paint:** < 1.5s
- **Largest Contentful Paint:** < 2.5s
- **Cumulative Layout Shift:** < 0.1

## 🔍 SEO

### Meta Tags
Cada página possui:
- **Title:** Único e descritivo
- **Description:** Meta description otimizada
- **Keywords:** Palavras-chave relevantes
- **Open Graph:** Para redes sociais

### Estrutura HTML Semântica
```html
<header>   <!-- Cabeçalho -->
<main>     <!-- Conteúdo principal -->
  <section> <!-- Seções organizadas -->
<aside>    <!-- Conteúdo lateral -->
<footer>   <!-- Rodapé -->
```

## 🚀 Deploy e CI/CD

### Ambiente de Desenvolvimento
- **URL:** http://localhost:5173
- **Hot Reload:** Automático
- **Source Maps:** Habilitados

### Ambiente de Produção
- **Plataforma:** Cloud Hosting
- **Deploy:** Automático via git push
- **HTTPS:** Habilitado por padrão
- **CDN:** Global

### Variáveis de Ambiente
```
# Supabase
SUPABASE_URL=https://vitxtbotmtxfytusptbf.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiI...
```

## 📞 Suporte e Manutenção

### Monitoramento
- **Supabase Dashboard:** Logs de database e API
- **Analytics Platform:** Métricas de uso
- **Browser DevTools:** Debug de frontend

### Backup
- **Database:** Backup automático Supabase
- **Storage:** Replicação automática
- **Code:** Versionamento Git

### Atualizações
- **Dependencies:** Verificação mensal
- **Security:** Patches automáticos
- **Features:** Deploy contínuo automatizado