# Release 6.47.2

Data: 07/08/2026

## Objetivo

Esta revisão usa o backup público de 04/08/2026 para restaurar os aniversariantes que desapareceram após a migração da versão 6.47.0, sem substituir os dados atuais da Tesouraria.

## Componentes

- Portal 6.47.2
- Cloudflare Worker 1.13.2
- D1 esquema operacional 9
- Migração corretiva de dados `0011_recover_public_members_20260804.sql`
- R2 mantido para fotos, anexos e backups

## Conteúdo recuperado

A migração contém 32 cadastros do backup:

- 29 associados com status Ativo;
- 3 participantes com status Mútua.

Somente os campos públicos do cadastro foram incluídos: identificador, número de associado, nome, data de nascimento, foto, status e situação ativa.

## Segurança da correção

A migração usa `UPSERT` e não executa exclusão do diretório. Quando um cadastro já existe no D1:

1. os dados atuais permanecem prioritários;
2. data de nascimento e foto são preenchidas apenas quando estiverem ausentes;
3. informações adicionais atuais são preservadas;
4. registros novos são adicionados sem apagar os atuais.

A migração não altera as tabelas de movimentações, contas, categorias, grupos familiares, grupos de Mútua, mensalidades, anexos ou backups.

O Worker também bloqueia uma publicação pública vazia quando o D1 já possui associados, evitando que uma resposta ou cache incompleto apague novamente o diretório.

## Ordem de implantação

### 1. Preparar o Worker

Extraia `cloudflare-worker-v1.13.2.zip`, copie para a pasta o `wrangler.toml` já configurado e execute:

```bash
npm ci
npx wrangler d1 migrations list lions-portal-dados --remote
```

A lista deve mostrar `0011_recover_public_members_20260804.sql` como pendente.

### 2. Aplicar a recuperação no D1

```bash
npx wrangler d1 migrations apply lions-portal-dados --remote
```

Confirme a aplicação quando o Wrangler solicitar.

### 3. Conferir o banco

```bash
npx wrangler d1 execute lions-portal-dados --remote --command="SELECT COUNT(*) AS total, SUM(CASE WHEN mutual = 1 THEN 1 ELSE 0 END) AS mutuas FROM portal_members;"
```

Resultado mínimo esperado para o conjunto do backup:

- `total = 32`;
- `mutuas = 3`.

Caso o D1 já possuísse outros cadastros válidos, o total poderá ser maior que 32.

Confira que a Tesouraria permanece intacta:

```bash
npx wrangler d1 execute lions-portal-dados --remote --command="SELECT COUNT(*) AS movimentos FROM treasury_movements;"
```

Compare o total com o valor anterior à atualização.

Confira a revisão pública:

```bash
npx wrangler d1 execute lions-portal-dados --remote --command="SELECT key, value FROM portal_meta WHERE key IN ('schema_version','public_revision','public_updated_at','public_migration_complete');"
```

Resultados esperados:

- `schema_version = 9`;
- `public_revision = recovery-members-20260804-v1`;
- `public_updated_at` preenchida;
- `public_migration_complete = 1`.

### 4. Publicar o Worker

```bash
npx wrangler deploy
```

O `/health` deverá informar Worker `1.13.2` e esquema D1 `9`.

### 5. Publicar o Portal

Substitua os arquivos estáticos do GitHub Pages pelo conteúdo de `portal-site-v6.47.2.zip` e pressione `Ctrl + F5`.

## Homologação essencial

1. Verificar os aniversariantes no dashboard.
2. Abrir a página Aniversariantes e conferir 29 ativos e 3 mutuários do backup, além de eventuais cadastros mais recentes.
3. Confirmar que fotos ausentes usam avatar neutro.
4. Abrir Movimentações e conferir valores, filtros e totais anteriores.
5. Conferir Mensalidades e Mútuas.
6. Publicar uma alteração pública e verificar que o diretório não desaparece.
7. Validar sincronização automática em até 60 segundos e atualização ao retornar para a aba.

## Rollback

A migração é aditiva e preserva registros atuais. O esquema permanece na versão 9. Em caso de problema no código, o Worker 1.13.1 pode ser republicado sem desfazer a migração 0011. Não apague backups do R2 durante a homologação.
