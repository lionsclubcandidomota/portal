# Atualização corretiva do Worker 1.13.2

## Finalidade

Esta versão restaura os aniversariantes usando o backup público de 04/08/2026 e protege o diretório contra publicações vazias acidentais. A Tesouraria não é importada nem substituída.

## Publicação

Preserve o `wrangler.toml` usado na versão anterior e execute:

```bash
npm ci
npx wrangler d1 migrations list lions-portal-dados --remote
npx wrangler d1 migrations apply lions-portal-dados --remote
npx wrangler deploy
```

A migração pendente deve ser:

```text
0011_recover_public_members_20260804.sql
```

Ela é uma migração de dados; o esquema esperado continua sendo 9.

## O que a migração faz

- restaura 32 cadastros públicos do backup;
- usa `UPSERT`, sem `DELETE FROM portal_members`;
- preserva dados mais recentes já existentes;
- preenche nascimento e foto somente quando ausentes;
- identifica os 3 registros com status Mútua no indicador relacional;
- atualiza a revisão pública para forçar a recarga do Portal;
- não toca em movimentações, contas, categorias, grupos, mensalidades, anexos ou backups.

## Conferência

```bash
npx wrangler d1 execute lions-portal-dados --remote --command="SELECT COUNT(*) AS total, SUM(CASE WHEN mutual = 1 THEN 1 ELSE 0 END) AS mutuas FROM portal_members;"
```

O conjunto do backup possui 32 cadastros, sendo 3 de Mútua. O total pode ser maior quando existirem cadastros mais recentes no D1.

```bash
npx wrangler d1 execute lions-portal-dados --remote --command="SELECT key, value FROM portal_meta WHERE key IN ('schema_version','public_revision','public_updated_at','public_migration_complete');"
```

O esquema deve continuar em `9`, a revisão deve ser `recovery-members-20260804-v1` e `public_migration_complete` deve ser `1`.
