
-- 1. Normalize all names: UPPER + TRIM
UPDATE bd_funcoes SET nome_funcao = UPPER(TRIM(nome_funcao));

-- 2. Migrate all references (bd_funcionarios + bd_diaria_presencas) then delete duplicates

-- AUXILIAR DE ENGENHARIA: keep 226c9b28 (0), delete 8f67c217 (0)
DELETE FROM bd_funcoes WHERE id = '8f67c217-2968-4ed2-aa4b-52eb7ce5128d';

-- AUXILIAR GERAL DE ELÉTRICA: keep 090367b2 (1), delete dfc427ca (0)
DELETE FROM bd_funcoes WHERE id = 'dfc427ca-b27f-4540-a88a-fea3aa18a995';

-- ENCARREGADO DE OBRAS I: keep 90c5d829 (1), delete f9a02cdc (0)
DELETE FROM bd_funcoes WHERE id = 'f9a02cdc-443a-4d61-8f97-f3afe1a6de00';

-- ENCARREGADO DE TURMA: keep 98973f8c (6 func), move from 669d409b
UPDATE bd_funcionarios SET funcao_id = '98973f8c-d221-419f-80bc-9e5d755a8485' WHERE funcao_id = '669d409b-899a-4157-a606-e730fe4e4147';
UPDATE bd_diaria_presencas SET funcao_id = '98973f8c-d221-419f-80bc-9e5d755a8485' WHERE funcao_id = '669d409b-899a-4157-a606-e730fe4e4147';
DELETE FROM bd_funcoes WHERE id = '669d409b-899a-4157-a606-e730fe4e4147';

-- JOVEM APRENDIZ: keep aaa8c0cc (3), delete ab5fc98f (0)
DELETE FROM bd_funcoes WHERE id = 'ab5fc98f-a99c-4f3c-a6fc-4b223ee91ab8';

-- LÍDER DE TURMA: keep c3c514d0 (1), delete 146face5 (0)
DELETE FROM bd_funcoes WHERE id = '146face5-6479-4901-92d4-cf3d278e5b26';

-- OPERADOR DE PATROL: keep 85e0f8aa (2 func + 4 presencas), delete 60445b31 (0)
DELETE FROM bd_funcoes WHERE id = '60445b31-f8ed-4840-af67-bc093bbaeb5c';

-- OPERADOR DE RETROESCAVADEIRA: keep 6b137e64 (13 func), move from 17cc6a13 (10 func + 92 presencas)
UPDATE bd_funcionarios SET funcao_id = '6b137e64-fa3d-4783-9674-4ad432ecd803' WHERE funcao_id = '17cc6a13-9b13-49fc-93dc-7e29deee83a1';
UPDATE bd_diaria_presencas SET funcao_id = '6b137e64-fa3d-4783-9674-4ad432ecd803' WHERE funcao_id = '17cc6a13-9b13-49fc-93dc-7e29deee83a1';
DELETE FROM bd_funcoes WHERE id = '17cc6a13-9b13-49fc-93dc-7e29deee83a1';

-- OPERADOR DE TRÂNSITO: keep aeb8feb6 (1), delete f9f02819 (0)
DELETE FROM bd_funcoes WHERE id = 'f9f02819-52e6-494c-9342-eab1011e4f87';

-- PEDREIRO A: keep b3bdc3dd (3), move from f5447b1f (2 func + 3 presencas)
UPDATE bd_funcionarios SET funcao_id = 'b3bdc3dd-8f26-4647-8579-fef78ba28d60' WHERE funcao_id = 'f5447b1f-f5d3-4edb-833d-a93050ee8a00';
UPDATE bd_diaria_presencas SET funcao_id = 'b3bdc3dd-8f26-4647-8579-fef78ba28d60' WHERE funcao_id = 'f5447b1f-f5d3-4edb-833d-a93050ee8a00';
DELETE FROM bd_funcoes WHERE id = 'f5447b1f-f5d3-4edb-833d-a93050ee8a00';

-- TÉCNICA DE ENFERMAGEM: keep a85cb25b (1), delete 569e3063 (0)
DELETE FROM bd_funcoes WHERE id = '569e3063-d946-4f87-a689-58bf01f35a63';

-- 3. Unique index to prevent future duplicates (case-insensitive)
CREATE UNIQUE INDEX idx_bd_funcoes_nome_unique ON bd_funcoes (UPPER(TRIM(nome_funcao)));
