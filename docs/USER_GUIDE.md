
# Manual do Usuário 👨‍💻

## Introdução ao Sistema

O Sistema de Gestão de Asfalto e Logística é uma ferramenta completa para controlar todo o processo de aplicação de asfalto, desde a requisição inicial até a finalização da obra. Este manual guiará você através de todas as funcionalidades do sistema.

## 🔐 Acesso ao Sistema

### Login
1. Acesse a URL do sistema fornecida pela administração
2. Digite seu **email** e **senha** nos campos correspondentes
3. Clique em **"Entrar"**
4. Se necessário, complete a autenticação em dois fatores

### Primeiro Acesso
1. Use as credenciais fornecidas pelo administrador
2. Você será solicitado a alterar sua senha
3. Configure sua foto de perfil (opcional)
4. Verifique suas permissões no menu **Perfil**

### Recuperação de Senha
1. Na tela de login, clique em **"Esqueci minha senha"**
2. Digite seu email cadastrado
3. Verifique sua caixa de entrada e spam
4. Clique no link recebido e defina uma nova senha

## 📊 Dashboard Principal

O Dashboard é a primeira tela após o login e apresenta uma visão geral do sistema.

### Indicadores Principais (KPIs)
- **Total de Requisições**: Número total de requisições no período
- **Entregas Programadas**: Entregas agendadas para hoje/semana
- **Aplicações Concluídas**: Número de aplicações finalizadas
- **Equipes Ativas**: Equipes em campo hoje

### Gráficos e Análises
- **Gráfico de Barras**: Produtividade por equipe/período
- **Gráfico Pizza**: Distribuição por tipo de serviço
- **Timeline**: Entregas da semana
- **Mapa de Calor**: Atividades por região

### Notificações e Alertas
- **Entregas Atrasadas**: ⚠️ Alertas em vermelho
- **Manutenções Pendentes**: 🔧 Alertas em amarelo
- **Novas Requisições**: 📋 Notificações em azul

## 👥 Gestão de Recursos Humanos

### Cadastro de Funcionários

#### Acessando o Módulo
1. No menu lateral, clique em **"RH"**
2. Selecione **"Funcionários"**
3. A lista de funcionários será exibida

#### Criando um Novo Funcionário
1. Clique no botão **"+ Novo Funcionário"**
2. Preencha as abas sequencialmente:

**Aba 1: Dados Pessoais**
- Nome completo (obrigatório)
- CPF (obrigatório - somente números)
- Data de nascimento
- Gênero
- Endereço completo
- Email de contato
- Escolaridade

**Aba 2: Dados Profissionais**
- Empresa vinculada (obrigatório)
- Departamento (obrigatório)
- Função/cargo (obrigatório)
- Centro de custo
- Equipe de trabalho
- Status (Ativo/Inativo/Férias/Afastado)

**Aba 3: Dados Contratuais**
- Data de admissão (obrigatório)
- Data de demissão (se aplicável)
- Data das férias programadas
- Observações contratuais

**Aba 4: Dados Financeiros**
- Salário base
- Gratificações
- Adicional de insalubridade
- Adicional de periculosidade
- Adicional noturno
- Valor das diárias
- Valor da refeição
- Custo de passagem

3. **Upload da Foto** (opcional):
   - Clique na área da foto
   - Selecione uma imagem (JPG, PNG)
   - A foto será automaticamente redimensionada

4. Clique em **"Salvar"** para finalizar o cadastro

#### Editando um Funcionário
1. Na lista de funcionários, clique no ícone **"✏️ Editar"**
2. Modifique os campos necessários
3. Clique em **"Salvar Alterações"**

#### Visualizando Detalhes
1. Clique no ícone **"👁️ Visualizar"** ou no nome do funcionário
2. Uma janela modal exibirá todos os dados
3. Use as abas para navegar entre as informações

### Gestão de Equipes

#### Criando uma Equipe
1. Vá em **"RH"** → **"Equipes"**
2. Clique em **"+ Nova Equipe"**
3. Preencha os dados:
   - Nome da equipe (obrigatório)
   - Encarregado (funcionário responsável)
   - Apontador (funcionário que faz apontamentos)
   - Membros da equipe (selecione múltiplos funcionários)
4. Clique em **"Salvar"**

#### Gerenciando Membros da Equipe
1. Na lista de equipes, clique em **"Editar"**
2. Na seção **"Membros"**:
   - Para adicionar: Clique em **"+ Adicionar Membro"**
   - Para remover: Clique no **"×"** ao lado do nome
3. Salve as alterações

### Apontamento de Presença

#### Registrando Presença Diária
1. Vá em **"Apontamentos"** → **"Equipes"**
2. Clique em **"+ Novo Apontamento"**
3. Selecione:
   - Data do apontamento
   - Equipe
   - Entrega relacionada (se aplicável)
4. Para cada membro da equipe:
   - Marque **"Presente"** ou deixe desmarcado
   - Informe hora de início e fim (se presente)
   - Adicione observações se necessário
5. Clique em **"Salvar Apontamento"**

#### Consultando Apontamentos
1. Use os filtros para buscar:
   - Data específica ou período
   - Equipe específica
   - Status de presença
2. Exporte relatórios em Excel para análises

### Avaliação de Desempenho

#### Realizando uma Avaliação
1. No apontamento de equipe, clique em **"Avaliar Desempenho"**
2. Selecione o colaborador a ser avaliado
3. Avalie cada critério de 1 a 5:
   - **Competência Técnica**: Conhecimento técnico para a função
   - **Comunicação**: Clareza e eficácia na comunicação
   - **Trabalho em Equipe**: Colaboração e espírito de equipe
   - **Proatividade**: Iniciativa e busca por soluções
   - **Pontualidade**: Cumprimento de horários
   - **Organização**: Organização pessoal e do trabalho
4. Adicione observações detalhadas
5. Clique em **"Salvar Avaliação"**

## 🚛 Gestão de Máquinas e Equipamentos

### Cadastro de Veículos

#### Adicionando um Novo Veículo
1. Vá em **"Máquinas"** → **"Veículos"**
2. Clique em **"+ Novo Veículo"**
3. **Aba Detalhes Básicos**:
   - Placa (obrigatório)
   - Tipo de veículo (Caminhão, Trator, Equipamento)
   - Marca e modelo
   - Ano de fabricação
   - Cor
   - Número da frota
   - Empresa proprietária
   - Departamento responsável

4. **Aba Especificações Técnicas**:
   - Capacidade de carga
   - Tipo de motor
   - Tipo de combustível
   - Especificações adicionais

5. **Upload de Foto** (opcional):
   - Adicione uma foto do veículo
   - Formatos aceitos: JPG, PNG

6. **Status e Situação**:
   - Situação atual: Disponível, Em Uso, Manutenção, Indisponível
   - Status IPVA: Em dia, Vencido, Isento
   - Aluguel: Próprio, Alugado

7. Clique em **"Salvar"**

#### Editando Veículos
1. Na lista de veículos, encontre o veículo desejado
2. Clique no ícone **"✏️ Editar"**
3. Modifique os campos necessários
4. **Atenção**: Mudanças no status afetam a disponibilidade para programações

### Apontamento de Uso de Máquinas

#### Registrando Uso Diário
1. Vá em **"Apontamentos"** → **"Máquinas"**
2. Clique em **"+ Novo Apontamento"**
3. Preencha os dados:
   - **Data**: Data do uso (formatada como DD/MM/AAAA)
   - **Máquina/Veículo**: Selecione da lista
   - **Operador**: Funcionário responsável
   - **Centro de Custo**: Para controle financeiro
   - **Hora Inicial**: Início da operação
   - **Hora Final**: Fim da operação
   - **Horímetro/Hodômetro Inicial**: Leitura inicial
     - Para caminhões: exibido como "Hodômetro (KM)"
     - Para equipamentos: exibido como "Horímetro"
   - **Horímetro/Hodômetro Final**: Leitura final
   - **Abastecimento**: Litros abastecidos
   - **Situação**: Estado da máquina após uso

4. **Inspeção Veicular** (opcional mas recomendado):
   - Preencha o checklist de inspeção
   - Marque itens como: Conforme, Não Conforme, Não Aplicável
   - Adicione fotos de avarias se necessário
   - Itens inspecionados:
     - **Documentação**: Documentos obrigatórios
     - **Tacógrafo**: Funcionamento (apenas caminhões)
     - **Sistema Elétrico**: Luzes, painel, bateria
     - **Nível de Óleo**: Motor e hidráulico
     - **Nível de Água**: Radiador
     - **Nível de Combustível**: Tanque
     - **Drenagem Tanque de Ar**: Sistema pneumático
     - **Material Rodante**: Pneus, esteiras, rodas
     - **Cinto de Segurança**: Estado e funcionamento
     - **Material de Desgaste**: Lâminas, dentes, etc.
     - **Estado dos Implementos**: Caçambas, lâminas
     - **Limpeza Interna**: Cabine do operador
     - **Engate Reboque**: Quinta roda, engate
     - **Estado dos Equipamentos**: Equipamentos auxiliares
     - **Inspeção Veicular**: Verificação geral
     - **Material de Amarração**: Cordas, cintas

5. **Upload de Fotos de Avarias**:
   - Clique em **"+ Adicionar Foto"**
   - Selecione ou tire fotos das avarias encontradas
   - Adicione quantas fotos forem necessárias

6. Clique em **"Salvar Apontamento"**

#### Visualizando Detalhes do Apontamento
1. Na lista de apontamentos, clique no ícone **"👁️ Visualizar"**
2. O modal de detalhes mostra:
   - **Aba "Dados Operacionais"**:
     - Data (formatada corretamente como DD/MM/AAAA)
     - Operador, caminhão/equipamento
     - Centro de custo
     - Horímetros/hodômetros inicial e final
     - Horas de trabalho
     - Situação e abastecimento
   
   - **Aba "Checklist"**:
     - Todos os itens da inspeção veicular
     - Status de cada item inspecionado
     - Anotações do inspetor
     - Fotos de avarias (se houver)

3. **Interface Responsiva**:
   - Em dispositivos móveis, o modal se adapta automaticamente
   - Navegação por abas otimizada para toque
   - Scroll suave em telas pequenas

### Chamados Técnicos e Manutenção

#### Abrindo um Chamado
1. Vá em **"Máquinas"** → **"Chamados"**
2. Clique em **"+ Novo Chamado"**
3. Preencha as informações:
   - **Número do Chamado**: Gerado automaticamente
   - **Máquina/Equipamento**: Selecione o equipamento com problema
   - **Tipo de Falha**: Mecânica, Elétrica, Hidráulica, etc.
   - **Prioridade**: Baixa, Normal, Alta, Crítica
   - **Descrição do Problema**: Descreva detalhadamente o problema
   - **Centro de Custo**: Para controle de custos

4. **Fotos das Avarias**:
   - Clique em **"+ Adicionar Foto"**
   - Tire fotos ou selecione da galeria
   - Adicione quantas fotos forem necessárias

5. Clique em **"Abrir Chamado"**

#### Acompanhando Chamados
1. Na lista de chamados, você pode ver:
   - Status: Aberto, Em Andamento, Aguardando Peças, Concluído
   - Prioridade (cores diferentes)
   - Data de abertura
   - Técnico responsável

2. **Filtros disponíveis**:
   - Por status
   - Por prioridade
   - Por período
   - Por máquina
   - Por técnico

#### Convertendo para Ordem de Serviço
1. Clique no chamado desejado
2. Clique em **"Converter para OS"**
3. Preencha informações adicionais:
   - Setor responsável pela manutenção
   - Horímetro/KM atual
   - Observações técnicas
4. A OS será criada automaticamente

### Ordens de Serviço (OS)

#### Executando uma OS
1. Vá em **"Máquinas"** → **"Ordens de Serviço"**
2. Clique na OS desejada
3. **Iniciar Atendimento**:
   - Clique em **"Iniciar Atendimento"**
   - Informe data e hora de início
   - Registre horímetro inicial

4. **Durante a Execução**:
   - Registre materiais utilizados
   - Adicione mão de obra
   - Documente o progresso

5. **Finalizar OS**:
   - Informe data e hora de fim
   - Registre horímetro final
   - Descreva a tratativa aplicada
   - Adicione fotos do reparo
   - Teste o equipamento
   - Clique em **"Finalizar OS"**

## 📋 Gestão de Requisições

### Criando uma Requisição

#### Processo Completo
1. Vá em **"Logística"** → **"Requisições"**
2. Clique em **"+ Nova Requisição"**

#### Dados da Requisição
1. **Informações Gerais**:
   - **Número**: Gerado automaticamente
   - **Centro de Custo**: Solicitante (obrigatório)
   - **Diretoria**: Diretoria responsável
   - **Gerência**: Gerência responsável
   - **Engenheiro**: Engenheiro responsável pelo projeto
   - **Data da Requisição**: Data atual (editável)

#### Adicionando Logradouros
1. **Seção "Ruas da Requisição"**:
2. Clique em **"+ Adicionar Rua"**
3. Para cada logradouro, preencha:
   - **Nome do Logradouro**: Nome da rua/avenida (obrigatório)
   - **Bairro**: Bairro onde está localizado
   - **Largura**: Largura da via em metros (obrigatório)
   - **Comprimento**: Comprimento em metros (obrigatório)
   - **Pintura/Ligação**: Tipo de serviço (obrigatório)
   - **Traço**: Especificação do asfalto (obrigatório)
   - **Espessura**: Espessura em centímetros (obrigatório)

4. **Cálculos Automáticos**:
   - **Área**: Calculada automaticamente (largura × comprimento)
   - **Volume**: Calculado automaticamente (área × espessura ÷ 100)
   - **Massa Estimada**: Volume × 2,4 t/m³

5. **Adicionando Múltiplas Ruas**:
   - Repita o processo para cada logradouro
   - Use **"Duplicar Rua"** para ruas similares
   - Use **"Remover"** para excluir ruas

6. Clique em **"Salvar Requisição"**

### Aprovação de Requisições

#### Fluxo de Aprovação
1. **Requisições Pendentes** aparecem em destaque no dashboard
2. Gestores com permissão veem notificações de requisições pendentes
3. Para aprovar:
   - Clique na requisição
   - Revise todos os dados e cálculos
   - Clique em **"Aprovar"** ou **"Rejeitar"**
   - Adicione comentários se necessário

#### Status das Requisições
- **Rascunho**: Em elaboração
- **Pendente**: Aguardando aprovação
- **Aprovada**: Aprovada para programação
- **Rejeitada**: Rejeitada com motivo
- **Em Execução**: Com programações ativas
- **Concluída**: Totalmente executada

### Consultando Requisições

#### Filtros Disponíveis
1. **Por Período**: Data inicial e final
2. **Por Centro de Custo**: Filtrar por solicitante
3. **Por Status**: Filtrar por situação atual
4. **Por Engenheiro**: Filtrar por responsável técnico
5. **Por Número**: Busca direta

#### Exportando Dados
1. Use os filtros para selecionar os dados desejados
2. Clique em **"Exportar Excel"**
3. O arquivo será baixado com:
   - Dados da requisição
   - Lista de logradouros
   - Cálculos de área e volume
   - Totais gerais

## 🚚 Programação de Entregas

### Criando uma Programação

#### Acessando o Módulo
1. Vá em **"Logística"** → **"Programação de Entregas"**
2. Clique em **"+ Nova Programação"**

#### Dados Básicos da Programação
1. **Requisição Base**: Selecione uma requisição aprovada
2. **Centro de Custo**: Automaticamente preenchido
3. **Data de Entrega**: Data programada para execução

#### Adicionando Itens de Entrega
1. **Seção "Itens de Entrega"**:
2. Clique em **"+ Adicionar Item"**
3. Para cada item:
   - **Logradouro**: Selecione da lista da requisição
   - **Quantidade de Massa**: Em toneladas (obrigatório)
   - **Tipo de Lançamento**: 
     - Recapeamento
     - Tapa Buraco
     - Pavimentação Nova
     - Micro Revestimento
   - **Usina**: Usina fornecedora do asfalto
   - **Caminhão**: Veículo que fará o transporte
   - **Equipe**: Equipe responsável pela aplicação
   - **Apontador**: Responsável pelo apontamento

4. **Validações Automáticas**:
   - Disponibilidade do caminhão na data
   - Disponibilidade da equipe
   - Capacidade da usina
   - Soma das massas não pode exceder o total da requisição

#### Gerenciando Itens
- **Duplicar Item**: Para entregas similares
- **Editar Item**: Modificar dados específicos
- **Cancelar Item**: Cancelar com motivo
- **Reordenar**: Arrastar para reordenar a sequência

5. Clique em **"Salvar Programação"**

### Editando Programações

#### Modificações Permitidas
1. **Antes do Envio**: Todos os campos podem ser editados
2. **Após Envio**: Apenas alguns campos específicos
3. **Com Registro de Carga**: Limitações maiores

#### Cancelando Itens
1. Clique no item desejado
2. Clique em **"Cancelar Item"**
3. Informe o motivo do cancelamento
4. O item ficará marcado como cancelado

### Enviando para Execução

#### Processo de Envio
1. **Revisão Final**: Verifique todos os dados
2. **Validações**: Sistema verifica:
   - Disponibilidade de recursos
   - Consistência de dados
   - Aprovações necessárias
3. **Envio**: Clique em **"Enviar para Execução"**
4. **Status**: Muda para "Enviada"

#### Após o Envio
- Itens aparecem na lista de **"Entregas Pendentes"**
- Apontadores podem visualizar suas entregas
- Processo de registro de carga pode ser iniciado

## 🛣️ Registro de Cargas

### Processo de Saída da Usina

#### Acessando o Módulo
1. Vá em **"Logística"** → **"Registro de Cargas"**
2. A lista mostra entregas programadas pendentes

#### Registrando uma Nova Carga
1. Clique na entrega desejada ou em **"+ Novo Registro"**
2. **Dados da Saída**:
   - **Data de Saída**: Data atual (editável)
   - **Hora de Saída**: Hora atual (editável)
   - **Temperatura de Saída**: Em °C (importante para qualidade)
   - **Tonelada de Saída**: Peso carregado na usina

3. **Documentação**:
   - **Foto do Ticket de Saída**: Obrigatório
     - Clique em **"📷 Tirar Foto"** ou **"📁 Selecionar Arquivo"**
     - A foto deve mostrar claramente o peso e informações

#### Registro de Retorno (Opcional)
1. **Tonelada de Retorno**: Peso do caminhão vazio
2. **Foto do Ticket de Retorno**: Documentação do retorno
3. **Tonelada Real**: Calculada automaticamente (saída - retorno)

#### Validações
- Temperatura deve estar entre 120°C e 180°C
- Peso de saída deve ser maior que peso de retorno
- Foto é obrigatória e deve ser legível

4. Clique em **"Salvar Registro"**

### Consultando Registros

#### Lista de Registros
- **Status**: Ativo, Cancelado, Concluído
- **Filtros**: Por data, caminhão, usina, status
- **Detalhes**: Clique para ver informações completas

#### Editando Registros
1. Clique no ícone **"✏️ Editar"**
2. Modifique apenas campos permitidos
3. **Restrições**: 
   - Registros com aplicação não podem alterar peso
   - Fotos não podem ser removidas após aplicação

## 🎯 Registro de Aplicação

### Processo Simplificado de Aplicação

#### Acessando o Módulo
1. Vá em **"Logística"** → **"Aplicações"**
2. A lista mostra entregas com cargas registradas

#### Iniciando um Novo Registro
1. Clique na entrega desejada
2. Clique em **"+ Nova Aplicação"**
3. O sistema abre o formulário simplificado

### Dados Essenciais da Aplicação

#### Informações Obrigatórias
1. **Data de Aplicação**: Data atual (editável)
2. **Hora de Chegada**: Quando o caminhão chegou no local (obrigatório)
3. **Hora de Saída**: Quando o caminhão saiu do local (obrigatório)
4. **Temperatura de Chegada**: Temperatura do asfalto na chegada (opcional)

#### Dados Técnicos (Opcionais)
1. **Localização**:
   - **Logradouro**: Pré-preenchido da programação
   - **Comprimento**: Em metros
   - **Largura Média**: Em metros
   - **Área Aplicada**: Calculada automaticamente (comprimento × largura)

2. **Massa e Espessura**:
   - **Tonelada Aplicada**: Quantidade efetivamente aplicada
   - **Espessura Aplicada**: Calculada automaticamente
   - **Fórmula**: Espessura = (Tonelada ÷ Área) ÷ 2,4 × 100 (cm)

3. **Detalhes Adicionais** (opcionais):
   - **Bordo**: Direito, Esquerdo, Centro, Único, Embocadura
   - **Temperatura de Aplicação**: Durante a aplicação
   - **Hora de Aplicação**: Quando iniciou a aplicação
   - **Estaca Inicial/Final**: Referências de localização

#### Observações
- **Anotações do Apontador**: Comentários sobre a aplicação
- **Observações Gerais**: Observações sobre toda a aplicação

### Cálculos Automáticos

#### Área e Espessura
- **Área = Comprimento × Largura**
- **Espessura = (Tonelada ÷ Área) ÷ 2,4 × 100 (cm)**
- **Massa Remanescente = Massa Total - Massa Aplicada**

#### Validações
- Massa aplicada não pode exceder massa remanescente
- Hora de saída deve ser posterior à chegada
- Dados devem estar consistentes

### Salvando a Aplicação
1. Preencha os campos obrigatórios (data, horas de chegada e saída)
2. **Opcional**: Adicione dados técnicos para relatórios detalhados
3. Clique em **"Salvar Aplicação"**
4. Status da entrega muda para "Finalizada"

### Múltiplas Aplicações

#### Cenário: Uma Carga, Várias Aplicações
Quando uma carga de asfalto é aplicada em múltiplos locais:

1. **Primeira Aplicação**: Processo normal descrito acima
2. **Aplicações Subsequentes**:
   - Sistema detecta massa remanescente
   - Permite nova aplicação com a mesma carga
   - Calcula automaticamente massa disponível

#### Controle de Massa Remanescente
- **Massa Disponível**: Mostrada em tempo real
- **Sequência**: Aplicações numeradas sequencialmente
- **Finalização Automática**: Quando massa ≤ 0.001t

### Visualização de Detalhes da Aplicação

#### Modal de Detalhes Melhorado
1. Clique no ícone **"👁️ Visualizar"** em qualquer aplicação
2. **Seção de Progresso da Aplicação**:
   - Barra de progresso visual da carga
   - Massa aplicada vs. remanescente
   - Percentual de conclusão
   - **Espessura Média da Carga**: Calculada quando há dados de área

3. **Informações da Entrega**:
   - Data de aplicação (formatada como DD/MM/AAAA)
   - Hora de chegada
   - Logradouro e centro de custo

4. **Detalhes da Carga**:
   - Data e hora de saída da usina
   - Tonelagem real carregada
   - Dados do caminhão
   - **Espessura Média**: Exibida quando há dados válidos de área

5. **Dados Técnicos da Aplicação**:
   - Dimensões (comprimento, largura, área)
   - Massa aplicada e espessura calculada
   - Status da espessura (adequada/inadequada)

6. **Dados de Aplicação** (se preenchidos):
   - Hora e temperatura de aplicação
   - Bordo aplicado

#### Cálculo de Espessura Média
- **Fórmula**: (Massa Total da Carga ÷ Área Total dos Detalhes) ÷ 2.4
- **Exibição**: Apenas quando há dados válidos de área
- **Precisão**: 3 casas decimais (ex: 4.567 cm)

### Status e Finalização

#### Status da Aplicação
- **Iniciada**: Dados iniciais preenchidos
- **Em Andamento**: Aplicação em execução
- **Finalizada**: Aplicação concluída

#### Finalização da Carga
- **Automática**: Quando massa remanescente ≤ 0.001t
- **Manual**: Botão "Finalizar Carga" 
- **Efeitos**: 
  - Status da entrega muda para "Entregue"
  - Cálculo de espessura média
  - Dados ficam em modo visualização

## 📊 Relatórios e Consultas

### Relatórios Disponíveis

#### Relatório de Medições
1. Vá em **"Relatórios"** → **"Medições"**
2. **Filtros**:
   - Período (data inicial e final)
   - Centro de custo
   - Apontador
   - Status da aplicação
3. **Informações Incluídas**:
   - Dados da requisição
   - Informações da programação
   - Detalhes da aplicação
   - Cálculos de área e espessura
   - Fotos (se incluídas)

#### Relatório de Produtividade
1. **Filtros**:
   - Período
   - Equipe
   - Tipo de serviço
2. **Métricas**:
   - Toneladas aplicadas por equipe
   - Área pavimentada
   - Média de espessura
   - Dias trabalhados
   - Produtividade diária

#### Relatório de Custos
1. **Filtros**:
   - Centro de custo
   - Período
   - Tipo de despesa
2. **Informações**:
   - Custo de material (asfalto)
   - Custo de mão de obra
   - Custo de equipamentos
   - Custos indiretos
   - Total por centro de custo

### Exportação de Dados

#### Excel
1. Configure os filtros desejados
2. Clique em **"Exportar Excel"**
3. **Arquivo inclui**:
   - Todas as colunas visíveis
   - Formatação adequada
   - Totais e subtotais
   - Gráficos básicos

#### PDF
1. Para relatórios formatados
2. **Inclui**:
   - Logo da empresa
   - Cabeçalho com filtros aplicados
   - Dados tabulados
   - Assinaturas (se configurado)

### Consultas Personalizadas

#### Construtor de Consultas
1. Vá em **"Relatórios"** → **"Consulta Personalizada"**
2. **Selecione Campos**:
   - Arraste campos desejados
   - Configure ordenação
   - Defina agrupamentos
3. **Filtros Avançados**:
   - Operadores: =, ≠, >, <, contém
   - Múltiplas condições
   - Lógica AND/OR
4. **Salvar Consulta**: Para reutilização

## 🔧 Configurações e Administração

### Gestão de Usuários

#### Cadastrando Usuários
1. Vá em **"Administração"** → **"Usuários"**
2. Clique em **"+ Novo Usuário"**
3. Preencha:
   - Email (será o login)
   - Nome completo
   - Função no sistema
   - Permissões
   - Status (Ativo/Inativo)
4. O usuário receberá email para definir senha

#### Permissões
**Níveis de Acesso**:
- **Visualizador**: Apenas consulta
- **Operador**: Pode criar e editar seus próprios registros
- **Supervisor**: Acesso amplo ao módulo
- **Administrador**: Acesso total ao sistema

**Permissões por Módulo**:
- RH: Visualizar, Criar, Editar, Excluir funcionários
- Máquinas: Gerenciar veículos e manutenções
- Logística: Requisições, programações, aplicações
- Relatórios: Acesso a relatórios específicos

### Configurações Gerais

#### Dados da Empresa
1. **Informações Básicas**:
   - Razão social
   - CNPJ
   - Endereço
   - Telefones
   - Email
   - Logo (para relatórios)

#### Parâmetros do Sistema
1. **Cálculos**:
   - Densidade do asfalto (padrão: 2,4 t/m³)
   - Temperaturas mínima e máxima
   - Tolerâncias de medição

2. **Workflow**:
   - Aprovações obrigatórias
   - Notificações automáticas
   - Prazos de execução

### Backup e Segurança

#### Backup Automático
- Backups diários automáticos
- Retenção de 30 dias
- Armazenamento seguro na nuvem

#### Auditoria
- Log de todas as ações
- Rastreabilidade completa
- Relatórios de auditoria

## 📱 Interface Responsiva

### Adaptação para Dispositivos Móveis

#### Características Gerais
- **Design Adaptativo**: Interface se ajusta automaticamente ao tamanho da tela
- **Navegação Otimizada**: Menus e botões adequados para toque
- **Modais Responsivos**: Ajuste automático em telas pequenas
- **Scroll Otimizado**: Rolagem suave em todos os componentes

#### Recursos Mobile-Friendly
1. **Tabelas Adaptativas**:
   - Em telas pequenas, dados importantes ficam em formato de cards
   - Scroll horizontal quando necessário
   - Botões de ação maiores para facilitar o toque

2. **Formulários Otimizados**:
   - Campos maiores para facilitar digitação
   - Teclado adequado para cada tipo de campo
   - Validação em tempo real

3. **Modais Responsivos**:
   - Tamanho ajustado para tela (95% da largura em mobile)
   - Padding reduzido para melhor aproveitamento
   - Scroll interno quando necessário

4. **Navegação Simplificada**:
   - Menu lateral colapsível
   - Breadcrumbs em telas maiores
   - Botões de ação flutuantes quando necessário

## ❓ Perguntas Frequentes (FAQ)

### Problemas Comuns

#### "Data aparece incorreta no sistema"
**Causa**: Problema de timezone
**Solução**: O sistema foi corrigido para sempre exibir datas no fuso horário brasileiro. Se ainda houver problemas, contate o suporte.

#### "Não consigo salvar a aplicação"
**Possíveis causas**:
1. Massa aplicada excede massa remanescente
2. Campos obrigatórios não preenchidos
3. Hora de saída anterior à chegada
4. Área calculada igual a zero

**Soluções**:
1. Verifique a massa disponível na carga
2. Preencha todos os campos marcados com *
3. Corrija as horas informadas
4. Informe comprimento e largura > 0

#### "Veículo não aparece na lista"
**Possíveis causas**:
1. Veículo com status "Indisponível" ou "Manutenção"
2. Veículo já programado para a data
3. Filtros ativos

**Soluções**:
1. Verifique o status do veículo
2. Escolha outra data ou outro veículo
3. Limpe os filtros

#### "Erro ao carregar foto"
**Possíveis causas**:
1. Arquivo muito grande (>5MB)
2. Formato não suportado
3. Problemas de conexão

**Soluções**:
1. Comprima a imagem
2. Use formatos JPG ou PNG
3. Verifique sua conexão

#### "Espessura não está sendo calculada"
**Causa**: Falta de dados de área ou massa
**Solução**: 
1. Preencha comprimento e largura
2. Informe a tonelada aplicada
3. O cálculo será automático: (Tonelada ÷ Área) ÷ 2,4 × 100

### Dicas de Uso

#### Melhor Performance
1. **Use filtros** para reduzir volume de dados
2. **Evite períodos muito longos** em relatórios
3. **Feche abas desnecessárias** do navegador
4. **Mantenha navegador atualizado**

#### Produtividade
1. **Atalhos de teclado**:
   - Ctrl+S: Salvar
   - Ctrl+N: Novo registro
   - ESC: Fechar modal
2. **Favoritos**: Marque relatórios frequentes
3. **Templates**: Use modelos para requisições similares

#### Qualidade dos Dados
1. **Tire fotos claras** dos tickets
2. **Preencha observações** detalhadas
3. **Valide medições** no campo
4. **Revise dados** antes de salvar
5. **Verifique datas** exibidas (devem estar no formato DD/MM/AAAA)

#### Uso em Dispositivos Móveis
1. **Gire a tela** para landscape em formulários complexos
2. **Use zoom** para ver detalhes pequenos
3. **Toque longo** para opções adicionais
4. **Swipe** para navegar entre abas

## 📞 Suporte Técnico

### Canais de Atendimento

#### Email
- **Suporte Geral**: suporte@sistema-asfalto.com
- **Suporte Técnico**: tecnico@sistema-asfalto.com
- **Comercial**: comercial@sistema-asfalto.com

#### Telefone
- **Central de Atendimento**: (11) 3000-0000
- **Emergencial**: (11) 99999-9999 (WhatsApp)

#### Horários
- **Segunda a Sexta**: 8h às 18h
- **Emergencial**: 24h (casos críticos)

### Informações para Suporte

Ao entrar em contato, tenha em mãos:
1. **URL do sistema** que está usando
2. **Usuário** logado
3. **Navegador e versão** (Chrome, Firefox, etc.)
4. **Tipo de dispositivo** (Desktop, Tablet, Smartphone)
5. **Descrição detalhada** do problema
6. **Prints das telas** com erro
7. **Passos para reproduzir** o problema

### Problemas Conhecidos e Soluções

#### Formatação de Datas
- **Problema**: Sistema corrigido para sempre exibir datas brasileiras
- **Se persistir**: Limpe cache do navegador e recarregue a página

#### Cálculos de Espessura
- **Problema**: Espessura média agora é calculada corretamente
- **Fórmula**: (Massa Total ÷ Área Total) ÷ 2.4
- **Exibição**: Apenas quando há dados válidos de área

### Atualizações

#### Notificações
- Atualizações são notificadas no sistema
- Emails informativos sobre novas funcionalidades
- Changelog disponível no sistema

#### Melhorias Recentes (Janeiro 2025)
- ✅ Correção de formatação de datas em todos os modais
- ✅ Cálculo correto de espessura média por carga
- ✅ Interface responsiva melhorada para dispositivos móveis
- ✅ Simplificação do processo de registro de aplicação
- ✅ Melhor visualização de progresso de aplicação

#### Treinamentos
- Webinars mensais
- Treinamentos presenciais sob demanda
- Material de apoio sempre atualizado

---

**Este manual é atualizado constantemente. Última atualização: Janeiro 2025**
**Versão: 2.1 - Inclui melhorias de timezone, cálculos e responsividade**
