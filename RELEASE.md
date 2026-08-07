# Release 6.41.0

Esta etapa amplia a otimização operacional do D1 com **gravações granulares de grupos familiares, grupos de Mútuas, participantes e eventos de falecimento**.

## Componentes

- Portal 6.41.0: detecta alterações exclusivas em grupos familiares e Mútuas e usa o novo endpoint granular.
- Worker 1.7.0: atualiza somente os grupos e vínculos afetados, com revisão otimista e idempotência.
- Migração D1 `0004_group_granular_writes.sql`: índices específicos, ativação de `groups_granular_writes` e esquema D1 3.
- R2: continua armazenando anexos e o espelho de contingência.

## Ordem de implantação

1. Atualizar o Worker para 1.7.0, preservando `wrangler.toml` e os segredos.
2. Executar `npx wrangler d1 migrations apply lions-portal-dados --remote --config wrangler.toml`.
3. Confirmar a aplicação de `0004_group_granular_writes.sql`.
4. Publicar o Worker com `npx wrangler deploy --config wrangler.toml`.
5. Confirmar `/health` com `workerVersion: 1.7.0`, esquema D1 3, `privateAutosave: granular-treasury-groups` e `granularWrites.groups: true`.
6. Publicar o Portal 6.41.0 no GitHub Pages.
7. Criar e editar um grupo familiar e confirmar **Banco sincronizado** sem publicação pública pendente.
8. Criar ou editar um grupo de Mútuas, registrar um falecimento e confirmar persistência após recarregar a página.
9. Confirmar que movimentações e anexos continuam usando o endpoint granular da Tesouraria.

## Operações granulares desta etapa

- criação, edição e exclusão de grupos familiares;
- atualização dos participantes e titular de um grupo familiar;
- criação, edição, baixa e exclusão permitida de grupos de Mútuas;
- inclusão e encerramento de vínculos de mutuários;
- criação de eventos de falecimento;
- congelamento dos participantes vinculados ao evento.

Cada grupo alterado é persistido como uma unidade transacional. As tabelas de movimentações, contas, categorias e demais grupos não são reconstruídas.

## Comportamento de fallback

O Portal mantém a sincronização completa quando a mesma operação altera simultaneamente grupos e outras coleções privadas, quando existem identificadores inválidos/repetidos ou quando a alteração ultrapassa 40 grupos. Esse fallback preserva a compatibilidade durante a migração progressiva.

## Segurança

Cada mutação possui `mutationId`, revisão esperada e nova revisão. Uma repetição retorna o resultado original, enquanto uma sessão desatualizada recebe conflito e não sobrescreve dados mais recentes. O snapshot no D1 e o espelho no R2 continuam atualizados como contingência.
