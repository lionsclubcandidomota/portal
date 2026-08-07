# Cloudflare R2 — configuração para o Portal 6.47.0

O R2 guarda arquivos binários. Os dados estruturados e as referências ficam no D1.

## Conteúdo do bucket

```text
public/                    mídias públicas dinâmicas
public/members/            fotos de associados
public/logo.png            logo administrável

treasury/                  anexos privados da Tesouraria
__portal/backups/          backups e pontos de recuperação
```

O bucket pode permanecer sem acesso público e sem domínio `r2.dev`. O Worker utiliza o binding `ATTACHMENTS`.

## Configuração

No `wrangler.toml`:

```toml
[[r2_buckets]]
binding = "ATTACHMENTS"
bucket_name = "lions-portal-documentos"
```

Configure também `ALLOWED_ORIGINS`, o binding D1 `PORTAL_DB` e os segredos:

```bash
npx wrangler secret put SESSION_SECRET
npx wrangler secret put ADMIN_BOOTSTRAP_KEY
```

Nenhuma Access Key do R2 é colocada no navegador ou no repositório.

## Publicação

```bash
npm ci
npx wrangler deploy --config wrangler.toml
```

O `/health` deve informar `storage: "cloudflare-r2+d1"`.

## Migração pública inicial

Enquanto a versão 6.46.0 ainda estiver publicada, `PUBLIC_DATA_URL` aponta temporariamente para o antigo JSON. O Worker importa logo e fotos para `public/...` no R2. Depois da homologação, essa variável pode ser removida.

## Acesso

- mídias públicas: `/api/public/media?key=public/...`, com cache e ETag;
- anexos privados: tickets temporários emitidos após autenticação;
- backups: rotas administrativas da Central de Recuperação.
