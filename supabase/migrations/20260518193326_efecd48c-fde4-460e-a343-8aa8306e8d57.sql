UPDATE public.bd_ponto_config
SET match_min_confidence = 0.55,
    match_strong_confidence = 0.70,
    match_min_delta = 0.05,
    modo_reconhecimento_estrito = true,
    updated_at = now()
WHERE centro_custo_id = '299e6a35-e71e-49e1-a450-a46f5747db98';