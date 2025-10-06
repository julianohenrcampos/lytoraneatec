# Configuração do Supabase para Reset de Senha

## URLs que devem ser configuradas no Dashboard do Supabase

Acesse: https://supabase.com/dashboard/project/eexzgpmrousuxlkvqwkm/auth/url-configuration

### Site URL
```
http://lytotec.com.br
```

### Additional Redirect URLs
```
http://lytotec.com.br/reset-password
http://lytotec.com.br/*
http://localhost:3000
http://localhost:3000/reset-password
http://localhost:3000/*
```

### Quando HTTPS estiver disponível, adicionar também:
```
https://lytotec.com.br
https://lytotec.com.br/reset-password
https://lytotec.com.br/*
```

## Importante

1. **Sempre teste com um novo email de recuperação** após alterar as configurações
2. Links antigos expiram e não funcionarão
3. Verifique se as URLs estão exatamente como mostrado acima
4. O Service Worker foi atualizado para v3 para evitar cache de auth

## Troubleshooting

Se ainda ocorrer erro "otp_expired":
1. Limpe o cache do navegador (Ctrl+Shift+R)
2. Teste em aba anônima
3. Verifique se o email foi enviado recentemente (links expiram)
4. Confira se as URLs no Supabase estão corretas