-- Passo 1: Redirecionar agendamentos para MTX MEDICINA DO TRABALHO Itaguaí
UPDATE bd_agendamentos_exames 
SET local_atendimento_id = '4eb61dfc-9bc1-4020-a115-9fcdb3a0132e'
WHERE local_atendimento_id = '2851d9d2-485c-4ddc-a795-9d0f8845f0c6';

-- Passo 2: Excluir clínica "joao neto frederico"
DELETE FROM bd_locais_atendimento 
WHERE id = '2851d9d2-485c-4ddc-a795-9d0f8845f0c6';