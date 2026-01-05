UPDATE bd_pncp_config_monitoramento 
SET valor_minimo = 1000000,
    updated_at = now()
WHERE ativo = true;