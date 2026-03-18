
-- Step 1: Create new specific categories
INSERT INTO bd_categorias_ativos (id, nome_categoria, ativo, descricao) VALUES
  ('a1b2c3d4-1111-4000-8000-000000000001', 'CAMINHÃO', true, 'Caminhões'),
  ('a1b2c3d4-2222-4000-8000-000000000002', 'ÔNIBUS', true, 'Ônibus'),
  ('a1b2c3d4-3333-4000-8000-000000000003', 'PRANCHA', true, 'Pranchas'),
  ('a1b2c3d4-4444-4000-8000-000000000004', 'VAN', true, 'Vans e veículos leves');

-- Step 2: Reclassify subcategories from VEICULO to new specific categories

-- Subcategories -> CAMINHÃO
UPDATE bd_subcategorias_ativos SET categoria_id = 'a1b2c3d4-1111-4000-8000-000000000001'
WHERE id IN (
  'cee49223-d1f4-42cb-a092-59473ae719f9',  -- CAM BASCULANTE
  '280723c8-8bc9-4348-8453-890570d87e99',  -- CAM BASCULANTE C CABINE AUX
  '5f6ed89a-972a-4168-903f-8768c2da3c51',  -- CAM BASCULANTE TRUCK
  'c0f5f5c5-e117-4c60-a1ea-3a88abf43725',  -- CAMINHÃO BASCULANTE TRAÇADO
  '90c1e68c-07ec-445a-b99d-38030ebd7b5d',  -- CAMINHÃO BAÚ
  '408b5812-14d5-48fd-acfa-c2316be8a9d9',  -- CAMINHÃO BETONEIRA
  '49e77744-62c0-4c10-bc9a-fb65bf40f147',  -- CAMINHÃO CARROCERIA
  'bdaa3629-08fb-487d-8732-ee833762944a',  -- CAMINHÃO CARROCERIA (BOI)
  'ea5176c0-67c2-44c8-bf4e-37c496f95f4c',  -- CAMINHÃO CARROCERIA C/ CAB AUXILIAR
  '247af3fd-f93f-4101-ad7a-7c632a0782eb',  -- CAMINHÃO COMBOIO (Melosa)
  'dc79d237-6cf0-499f-bf3e-725f3ccbee8c',  -- CAMINHÃO ESPARGEDOR
  '4d18e8be-a11b-42d1-a319-1b7437435c7a',  -- CAMINHÃO MUNCK
  '26512b7b-de60-41a1-99d4-fba1d3b1b904',  -- CAMINHÃO PIPA
  '2ac16996-58c1-4468-ba6b-325706a470ca',  -- CAMINHÃO POLIGUINDASTE
  '66ad77bb-9f8d-429d-bc33-0d3389a4ddc8',  -- CAMINHÃO PRANCHA
  '7fe91d65-fc6f-4ed8-8ef7-87dea69c79b2',  -- CAMINHÃO TOCO CARROCERIA CAB AUX
  '5f08d071-fb8e-4cf7-a002-97ba42a57dd3',  -- CAMINHÃO VACALL
  '3e44f208-9965-4fe8-a330-fecbfdcd9e3b',  -- CARRETA CAÇAMBA
  '21c79178-2e97-4f3a-ad7f-6e554b64f6ca',  -- CARRETA PRANCHA CONTAINER
  '0565c4af-01c5-4c63-8c16-e50870e568a5',  -- CARRETA TANQUE
  'e3d52366-eb5b-4cc7-8037-e54b66390717'   -- CAVALO MECÂNICO
);

-- Subcategory -> ÔNIBUS
UPDATE bd_subcategorias_ativos SET categoria_id = 'a1b2c3d4-2222-4000-8000-000000000002'
WHERE id = 'f1f9bec5-dc41-4823-bc48-4562f608d8d3';  -- ÔNIBUS

-- Subcategory -> PRANCHA
UPDATE bd_subcategorias_ativos SET categoria_id = 'a1b2c3d4-3333-4000-8000-000000000003'
WHERE id = '205d101f-1ea1-43e3-a66b-e86e604c5607';  -- CARRETA PRANCHA

-- Subcategories -> VAN
UPDATE bd_subcategorias_ativos SET categoria_id = 'a1b2c3d4-4444-4000-8000-000000000004'
WHERE id IN (
  '75d14007-edcd-4928-93a1-a437c1bb603a',  -- VAN
  '154ae835-624d-48c3-ad3f-fbf630cfdb4e',  -- PICAPE
  'ce3507a8-9584-4cc4-bbbe-c878e047a7e0',  -- VEICULO HATCH
  'b625ed9b-1133-48c4-8db6-acddff3eb9b3'   -- VEICULO SUV COMPACTO
);

-- Step 3: Update records in bd_caminhoes_equipamentos to point to new categories
UPDATE bd_caminhoes_equipamentos SET categoria_ativo_id = 'a1b2c3d4-1111-4000-8000-000000000001'
WHERE tipo_veiculo = 'Caminhão';

UPDATE bd_caminhoes_equipamentos SET categoria_ativo_id = 'a1b2c3d4-2222-4000-8000-000000000002'
WHERE tipo_veiculo = 'Ônibus';

UPDATE bd_caminhoes_equipamentos SET categoria_ativo_id = 'a1b2c3d4-3333-4000-8000-000000000003'
WHERE tipo_veiculo = 'Prancha';

UPDATE bd_caminhoes_equipamentos SET categoria_ativo_id = 'a1b2c3d4-4444-4000-8000-000000000004'
WHERE tipo_veiculo = 'Van';

-- Step 4: Delete old VEICULO category (now empty of subcategories and records)
DELETE FROM bd_categorias_ativos WHERE id = 'e83b208f-dad7-49c4-953a-92d3b843e6e9';

-- Step 5: Drop legacy columns
ALTER TABLE bd_caminhoes_equipamentos DROP COLUMN IF EXISTS tipo_veiculo;
ALTER TABLE bd_caminhoes_equipamentos DROP COLUMN IF EXISTS modelo;
