# Arquitetura da Tesouraria — v6.35.0

A Tesouraria mantém **Movimentações** como centro da gestão financeira e separa regras, composição visual e eventos em módulos especializados.

## Módulos de domínio e modelo

- `domain.js`: datas, competências, moeda, status, paginação e identificação de cobranças.
- `controller.js`: navegação, filtros, seleção e serviços financeiros.
- `memberships.js`: modelo e HTML do controle de mensalidades.
- `mutuals.js`: modelo e HTML das cobranças de mútuas geradas por eventos de falecimento.
- `movements.js`: histórico, pesquisa, paginação e origem dos movimentos.
- `charts.js`: renderização e ciclo de vida dos gráficos nativos.

## Módulos da visualização

- `view.js`: orquestrador enxuto da página.
- `view-shell.js`: composição estrutural e cards.
- `view-overview.js`: navegação interna, período, privacidade e contas.
- `view-memberships.js`: filtros e ações de mensalidades.
- `view-mutuals.js`: filtros, accordions e seleção de mútuas.
- `view-charts.js`: expansão e renderização dos gráficos.

```text
portal-app.js
    └── treasury.js
        ├── controller.js
        ├── view.js
        │   ├── view-shell.js
        │   ├── view-overview.js
        │   ├── view-memberships.js
        │   ├── view-mutuals.js
        │   └── view-charts.js
        ├── memberships.js
        ├── mutuals.js
        ├── movements.js
        └── charts.js
```

## Regras de manutenção

- Regras financeiras puras devem permanecer no domínio.
- O controlador não deve gerar HTML.
- `view.js` deve apenas montar o modelo e coordenar os módulos de tela.
- Estado visual transitório não deve ser persistido no banco.
- Mensalidades e mútuas devem permanecer classificadas separadamente; somente as Mensalidades possuem recorrência por competência.

## Contrato público

A fachada continua exportando:

```js
createTreasuryController
renderTreasury
destroyTreasuryCharts
```
