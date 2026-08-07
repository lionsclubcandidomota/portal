# Fonte relacional e paginação operacional no D1

## Objetivo

A versão 6.43.0 muda o D1 de projeção auxiliar para fonte operacional do estado privado. O snapshot JSON permanece no banco e no R2, mas deixa de ser atualizado a cada alteração granular.

## Reconstrução do estado

`GET /api/private-state` consulta as tabelas relacionais e recompõe:

- configurações privadas;
- contas e categorias;
- grupos familiares e participantes;
- grupos de Mútuas, vínculos, eventos e participantes;
- movimentações e anexos;
- campos privados adicionais.

Os arrays dependentes são derivados das tabelas de vínculo. Dessa forma, uma inconsistência no payload agregado não duplica participantes ou anexos na leitura.

## Paginação das movimentações

`GET /api/operational/treasury` aceita:

- `start` e `end`;
- `query`;
- `filter`: `all`, `completed`, `scheduled`, `entries` ou `exits`;
- `scheduledPage`;
- `completedPage`;
- `pageSize`, limitado a 50.

A resposta contém contagens globais do recorte, resumo financeiro e as duas páginas de lançamentos.

## Snapshot de recuperação

Após uma mutação granular, `snapshot_stale` é marcado como `1`. Isso não indica perda de dados: as tabelas relacionais contêm a revisão atual. O snapshot é atualizado apenas por operações que materializam o estado completo.

## Compatibilidade

O Worker 1.9.0 lê o snapshot nos esquemas anteriores e muda automaticamente para a fonte relacional quando a migração 0006 ativa o esquema 5. O Portal mantém fallback local para a lista de movimentações.
