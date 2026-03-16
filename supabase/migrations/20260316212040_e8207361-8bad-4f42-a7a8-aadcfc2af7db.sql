-- Step 1: Create missing subcategorias
INSERT INTO bd_subcategorias_ativos (categoria_id, nome_subcategoria, ativo)
VALUES 
  ('bb095908-3160-45eb-b7aa-cbebeeaa15ee'::uuid, 'CHAPA CHAPA', true),
  ('bb095908-3160-45eb-b7aa-cbebeeaa15ee'::uuid, 'ROLINHO TAPA BURACO', true)
ON CONFLICT DO NOTHING;

-- Step 2: Populate categoria_ativo_id based on tipo_veiculo
UPDATE bd_caminhoes_equipamentos
SET categoria_ativo_id = CASE
  WHEN tipo_veiculo = 'Equipamento' THEN 'bb095908-3160-45eb-b7aa-cbebeeaa15ee'::uuid
  ELSE 'e83b208f-dad7-49c4-953a-92d3b843e6e9'::uuid
END
WHERE tipo_veiculo IS NOT NULL AND categoria_ativo_id IS NULL;

-- Step 3: Populate subcategoria_ativo_id via explicit mapping
WITH mapeamento (modelo_norm, subcat_id) AS (
  VALUES
    ('TRAÇADO BASCULANTE',                    'c0f5f5c5-e117-4c60-a1ea-3a88abf43725'::uuid),
    ('BASCULANTE',                            'cee49223-d1f4-42cb-a092-59473ae719f9'::uuid),
    ('CAÇAMBA CABINE',                        '280723c8-8bc9-4348-8453-890570d87e99'::uuid),
    ('TRUCADO BASCULANTE',                    '5f6ed89a-972a-4168-903f-8768c2da3c51'::uuid),
    ('TRUCADO BASCULANTE CACHORREIRA',        '5f6ed89a-972a-4168-903f-8768c2da3c51'::uuid),
    ('TRUCADO CACHORREIRA BASCULANTE',        '5f6ed89a-972a-4168-903f-8768c2da3c51'::uuid),
    ('TOCO CACHORREIRA BASCULANTE',           'cee49223-d1f4-42cb-a092-59473ae719f9'::uuid),
    ('TOCO  CACHORREIRA BASCULANTE',          'cee49223-d1f4-42cb-a092-59473ae719f9'::uuid),
    ('TOCO ESPARGIDOR',                       'dc79d237-6cf0-499f-bf3e-725f3ccbee8c'::uuid),
    ('TRUCADO ESPARGIDOR',                    'dc79d237-6cf0-499f-bf3e-725f3ccbee8c'::uuid),
    ('TOCO  PIPA',                            '26512b7b-de60-41a1-99d4-fba1d3b1b904'::uuid),
    ('TRUCADO  PIPA',                         '26512b7b-de60-41a1-99d4-fba1d3b1b904'::uuid),
    ('CARROCERIA CACHORREIRA',                '49e77744-62c0-4c10-bc9a-fb65bf40f147'::uuid),
    ('TOCO CARROCERIA CACHORREIRA',           '49e77744-62c0-4c10-bc9a-fb65bf40f147'::uuid),
    ('TOCO CAVALO MECÂNICO',                  'e3d52366-eb5b-4cc7-8037-e54b66390717'::uuid),
    ('TRUCADO CAVALO MECÂNICO (USINA MÓVEL)', 'e3d52366-eb5b-4cc7-8037-e54b66390717'::uuid),
    ('TOCO PRANCHA',                          '66ad77bb-9f8d-429d-bc33-0d3389a4ddc8'::uuid),
    ('TRAÇADO PRANCHA',                       '66ad77bb-9f8d-429d-bc33-0d3389a4ddc8'::uuid),
    ('ÔNIBUS',                                'f1f9bec5-dc41-4823-bc48-4562f608d8d3'::uuid),
    ('VAN',                                   '75d14007-edcd-4928-93a1-a437c1bb603a'::uuid),
    ('PRANCHA DO CAVALO',                     '205d101f-1ea1-43e3-a66b-e86e604c5607'::uuid),
    ('SRCT 2E 22T',                           '205d101f-1ea1-43e3-a66b-e86e604c5607'::uuid),
    ('MINICARREGADEIRA',                      '8775e427-912a-4189-bd1c-36a36ba2d3b9'::uuid),
    ('PÁ CARREGADEIRA',                       'c55c4a53-5547-478f-a330-9e090c9755cc'::uuid),
    ('RETROESCAVADEIRA',                      '1177d077-4340-48e7-a651-b6923d423c5b'::uuid),
    ('FRESADORA',                             '3e6bc499-0d3d-4693-9f37-54a003efad1d'::uuid),
    ('VIBROACABADORA',                        '8e6c43e4-b02d-4303-bce8-c8b250b334e3'::uuid),
    ('VASSOURA',                              '3289340e-b8d1-401b-b7f1-593cd1f2adf7'::uuid),
    ('PNEU',                                  '7bc3daa3-3ff2-4be3-ae5e-73a58692e915'::uuid),
    ('COMBINADO',                             '6a58912a-1a6b-4251-b192-56503d6423eb'::uuid),
    ('ROLINHO DE ASFALTO',                    'faf5ee95-884a-4d8c-a072-64f9afc3de18'::uuid),
    ('USINA MÓVEL',                           'bed1f0db-c7ca-451e-9394-9a6d8bf0580f'::uuid)
)
UPDATE bd_caminhoes_equipamentos v
SET subcategoria_ativo_id = m.subcat_id
FROM mapeamento m
WHERE UPPER(TRIM(v.modelo)) = m.modelo_norm
  AND v.subcategoria_ativo_id IS NULL;

-- Step 3b: Map CHAPA CHAPA and ROLINHO TAPA BURACO to newly created subcategorias
UPDATE bd_caminhoes_equipamentos v
SET subcategoria_ativo_id = s.id
FROM bd_subcategorias_ativos s
WHERE UPPER(TRIM(v.modelo)) = 'CHAPA CHAPA'
  AND s.nome_subcategoria = 'CHAPA CHAPA'
  AND v.subcategoria_ativo_id IS NULL;

UPDATE bd_caminhoes_equipamentos v
SET subcategoria_ativo_id = s.id
FROM bd_subcategorias_ativos s
WHERE UPPER(TRIM(v.modelo)) = 'ROLINHO TAPA BURACO'
  AND s.nome_subcategoria = 'ROLINHO TAPA BURACO'
  AND v.subcategoria_ativo_id IS NULL;