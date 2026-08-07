# Registro técnico — 6.28.0

## Resumo dinâmico da Tesouraria

`treasury/movements.js` agora expõe `summarizeMovementFilter()`. A função usa a lista já filtrada para calcular entradas, saídas, resultado e quantidade. No filtro geral, o saldo mantém a regra histórica de considerar somente realizados; em Programados, os valores previstos são calculados exclusivamente a partir dos lançamentos programados.

## Agenda responsiva do Dashboard

O item de compromisso deixou de usar um `small` contendo blocos internos e passou a ter estrutura semântica própria: ícone, conteúdo, detalhes e tipo. A grade usa áreas nomeadas e muda para duas linhas em telas estreitas, evitando sobreposição de título, local, link e badge.

## Clean UI

A camada `components/clean-ui.css` é carregada ao final do bundle e consolida o redesign sem remover seletores ou fluxos legados. Ela redefine tokens, shell, cards, formulários, tabelas, dashboard, tesouraria, agenda, administração, modais e breakpoints.

## Compatibilidade

- Esquema de dados permanece 10.
- Não há migração de conteúdo.
- Regras de Mútuas da série 6.27.x permanecem inalteradas.
