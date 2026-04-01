INSERT INTO bd_configuracoes_sistema (chave, valor, descricao, ativo)
VALUES (
  'desbloqueio_horario_agendamento_exames',
  'false',
  'Quando ativo, permite criar/editar agendamentos de exames fora do horário comercial (6h-16h)',
  true
)
ON CONFLICT (chave) DO NOTHING;