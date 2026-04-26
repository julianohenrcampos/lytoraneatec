-- Fase 1.1 — Feature flag para integração Ponto → Diária

-- 1) Insere a chave (idempotente)
INSERT INTO public.bd_configuracoes_sistema (chave, valor, ativo, descricao)
VALUES (
  'ponto_integracao_diaria_ativa',
  'false',
  true,
  'Ativa integração automática entre registro de ponto e apontamento de diária (Fase 1).'
)
ON CONFLICT (chave) DO NOTHING;

-- 2) Reforça guarda SuperAdm na função de update (defesa em profundidade,
--    sem alterar a assinatura usada pelo serviço configService.ts)
CREATE OR REPLACE FUNCTION public.update_configuracao_sistema(p_chave text, p_valor text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.fn_ponto_is_superadmin() THEN
    RAISE EXCEPTION 'Sem permissão para alterar configurações do sistema';
  END IF;

  UPDATE public.bd_configuracoes_sistema
     SET valor = p_valor,
         updated_at = now()
   WHERE chave = p_chave;
END;
$$;