
-- Step 1: Move subcategories from ÔNIBUS (a1b2c3d4-2222) to VEÍCULO (a1b2c3d4-1111)
UPDATE bd_subcategorias_ativos
SET categoria_id = 'a1b2c3d4-1111-4000-8000-000000000001'
WHERE categoria_id = 'a1b2c3d4-2222-4000-8000-000000000002';

-- Step 2: Move subcategories from VAN (a1b2c3d4-4444) to VEÍCULO (a1b2c3d4-1111)
UPDATE bd_subcategorias_ativos
SET categoria_id = 'a1b2c3d4-1111-4000-8000-000000000001'
WHERE categoria_id = 'a1b2c3d4-4444-4000-8000-000000000004';

-- Step 3: Move subcategory CARRETA PRANCHA from PRANCHA (a1b2c3d4-3333) to EQUIPAMENTO (bb095908)
UPDATE bd_subcategorias_ativos
SET categoria_id = 'bb095908-3160-45eb-b7aa-cbebeeaa15ee'
WHERE categoria_id = 'a1b2c3d4-3333-4000-8000-000000000003';

-- Step 4: Move assets from ÔNIBUS → VEÍCULO
UPDATE bd_caminhoes_equipamentos
SET categoria_ativo_id = 'a1b2c3d4-1111-4000-8000-000000000001'
WHERE categoria_ativo_id = 'a1b2c3d4-2222-4000-8000-000000000002';

-- Step 5: Move assets from VAN → VEÍCULO
UPDATE bd_caminhoes_equipamentos
SET categoria_ativo_id = 'a1b2c3d4-1111-4000-8000-000000000001'
WHERE categoria_ativo_id = 'a1b2c3d4-4444-4000-8000-000000000004';

-- Step 6: Move assets from PRANCHA → EQUIPAMENTO
UPDATE bd_caminhoes_equipamentos
SET categoria_ativo_id = 'bb095908-3160-45eb-b7aa-cbebeeaa15ee'
WHERE categoria_ativo_id = 'a1b2c3d4-3333-4000-8000-000000000003';

-- Step 7: Rename category VEÍCULO to be clearer (it was originally "Caminhão")
UPDATE bd_categorias_ativos
SET nome_categoria = 'VEÍCULO'
WHERE id = 'a1b2c3d4-1111-4000-8000-000000000001';

-- Step 8: Rename EQUIPAMENTO to be consistent
UPDATE bd_categorias_ativos
SET nome_categoria = 'EQUIPAMENTO'
WHERE id = 'bb095908-3160-45eb-b7aa-cbebeeaa15ee';

-- Step 9: Delete now-empty categories
DELETE FROM bd_categorias_ativos WHERE id = 'a1b2c3d4-2222-4000-8000-000000000002';
DELETE FROM bd_categorias_ativos WHERE id = 'a1b2c3d4-3333-4000-8000-000000000003';
DELETE FROM bd_categorias_ativos WHERE id = 'a1b2c3d4-4444-4000-8000-000000000004';
