-- Atualizar total de itens de 45 para 35
ALTER TABLE bd_sso_checklists 
  ALTER COLUMN total_itens SET DEFAULT 35;

-- Popular tabela de itens modelo com os 35 itens da planilha NR-18
INSERT INTO bd_sso_itens_modelo (ordem, tema, descricao) VALUES
(1, 'Instalações Sanitárias', 'O canteiro de obra possui instalações sanitárias?'),
(2, 'Instalações Sanitárias', 'As instalações sanitárias são separadas por sexo?'),
(3, 'Instalações Sanitárias', 'As instalações sanitárias possuem paredes de material resistente e lavável?'),
(4, 'Instalações Sanitárias', 'As instalações sanitárias possuem pisos impermeáveis, laváveis e antiderrapante?'),
(5, 'Instalações Sanitárias', 'As instalações sanitárias possuem ventilação e iluminação adequadas?'),
(6, 'Instalações Sanitárias', 'As instalações sanitárias possuem instalações elétricas adequadamente protegidas?'),
(7, 'Instalações Sanitárias', 'As instalações sanitárias possuem lavatório, vaso sanitário e mictório na proporção de 1 conjunto para cada grupo de 20 trabalhadores ou fração?'),
(8, 'Instalações Sanitárias', 'As instalações sanitárias possuem um chuveiro para cada grupo de 10 trabalhadores ou fração?'),
(9, 'Instalações Sanitárias', 'Deve ser de, no máximo, 150 m o deslocamento do trabalhador do seu posto de trabalho até a instalação sanitária mais próxima?'),
(10, 'Instalações Sanitárias', 'Os chuveiros possuem água quente?'),
(11, 'Instalações Sanitárias', 'Os chuveiros estão aterrados eletricamente?'),
(12, 'Vestiário', 'O canteiro de obra possui vestiário?'),
(13, 'Vestiário', 'O vestiário possui piso de material lavável?'),
(14, 'Vestiário', 'O vestiário possui armários individuais dotados de fechadura ou cadeado?'),
(15, 'Vestiário', 'O vestiário é mantido em perfeito estado de conservação, higiene e limpeza?'),
(16, 'Vestiário', 'O vestiário possui bancos em número suficiente, sendo a largura mínima de 0,30 m por usuário?'),
(17, 'Áreas de Vivência', 'As áreas de vivência são mantidas em perfeito estado de conservação, higiene e limpeza?'),
(18, 'Local para Refeições', 'O canteiro de obra possui local para refeições?'),
(19, 'Local para Refeições', 'O local para refeições possui piso de material lavável?'),
(20, 'Local para Refeições', 'O local para refeições possui capacidade para garantir o atendimento de todos os trabalhadores no horário das refeições?'),
(21, 'Local para Refeições', 'O local para refeições possui lavatório no seu interior ou nas proximidades?'),
(22, 'Local para Refeições', 'O local para refeições possui mesas com tampos lisos e laváveis?'),
(23, 'Local para Refeições', 'O local para refeições possui assentos em número suficiente para atender os usuários?'),
(24, 'Local para Refeições', 'O local para refeições possui depósito com tampa para detritos?'),
(25, 'Local para Refeições', 'O local para refeições é separado das instalações sanitárias?'),
(26, 'Água Potável', 'É fornecida água potável para os trabalhadores?'),
(27, 'Água Potável', 'Deve ser de, no máximo, 100 m o deslocamento do trabalhador do seu posto de trabalho até o fornecimento de água?'),
(28, 'Água Potável', 'Na impossibilidade de instalação de bebedouro ou de dispositivo equivalente dentro dos limites referidos no subitem anterior, as empresas devem garantir, nos postos de trabalho, suprimento de água potável, filtrada e fresca fornecida em recipientes portáteis herméticos?'),
(29, 'Instalações Elétricas', 'Existe projeto e laudo de aterramento dos contêiners?'),
(30, 'Instalações Elétricas', 'Os contêiners possuem devido aterramento elétrico?'),
(31, 'Instalações Elétricas', 'Máquinas e equipamentos móveis e ferramentas elétricas portáteis devem ser conectadas à rede de alimentação elétrica, por intermédio de conjunto de plugue e tomada?'),
(32, 'Instalações Elétricas', 'É proibida a existência de partes vivas expostas e acessíveis pelos trabalhadores?'),
(33, 'Equipamentos - Serra Circular', 'Serra circular dispor de dispositivo que possibilite a regulagem da altura do disco?'),
(34, 'Equipamentos - Serra Circular', 'Serra circular possui coletor de serragem?'),
(35, 'Equipamentos - Serra Circular', 'Serra circular deve ter coifa ou outro dispositivo que impeça a projeção do disco de corte e retrocesso da madeira?')
ON CONFLICT (id) DO NOTHING;