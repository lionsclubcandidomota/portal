# D1 granular — grupos familiares e Mútuas

## Objetivo

A versão 6.41.0 evita a reconstrução de todas as projeções do D1 quando somente grupos familiares ou grupos de Mútuas são alterados.

```text
Grupo familiar / grupo de Mútuas / evento de falecimento
        → PUT /api/private-state/groups
        → revisão otimista
        → UPSERT/DELETE somente dos grupos afetados
        → atualização dos vínculos, eventos e participantes relacionados
        → snapshot de contingência sincronizado
```

## Migração

```bash
npx wrangler d1 migrations apply lions-portal-dados --remote --config wrangler.toml
```

A migração `0004_group_granular_writes.sql`:

- ativa `groups_granular_writes`;
- eleva `schema_version` para `3`;
- adiciona índices para grupos familiares, vínculos ativos, eventos por data e participantes por evento;
- executa `PRAGMA optimize` após a criação dos índices.

## Unidade de gravação

A unidade granular é o grupo. Uma alteração em um grupo de Mútuas atualiza de forma transacional:

- a linha de `mutual_groups`;
- seus vínculos em `mutual_memberships`;
- seus eventos em `mutual_events`;
- os participantes congelados em `mutual_event_participants`.

Uma alteração em grupo familiar atualiza:

- a linha de `family_groups`;
- seus integrantes em `family_group_members`.

Movimentações e anexos não são apagados nem reinseridos durante essas operações.

## Idempotência e concorrência

- cada solicitação recebe um `mutationId` estável durante novas tentativas;
- `expectedRevision` precisa corresponder à revisão atual;
- o lote troca a revisão somente quando a revisão esperada ainda é válida;
- uma repetição do mesmo `mutationId` retorna o resultado persistido;
- o histórico permanece limitado às últimas 250 mutações;
- toda a operação é executada no mesmo `batch()` do D1.

## Escritas por operação

A quantidade de comandos SQL é fixa para uma alteração de grupos, independentemente do total histórico de movimentações ou da quantidade de outros grupos. Arrays vazios são processados sem reconstruir tabelas não relacionadas.

## Fallback

A sincronização completa continua disponível quando:

- outra coleção privada muda na mesma operação;
- um grupo ou evento possui identificador ausente ou repetido;
- a operação ultrapassa 40 grupos;
- o D1 ainda não está ativo no esquema 3.
