# Segurança

## Nunca

- commitar `.env`;
- armazenar tokens em código;
- aceitar URLs sem validação;
- permitir SSRF;
- logar secrets;
- burlar CAPTCHA;
- contornar rate limits;
- acessar áreas privadas sem autorização;
- reutilizar credenciais de terceiros.

## URLs

Ao aceitar uma URL de produto:

1. validar esquema;
2. aplicar allowlist de domínios;
3. rejeitar IPs privados;
4. impedir redirects perigosos;
5. limitar tamanho;
6. registrar apenas metadados seguros.

## Credenciais

Usar secret manager quando possível. Em MVP, `.env` fora do Git e permissões restritas.

## Admin

Ativar autenticação forte e, futuramente, 2FA.

## Auditoria

Registrar:

- login;
- alteração de configuração;
- publicação manual;
- rejeição;
- troca de credenciais;
- alterações de regras.
