CREATE OR REPLACE FUNCTION public.fn_rate_limit_reset(p_escopo text, p_chave_tipo text, p_chave_valor text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  DELETE FROM public.bd_rate_limit_tentativas
  WHERE escopo = p_escopo
    AND chave_tipo = p_chave_tipo
    AND chave_valor = p_chave_valor;
$$;

REVOKE ALL ON FUNCTION public.fn_rate_limit_reset(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_rate_limit_reset(text, text, text) TO service_role;

UPDATE public.bd_rate_limit_tentativas
SET bloqueado_ate = NULL, tentativas = 0, janela_inicio = now(), updated_at = now()
WHERE escopo = 'atestado_validar' AND bloqueado_ate IS NOT NULL AND bloqueado_ate > now();