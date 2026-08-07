# Homologação — Portal 6.47.2 / Worker 1.13.2

## Antes da atualização

1. Preserve o `wrangler.toml` configurado com `PORTAL_DB` e `ATTACHMENTS`.
2. Não apague backups do R2.
3. Anote a quantidade atual de movimentações da Tesouraria.
4. Confirme que o D1 está no esquema 9.

## Migração corretiva

1. Execute `npm ci` na pasta do Worker.
2. Liste as migrações remotas.
3. Confirme que `0011_recover_public_members_20260804.sql` está pendente.
4. Aplique as migrações remotas.
5. Consulte `portal_members` e confirme pelo menos 32 cadastros e 3 registros com `mutual = 1`.
6. Consulte `treasury_movements` e confirme que a quantidade anterior foi preservada.
7. Confirme `schema_version = 9` e `public_migration_complete = 1`.

## Publicação do Worker

1. Publique com `npx wrangler deploy`.
2. Verifique `/health` com Worker 1.13.2 e esquema 9.
3. Abra `/api/public/state` e confirme que `data.birthdays` possui registros.
4. Verifique que fotos ausentes usam o endpoint de mídia e não geram erro 404.

## Publicação do Portal

1. Publique somente o conteúdo de `portal-site-v6.47.2.zip`.
2. Confirme que o pacote não contém `data/dados.json`, `public/members` ou `public/treasury`.
3. Pressione `Ctrl + F5`.
4. Abra o Portal em janela anônima e valide dashboard, aniversariantes, agenda e avisos.
5. Faça login como Administrador e teste Movimentações, Mensalidades, Mútuas, relatórios e anexos.

## Proteção contra regressão

1. Com o diretório preenchido, tente publicar um estado público sem aniversariantes em homologação.
2. Confirme que o Worker bloqueia a operação em vez de executar `DELETE FROM portal_members`.
3. Publique uma alteração pública normal e confirme que aniversariantes continuam disponíveis.
4. Confirme que registros com status Mútua possuem `mutual = 1` no D1.

## Sincronização automática

1. Abra duas sessões do Portal.
2. Altere e publique um dado público em uma sessão.
3. Confirme a atualização da outra sessão em até 60 segundos.
4. Oculte uma aba por mais de um minuto e confirme que não há consultas periódicas enquanto estiver oculta.
5. Retorne à aba e confirme atualização imediata.
6. Simule perda de conexão e confirme o backoff progressivo.
