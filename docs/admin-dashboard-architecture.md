# Arquitetura do Dashboard Administrativo — v6.6.0

O dashboard administrativo foi separado em três responsabilidades:

```text
assets/js/modules/
├── admin-panel.js
└── admin-dashboard/
    ├── domain.js
    └── view.js
```

## `domain.js`

Contém regras puras e testáveis:

- Limites e rótulos de períodos.
- Filtro inclusivo por data.
- Classificação dos status da Agenda.
- Classificação dos status de Compromissos.
- Agrupamento e ordenação dos status.
- Resumo de entradas, saídas e saldo.
- Montagem do modelo gerencial usado pela interface.

## `view.js`

Gera a apresentação do login e do dashboard a partir do modelo pronto. Não consulta armazenamento nem altera estado.

## `admin-panel.js`

Permanece responsável somente por:

- Ler e gravar a preferência de período.
- Ligar eventos dos controles.
- Acionar login, formulários, navegação, backup e privacidade financeira.
- Selecionar entre a tela de login e o painel administrativo.

A separação corrigiu também a opção duplicada “Ano atual” que existia no filtro de período.
