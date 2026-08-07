# Esquema de dados do Portal — v10

O esquema v10 altera a regra das Mútuas: grupos não geram cobranças mensais. Uma cobrança existe somente quando o Administrador registra o falecimento de um associado do Distrito.

```json
{
  "schemaVersion": 10,
  "version": 10,
  "data": {
    "mutualGroups": [
      {
        "id": "mu_exemplo",
        "name": "Mútua 658",
        "notes": "",
        "memberships": [
          {
            "id": "mum_exemplo",
            "memberId": "b_participante",
            "joinedMonth": "2026-08",
            "endedMonth": ""
          }
        ],
        "events": [
          {
            "id": "mue_exemplo",
            "deceasedName": "Associado do Distrito",
            "occurrenceDate": "2026-08-15",
            "amount": 15,
            "participantIds": ["b_participante"],
            "notes": "Comunicado do Distrito",
            "createdAt": "2026-08-16T12:00:00.000Z"
          }
        ]
      }
    ]
  }
}
```

## Regras das Mútuas

- `memberships` mantém o histórico de participação no grupo.
- A ausência de itens em `events` significa que não existem cobranças abertas, independentemente da quantidade de meses transcorridos.
- Cada item de `events` representa um falecimento e guarda uma lista imutável de `participantIds`.
- `amount` é o valor individual devido por cada participante daquela ocorrência.
- Alterar o grupo não modifica eventos já registrados.
- Uma baixa financeira usa `mutualGroupId`, `mutualEventId`, `mutualMemberId` e uma chave `grupo::evento::participante`.
- Movimentações antigas da categoria Mútua continuam preservadas no histórico financeiro.

## Migração v9 → v10

- `monthlyAmount`, `startedMonth` e `amountHistory` deixam de fazer parte do grupo normalizado.
- Os participantes existentes são preservados em `memberships`.
- Nenhum evento é criado automaticamente a partir dos meses anteriores.
- Cobranças mensais que ainda não tinham baixa deixam de existir.
- Entradas e saídas já registradas na Tesouraria não são apagadas nem recalculadas.

Os anexos financeiros e as situações `Ativo`, `Mútua` e `Inativo` permanecem conforme o esquema v9.

- `createdDate` registra a data local em que a cobrança foi gerada; `createdAt` mantém o instante técnico completo.
