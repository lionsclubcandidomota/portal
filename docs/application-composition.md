# Composição da aplicação — v6.36.0

## Bootstrap

`assets/js/modules/portal-app.js` monta serviços, controladores e dependências de alto nível. O arquivo não contém a implementação completa das páginas.

## Renderização de páginas

`assets/js/modules/portal-view-renderer.js` coordena:

- Início;
- Aniversariantes;
- Tesouraria;
- Agenda;
- Avisos;
- Área administrativa;
- Ajustes.

Cada página continua usando seu módulo de domínio e view. O controlador completo da Tesouraria é fornecido por `lazy-treasury-controller.js` apenas quando necessário; o Dashboard usa um resumo financeiro leve e independente.

## Renderização incremental

`assets/js/modules/visual-helpers.js` contém `renderHtmlIfChanged`. O helper evita escrever novamente um HTML idêntico e é usado nas listas de aniversariantes, avisos, movimentações e nos gráficos financeiros.

A regra arquitetural é simples:

1. o módulo calcula o HTML esperado;
2. o helper compara com o último resultado aplicado ao elemento;
3. a árvore DOM e os eventos só são recriados quando o conteúdo realmente muda.

Como o helper está em um módulo visual já carregado, essa otimização não cria um novo ponto no grafo inicial.

## Cadastros

`assets/js/modules/entity-forms.js` controla abertura, submissão, persistência e exclusão.

`assets/js/modules/entity-forms/templates.js` contém os templates, campos e validações dos cadastros.

## Portões arquiteturais

- `portal-app.js` deve permanecer abaixo de 500 linhas;
- `entity-forms.js` deve permanecer abaixo de 380 linhas;
- o compositor visual e os templates precisam exportar seus contratos esperados;
- a pasta `assets/css/legacy` não pode ser recriada;
- listas de atualização frequente devem preservar a renderização incremental;
- recursos administrativos pesados não podem retornar ao grafo inicial.
