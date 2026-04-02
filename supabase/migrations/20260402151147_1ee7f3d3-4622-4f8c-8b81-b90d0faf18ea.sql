
UPDATE bd_diaria_presencas
SET usar_diaria_exclusiva = false,
    valor_diaria_aplicada = 150.00
WHERE id IN (
  'fafe182f-be53-4689-a965-c01c160a3e79',
  '7a3e6533-9452-45b2-94b3-3699d6f388ed',
  '260fad7a-1602-4da3-89d1-a3888ce17d1b'
)
AND usar_diaria_exclusiva = true;
