# Cloudflare Worker do Portal Lions — v1.11.0

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
- `0002_admin_auth.sql`: usuários, sessões e auditoria de autenticação;
- `0003_treasury_granular_writes.sql`: mutações idempotentes da Tesouraria e esquema D1 2.
- `0004_group_granular_writes.sql`: grupos familiares, Mútuas e esquema D1 3.
- `0005_analytics_read_models.sql`: índices de leitura, analytics e esquema D1 4.
- `0006_relational_operational_source.sql`: fonte relacional, paginação operacional e esquema D1 5.
- `0007_operational_memberships_mutuals.sql`: diretório de associados, Mensalidades/Mútuas paginadas e esquema D1 6.
- `0008_private_bootstrap_reference.sql`: bootstrap privado reduzido, referências granulares e esquema D1 7.

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

- PBKDF2-HMAC-SHA-256 com salt individual e 100.000 iterações;
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
- `GET /api/private-state/bootstrap` para o conjunto operacional reduzido do login
- `PUT /api/private-state/treasury` para movimentações e anexos granulares
- `PUT /api/private-state/groups` para grupos familiares, Mútuas, vínculos e eventos
- `PUT /api/private-state/reference` para configurações privadas, contas e categorias
- `GET /api/analytics/dashboard` para agregações financeiras por período
- `GET /api/analytics/report` para recortes de Movimentações, Mensalidades e Mútuas
- `GET /api/operational/treasury` para paginação, pesquisa e filtros das movimentações
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
  "workerVersion": "1.7.0",
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



## Otimização v1.6.0

O endpoint `PUT /api/private-state/treasury` grava somente as movimentações e os anexos alterados. Cada solicitação usa revisão otimista e `mutationId` idempotente. O endpoint completo permanece como fallback para alterações nas demais coleções.


## Otimização v1.7.0

O endpoint `PUT /api/private-state/groups` grava somente os grupos familiares e de Mútuas alterados. Vínculos, eventos de falecimento e participantes congelados são atualizados no mesmo lote transacional. Movimentações, anexos, contas, categorias e grupos não afetados permanecem intactos.

O `/health` informa:

```json
{
  "workerVersion": "1.7.0",
  "privateAutosave": "granular-treasury-groups",
  "d1": { "schemaVersion": 3, "active": true },
  "granularWrites": {
    "treasury": true,
    "groups": true,
    "snapshotFallback": true
  }
}
```


## Otimização v1.8.0

O Worker adiciona consultas autenticadas de leitura para o Dashboard e os relatórios privados. A migração `0005_analytics_read_models.sql` cria apenas os índices necessários e ativa `analytics_read_models`.

Implantação recomendada:

```bash
npm ci
npx wrangler deploy --config wrangler.toml
npx wrangler d1 migrations apply lions-portal-dados --remote --config wrangler.toml
```

O Worker 1.8.0 mantém gravações nos esquemas 3 e 4 para permitir essa ordem sem interrupção. As rotas de analytics respondem somente depois da migração para o esquema 4.

Health esperado:

```json
{
  "workerVersion": "1.8.0",
  "privateAutosave": "granular-treasury-groups",
  "d1": { "schemaVersion": 4, "active": true },
  "granularWrites": {
    "treasury": true,
    "groups": true,
    "snapshotFallback": true
  },
  "optimizedReads": {
    "dashboard": true,
    "reports": true
  }
}
```


## Otimização v1.9.0

A migração `0006_relational_operational_source.sql` promove as tabelas relacionais a fonte oficial do estado privado. O endpoint `GET /api/private-state` reconstrói as coleções a partir dos relacionamentos do D1 e deixa o snapshot somente para recuperação.

A rota autenticada `GET /api/operational/treasury` recebe período, busca, filtro e páginas independentes para programados e realizados. Ela retorna apenas os registros das páginas, contagens e somatórias.

Gravações granulares não atualizam mais o snapshot nem o espelho JSON no R2. Elas marcam `snapshot_stale = 1`; backups, restaurações, sincronizações completas e rollback materializam o estado atual quando necessário.

Ordem de implantação:

```bash
npm ci
npx wrangler deploy --config wrangler.toml
npx wrangler d1 migrations apply lions-portal-dados --remote --config wrangler.toml
```

Health esperado:

```json
{
  "workerVersion": "1.9.0",
  "privateAutosave": "relational-operational",
  "d1": { "schemaVersion": 5, "active": true },
  "relationalSource": true,
  "snapshotPolicy": "recovery-only",
  "optimizedReads": {
    "dashboard": true,
    "reports": true,
    "treasuryPagination": true
  }
}
```


## Otimização v1.10.0

A migração `0007_operational_memberships_mutuals.sql` cria o diretório relacional `portal_members`, eleva o esquema para 6 e habilita consultas operacionais paginadas para Mensalidades e Mútuas.

Novas rotas autenticadas:

```text
GET  /api/operational/memberships
GET  /api/operational/mutuals
POST /api/operational/member-directory/sync
```

O diretório de associados é atualizado depois de publicações públicas e, como contingência, pelo `PUBLIC_DATA_URL` quando estiver vazio ou com mais de 24 horas.

Ordem de implantação:

```bash
npm ci
npx wrangler deploy --config wrangler.toml
npx wrangler d1 migrations apply lions-portal-dados --remote --config wrangler.toml
```

Health esperado:

```json
{
  "workerVersion": "1.10.0",
  "privateState": "d1",
  "d1": { "schemaVersion": 6, "requiredSchemaVersion": 6, "active": true },
  "optimizedReads": {
    "dashboard": true,
    "reports": true,
    "treasuryPagination": true,
    "memberships": true,
    "mutuals": true
  },
  "memberDirectory": { "available": true, "updatedAt": "..." }
}
```


## Otimização v1.11.0

O login usa `GET /api/private-state/bootstrap`, que retorna as referências privadas, grupos e somente pagamentos de Mensalidades/Mútuas necessários aos formulários. Movimentações ordinárias são carregadas pelas rotas paginadas.

A rota `PUT /api/private-state/reference` atualiza configurações, contas e categorias em lote transacional, com revisão otimista e idempotência, sem reconstruir movimentações ou grupos.
