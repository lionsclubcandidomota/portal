# Release 6.40.0

Esta etapa inicia a otimização operacional do D1 com **CRUD granular de movimentações e anexos**.

## Componentes

- Portal 6.40.0: detecta alterações exclusivas da Tesouraria e usa o endpoint granular.
- Worker 1.6.0: aplica mutações idempotentes e protegidas por revisão.
- Migração D1 `0003_treasury_granular_writes.sql`: histórico de mutações e ativação do esquema 2.
- R2: continua armazenando anexos e o espelho de contingência.

## Ordem de implantação

1. Atualizar o Worker para 1.6.0, preservando `wrangler.toml` e os segredos.
2. Executar `npx wrangler d1 migrations apply lions-portal-dados --remote`.
3. Confirmar a aplicação de `0003_treasury_granular_writes.sql`.
4. Publicar o Worker com `npx wrangler deploy --config wrangler.toml`.
5. Confirmar `/health` com `workerVersion: 1.6.0`, esquema D1 2 e `privateAutosave: granular-treasury`.
6. Publicar o Portal 6.40.0 no GitHub Pages.
7. Criar, editar e excluir uma movimentação de teste e confirmar **Banco sincronizado**.
8. Recarregar a página, conferir o registro e testar visualização/baixa de anexos.

## Comportamento de fallback

O Portal usa a gravação completa quando a alteração inclui contas, categorias, grupos familiares, Mútuas, configurações privadas ou mais de 60 registros. Isso mantém compatibilidade durante a migração progressiva dos demais módulos.

## Segurança

Cada mutação possui um identificador idempotente, revisão esperada e nova revisão. Uma tentativa repetida retorna o resultado original; uma sessão desatualizada recebe conflito e não sobrescreve os dados atuais.
