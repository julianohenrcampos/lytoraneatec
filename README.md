
# Sistema de Gestão Integrada de Pavimentação Asfáltica 🛣️

[![Versão](https://img.shields.io/badge/versão-4.0.0-blue.svg)](CHANGELOG.md)
[![React](https://img.shields.io/badge/React-18.3+-61DAFB.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6.svg)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-00D588.svg)](https://supabase.com/)
[![PWA](https://img.shields.io/badge/PWA-Ready-orange.svg)](docs/PWA.md)

## 📋 Sobre o Projeto

Sistema **completo e avançado** de gestão para empresas de pavimentação asfáltica, integrando recursos humanos, equipamentos, logística e controle operacional. **Progressive Web App (PWA)** com **modo offline completo**, sincronização automática e **fluxo integrado de retorno de massa**. Desenvolvido com tecnologias modernas para máxima eficiência e confiabilidade.

### ✨ Principais Funcionalidades
📱 Progressive Web App (PWA): Instalação nativa e notificações

🔄 Modo Offline Completo: Trabalhe sem internet com sincronização automática

👥 Gestão de RH Completa: Cadastro, apontamentos, avaliações e controle salarial

🚛 Gestão de Máquinas: Controle total de veículos, equipamentos e manutenção

📦 Logística Integrada: Requisições, programação, registro de cargas e aplicação

🔄 Fluxo de Retorno de Massa: Integração automática entre aplicação e pesagem ⭐

📊 Relatórios de Medição: Cálculos automáticos para contratos de locação

🔧 Ordens de Serviço: Sistema completo de chamados e manutenção

📈 Dashboards Avançados: KPIs e métricas em tempo real com 4 dashboards especializados

📑 Exportações: Excel e PDF com formatação profissional

📱 Mobile First: Interface responsiva otimizada para tablet e smartphone

🔐 Segurança Avançada: Sistema de permissões granulares com RLS

🔔 Sistema de Notificações em Tempo Real: Alertas de alterações no sistema

👥 Monitoramento de Usuários Online: Visualização de colaboradores conectados

⛽ Sistema de Gestão de Abastecimento: Controle completo de combustível e consumo
### 🆕 Novidades da Versão 4.1

🔔 Sistema de Notificações em Tempo Real
Sistema avançado de notificações que monitora todas as alterações no banco de dados em tempo real, com:

Notificações Contextuais: Alertas específicos por tipo de usuário e permissões

Agrupamento Inteligente: Organização por categorias (Funcionários, Caminhões, Requisições, etc.)

Marcação como Lidas: Controle individual ou em massa de notificações visualizadas

Navegação Direta: Acesso rápido aos registros mencionados nas notificações

Filtro por Permissões: Cada perfil de usuário recebe apenas notificações relevantes

👥 Monitoramento de Usuários Online
Sistema de presença que mostra em tempo real os usuários conectados ao sistema:

Status de Conexão: Visualização de quem está online no momento

Página Atual: Informação sobre qual módulo cada usuário está acessando

Tempo de Sessão: Exibição do tempo de conexão de cada usuário

Acesso Restrito: Disponível apenas para administradores (SuperAdm)

Avatar e Identificação: Foto e nome completo para fácil identificação

⛽ Sistema de Gestão de Abastecimento
Módulo completo para controle e análise de abastecimentos de frota:

Funcionalidades Principais
Dashboard Interativo: Visualização de métricas e KPIs de consumo

Filtros Avançados: Busca por data, comboista, frota, placa e centro de custo

Gráficos Dinâmicos:

Litragem diária e consumo por veículo

Abastecimentos por dia e por comboista

Litragem por centro de custo e tipo de combustível

Consumo por frota e abastecimentos por procedimento

Métricas e Análises
Total de Abastecimentos: Contagem completa de todos os abastecimentos

Volume Total: Soma de litros abastecidos no período

Frota Ativa: Quantidade de veículos únicos abastecidos

Consumo Médio: Cálculo de km/L para a frota filtrada

Quilometragem Total: Soma de km rodados pelos veículos

Comparativos e Relatórios
Análise Comparativa: Comparação entre frotas ou placas específicas

Exportação para Excel: Geração de relatórios completos em planilha

Paginação Inteligente: Navegação facilitada em grandes conjuntos de dados

Cálculo de Consumo: Algoritmo avançado para cálculo preciso de consumo

Integração e Autenticação
Conexão com API Externa: Integração com sistema de abastecimento terceiro

Autenticação Automática: Login transparente com credenciais seguras

Proxy Dedicado: Camada de segurança para comunicação com API externa

Visualização de Dados
Cards Informativos: Métricas principais em visualização destacada

Gráficos Interativos: Visualizações com ApexCharts para melhor análise

Tabela Detalhada: Visualização completa de todos os campos de abastecimento

Responsividade: Adaptação perfeita para desktop e mobile

- **🔄 Fluxo Integrado de Retorno de Massa**
  - Detecção automática de massa remanescente após aplicação
  - Botão "Retorno de Massa" no finalização da aplicação
  - Navegação contextual para registro de cargas com foco automático
  - Modo visual destacado para campo de retorno
  - Rastreabilidade completa do material

- **🛡️ Sistema de Proteção contra Erros**
  - GlobalErrorBoundary interceptando erros da plataforma
  - SafeToast com fallback silencioso para erros TypeID
  - SafeModalWrapper protegendo todos os modais críticos
  - SafeFormWrapper com retry automático em formulários
  - Isolamento completo de erros externos

- **📱 PWA Avançado**
  - Service Worker otimizado com cache inteligente
  - Modo offline completo em todos os módulos
  - Sincronização automática em background
  - Indicadores visuais de status de conexão
  - Notificações push para atualizações

- **🎯 Interface Aprimorada**
  - 4 Dashboards especializados (Geral, RH, Máquinas, CBUQ)
  - Navegação contextual entre módulos
  - Validação de data em tempo real
  - Modo "Retorno de Massa" com destaque visual
  - Design system consistente com tokens semânticos

## 🚀 Tecnologias Utilizadas

### Frontend
- **React 18** - Framework principal
- **TypeScript** - Tipagem estática
- **Vite** - Build tool otimizado
- **Tailwind CSS** - Estilização
- **Shadcn/UI** - Componentes modernos
- **React Hook Form** - Gerenciamento de formulários
- **TanStack Query** - Gerenciamento de estado e cache
- **Recharts** - Gráficos e visualizações

### Backend
- **Supabase** - Backend as a Service
- **PostgreSQL** - Banco de dados principal
- **Row Level Security** - Segurança granular
- **Edge Functions** - Processamento server-side
- **Realtime** - Atualizações em tempo real

### Ferramentas
- **Date-fns** - Manipulação de datas
- **Zod** - Validação de schemas
- **Lucide React** - Ícones
- **React Router** - Roteamento

## 📦 Instalação e Configuração

### Pré-requisitos
- Node.js 18+ 
- npm ou yarn
- Conta no Supabase

### 1. Clone o Repositório
```bash
git clone https://github.com/seu-usuario/sistema-pavimentacao.git
cd sistema-pavimentacao
```

### 2. Instale as Dependências
```bash
npm install
# ou
yarn install
```

### 3. Configuração do Ambiente
Crie um arquivo `.env.local` na raiz do projeto:

```env
VITE_SUPABASE_URL=sua_url_do_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anonima_do_supabase
```

### 4. Configuração do Banco de Dados
Execute os scripts SQL fornecidos na pasta `/database`:

```sql
-- 1. Estrutura básica
\i database/01_estrutura_basica.sql

-- 2. Tabelas principais
\i database/02_tabelas_principais.sql

-- 3. Views e functions
\i database/03_views_functions.sql

-- 4. Dados iniciais
\i database/04_dados_iniciais.sql
```

### 5. Execute o Projeto
```bash
npm run dev
# ou
yarn dev
```

O sistema estará disponível em `http://localhost:5173`

## 📚 Documentação

### Guias Completos
- 📖 [Guia do Usuário](docs/USER_GUIDE.md) - Como usar todas as funcionalidades
- 🛠️ [Documentação Técnica](docs/TECHNICAL.md) - Arquitetura e desenvolvimento
- 🗄️ [Documentação do Banco](docs/DATABASE.md) - Estrutura e queries
- 📝 [Changelog](CHANGELOG.md) - Histórico de versões

### Links Rápidos
- [Módulo de Relatório de Medição](docs/USER_GUIDE.md#relatório-de-medição) ⭐
- [Gestão de RH](docs/USER_GUIDE.md#gestão-de-rh)
- [Aplicação de Asfalto](docs/USER_GUIDE.md#aplicação-de-asfalto)
- [Configuração de Permissões](docs/TECHNICAL.md#permissões)

## 🎯 Funcionalidades Principais

### 👥 Gestão de Recursos Humanos
- Cadastro completo de funcionários
- Organização em equipes
- Apontamento de presença diário
- Sistema de avaliação de performance
- Controle de benefícios e salários

### 🚛 Gestão de Máquinas e Equipamentos
- Cadastro de veículos, caminhões e equipamentos
- Apontamento operacional com inspeção
- Sistema de chamados técnicos
- Ordens de serviço completas
- Controle de manutenção preventiva

### 📦 Logística de Pavimentação
- **Requisições de Obra**: Cadastro de logradouros para pavimentação
- **Programação de Entregas**: Organização de entregas por data e equipe
- **Registro de Cargas**: Controle de saída e retorno da usina
- **Aplicação de Asfalto**: Processo completo em 3 etapas:
  1. Dados iniciais (seleção da entrega)
  2. Dados técnicos (dimensões e temperaturas)
  3. Finalização (cálculos automáticos)

### 📊 Relatório de Medição ⭐

#### Para Equipamentos
- **Base de Cálculo**: 200 horas mensais
- **Valor Unitário**: Aluguel mensal ÷ 200h = R$/h
- **Descontos**: 
  - Manutenção: (200 ÷ 30) × dias × R$/h
  - Desmobilização: (200 ÷ 30) × dias parados × R$/h
- **Distribuição**: Proporcional por centro de custo

#### Para Caminhões
- **Base de Cálculo**: Dias úteis
- **Valor Unitário**: Aluguel mensal ÷ 30 = R$/dia
- **Descontos**:
  - Manutenção: R$/dia × dias
  - Desmobilização: R$/dia × dias parados
- **Distribuição**: Proporcional por centro de custo

#### Funcionalidades
- ✅ Filtros por tipo, veículo e período
- ✅ Cálculos automáticos baseados em apontamentos
- ✅ Controle de descontos de manutenção
- ✅ Opção de desconto por desmobilização
- ✅ Exportação Excel com múltiplas abas
- ✅ Geração de PDF formatado
- ✅ Validações e mensagens de erro

## 🎨 Interface e Experiência

### Design System
- **Responsivo**: Funciona perfeitamente em desktop, tablet e mobile
- **Tema Moderno**: Interface limpa e profissional
- **Cores Consistentes**: Paleta harmoniosa e acessível
- **Componentes Reutilizáveis**: Baseados no Shadcn/UI

### Usabilidade
- **Navegação Intuitiva**: Menu lateral organizado por módulos
- **Formulários Inteligentes**: Validação em tempo real
- **Feedback Visual**: Loading states e mensagens claras
- **Atalhos**: Teclas de atalho para ações comuns

## 🔐 Segurança e Permissões

### Sistema de Roles
- **SuperAdm**: Acesso total ao sistema
- **AdmLogistica**: Gestão de logística e relatórios
- **Encarregado**: Apontamentos e operações
- **Usuário**: Consultas básicas

### Segurança
- **Row Level Security (RLS)**: Controle granular no banco
- **Autenticação JWT**: Tokens seguros via Supabase
- **Validação Server-side**: Todas as operações validadas
- **Auditoria**: Log de todas as ações importantes

## 📈 Performance e Otimizações

### Frontend
- **Code Splitting**: Carregamento otimizado por rotas
- **Lazy Loading**: Componentes carregados sob demanda
- **Memoização**: Componentes otimizados com React.memo
- **Bundle Size**: Otimizado com Vite

### Backend
- **Índices**: Queries otimizadas com índices estratégicos
- **Views**: Consultas complexas pré-processadas
- **Cache**: TanStack Query para cache inteligente
- **Pagination**: Listas grandes paginadas

## 🧪 Testes e Qualidade

### Validações
- **TypeScript**: Tipagem estrita em todo o código
- **Zod**: Validação de schemas em runtime
- **Formulários**: Validação em tempo real
- **Dados**: Sanitização automática

### Monitoramento
- **Error Tracking**: Captura de erros em produção
- **Performance**: Métricas de carregamento
- **Usage Analytics**: Análise de uso das funcionalidades

## 🚀 Deploy e Produção

### Ambientes Suportados
- **Vercel**: Deploy automático via Git
- **Netlify**: Integração contínua
- **Docker**: Containerização disponível

### CI/CD
- **GitHub Actions**: Deploy automático
- **Preview Deployments**: Branch previews
- **Environment Variables**: Configuração por ambiente

## 🤝 Contribuição

### Como Contribuir
1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -m 'feat: adicionar nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

### Convenções
- **Commits**: Seguimos [Conventional Commits](https://www.conventionalcommits.org/)
- **Code Style**: ESLint + Prettier configurados
- **TypeScript**: Tipagem obrigatória
- **Testes**: Incluir testes para novas funcionalidades

## 📊 Roadmap

### Versão 2.2 (Q1 2025)
- [ ] **Módulo Financeiro**
  - Controle de custos operacionais
  - Análise de rentabilidade por projeto
  - Integração bancária

- [ ] **Mobile App**
  - App nativo React Native
  - Funcionalidades offline
  - Sincronização automática

### Versão 2.3 (Q2 2025)
- [ ] **Inteligência Artificial**
  - Previsão de manutenções
  - Otimização de rotas
  - Análise preditiva

- [ ] **Integração IoT**
  - Sensores de equipamentos
  - Monitoramento em tempo real
  - Alertas automáticos

### Versão 3.0 (Q3 2025)
- [ ] **Gestão de Contratos**
  - Contratos digitais
  - Assinaturas eletrônicas
  - Workflow de aprovações

- [ ] **Business Intelligence**
  - Dashboards executivos
  - Relatórios gerenciais
  - Data warehouse

## 📞 Suporte e Comunidade

### Canais de Suporte
- 📧 **Email**: suporte@sistema-pavimentacao.com
- 💬 **Discord**: [Comunidade](https://discord.gg/sistema-pavimentacao)
- 🐛 **Issues**: [GitHub Issues](https://github.com/sistema-pavimentacao/issues)
- 📚 **Documentação**: [Wiki Completa](https://docs.sistema-pavimentacao.com)

### FAQ
- [Perguntas Frequentes](docs/FAQ.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Video Tutoriais](https://youtube.com/sistema-pavimentacao)

## 📄 Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.

## 🙏 Agradecimentos

- **Equipe de Desenvolvimento**: Pelos esforços incansáveis
- **Beta Testers**: Pelas sugestões valiosas
- **Comunidade Open Source**: Pelas bibliotecas incríveis
- **Clientes**: Pelo feedback construtivo

---

<div align="center">

**Sistema de Gestão Integrada de Pavimentação Asfáltica v2.1**

[🌐 Website](https://sistema-pavimentacao.com) • 
[📖 Documentação](docs/USER_GUIDE.md) • 
[🚀 Demo](https://demo.sistema-pavimentacao.com) • 
[💬 Suporte](mailto:suporte@sistema-pavimentacao.com)

Desenvolvido com ❤️ pela equipe de desenvolvimento

</div>
