
# Guia do Usuário - Sistema de Gestão Integrada 📋

## Índice

1. [Introdução](#introdução)
2. [Primeiros Passos](#primeiros-passos)
3. [Dashboard](#dashboard)
4. [Gestão de RH](#gestão-de-rh)
5. [Gestão de Máquinas](#gestão-de-máquinas)
6. [Logística](#logística)
7. [Relatório de Medição](#relatório-de-medição) ⭐ **NOVO**
8. [Relatórios e Exportações](#relatórios-e-exportações)
9. [Configurações](#configurações)
10. [Solução de Problemas](#solução-de-problemas)

## Introdução

O Sistema de Gestão Integrada é uma plataforma completa para gerenciamento de operações de pavimentação asfáltica, incluindo gestão de recursos humanos, máquinas, logística e relatórios de medição para contratos de locação.

### Perfis de Usuário

- **SuperAdm**: Acesso completo ao sistema
- **AdmLogistica**: Gestão de logística e relatórios
- **Encarregado**: Apontamentos e operações diárias
- **Usuário**: Consultas básicas

## Primeiros Passos

### 1. Login
- Acesse o sistema com seu email e senha
- Em caso de esquecimento, use "Esqueci minha senha"
- Primeiro acesso: contate o administrador

### 2. Navegação
- **Sidebar**: Menu principal com módulos
- **Header**: Informações do usuário e notificações
- **Dashboard**: Visão geral das operações

## Dashboard

O dashboard oferece uma visão consolidada das operações:

### KPIs Principais
- **Funcionários Ativos**: Total de colaboradores
- **Veículos Operando**: Equipamentos em atividade
- **Requisições Pendentes**: Solicitações aguardando
- **Entregas do Dia**: Programações ativas

### Gráficos
- **Produtividade Mensal**: Evolução da produção
- **Status de Veículos**: Distribuição por situação
- **Entregas por Centro de Custo**: Análise regional

## Gestão de RH

### Cadastro de Funcionários

#### Dados Pessoais
- Nome completo
- CPF (validação automática)
- Data de nascimento
- Gênero
- Endereço completo
- Telefone e email

#### Dados Profissionais
- Empresa
- Departamento
- Função
- Centro de custo
- Data de admissão
- Status (Ativo/Inativo)

#### Dados Contratuais
- Salário base
- Benefícios (VT, VR, etc.)
- Adicionais (noturno, periculosidade)
- Férias programadas

### Apontamento de Equipes
1. Selecione a equipe
2. Marque presença dos colaboradores
3. Registre horários de trabalho
4. Adicione observações se necessário
5. Confirme o apontamento

### Avaliação de Performance
- Pontualidade (1-5)
- Competência técnica (1-5)
- Trabalho em equipe (1-5)
- Comunicação (1-5)
- Proatividade (1-5)
- Organização (1-5)

## Gestão de Máquinas

### Cadastro de Veículos/Equipamentos

#### Informações Básicas
- Frota e número
- Placa
- Tipo (Caminhão, Equipamento, Prancha, etc.)
- Marca e modelo
- Ano de fabricação

#### Especificações Técnicas
- Motor
- Combustível
- Capacidade
- Situação operacional
- Status IPVA

#### Documentação
- Upload de fotos
- Documentos do veículo
- Observações importantes

### Apontamento de Uso

#### Dados Operacionais
- Data e horários de operação
- Horímetro inicial e final
- Operador responsável
- Centro de custo
- Situação (Operando, Disponível, Manutenção, etc.)

#### Inspeção Diária
- Níveis (óleo, água, combustível)
- Estado dos equipamentos
- Material de segurança
- Documentação
- Registro fotográfico de avarias

### Chamados e Ordens de Serviço

#### Abertura de Chamado
1. Selecione o veículo/equipamento
2. Descreva o problema
3. Defina prioridade
4. Anexe fotos das avarias
5. Submeta o chamado

#### Acompanhamento
- Status do chamado
- Técnico responsável
- Tempo de atendimento
- Histórico de movimentações

## Logística

### Requisições de Obra

#### Criação de Requisição
1. Número da requisição
2. Centro de custo
3. Engenheiro responsável
4. Data da requisição

#### Logradouros
- Nome da rua/avenida
- Bairro
- Comprimento (m)
- Largura (m)
- Espessura (cm)
- Tipo de massa asfáltica
- Pintura de ligação

### Programação de Entregas

#### Dados da Programação
- Requisição base
- Data de entrega
- Centro de custo
- Usina fornecedora

#### Lista de Entregas
- Caminhão designado
- Equipe responsável
- Apontador
- Quantidade de massa (ton)
- Logradouro de destino
- Tipo de lançamento

### Registro de Cargas

#### Saída da Usina
- Data e hora de saída
- Temperatura da massa
- Peso na balança (ticket)
- Upload da foto do ticket

#### Retorno à Usina
- Peso de retorno
- Cálculo da carga líquida
- Status da entrega

### Aplicação de Asfalto

#### Processo em 3 Etapas

**1. Dados Iniciais**
- Seleção da entrega programada
- Verificação da carga disponível
- Dados do logradouro

**2. Dados Técnicos**
- Data e hora de chegada
- Temperatura na chegada
- Hora de aplicação
- Temperatura na aplicação
- Dimensões da aplicação:
  - Estaca inicial/final
  - Comprimento (m)
  - Largura média (m)
  - Área calculada automaticamente

**3. Finalização**
- Tonelada aplicada
- Espessura calculada automaticamente
- Validação (ideal: 3-7cm)
- Hora de saída do caminhão
- Observações finais

#### Múltiplas Aplicações
- Uma carga pode ter várias aplicações
- Controle de massa remanescente
- Sequenciamento automático
- Finalização quando massa zerada

## Relatório de Medição ⭐

### Visão Geral
O módulo de Relatório de Medição é utilizado para contratos de locação de equipamentos e caminhões, calculando valores proporcionais baseados em apontamentos operacionais e aplicando descontos de manutenção e desmobilização.

### Filtros de Geração

#### 1. Tipo de Veículo (Obrigatório)
- **Equipamento**: Cálculo baseado em horas (200h/mês)
- **Caminhão**: Cálculo baseado em dias úteis
- **Prancha/Van/Ônibus**: Outros tipos disponíveis

#### 2. Identificação (Obrigatório)
- Lista dinâmica baseada no tipo selecionado
- Mostra: Frota + Número + Placa + Modelo
- Somente veículos ativos são exibidos

#### 3. Período (Obrigatório)
- Seletor de intervalo de datas
- Padrão: 21/mês atual à 20/próximo mês
- Valida apontamentos no período

#### 4. Desmobilização (Opcional)
- Checkbox para aplicar desconto de desmobilização
- Disponível para Equipamentos e Caminhões
- Calcula dias sem apontamento até final do período

### Cálculos para Equipamentos

#### Fórmula Base (4 Partes)
1. **Valor Unitário**: `Aluguel Mensal ÷ 200 horas = R$/h`
2. **Desconto Manutenção**: `(200 ÷ 30) × Dias Manutenção × R$/h`
3. **Desconto Desmobilização**: `(200 ÷ 30) × Dias Parados × R$/h`
4. **Horas Restantes**: `200h - Total Horas Descontadas`

#### Distribuição por Centro de Custo
- **Horas Disponíveis**: `(Horas Restantes ÷ Total Dias) × Dias do Centro`
- **Valor Período**: `Horas Disponíveis × Valor Unitário`
- **Produtividade**: `(Total Horímetros ÷ Horas Restantes) × Horas Disponíveis`

### Cálculos para Caminhões

#### Fórmula Base (4 Partes)
1. **Valor Diário**: `Aluguel Mensal ÷ 30 dias = R$/dia`
2. **Desconto Manutenção**: `Valor Diário × Dias Manutenção`
3. **Desconto Desmobilização**: `Valor Diário × Dias Parados`
4. **Valor Restante**: `Aluguel Mensal - Total Descontos`

#### Distribuição por Centro de Custo
- **Valor Diário Divisão**: `Valor Restante ÷ Total Dias Operando`
- **Valor Centro**: `Valor Diário Divisão × Dias do Centro`
- **Produtividade**: Quilometragem proporcional por centro

### Tipos de Desconto

#### Manutenção
- **Fonte**: Apontamentos com situação "Em Manutenção"
- **Equipamento**: Calculado em horas
- **Caminhão**: Calculado em dias
- **Automático**: Baseado nos apontamentos do período

#### Desmobilização
- **Ativação**: Checkbox opcional
- **Cálculo**: Diferença entre última data de apontamento e final do período
- **Aplicação**: Mesmo valor unitário da manutenção

### Estrutura do Relatório

#### Cabeçalho
- Logo da empresa
- Número PM, mês de referência, período
- Contratada: ABRA INFRAESTRUTURA
- Obra: Centros de custo envolvidos

#### 1. Descrição dos Serviços
**Para Equipamentos:**
- Quantidade (200H fixo)
- Valor Unit. (R$/h)
- Total Mensal (R$)
- Horas Disponíveis
- Valor (R$)
- Produtividade (H)
- Abastecimento (L)
- Média Abast. (L/H)
- Rastreador (editável)

**Para Caminhões:**
- Total Mensal (R$)
- QTD/DIA
- Valor (R$)
- Produtividade (KM)
- Abastecimento (L)
- Média Abast. (KM/L)
- Rastreador (editável)

#### 2. Descontos/Acréscimos
- **Tipo de Desconto**: Manutenção/Desmobilização
- **Valor Unit.**: R$/h ou R$/dia
- **Quantidade**: Horas ou dias
- **Valor Total**: Desconto aplicado

#### 3. Observações
- Campo livre para anotações
- Importante para contextualizações

#### 4. Total do Período
- **Cálculo**: Soma dos valores - Soma dos descontos
- **Destaque**: Valor final em negrito

#### 5. Assinaturas
- Medição e Controle
- Gestor de Contratos
- Contratada

### Exportações

#### Excel (Múltiplas Abas)
- **Aba 1**: Relatório principal
- **Aba 2**: Detalhamento de descontos
- **Aba 3**: Resumo por centro de custo
- **Formatação**: Cores, bordas, formatação monetária

#### PDF
- **Layout**: Formato de impressão A4
- **Conteúdo**: Relatório completo com formatação
- **Assinaturas**: Campos para assinatura manual

### Validações e Regras

#### Obrigatórias
- Tipo de veículo, identificação e período são obrigatórios
- Período deve ter apontamentos "Operando" ou "Disponível"
- Veículo deve ter valor de aluguel cadastrado

#### Automáticas
- Busca apontamentos por situação específica
- Calcula automaticamente todos os valores
- Valida período contra dados disponíveis

#### Mensagens
- **Sucesso**: "Relatório gerado com X registros"
- **Erro**: "Nenhum dado encontrado para os filtros"
- **Validação**: Campos obrigatórios destacados

### Cenários de Uso

#### Caso 1: Equipamento Completo
- Equipamento trabalhou todos os dias
- Sem manutenção, sem desmobilização
- Valor = (Aluguel ÷ 200) × Horas trabalhadas

#### Caso 2: Equipamento com Manutenção
- 5 dias em manutenção no período
- Desconto: (200 ÷ 30) × 5 × (Aluguel ÷ 200)
- Horas restantes: 200 - horas descontadas

#### Caso 3: Caminhão com Desmobilização
- Última data de apontamento: dia 15
- Período até dia 20 = 5 dias parados
- Desconto: (Aluguel ÷ 30) × 5 dias

#### Caso 4: Múltiplos Centros de Custo
- Equipamento trabalhou em 3 centros diferentes
- Rateio proporcional por dias trabalhados
- Cada centro recebe valor correspondente

### Troubleshooting

#### "Nenhum dado encontrado"
1. Verifique se há apontamentos no período
2. Confirme se situações são "Operando" ou "Disponível"
3. Valide se centro de custo está preenchido

#### "Erro na exportação"
1. Verifique dados de manutenção
2. Confirme cálculos de desconto
3. Tente gerar novamente

#### "Valores incorretos"
1. Verifique valor de aluguel do veículo
2. Confirme apontamentos de manutenção
3. Valide configuração de desmobilização

## Relatórios e Exportações

### Tipos de Relatório
- **Funcionários**: Lista completa com filtros
- **Veículos**: Status e utilização
- **Produtividade**: Métricas operacionais
- **Medição**: Contratos de locação ⭐

### Formatos de Export
- **Excel**: Dados tabulares com formatação
- **PDF**: Relatórios formatados para impressão
- **CSV**: Dados brutos para análise

## Configurações

### Centros de Custo
- Código identificador
- Nome descritivo
- CNPJ vinculado
- Status (Ativo/Inativo)

### Empresas
- Dados fiscais
- Endereço e contatos
- Departamentos associados

### Usuários e Permissões
- Criação de usuários
- Atribuição de funções
- Controle de acesso por módulo

## Solução de Problemas

### Problemas Comuns

#### "Erro de Permissão"
- Verifique seu perfil de usuário
- Contate o administrador para ajustes
- Confirme se está na empresa correta

#### "Dados não Carregando"
- Verifique conexão com internet
- Recarregue a página
- Limpe cache do navegador

#### "Erro ao Salvar"
- Verifique campos obrigatórios
- Confirme formato dos dados
- Tente novamente

### Contato para Suporte
- **Email**: suporte@sistema.com
- **Telefone**: (11) 99999-9999
- **Horário**: Segunda a sexta, 8h às 18h

---

**Versão do Guia**: 2.1  
**Última Atualização**: Dezembro 2024  
**Sistema**: Gestão Integrada de Pavimentação
