# Release 6.39.0

Esta etapa introduz **autenticação administrativa por usuário e senha no Cloudflare D1** e retira o token do GitHub do navegador.

## Componentes

- Portal 6.39.0: tela de login, primeiro acesso e cliente de sessão.
- Worker 1.5.0: autenticação, sessões, auditoria e publicação pública.
- Migração D1 `0002_admin_auth.sql`: usuários, sessões e eventos de autenticação.
- R2: permanece responsável por anexos, espelho e backups.

## Ordem de implantação

1. Atualizar o pacote do Worker, preservando os bindings `ATTACHMENTS` e `PORTAL_DB`.
2. Configurar os segredos `GITHUB_TOKEN`, `ADMIN_BOOTSTRAP_KEY` e manter `SESSION_SECRET`.
3. Aplicar as migrações D1 remotas.
4. Publicar o Worker 1.5.0.
5. Confirmar `/health` com autenticação inicializada.
6. Publicar o Portal 6.39.0 uma vez pelo fluxo atual de implantação do repositório.
7. Abrir a área administrativa e criar o primeiro usuário pela opção **Primeiro acesso**.
8. Entrar usando o usuário e a senha criados.
9. Testar salvamento privado no D1 e publicação pública pelo Worker.

## Segredos

```bash
npx wrangler secret put SESSION_SECRET
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put ADMIN_BOOTSTRAP_KEY
```

`ADMIN_BOOTSTRAP_KEY` deve possuir pelo menos 24 caracteres e ser usada somente para a criação inicial. `GITHUB_TOKEN` não deve aparecer em `wrangler.toml`, arquivos do Portal ou armazenamento do navegador.

## Compatibilidade

- O D1 já ativo continua como fonte principal dos dados privados.
- Os anexos e backups existentes não são movidos ou apagados.
- O acesso da Diretoria por senha permanece disponível.
- O acesso administrativo por token antigo fica desabilitado com `LEGACY_GITHUB_LOGIN_ENABLED = "false"`.

Guia detalhado: `docs/admin-authentication-d1.md`.
