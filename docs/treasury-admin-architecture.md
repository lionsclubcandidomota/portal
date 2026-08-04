# Arquitetura Administrativa da Tesouraria — v6.15.0

A fachada `assets/js/modules/treasury-admin.js` compõe os fluxos administrativos e mantém o acesso centralizado usado por `portal-app.js` e pela visualização da Tesouraria.

## Módulos

- `treasury-admin/context.js`: valida e organiza as dependências compartilhadas.
- `treasury-admin/domain.js`: cálculos e validações puras de mensalidades, cobranças e lançamentos.
- `treasury-admin/member-selector.js`: componente reutilizável de seleção de associados.
- `treasury-admin/family-groups.js`: cadastro e manutenção de grupos familiares.
- `treasury-admin/membership-payments.js`: baixa de mensalidades individuais e familiares.
- `treasury-admin/mutual-groups.js`: cadastro dos grupos mensais, valor, participantes e histórico de vigência.
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
openMutualPayment
openTreasuryAccountsManager
shareMembershipCharge
treasuryEntryFormHtml
openTreasuryEntryForm
```

## Garantias do fluxo de mútuas

- O grupo possui um único valor mensal, cobrado integralmente de cada participante.
- A seleção utiliza checkboxes vinculados a rótulos, leitura por `FormData` e atualização imediata do contador.
- Adicionar ou remover participantes não apaga períodos anteriores.
- A saída é efetiva para as competências posteriores ao mês registrado.
- Alterações de valor criam um item em `amountHistory` e não reescrevem pagamentos existentes.
- A baixa exige grupo e competência únicos, conta ativa e data manual.
- Cada associado selecionado gera uma movimentação financeira própria.
- A confirmação apresenta grupo, competência, associados, quantidade, total e data antes da gravação.
- A chave mensal impede duplicidade de pagamento.

## Regras de manutenção

- Regras sem acesso ao DOM devem ficar em módulos de domínio e possuir testes automatizados.
- Cada gerenciador deve cuidar de apenas um cadastro ou fluxo administrativo.
- A fachada não deve gerar HTML nem alterar o estado diretamente.
- Novos formulários devem receber dependências pelo contexto em vez de importar controladores globais.
- Cobranças automáticas devem permanecer vinculadas ao histórico financeiro por identificadores estáveis.
