# Autenticação administrativa pelo Cloudflare D1

## Resultado esperado

Depois desta etapa, o Administrador entra no Portal com **usuário e senha**. O token do GitHub não é solicitado pelo frontend e fica somente como segredo do Cloudflare Worker para publicação do conteúdo público.

```text
Portal → usuário e senha → Worker → D1 → sessão temporária
Portal → publicar conteúdo público → Worker → segredo GITHUB_TOKEN → GitHub
```

## 1. Arquivos envolvidos

O Worker 1.5.0 adiciona:

- `src/auth.js`;
- `src/github-publication.js`;
- `migrations/0002_admin_auth.sql`.

A migração cria:

- `portal_users`: usuários, perfis, hashes, bloqueios e último acesso;
- `portal_auth_sessions`: sessões opacas armazenadas somente pelo hash;
- `portal_auth_audit`: eventos de bootstrap, login, logout e gestão de usuários.

## 2. Atualizar o Worker

Extraia o pacote do Worker e preserve o `wrangler.toml` usado em produção. Confira:

```toml
[[r2_buckets]]
binding = "ATTACHMENTS"
bucket_name = "lions-portal-documentos"

[[d1_databases]]
binding = "PORTAL_DB"
database_name = "lions-portal-dados"
database_id = "UUID_REAL_DO_BANCO"
migrations_dir = "migrations"

[vars]
GITHUB_OWNER = "lionsclubcandidomota"
GITHUB_REPO = "portal"
GITHUB_BRANCH = "main"
GITHUB_DATA_PATH = "data/dados.json"
LEGACY_GITHUB_LOGIN_ENABLED = "false"
```

Não coloque segredos no arquivo TOML.

## 3. Configurar os segredos

Na pasta `cloudflare/attachment-worker`:

```bash
npx wrangler secret put SESSION_SECRET
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put ADMIN_BOOTSTRAP_KEY
```

### SESSION_SECRET

Preserve o valor já usado pelo Worker. Ele continua protegendo os tickets temporários de acesso aos anexos.

### GITHUB_TOKEN

Use o token que atualmente permite publicar no repositório `lionsclubcandidomota/portal`. Ele passa a existir somente no ambiente do Worker e não será mais digitado no Portal.

### ADMIN_BOOTSTRAP_KEY

Crie um código aleatório com pelo menos 24 caracteres. Exemplo de geração local:

```bash
openssl rand -base64 32
```

Guarde o código até criar o primeiro Administrador. Ele não é uma senha de uso diário.

## 4. Aplicar a migração D1

```bash
npm ci
npx wrangler d1 migrations apply lions-portal-dados --remote
```

A saída deve informar que `0002_admin_auth.sql` foi aplicada. O comando pode informar que `0001_portal_private_state.sql` já estava aplicada; isso é esperado.

## 5. Publicar o Worker

```bash
npx wrangler deploy
```

Abra o endpoint `/health`. Antes da criação do primeiro usuário, o resultado esperado inclui:

```json
{
  "workerVersion": "1.5.0",
  "privateState": "d1",
  "authentication": {
    "available": true,
    "initialized": true,
    "bootstrapRequired": true,
    "passwordLogin": false,
    "publicationAvailable": true
  },
  "publicPublication": {
    "available": true,
    "via": "worker-secret"
  }
}
```

Se `initialized` for `false`, a migração 0002 ainda não foi aplicada. Se `publicationAvailable` for `false`, o segredo `GITHUB_TOKEN` ainda não foi cadastrado.

## 6. Publicar o Portal 6.39.0

Atualize o repositório com o pacote-fonte e aguarde o GitHub Actions. Esta publicação instala a nova tela de autenticação. Depois disso, o token não será mais necessário para entrar no Portal.

## 7. Criar o primeiro Administrador

1. Abra **Dashboard Administrativo**.
2. Expanda **Primeiro acesso: criar Administrador**.
3. Informe o valor de `ADMIN_BOOTSTRAP_KEY`.
4. Informe nome exibido, usuário e senha.
5. Confirme a criação.

Regras iniciais da senha:

- 10 a 128 caracteres;
- pelo menos uma letra;
- pelo menos um número.

A criação inicial é bloqueada definitivamente assim que existe um Administrador no D1.

## 8. Entrar e homologar

Entre com o usuário e a senha criados. Verifique:

1. os dados privados são carregados do D1;
2. uma movimentação de teste mostra **Banco sincronizado** sem publicação;
3. um aviso público cria pendência pública;
4. **Publicar conteúdo público** funciona sem solicitar token;
5. sair encerra a sessão no D1;
6. tentar usar a sessão encerrada retorna acesso negado.

Depois do primeiro login, `/health` deve apresentar:

```json
{
  "authentication": {
    "bootstrapRequired": false,
    "passwordLogin": true
  }
}
```

## 9. Segurança operacional

- A senha original não é armazenada.
- Cada usuário possui salt individual e derivação PBKDF2-HMAC-SHA-256.
- Cinco tentativas inválidas provocam bloqueio temporário de 15 minutos.
- O token de sessão é aleatório; somente seu hash SHA-256 fica no D1.
- A sessão fica apenas na memória da página e é removida no logout ou por inatividade.
- O acesso legado por token permanece desabilitado por padrão.
- O Worker registra eventos de autenticação em `portal_auth_audit`.

## 10. Contingência

Não habilite `LEGACY_GITHUB_LOGIN_ENABLED` durante o uso normal. Essa variável existe apenas para uma contingência técnica temporária durante a homologação. Depois de confirmar o login por senha, mantenha:

```toml
LEGACY_GITHUB_LOGIN_ENABLED = "false"
```

Os dados financeiros no D1, os anexos no R2 e os backups existentes não são alterados pela migração de autenticação.
