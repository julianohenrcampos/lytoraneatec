
-- Correção: Excluir 70 registros duplicados onde nome_completo contém valor numérico (matrícula)
-- Esses registros foram criados erroneamente pela importação Alterdata
-- Os registros originais com nomes corretos já existem no banco
DELETE FROM bd_funcionarios
WHERE nome_completo ~ '^[0-9]+$';
