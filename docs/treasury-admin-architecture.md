# Arquitetura Administrativa da Tesouraria — v6.35.0

A fachada `assets/js/modules/treasury-admin.js` compõe os fluxos administrativos e mantém o acesso centralizado usado por `portal-app.js` e pela visualização da Tesouraria.

## Módulos

- `treasury-admin/context.js`: valida e organiza as dependências compartilhadas.
- `treasury-admin/domain.js`: cálculos e validações puras de mensalidades, cobranças e lançamentos.
- `treasury-admin/member-selector.js`: componente reutilizável de seleção de associados.
- `treasury-admin/family-groups.js`: cadastro e manutenção de grupos familiares.
- `treasury-admin/membership-payments.js`: baixa de mensalidades individuais e familiares.
- `treasury-admin/mutual-groups.js`: cadastro de grupos ativos, participantes e encerramento opcional com motivo.
- `treasury-admin/mutual-events.js`: registro de falecimentos e geração única das cobranças para os participantes do evento.
- `treasury-admin/mutual-payments.js`: baixa individual ou em lote por competência e geração dos movimentos de conta.
- `treasury-admin/sharing.js`: compartilhamento e cópia de mensagens de cobrança de mensalidades.
- `treasury-admin/accounts.js`: cadastro, ativação e exclusão de contas.
- `treasury-admin/entries.js`: formulário de movimentações gerais e gerenciamento contextual de categorias.
- `treasury-admin.js`: fachada que compõe os módulos e preserva a API pública.

## Dependências

```text
portal-app.js
    └── treasury-admin.js (fachada)
        ├── context.js
        ├── member-selector.js
        ├── family-groups.js
        ├── membership-payments.js
        │   └── domain.js
        ├── mutual-groups.js
        ├── mutual-events.js
        ├── mutual-payments.js
        ├── sharing.js
        │   └── domain.js
        ├── accounts.js
        └── entries.js
            └── domain.js
```

## Contrato público

```js
memberSelectorCard
openFamilyGroupsManager
openMembershipPayment
openMutualGroupsManager
openMutualEvent
openMutualPayment
openTreasuryAccountsManager
shareMembershipCharge
treasuryEntryFormHtml
openTreasuryEntryForm
```

## Garantias do fluxo de mútuas

- Criar ou editar um grupo não gera cobrança.
- O grupo nasce ativo e sem data de baixa.
- A baixa do grupo exige simultaneamente data e motivo.
- Um evento de falecimento é o único gatilho para gerar cobranças.
- Cada evento possui data, associado falecido, valor por participante e vencimento opcional.
- A lista de participantes é congelada no momento do evento.
- Entradas ou saídas posteriores no grupo não alteram eventos anteriores.
- Cada participante selecionado gera uma movimentação financeira própria na baixa.
- A chave `grupo::evento::participante` impede pagamentos duplicados.
- Não existe competência mensal, histórico de valor mensal ou recorrência automática.

## Regras de manutenção

- Regras sem acesso ao DOM devem ficar em módulos de domínio e possuir testes automatizados.
- Cada gerenciador deve cuidar de apenas um cadastro ou fluxo administrativo.
- A fachada não deve gerar HTML nem alterar o estado diretamente.
- Novos formulários devem receber dependências pelo contexto em vez de importar controladores globais.
- Cobranças automáticas devem permanecer vinculadas ao histórico financeiro por identificadores estáveis.
