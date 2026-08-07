# D1 granular — movimentações e anexos

## Objetivo

A versão 6.40.0 deixa de reconstruir todas as projeções do D1 quando somente a Tesouraria mudou.

```text
Nova movimentação / edição / exclusão
        → PUT /api/private-state/treasury
        → revisão otimista
        → UPSERT/DELETE somente das linhas afetadas
        → atualização dos anexos da movimentação
        → snapshot de contingência sincronizado
```

## Migração

```bash
npx wrangler d1 migrations apply lions-portal-dados --remote
```

A migração `0003_treasury_granular_writes.sql` cria `portal_mutations`, ativa `treasury_granular_writes` e eleva `schema_version` para `2`.

## Idempotência e concorrência

- cada solicitação recebe `mutationId` estável durante novas tentativas;
- `expectedRevision` precisa corresponder à revisão atual;
- o primeiro comando do lote troca a revisão apenas quando a revisão esperada ainda é válida;
- todos os demais comandos são condicionados à nova revisão;
- uma repetição do mesmo `mutationId` recebe o resultado já persistido;
- o histórico é limitado às últimas 250 mutações.

## Escritas por operação

Uma edição comum utiliza um lote fixo de nove comandos SQL, independentemente da quantidade total de movimentações. A versão anterior apagava e reinseria todas as projeções privadas.

## Fallback

A sincronização completa continua disponível quando contas, categorias, configurações ou múltiplos domínios privados mudam na mesma operação, quando existem identificadores inválidos/repetidos ou quando a operação supera 60 registros. Grupos familiares e Mútuas possuem rota granular própria a partir da versão 6.41.0.
