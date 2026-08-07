# Migração integral do Portal para Cloudflare D1 — v6.47.0

## Estado final

O D1 passa a ser a fonte única de dados estruturados públicos e privados. O R2 mantém arquivos binários e backups. A hospedagem estática mantém somente a interface.

## Requisitos existentes

- banco D1 `lions-portal-dados` no binding `PORTAL_DB`;
- bucket R2 no binding `ATTACHMENTS`;
- `SESSION_SECRET`;
- `ADMIN_BOOTSTRAP_KEY`;
- Worker anterior funcionando com esquema D1 8.

## Implantação segura

1. Mantenha o Portal 6.46.0 publicado. O antigo `data/dados.json` e as fotos ainda precisam estar acessíveis durante a importação.
2. Extraia o Worker 1.13.0 e copie o `wrangler.toml` configurado da versão anterior.
3. Defina temporariamente:

   ```toml
   PUBLIC_DATA_URL = "https://lionsclubcandidomota.github.io/portal/data/dados.json"
   ```

4. Publique o Worker:

   ```bash
   npm ci
   npx wrangler deploy --config wrangler.toml
   ```

5. Aplique as migrações:

   ```bash
   npx wrangler d1 migrations apply lions-portal-dados --remote --config wrangler.toml
   ```

6. Confirme `0010_public_portal_d1.sql`.
7. Faça logout e login como Administrador. O primeiro login importa automaticamente o JSON e as mídias da versão 6.46.0.
8. Abra `/health` e confira esquema 9, fonte `cloudflare-d1` e as contagens esperadas.
9. Só então publique o Portal 6.47.0.
10. Homologue páginas públicas, fotos, agenda, avisos e administração.
11. Após o período de segurança, remova `PUBLIC_DATA_URL` e o segredo antigo `GITHUB_TOKEN`, caso ainda existam.

## Resultado esperado no health

```json
{
  "workerVersion": "1.13.0",
  "d1": {
    "active": true,
    "schemaVersion": 9,
    "requiredSchemaVersion": 9
  },
  "publicData": {
    "source": "d1",
    "active": true,
    "media": "cloudflare-r2"
  },
  "structuredDataSource": "cloudflare-d1",
  "automaticSync": {
    "intervalSeconds": 60,
    "lightweightRevisionCheck": true
  },
  "snapshotPolicy": "recovery-only"
}
```

Para o conjunto atual, as contagens públicas esperadas são 32 associados, 12 eventos, 3 reuniões e 2 avisos.

## Rollback de implantação

Antes de publicar o Portal 6.47.0, basta manter a versão 6.46.0 no ar enquanto se corrige o Worker. Depois da publicação estática, um rollback visual pode restaurar o pacote 6.46.0; os dados já migrados permanecem no D1 e não são apagados.

Backups privados continuam no R2. O snapshot não participa das operações diárias e é materializado somente para recuperação, importação, exportação ou retorno emergencial.
