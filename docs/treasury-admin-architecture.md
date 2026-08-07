# Arquitetura Administrativa da Tesouraria — v6.27.2

A fachada `assets/js/modules/treasury-admin.js` compõe os fluxos administrativos e mantém o acesso centralizado usado por `portal-app.js` e pela visualização da Tesouraria.

## Módulos

- `treasury-admin/context.js`: valida e organiza as dependências compartilhadas.
- `treasury-admin/domain.js`: cálculos e validações puras de mensalidades, cobranças e lançamentos.
- `treasury-admin/member-selector.js`: componente reutilizável de seleção de associados.
- `treasury-admin/family-groups.js`: cadastro e manutenção de grupos familiares.
- `treasury-admin/membership-payments.js`: baixa de mensalidades individuais e familiares.
- `treasury-admin/mutual-groups.js`: cadastro dos grupos e manutenção dos participantes, sem valor ou cobrança mensal.
- `treasury-admin/mutual-events.js`: registro do falecimento, valor individual e fotografia dos participantes incluídos.
- `treasury-admin/mutual-payments.js`: baixa individual ou em lote por ocorrência e geração dos movimentos de conta.
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
openMutualEventManager
openMutualPayment
openTreasuryAccountsManager
shareMembershipCharge
treasuryEntryFormHtml
openTreasuryEntryForm
```

## Garantias do fluxo de mútuas

- O grupo mantém participantes, mas não possui valor mensal nem cria cobranças recorrentes.
- O Administrador registra uma ocorrência somente após o falecimento de um associado do Distrito.
- A ocorrência exige nome, data, valor por participante e ao menos um participante ativo.
- A lista de participantes é copiada para o evento e não muda após alterações futuras no grupo.
- Cada ocorrência gera no máximo uma cobrança por participante.
- A baixa exige conta ativa e data manual e cria uma movimentação financeira individual.
- A chave `grupo::evento::participante` impede duplicidade de pagamento.
- Uma ocorrência com pagamentos não pode ser excluída.

## Regras de manutenção

- Regras sem acesso ao DOM devem ficar em módulos de domínio e possuir testes automatizados.
- Cada gerenciador deve cuidar de apenas um cadastro ou fluxo administrativo.
- A fachada não deve gerar HTML nem alterar o estado diretamente.
- Novos formulários devem receber dependências pelo contexto em vez de importar controladores globais.
- Cobranças eventuais devem permanecer vinculadas ao histórico financeiro por identificadores estáveis.


## Imutabilidade das ocorrências

- Uma ocorrência gerada é definitiva e não pode ser editada nem excluída.
- A lista `participantIds` registra os mutuários existentes no momento da geração.
- Mudanças no grupo são permitidas somente para cobranças futuras e não alteram ocorrências anteriores.
