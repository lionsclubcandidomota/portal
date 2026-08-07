# Autenticação administrativa no D1 — v6.47.0

O Administrador entra com usuário e senha validados pelo Cloudflare Worker. Usuários, derivação de senha, sessões e auditoria ficam no D1.

## Segredos necessários

```bash
npx wrangler secret put SESSION_SECRET
npx wrangler secret put ADMIN_BOOTSTRAP_KEY
```

`GITHUB_TOKEN` não é utilizado.

## Primeiro Administrador

A tela de primeiro acesso envia usuário, nome, senha e a chave de bootstrap ao Worker. O bootstrap é encerrado automaticamente assim que existe um Administrador.

## Sessões

O navegador mantém um token opaco apenas em memória. O D1 armazena somente seu hash, usuário, perfil, expiração e revogação. O logout revoga a sessão.

## Publicação

Depois do login, alterações públicas são revisadas e gravadas no D1 pelo endpoint `/api/publication`. Não há autenticação ou escrita direta no GitHub.
