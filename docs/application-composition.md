# Composição da aplicação — v6.34.1

## Raiz de composição

`assets/js/modules/portal-app.js` coordena estado, runtime, serviços centrais e a ordem de inicialização. Ele não monta mais diretamente os controladores de cada domínio e não contém implementação de páginas.

## Inicializadores de funcionalidades

A pasta `assets/js/modules/portal-composition` contém os contratos de composição:

- `treasury-feature.js`: controlador financeiro e fachada administrativa da Tesouraria;
- `administration-feature.js`: cadastros, painel administrativo, relatórios, configurações e aniversários;
- `publication-feature.js`: revisão, central de publicação e atualização global;
- `navigation-feature.js`: navegação, shell de interface e proteção de somente leitura;
- `view-dependencies.js`: montagem das dependências entregues ao renderizador das páginas.

Os inicializadores recebem serviços e callbacks explicitamente. Eles não mantêm uma segunda cópia do estado global.

## Renderização

`assets/js/modules/portal-view-renderer.js` coordena Dashboard, Aniversariantes, Tesouraria, Agenda, Avisos, Dashboard administrativo e Configurações. Cada página continua usando seu módulo de domínio e view existente.

## Cadastros

`assets/js/modules/entity-forms.js` controla abertura, submissão, persistência e exclusão. `assets/js/modules/entity-forms/templates.js` contém os templates e a normalização dos formulários.

## Portões arquiteturais

- `portal-app.js` deve permanecer abaixo de 340 linhas;
- cada arquivo em `portal-composition` deve permanecer abaixo de 140 linhas;
- todos os inicializadores precisam exportar seus contratos esperados;
- `entity-forms.js` deve permanecer abaixo de 380 linhas;
- o compositor visual e os templates precisam exportar seus contratos esperados;
- a pasta `assets/css/legacy` não pode ser recriada.
