# Arquitetura da Tesouraria — v6.36.0

A Tesouraria mantém **Movimentações** como centro da gestão financeira e separa regras, composição visual e eventos em módulos especializados.

## Módulos de domínio e modelo

- `domain.js`: datas, competências, moeda, status, paginação e identificação de cobranças.
- `controller.js`: navegação, filtros, seleção e serviços financeiros.
- `memberships.js`: modelo e HTML do controle de mensalidades.
- `mutuals.js`: modelo e HTML das cobranças eventuais geradas por falecimento.
- `movements.js`: histórico, pesquisa, paginação e origem dos movimentos.
- `charts.js`: renderização e ciclo de vida dos gráficos nativos.

## Módulos da visualização

- `view.js`: orquestrador enxuto da página.
- `view-shell.js`: composição estrutural e cards.
- `view-overview.js`: navegação interna, período, privacidade e contas.
- `view-memberships.js`: filtros e ações de mensalidades.
- `view-mutuals.js`: filtros, accordions e seleção de Mútuas.
- `view-charts.js`: expansão e renderização dos gráficos.

```text
portal-view-renderer.js
    ├── lazy-treasury-controller.js
    │   └── treasury/controller.js
    └── treasury/view.js
        ├── view-shell.js
        ├── view-overview.js
        ├── view-memberships.js
        ├── view-mutuals.js
        └── view-charts.js
```

A antiga fachada `modules/treasury.js` foi removida na v6.36.0 porque não fazia parte do grafo de execução. Os contratos são verificados diretamente nos módulos reais.

## Administração financeira

O gerenciamento de categorias está integrado ao fluxo de lançamento em `treasury-admin/entries.js`. O módulo antigo `treasury-admin/categories.js` foi removido por não possuir consumidores.

## Regras de manutenção

- Regras financeiras puras devem permanecer no domínio.
- O controlador não deve gerar HTML.
- `view.js` deve apenas montar o modelo e coordenar os módulos de tela.
- Estado visual transitório não deve ser persistido.
- Mensalidades e Mútuas permanecem classificadas separadamente.
- Mútuas nunca geram cobranças pela passagem do mês; apenas eventos de falecimento podem originá-las.
- Cobranças em aberto exibem a data em que foram geradas, não a data do falecimento.
- A data do falecimento permanece no cabeçalho da ocorrência e nos lançamentos de baixa.
- Ocorrências já geradas são imutáveis.
