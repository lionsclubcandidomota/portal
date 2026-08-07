# Cloudflare Worker do Portal Lions — v1.5.1

O Worker concentra autenticação, dados privados, anexos, backups e publicação pública.

## Serviços vinculados

```text
PORTAL_DB  → Cloudflare D1
ATTACHMENTS → Cloudflare R2
```

O D1 armazena dados privados estruturados, usuários, sessões e auditoria. O R2 armazena documentos, comprovantes, backups e espelho de contingência.

## Preparação

```bash
npm ci
cp wrangler.toml.example wrangler.toml
```

No `wrangler.toml`, informe o bucket e o UUID real do D1. Preserve:

```toml
[[r2_buckets]]
binding = "ATTACHMENTS"
bucket_name = "lions-portal-documentos"

[[d1_databases]]
binding = "PORTAL_DB"
database_name = "lions-portal-dados"
database_id = "UUID_REAL"
migrations_dir = "migrations"
```

## Variáveis públicas

```toml
[vars]
ALLOWED_ORIGINS = "https://lionsclubcandidomota.github.io,http://localhost:*,http://127.0.0.1:*"
GITHUB_OWNER = "lionsclubcandidomota"
GITHUB_REPO = "portal"
GITHUB_BRANCH = "main"
GITHUB_DATA_PATH = "data/dados.json"
LEGACY_GITHUB_LOGIN_ENABLED = "false"
PUBLIC_DATA_URL = "https://lionsclubcandidomota.github.io/portal/data/dados.json"
SESSION_TTL_SECONDS = "1800"
DOWNLOAD_TTL_SECONDS = "300"
```

## Segredos

```bash
npx wrangler secret put SESSION_SECRET
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put ADMIN_BOOTSTRAP_KEY
```

- `SESSION_SECRET`: mínimo de 32 caracteres; protege tickets de anexos.
- `GITHUB_TOKEN`: usado somente pelo Worker para publicar conteúdo público.
- `ADMIN_BOOTSTRAP_KEY`: mínimo de 24 caracteres; cria o primeiro Administrador.

Não coloque esses valores em arquivos versionados.

## Migrações

```bash
npx wrangler d1 migrations apply lions-portal-dados --remote
```

Migrações atuais:

- `0001_portal_private_state.sql`: estado privado e projeções relacionais;
- `0002_admin_auth.sql`: usuários, sessões e auditoria de autenticação.

## Implantação

```bash
npm run check
npm run deploy
```

A verificação local do Wrangler pode usar:

```bash
npx wrangler deploy --dry-run --config wrangler.ci.toml
```

## Autenticação

### Primeiro acesso

`POST /api/auth/bootstrap` recebe `setupKey`, `displayName`, `username` e `password`. A operação só funciona enquanto não existe Administrador.

### Login

`POST /api/session`:

```json
{
  "role": "admin",
  "username": "administrador",
  "password": "senha"
}
```

A resposta contém uma sessão opaca temporária. Somente o hash da sessão fica no D1.

### Segurança

- PBKDF2-HMAC-SHA-256 com salt individual e 150.000 iterações;
- cinco falhas consecutivas provocam bloqueio de 15 minutos;
- limite de tentativas por origem;
- sessões revogáveis e expiráveis;
- eventos em `portal_auth_audit`;
- acesso legado por token desativado por padrão.

## Publicação pública

O navegador não acessa mais a API de gravação do GitHub. Uma sessão administrativa chama:

```text
POST /api/publication
```

O Worker usa `GITHUB_TOKEN`, valida a fronteira pública e cria um único commit com:

- `data/dados.json`;
- mídias públicas alteradas;
- exclusões solicitadas;
- `release-manifest.json` recalculado.

## Rotas principais

### Públicas

- `GET /health`
- `GET /api/auth/status`
- `POST /api/auth/bootstrap`
- `POST /api/session`
- `GET /api/attachments/object` com ticket temporário

### Administrador

- `POST /api/session/logout`
- `PUT /api/auth/password`
- `GET/POST /api/auth/users`
- `PATCH /api/auth/users/:id`
- `PUT /api/auth/users/:id/password`
- `GET /api/publication/status`
- `POST /api/publication`
- `GET/PUT /api/private-state`
- rotas de backups, integridade, migração D1 e anexos

### Diretoria

- leitura do estado privado autorizado;
- consulta de backups e integridade;
- visualização e download de anexos;
- nenhuma operação de escrita.

## Health check

Antes do primeiro usuário:

```json
{
  "workerVersion": "1.5.1",
  "privateState": "d1",
  "authentication": {
    "available": true,
    "initialized": true,
    "bootstrapRequired": true,
    "passwordLogin": false,
    "publicationAvailable": true
  }
}
```

Depois do primeiro usuário, `bootstrapRequired` muda para `false` e `passwordLogin` para `true`.

## Correção v1.5.1

- Ajusta o PBKDF2 para 100.000 iterações, limite aceito pelo runtime do Worker usado na implantação.
- Mantém salt individual, contexto de domínio, derivação SHA-256 e comparação resistente a tempo.
- Não exige nova migração D1 e não altera usuários já persistidos pela versão compatível.

