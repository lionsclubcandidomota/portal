# Cloudflare Worker do Portal Lions — v1.13.0

O Worker é a API do Portal. Todo dado estruturado, público ou privado, utiliza o Cloudflare D1 como fonte principal. O Cloudflare R2 guarda somente arquivos binários e cópias de recuperação.

## Arquitetura

```text
PORTAL_DB   → usuários, sessões, configurações, associados, agenda, avisos,
              grupos, movimentações, relatórios e revisões
ATTACHMENTS → fotos públicas, anexos financeiros e backups
GitHub Pages → somente HTML, CSS e JavaScript do front-end
```

## Preparação

```bash
npm ci
cp wrangler.toml.example wrangler.toml
```

Informe no `wrangler.toml` o bucket e o UUID real do D1. Preserve os bindings `ATTACHMENTS` e `PORTAL_DB`.

`PUBLIC_DATA_URL` é temporária: ela aponta para o `data/dados.json` da versão antiga e é usada uma única vez para importar o conteúdo público e suas mídias. Depois de confirmar a migração, a variável pode ser removida.

## Segredos necessários

```bash
npx wrangler secret put SESSION_SECRET
npx wrangler secret put ADMIN_BOOTSTRAP_KEY
```

- `SESSION_SECRET`: mínimo de 32 caracteres; protege sessões e tickets temporários.
- `ADMIN_BOOTSTRAP_KEY`: mínimo de 24 caracteres; permite criar o primeiro Administrador.

`GITHUB_TOKEN` não é mais utilizado pelo Portal.

## Migrações

```bash
npx wrangler d1 migrations apply lions-portal-dados --remote --config wrangler.toml
```

A migração mais recente é:

- `0010_public_portal_d1.sql`: conteúdo público relacional, histórico de publicações, mídias no R2 e esquema D1 9.

As migrações anteriores, `0001` a `0009`, preservam autenticação, dados privados, gravações granulares, consultas operacionais e revisões por módulo.

## Migração inicial do conteúdo público

Depois de publicar o Worker e aplicar `0010`, faça login administrativo enquanto a versão anterior do Portal ainda estiver no ar. O Worker detecta que o módulo público está vazio e importa automaticamente:

- associados;
- configurações públicas;
- agenda e eventos;
- reuniões;
- avisos;
- logotipo e fotos públicas para o R2.

Também é possível executar manualmente, já autenticado:

```text
POST /api/storage/migrate-public-d1
```

A importação é idempotente: depois da primeira revisão pública, novas execuções não duplicam registros.

## Rotas públicas

- `GET /health`
- `GET /api/public/state`
- `GET /api/public/media?key=public/...`
- `GET /api/auth/status`
- `POST /api/auth/bootstrap`
- `POST /api/session`
- `GET /api/attachments/object` com ticket temporário

## Rotas autenticadas principais

- `GET /api/publication/status`
- `POST /api/publication`
- `GET /api/sync/revisions`
- `GET /api/private-state/bootstrap`
- `GET/PUT /api/private-state`
- `PUT /api/private-state/treasury`
- `PUT /api/private-state/groups`
- `PUT /api/private-state/reference`
- `GET /api/operational/treasury`
- `GET /api/operational/memberships`
- `GET /api/operational/mutuals`
- `GET /api/analytics/dashboard`
- `GET /api/analytics/report`
- rotas de anexos, backups e integridade

## Sincronização

`GET /api/sync/revisions` lê somente as revisões dos módulos em uma consulta leve. O navegador verifica a cada 60 segundos apenas enquanto a sessão está ativa e a aba está visível. Os dados de um módulo só são consultados novamente quando sua revisão muda.

## Implantação

```bash
npm run check
npx wrangler deploy --config wrangler.toml
```

O `/health` deve informar:

```json
{
  "workerVersion": "1.13.0",
  "structuredDataSource": "cloudflare-d1",
  "d1": { "schemaVersion": 9, "requiredSchemaVersion": 9 },
  "publicData": { "source": "d1", "active": true, "media": "cloudflare-r2" }
}
```
