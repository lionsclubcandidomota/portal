# Esquema de dados do Portal — v12

O esquema v12 preserva usuários, cargos e permissões do esquema v11 e acrescenta o histórico de cargos por Ano Leonístico.

```json
{
  "schemaVersion": 12,
  "version": 12,
  "data": {
    "accessRoles": [
      {
        "id": "role-treasurer",
        "name": "Tesoureiro",
        "active": true,
        "permissions": ["view-treasury", "manage-treasury"]
      }
    ],
    "portalUsers": [
      {
        "id": "usr_exemplo",
        "memberId": "b_associado",
        "username": "associado.exemplo",
        "roleId": "role-treasurer",
        "active": true,
        "passwordVersion": 1,
        "passwordSalt": "32 caracteres hexadecimais",
        "passwordHash": "64 caracteres hexadecimais",
        "passwordIterations": 210000
      }
    ],
    "leadershipAssignments": [
      {
        "id": "leadership_exemplo",
        "memberId": "b_associado",
        "roleId": "role-treasurer",
        "lionYear": "2026/2027",
        "startsOn": "2026-07-01",
        "endsOn": "2027-06-30",
        "active": true,
        "notes": "Eleito para o período."
      }
    ]
  }
}
```

## Regras

- `accessRoles` define cargos e permissões.
- `portalUsers` define credenciais individuais vinculadas a associados ativos.
- `leadershipAssignments` preserva o histórico de cargos.
- `lionYear` usa o formato `AAAA/AAAA`, com anos consecutivos.
- `startsOn` e `endsOn` devem estar dentro do Ano Leonístico informado.
- O cargo efetivo é calculado pela data atual; `portalUsers[].roleId` permanece como compatibilidade, mas não reativa um cargo vencido quando existe histórico.
- Cargos inativos, usuários inativos e designações desativadas não concedem acesso.
- A senha em texto nunca integra o estado.

## Migração v11 → v12

- cria `leadershipAssignments`;
- converte o cargo atual de cada usuário existente em uma designação do Ano Leonístico vigente;
- mantém `roleId` no usuário para compatibilidade;
- não altera os demais módulos operacionais;
- pode ser executada novamente sem duplicar registros.

## Mútuas preservadas

A cobrança continua sendo criada somente por ocorrência de falecimento. Não existe cobrança mensal automática de Mútua.

## Projeção pública de Dirigentes

A tela pública não cria uma coleção nova. Ela cruza `leadershipAssignments`, `accessRoles` e `birthdays` em tempo de execução. Somente designações vigentes do Ano Leonístico atual são exibidas. `portalUsers`, hashes de senha, permissões, números de associado e observações internas não fazem parte da projeção pública.
